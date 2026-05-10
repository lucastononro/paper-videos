import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// editor/server/src/ → editor/server/ → editor/ → repo root
export const REPO_ROOT = path.resolve(here, '..', '..', '..');
export const VIDEOS_DIR = path.join(REPO_ROOT, 'videos');

export function slugDir(slug: string): string {
  return path.join(VIDEOS_DIR, slug);
}

export function slugPublicDir(slug: string): string {
  return path.join(slugDir(slug), 'public');
}
