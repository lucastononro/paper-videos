import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import { slugDir } from '../paths.js';
import { preparePreview } from '../../../../src/lib/prepare-preview.js';

export const prepareRouter = express.Router();

const inFlight = new Map<string, Promise<void>>();

prepareRouter.post('/:slug/prepare', async (req: Request, res: Response) => {
  const slug = req.params['slug']!;
  if (!fs.existsSync(slugDir(slug))) {
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
