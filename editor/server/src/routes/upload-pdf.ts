import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { slugDir, VIDEOS_DIR } from '../paths.js';

export const uploadPdfRouter = express.Router();

/**
 * `POST /api/projects/upload-pdf`
 *
 * Accepts a raw PDF upload from the browser, derives a slug from the
 * filename, creates `videos/<slug>/paper.pdf`, and returns the slug +
 * a dispatch prompt for the chat to auto-start the pipeline.
 *
 * Body: raw bytes, `Content-Type: application/pdf`
 * Header: `X-Filename` — original filename (for slug derivation)
 * Returns: `{ slug, paperPdf, dispatchPrompt }`
 *
 * Does NOT write config.yaml or manifest.json — the chat pipeline
 * (via `fetch-paper.ts`) handles that once the auto-dispatch fires.
 */
uploadPdfRouter.post('/upload-pdf', async (req: Request, res: Response) => {
  try {
    const ct = String(req.headers['content-type'] ?? '').toLowerCase();
    if (!ct.startsWith('application/pdf')) {
      res.status(415).json({ error: 'expected Content-Type: application/pdf' });
      return;
    }

    const bytes = await readRawBody(req);
    if (!bytes || bytes.length === 0) {
      res.status(400).json({ error: 'empty body' });
      return;
    }
    if (bytes.length > 25 * 1024 * 1024) {
      res.status(413).json({ error: 'PDF exceeds 25MB limit' });
      return;
    }

    // Validate PDF magic bytes.
    const header = bytes.subarray(0, 5).toString('ascii');
    if (!header.startsWith('%PDF')) {
      res
        .status(400)
        .json({ error: 'file does not appear to be a valid PDF (missing %PDF header)' });
      return;
    }

    // Derive slug from the original filename.
    const filename = String(req.headers['x-filename'] ?? 'uploaded-paper.pdf');
    const baseName = path.basename(filename, path.extname(filename));
    let slug = baseName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    if (!slug || !/^[a-z0-9]/.test(slug)) slug = 'uploaded-paper';

    // Collision check — append -2, -3, etc.
    const origSlug = slug;
    let suffix = 1;
    while (fs.existsSync(slugDir(slug))) {
      suffix += 1;
      slug = `${origSlug}-${suffix}`;
    }

    // Create directory and write the PDF.
    const dir = slugDir(slug);
    fs.mkdirSync(dir, { recursive: true });
    const paperPdf = path.join(dir, 'paper.pdf');
    fs.writeFileSync(paperPdf, bytes);

    // The dispatch prompt tells Claude the PDF is already in place.
    // It references the local path so fetch-paper recognizes it and
    // skips the copy (same-path guard).
    const localPath = path.relative(path.resolve(VIDEOS_DIR, '..'), paperPdf);
    const dispatchPrompt =
      `The user uploaded a PDF which is now at ${localPath}. ` +
      `Run /paper-video new ${localPath} ${slug} to scaffold the project, ` +
      `then proceed with paper-extractor.`;

    res.json({ slug, paperPdf, dispatchPrompt });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[upload-pdf] failed:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
});

function readRawBody(req: Request): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > 26 * 1024 * 1024) {
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
