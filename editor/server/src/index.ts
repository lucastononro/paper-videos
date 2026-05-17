import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { REPO_ROOT, VIDEOS_DIR, slugPublicDir } from './paths.js';
import { projectsRouter } from './routes/projects.js';
import { thumbRouter } from './routes/thumb.js';
import { prepareRouter } from './routes/prepare.js';
import { newRouter } from './routes/new.js';
import { qaRouter } from './routes/qa.js';
import { filesRouter } from './routes/files.js';
import { renderRouter } from './routes/render.js';
import { chatImagesRouter } from './routes/chat-images.js';
import { attachWs } from './ws.js';
import { startWatcher } from './watch.js';

// Load repo-root .env for ELEVENLABS_API_KEY etc. (needed by tools the chat
// subprocess invokes in later phases).
const envPath = path.join(REPO_ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, '');
  }
}

const PORT = Number(process.env['EDITOR_SERVER_PORT'] ?? 5174);

const app = express();
app.use(cors());
// 25MB covers a base64-encoded 20MB chat-image upload with room for the
// data-URL wrapper. Raw image/* uploads stream in via the chat-images route
// itself, bypassing this parser.
app.use(express.json({ limit: '25mb' }));

// Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, videosDir: VIDEOS_DIR });
});

// /api/projects and /api/projects/:slug/manifest
app.use('/api/projects', projectsRouter);
// /api/projects/:slug/thumb.png
app.use('/api/projects', thumbRouter);
// /api/projects/:slug/prepare
app.use('/api/projects', prepareRouter);
// POST /api/projects/new
app.use('/api/projects', newRouter);
// /api/projects/:slug/qa-report (GET cached, POST re-runs)
app.use('/api/projects', qaRouter);
// /api/projects/:slug/files & .../file
app.use('/api/projects', filesRouter);
// /api/projects/:slug/render — POST starts, DELETE cancels, GET state
app.use('/api/projects', renderRouter);
// POST /api/projects/:slug/chat-images — drag-drop / paste / player-crop uploads
app.use('/api/projects', chatImagesRouter);

// Global error handler — catch any unhandled route error and return 500
// instead of letting the request hang indefinitely.
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    // Express requires the 4th param for error middleware even if unused.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: express.NextFunction,
  ) => {
    // eslint-disable-next-line no-console
    console.error('[editor-server] route error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  },
);

// Backwards compat for older clients still hitting /api/slugs.
app.use('/api/slugs', projectsRouter);
app.use('/api/slugs', prepareRouter);

// /static/:slug/* → videos/:slug/public/*
// Express 4 wildcards must be named, so we slice the path manually.
app.get(/^\/static\/([^/]+)\/(.+)/, (req, res) => {
  const slug = req.params[0];
  const rest = req.params[1];
  if (!slug || !rest) {
    res.status(400).end();
    return;
  }
  const pub = slugPublicDir(slug);
  const abs = path.resolve(pub, rest);
  // Path-traversal guard
  if (!abs.startsWith(pub + path.sep) && abs !== pub) {
    res.status(403).end();
    return;
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    res.status(404).end();
    return;
  }
  res.sendFile(abs);
});

const server = http.createServer(app);

// WebSocket: chat events (claude subprocess stream) + preview:reload broadcasts.
attachWs(server);

// Filesystem watcher: any change under videos/<slug>/{manifest.json, narration, manim, qa-report.json}
// debounces into a "preview:reload" broadcast over WS so open editor views
// pick up edits without a manual refresh.
startWatcher();

// Bind explicitly to IPv4 loopback. Node 20+ defaults `listen(PORT)` to dual
// stack on some platforms; Vite's proxy resolves `localhost` to `::1` first,
// so a server that bound v6-only would refuse v4 proxied requests with
// `AggregateError [ECONNREFUSED]` on every /static/* request. Pinning to
// 127.0.0.1 here, and the client-side proxy to 127.0.0.1:5174, removes the
// guesswork.
server.listen(PORT, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`[editor-server] http://127.0.0.1:${PORT}  ws://127.0.0.1:${PORT}/ws`);
  // eslint-disable-next-line no-console
  console.log(`[editor-server] serving videos from ${VIDEOS_DIR}`);

  // Startup health check — non-blocking diagnostics.
  const warnings: string[] = [];
  try {
    execSync('which claude', { stdio: 'ignore' });
  } catch {
    warnings.push('claude CLI not found on PATH — chat will fail with spawn error');
  }
  if (!process.env['ELEVENLABS_API_KEY']) {
    warnings.push('ELEVENLABS_API_KEY not set — narration will fail');
  }
  if (!fs.existsSync(VIDEOS_DIR)) {
    fs.mkdirSync(VIDEOS_DIR, { recursive: true });
    warnings.push(`created missing videos/ directory at ${VIDEOS_DIR}`);
  }
  if (warnings.length > 0) {
    for (const w of warnings) {
      // eslint-disable-next-line no-console
      console.warn(`[editor-server] ⚠ ${w}`);
    }
  }
});

// Last-line-of-defense: log + survive any unhandled rejection or
// uncaught exception. Node 20+ kills the process on unhandled rejections
// by default, which would leave the editor / proxy with a dead backend
// (the "ECONNREFUSED 127.0.0.1:5174" spam after sending a chat message).
// We log loudly so the cause is visible in the [server] lane, then keep
// serving. Real bugs still get fixed at the source; this just keeps an
// active editor session usable while we diagnose.
process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('[editor-server] unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('[editor-server] uncaughtException:', err);
});
