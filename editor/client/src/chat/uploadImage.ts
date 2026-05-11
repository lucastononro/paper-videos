import type { AttachedImage } from '../ws/types';

/**
 * Upload an image to the editor server's chat-images endpoint. Returns the
 * `AttachedImage` the chat:turn frame and the directive will embed.
 *
 * Two callers:
 *   - Drag-and-drop / paste in ChatPanel — passes the raw `File | Blob`.
 *   - Player crop overlay — passes a `Blob` produced from a canvas crop.
 *
 * The server saves to `videos/<slug>/.cache/chat-images/img-<ts>-<rand>.<ext>`
 * (gitignored, watcher-ignored) and returns the absolute path the agent will
 * Read + the relative URL the React UI uses for the thumbnail.
 */
export async function uploadChatImage(
  slug: string,
  blob: Blob,
  source: 'drop' | 'paste' | 'crop',
): Promise<AttachedImage> {
  const ct = blob.type || 'image/png';
  const res = await fetch(`/api/projects/${encodeURIComponent(slug)}/chat-images`, {
    method: 'POST',
    headers: { 'Content-Type': ct },
    body: blob,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`chat-images upload failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as {
    id: string;
    path: string;
    url: string;
    bytes: number;
  };
  return {
    id: json.id,
    path: json.path,
    url: json.url,
    bytes: json.bytes,
    source,
  };
}

/** True if the given DataTransfer (drop event) has at least one image file. */
export function hasImageFiles(dt: DataTransfer | null): boolean {
  if (!dt) return false;
  for (const item of dt.items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) return true;
  }
  for (const file of dt.files) {
    if (file.type.startsWith('image/')) return true;
  }
  return false;
}

/** Extract image File objects from a DataTransfer. */
export function imageFilesFrom(dt: DataTransfer): File[] {
  const out: File[] = [];
  const seen = new Set<string>();
  for (const file of dt.files) {
    if (file.type.startsWith('image/') && !seen.has(file.name + file.size)) {
      seen.add(file.name + file.size);
      out.push(file);
    }
  }
  return out;
}
