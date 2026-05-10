// Shared types between editor server and client. Keep in sync with
// editor/server/src/routes/projects.ts.

export type ProjectSummary = {
  slug: string;
  paperTitle: string;
  fps: number;
  resolution: { width: number; height: number };
  totalFrames: number;
  totalSeconds: number;
  voiceBeats: number;
  visualBlocks: number;
  hasOutputMp4: boolean;
  lastModified: number;
  /** True when a chat turn or async thread is currently running for this slug. */
  inFlight: boolean;
};

type BBox = { x: number; y: number; w: number; h: number };

export type Visual =
  | { kind: 'titleCard'; text: string; subtitle?: string }
  | { kind: 'paperPage'; pageIdx: number; focus: 'top' | 'center' | 'bottom' | 'all'; highlightBBox?: BBox }
  | { kind: 'highlightedQuote'; pageIdx: number; text: string; bbox?: BBox }
  | { kind: 'equationCard'; equationId: string; reveal: 'stepwise' | 'all' }
  | { kind: 'equationStep'; equationId: string; step: number }
  | { kind: 'image'; assetId: string }
  | { kind: 'diagram'; assetId: string }
  | { kind: 'manimClip'; sceneFile: string; mp4: string; clipDurationFrames?: number }
  | { kind: 'pause' };

export type VoiceBeat = {
  id: string;
  startFrame: number;
  durationFrames: number;
  audioFile: string | null;
  timestampsFile: string | null;
  text?: string;
};

export type VisualBlock = {
  id: string;
  startFrame: number;
  durationFrames: number;
  description: string;
  visual: Visual;
};

export type Manifest = {
  slug: string;
  paperTitle: string;
  fps: number;
  resolution: { width: number; height: number };
  voice: VoiceBeat[];
  visualBlocks: VisualBlock[];
  totalFrames: number;
  /** Render the bottom CaptionBar over the video. Default false (opt-in per video). */
  captions?: boolean;
};

export type Equations = Array<{
  id: string;
  latex: string;
  display: 'inline' | 'block';
  context: string;
}>;

export type AssetsIndex = Record<string, { kind: 'image' | 'diagram'; file: string }>;
export type ManimDurations = Record<string, number>;
export type ManimLastFrames = Record<string, string>;

export type FullPreviewData = {
  manifest: Manifest;
  equations: Equations;
  assets: AssetsIndex;
  manimDurations: ManimDurations;
  manimLastFrames: ManimLastFrames;
};

export async function fetchProjects(): Promise<ProjectSummary[]> {
  const res = await fetch('/api/projects');
  if (!res.ok) throw new Error(`GET /api/projects failed: ${res.status}`);
  const json = (await res.json()) as { projects: ProjectSummary[] };
  return json.projects;
}

export async function fetchManifest(slug: string): Promise<Manifest> {
  const res = await fetch(`/api/projects/${encodeURIComponent(slug)}/manifest`);
  if (!res.ok) throw new Error(`GET manifest failed: ${res.status}`);
  return (await res.json()) as Manifest;
}

/**
 * `exists: false` means the slug folder isn't there yet — that's the normal
 * state for a brand-new slug the user just picked from the gallery. The
 * editor treats it as "draft mode" (chat-only, no canvas) without surfacing
 * an error.
 */
export async function preparePreview(slug: string): Promise<{ exists: boolean }> {
  const res = await fetch(`/api/projects/${encodeURIComponent(slug)}/prepare`, { method: 'POST' });
  if (res.status === 404) return { exists: false };
  if (!res.ok) throw new Error(`POST prepare failed: ${res.status}`);
  return { exists: true };
}

/**
 * Pre-fetch the five JSONs the composition needs from the editor server's
 * static endpoint. Returns everything the Player needs to render the
 * `PaperExplainerCore` component directly — no `staticFile()` indirection.
 */
export async function fetchPreviewData(slug: string): Promise<FullPreviewData> {
  const baseUrl = `/static/${encodeURIComponent(slug)}/`;
  // The `silent: true` form swallows 404s — these JSON sidecars are optional
  // for a freshly-scaffolded project (no equations/assets/manim yet).
  const get = async <T>(file: string, fallback: T, silent = false): Promise<T> => {
    try {
      const r = await fetch(baseUrl + file);
      if (!r.ok) {
        if (!silent && r.status !== 404) {
          // eslint-disable-next-line no-console
          console.warn(`[preview] ${file}: ${r.status}`);
        }
        return fallback;
      }
      return (await r.json()) as T;
    } catch {
      return fallback;
    }
  };
  const [manifest, equations, assets, manimDurations, manimLastFrames] = await Promise.all([
    get<Manifest>('manifest.json', {} as Manifest),
    get<Equations>('equations.json', [], true),
    get<AssetsIndex>('assets-index.json', {}, true),
    get<ManimDurations>('manim-durations.json', {}, true),
    get<ManimLastFrames>('manim-last-frames.json', {}, true),
  ]);
  if (!manifest.slug) {
    throw new Error(
      `Manifest at ${baseUrl}manifest.json was empty or missing — POST /prepare first.`,
    );
  }
  // The static `manifest.json` is the v2-migrated form on disk; it doesn't
  // carry the computed `totalFrames`. Compute it from the voice timeline so
  // the Player gets a finite number even when the manifest is freshly
  // scaffolded with empty arrays.
  const totalFrames = computeTotalFrames(manifest);
  return {
    manifest: { ...manifest, totalFrames },
    equations,
    assets,
    manimDurations,
    manimLastFrames,
  };
}

function computeTotalFrames(m: Manifest): number {
  const tracks = m.voice && m.voice.length > 0 ? m.voice : [];
  if (tracks.length === 0) return 0;
  const last = tracks[tracks.length - 1]!;
  return last.startFrame + last.durationFrames;
}

export function thumbUrl(slug: string): string {
  return `/api/projects/${encodeURIComponent(slug)}/thumb.png`;
}

export type FileEntry = {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  mtime: number;
  mime: string | null;
};

export async function listFiles(slug: string, dirPath: string): Promise<FileEntry[]> {
  const url = `/api/projects/${encodeURIComponent(slug)}/files?path=${encodeURIComponent(dirPath)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET files failed: ${res.status}`);
  const json = (await res.json()) as { entries: FileEntry[] };
  return json.entries;
}

export function fileUrl(slug: string, filePath: string): string {
  return `/api/projects/${encodeURIComponent(slug)}/file?path=${encodeURIComponent(filePath)}`;
}

export function staticAssetBaseUrl(slug: string): string {
  return `/static/${encodeURIComponent(slug)}/`;
}

/**
 * Render the slug to output.mp4 via the button-driven `render-remotion` flow.
 * Server returns 409 if a render is already in progress for this slug.
 */
export async function startRender(slug: string): Promise<{ started: boolean; running: boolean }> {
  const res = await fetch(`/api/projects/${encodeURIComponent(slug)}/render`, { method: 'POST' });
  if (res.status === 409) {
    return { started: false, running: true };
  }
  if (!res.ok) throw new Error(`POST render failed: ${res.status}`);
  const j = (await res.json()) as { started: boolean; running: boolean };
  return j;
}

export async function cancelRender(slug: string): Promise<void> {
  const res = await fetch(`/api/projects/${encodeURIComponent(slug)}/render`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE render failed: ${res.status}`);
}

export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds - m * 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatRelativeTime(ms: number): string {
  if (!ms) return '';
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
