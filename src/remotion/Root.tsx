import React from 'react';
import { Composition, staticFile } from 'remotion';
import { z } from 'zod';
import { PaperExplainer } from './compositions/PaperExplainer';

const Schema = z.object({
  slug: z.string().default('preview'),
});

export const Root: React.FC = () => {
  // We can't read the filesystem at compile time — defaults below match a placeholder
  // composition. The CLI tool (render-remotion) calls selectComposition() and overrides
  // durationInFrames + dimensions from the manifest at render time.
  return (
    <>
      <Composition
        id="PaperExplainer"
        component={PaperExplainer}
        schema={Schema}
        defaultProps={{ slug: 'preview' }}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        calculateMetadata={async ({ props }) => {
          // Read the manifest from the per-video public/ directory.
          // Bundler is configured to point publicDir at videos/<slug>/public.
          const res = await fetch(staticFile('manifest.json'));
          if (!res.ok) {
            // Fall back to defaults if no manifest is present (for dev/preview).
            return { props };
          }
          const manifest = (await res.json()) as {
            fps: number;
            resolution: { width: number; height: number };
            segments: Array<{ startFrame: number; durationFrames: number }>;
          };
          const last = manifest.segments[manifest.segments.length - 1];
          const total = last ? last.startFrame + last.durationFrames : 300;
          return {
            props,
            durationInFrames: total,
            fps: manifest.fps,
            width: manifest.resolution.width,
            height: manifest.resolution.height,
          };
        }}
      />
    </>
  );
};
