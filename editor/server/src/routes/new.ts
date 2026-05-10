import express, { type Request, type Response } from 'express';

export const newRouter = express.Router();

/**
 * `POST /api/projects/new` doesn't actually run the pipeline server-side.
 * It returns a *suggested* slug derived from the source so the frontend can
 * navigate to `/edit/<slug>`. The editor view's chat panel will then dispatch
 * the `/paper-video new <source>` turn through the regular WS chat flow.
 *
 * Why? Keeps the orchestrator (Claude, with the paper-video skill) in charge
 * of the long-running pipeline, surfaces tool-use cards in the chat for live
 * progress, and avoids duplicating extraction logic in the editor server.
 *
 * Body: `{ source: string }` (arxiv id, URL, or local path)
 * Returns: `{ slug: string, dispatchPrompt: string }`
 */
newRouter.post('/new', (req: Request, res: Response) => {
  const source = String((req.body as { source?: string } | undefined)?.source ?? '').trim();
  if (!source) {
    res.status(400).json({ error: 'missing source' });
    return;
  }
  const slug = slugForSource(source);
  res.json({
    slug,
    dispatchPrompt: `/paper-video new ${source} ${slug}`,
  });
});

function slugForSource(source: string): string {
  // arXiv id like 1706.03762 → "arxiv-1706-03762"
  const arxivM = source.match(/(\d{4}\.\d{4,5})/);
  if (arxivM) return `arxiv-${arxivM[1]!.replace('.', '-')}`;
  // URL: take the basename, strip extension
  const urlM = source.match(/[/]([^/]+?)(?:\.pdf)?$/i);
  if (urlM && urlM[1]) {
    return urlM[1]!
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }
  return source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'new-video';
}
