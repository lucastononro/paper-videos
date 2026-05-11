# Remotion usage notes

Read this first. Full upstream is at `references/raw-packages/remotion/`.

## Mental model

- A composition has `fps`, `durationInFrames`, `width`, `height`. Every visual is positioned by _frame_.
- `<Sequence from={N} durationInFrames={D}>` places its children at frame N for D frames.
- `<Audio src={...}>` plays an audio track. Multiple `<Audio>`s mix automatically.
- `<OffthreadVideo src={...}>` plays a video; the audio of the video plays with it (we mute Manim mp4s).
- `staticFile('foo')` resolves to the bundled `public/` directory. Our renderer points `publicDir` at `videos/<slug>/public/` so each per-video build sees its own assets.

## Frame math

```
frames = ceil(seconds × fps)
```

Always derive from word timestamps. Never hand-pick.

## Audio sync canonical pattern

See `audio-sync-pattern.tsx` in this folder. The core idea: each segment is one `<Sequence>` whose `durationInFrames` matches the segment's audio length, with `<Audio>` and the segment's visual + caption layer inside.

## Where things live in our repo

| File                                           | Purpose                                                                                                                           |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `src/remotion/Root.tsx`                        | Composition registration                                                                                                          |
| `src/remotion/compositions/PaperExplainer.tsx` | The single composition we render                                                                                                  |
| `src/remotion/components/*.tsx`                | Reusable visual components — `PaperPage`, `EquationCard`, `ManimClip`, `HighlightedQuote`, `TitleCard`, `Narration`, `CaptionBar` |
| `src/tools/render-remotion.ts`                 | Headless renderer (`bundle()` + `renderMedia()`)                                                                                  |

## Don't

- Don't fetch from external URLs at render time other than the KaTeX CDN already wired in `EquationCard.tsx`.
- Don't use `<Video>` for Manim mp4s — use `<OffthreadVideo>` (we already do).
- Don't add new visual kinds without updating both `src/lib/manifest.ts` (zod schema) AND `PaperExplainer.tsx` (dispatch).

## Validate your edits

Before rendering, run `npm run typecheck`. The composition is fragile — a missing prop or wrong key kills the whole render.
