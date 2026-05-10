import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import { slugDir } from '../paths.js';
import { renderStore } from '../render/store.js';

export const renderRouter = express.Router();

renderRouter.get('/:slug/render', (req: Request, res: Response) => {
  const slug = req.params['slug']!;
  if (!fs.existsSync(slugDir(slug))) {
    res.status(404).json({ error: `slug "${slug}" not found` });
    return;
  }
  res.json({ slug, ...renderStore.state(slug) });
});

renderRouter.post('/:slug/render', (req: Request, res: Response) => {
  const slug = req.params['slug']!;
  if (!fs.existsSync(slugDir(slug))) {
    res.status(404).json({ error: `slug "${slug}" not found` });
    return;
  }
  if (renderStore.isRunning(slug)) {
    res.status(409).json({ error: 'render already running', ...renderStore.state(slug) });
    return;
  }
  const ok = renderStore.start(slug);
  res.json({ slug, started: ok, ...renderStore.state(slug) });
});

renderRouter.delete('/:slug/render', (req: Request, res: Response) => {
  const slug = req.params['slug']!;
  if (!fs.existsSync(slugDir(slug))) {
    res.status(404).json({ error: `slug "${slug}" not found` });
    return;
  }
  const cancelled = renderStore.cancel(slug);
  res.json({ slug, cancelled });
});
