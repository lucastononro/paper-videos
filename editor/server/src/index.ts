import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { REPO_ROOT, VIDEOS_DIR, slugPublicDir } from './paths.js';
import { projectsRouter } from './routes/projects.js';
import { thumbRouter } from './routes/thumb.js';
import { prepareRouter } from './routes/prepare.js';
import { newRouter } from './routes/new.js';
import { qaRouter } from './routes/qa.js';
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
app.use(express.json({ limit: '1mb' }));

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

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[editor-server] http://localhost:${PORT}  ws://localhost:${PORT}/ws`);
  // eslint-disable-next-line no-console
  console.log(`[editor-server] serving videos from ${VIDEOS_DIR}`);
});
