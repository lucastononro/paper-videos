import React from 'react';
import { staticFile, delayRender, continueRender } from 'remotion';
import {
  PaperExplainerCore,
  type ManifestForCore,
  type Equations,
  type AssetsIndex,
  type ManimDurations,
  type ManimLastFrames,
} from './PaperExplainerCore';

/**
 * Offline-render entry. Fetches the per-video JSONs from the bundle's
 * `staticFile()` root (set by `@remotion/bundler`'s `publicDir` option in
 * `src/tools/render-remotion.ts`) and forwards them to `PaperExplainerCore`
 * with `assetBaseUrl=""`.
 *
 * The editor's preview path bypasses this wrapper — it pre-fetches the same
 * JSONs over HTTP and mounts `<PaperExplainerCore>` directly with
 * `assetBaseUrl="/static/<slug>/"`. Both paths therefore exercise the exact
 * same render code (Core).
 */
export const PaperExplainer: React.FC<{ slug: string }> = () => {
  const [handle] = React.useState(() => delayRender('Loading manifest'));
  const [data, setData] = React.useState<{
    manifest: ManifestForCore;
    equations: Equations;
    assets: AssetsIndex;
    manimDurations: ManimDurations;
    manimLastFrames: ManimLastFrames;
  } | null>(null);

  React.useEffect(() => {
    (async () => {
      const [m, e, a, d, lf] = await Promise.all([
        fetch(staticFile('manifest.json')).then((r) => r.json()),
        fetch(staticFile('equations.json')).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(staticFile('assets-index.json')).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
        fetch(staticFile('manim-durations.json')).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
        fetch(staticFile('manim-last-frames.json')).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
      ]);
      setData({
        manifest: m as ManifestForCore,
        equations: e as Equations,
        assets: a as AssetsIndex,
        manimDurations: d as ManimDurations,
        manimLastFrames: lf as ManimLastFrames,
      });
      continueRender(handle);
    })();
  }, [handle]);

  if (!data) return null;
  // Remotion's bundler mounts the contents of `publicDir` under `/public/`
  // (or whatever staticFile() resolves to). Build the base URL by asking
  // staticFile for the empty path — it returns the prefix the bundle serves.
  // Editor preview overrides this to `/static/<slug>/` per slug.
  const base = staticFile('');
  return (
    <PaperExplainerCore
      manifest={data.manifest}
      equations={data.equations}
      assets={data.assets}
      manimDurations={data.manimDurations}
      manimLastFrames={data.manimLastFrames}
      assetBaseUrl={base}
    />
  );
};
