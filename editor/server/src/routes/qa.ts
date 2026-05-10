import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import { slugDir } from '../paths.js';
import { runQa, writeQaReport, readQaReport } from '../../../../src/lib/qa.js';

export const qaRouter = express.Router();

qaRouter.get('/:slug/qa-report', (req: Request, res: Response) => {
  const slug = req.params['slug']!;
  if (!fs.existsSync(slugDir(slug))) {
    res.status(404).json({ error: `slug "${slug}" not found` });
    return;
  }
  const cached = readQaReport(slug);
  if (!cached) {
    res.json({ slug, issues: [], bySeverity: { error: 0, warning: 0, info: 0 }, byKind: {}, generatedAt: null });
    return;
  }
  res.json(cached);
});

qaRouter.post('/:slug/qa-report', (req: Request, res: Response) => {
  const slug = req.params['slug']!;
  if (!fs.existsSync(slugDir(slug))) {
    res.status(404).json({ error: `slug "${slug}" not found` });
    return;
  }
  try {
    const report = runQa(slug);
    writeQaReport(slug, report);
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
