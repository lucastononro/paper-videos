import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { slugDir } from '../paths.js';
import { preparePreview } from '../../../../src/lib/prepare-preview.js';

export const prepareRouter = express.Router();

const inFlight = new Map<string, Promise<void>>();

prepareRouter.post('/:slug/prepare', async (req: Request, res: Response) => {
  const slug = req.params['slug']!;
  const dir = slugDir(slug);
  // Both the directory AND manifest.json must exist. A PDF upload creates the
  // directory (with paper.pdf inside) before the pipeline writes manifest.json;
  // treating that as "not found" lets the EditorPage enter draft mode correctly.
  if (!fs.existsSync(dir) || !fs.existsSync(path.join(dir, 'manifest.json'))) {
    res.status(404).json({ error: `slug "${slug}" not found` });
    return;
  }
  // Coalesce concurrent prepare requests for the same slug.
  let pending = inFlight.get(slug);
  if (!pending) {
    pending = (async () => {
      preparePreview(slug);
    })().finally(() => inFlight.delete(slug));
    inFlight.set(slug, pending);
  }
  try {
    await pending;
    res.json({ ok: true, slug });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
