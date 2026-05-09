import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, '..', '..');

export const VIDEOS_DIR = path.join(REPO_ROOT, 'videos');
export const REFERENCES_DIR = path.join(REPO_ROOT, 'references');
export const VOICES_YAML = path.join(REFERENCES_DIR, 'usage', 'elevenlabs', 'voices.yaml');

export function videoDir(slug: string): string {
  return path.join(VIDEOS_DIR, slug);
}

export function videoFile(slug: string, ...parts: string[]): string {
  return path.join(videoDir(slug), ...parts);
}

export function ensureVideoDir(slug: string): string {
  const dir = videoDir(slug);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function ensureSubdir(slug: string, sub: string): string {
  const dir = videoFile(slug, sub);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function videoExists(slug: string): boolean {
  return fs.existsSync(videoDir(slug));
}
