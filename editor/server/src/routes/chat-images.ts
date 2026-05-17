import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { slugDir } from '../paths.js';

export const chatImagesRouter = express.Router();

/**
 * Image attachments for the chat.
 *
 * `POST /api/projects/:slug/chat-images`
 *
 * Two body shapes are accepted:
 *   1. Raw bytes — `Content-Type: image/png|image/jpeg|image/webp`. The
 *      client's drag-and-drop / paste handlers send these directly via a
 *      Blob upload.
 *   2. JSON — `Content-Type: application/json`, body `{ dataUrl: "data:image/..;base64,.." }`.
 *      The player-crop path produces these (OffscreenCanvas → toDataURL).
 *
 * Returns `{ id, path, url, bytes }`:
 *   - `path` is the absolute filesystem path. The chat directive embeds it
 *     verbatim so the spawned `claude` can Read the image — that's how the
 *     agent "sees" what the user dropped.
 *   - `url` is the editor-server URL the React UI uses to render the thumb,
 *     hitting the existing `/api/projects/:slug/file?path=...` endpoint.
 *
 * Storage lands under `videos/<slug>/.cache/chat-images/` so the watcher's
 * dotfile filter and `.gitignore`'s `.cache/` rule both apply automatically.
 * Filenames are `img-<ts>-<rand6>.<ext>` to dedupe across rapid uploads.
 */
chatImagesRouter.post('/:slug/chat-images', async (req: Request, res: Response) => {
  try {
    const slug = req.params['slug']!;
    const root = slugDir(slug);
    if (!fs.existsSync(root)) {
      res.status(404).json({ error: `slug "${slug}" not found` });
      return;
    }
    const dir = path.join(root, '.cache', 'chat-images');
    fs.mkdirSync(dir, { recursive: true });

    const ct = String(req.headers['content-type'] ?? '').toLowerCase();

    let bytes: Buffer | null = null;
    let ext: 'png' | 'jpg' | 'webp' = 'png';
    // Crop-to-chat metadata travels with the JSON body. Drag-drop / paste
    // paths use raw image/* and don't have any metadata to carry.
    let cropMetadata: Record<string, unknown> | undefined;

    if (ct.startsWith('image/')) {
      bytes = await readRawBody(req);
      ext = pickExt(ct);
    } else if (ct.startsWith('application/json')) {
      // Body is `{ dataUrl, metadata? }`. express.json was applied upstream
      // so req.body is parsed.
      const body = req.body as { dataUrl?: unknown; metadata?: unknown } | undefined;
      const dataUrl = typeof body?.dataUrl === 'string' ? body.dataUrl : '';
      const m = dataUrl.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/i);
      if (!m) {
        res
          .status(400)
          .json({ error: 'expected JSON body { dataUrl: "data:image/...;base64,..." }' });
        return;
      }
      ext = pickExt(m[1]!.toLowerCase());
      bytes = Buffer.from(m[3]!, 'base64');
      if (body?.metadata && typeof body.metadata === 'object') {
        cropMetadata = body.metadata as Record<string, unknown>;
      }
    } else {
      res.status(415).json({
        error: 'unsupported content-type; expected image/* or application/json {dataUrl}',
      });
      return;
    }

    if (!bytes || bytes.length === 0) {
      res.status(400).json({ error: 'empty body' });
      return;
    }
    if (bytes.length > 20 * 1024 * 1024) {
      res.status(413).json({ error: 'image > 20MB' });
      return;
    }

    const id = `img-${Date.now()}-${randomBytes(3).toString('hex')}`;
    const filename = `${id}.${ext}`;
    const abs = path.join(dir, filename);
    fs.writeFileSync(abs, bytes);

    // Path the agent will see when it Reads the image. Use a path RELATIVE TO
    // the repo root so it's consistent across machines (claude's cwd is repo
    // root — see editor/server/src/chat/spawn.ts) and shorter to reason about.
    const relFromVideosRoot = path.relative(slugDir(slug), abs);
    const url = `/api/projects/${encodeURIComponent(slug)}/file?path=${encodeURIComponent(relFromVideosRoot)}`;

    res.json({
      id,
      path: abs,
      relPath: relFromVideosRoot,
      url,
      bytes: bytes.length,
      contentType: ct.startsWith('image/') ? ct : `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      ...(cropMetadata ? { crop: cropMetadata } : {}),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[chat-images] upload failed:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
});

function pickExt(mime: string): 'png' | 'jpg' | 'webp' {
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  return 'png';
}

function readRawBody(req: Request): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > 22 * 1024 * 1024) {
        req.destroy();
        reject(new Error('body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
