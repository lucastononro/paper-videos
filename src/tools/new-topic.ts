#!/usr/bin/env tsx
/**
 * new-topic — scaffold a topic-mode (no-paper) educational explainer video.
 *
 * Paper-mode videos start from a PDF, run Marker, render pages. Topic-mode
 * videos start from a free-form prompt ("Galois theory", "explain
 * backpropagation"), have no paper artifacts at scaffold time, and let the
 * critic do its own web research. The critic can later opportunistically
 * decide to pull a canonical paper (e.g. Rumelhart-Hinton 1986 for backprop)
 * mid-pipeline — that's a paper-extractor invocation from inside the critic's
 * agent, not from here.
 *
 * Usage:
 *   npm run new-topic -- "<topic prompt>" [slug]
 *
 * Examples:
 *   npm run new-topic -- "Galois theory in 10 minutes"
 *   npm run new-topic -- "explain backpropagation" backprop-explainer
 */

import { Command } from 'commander';
import fs from 'node:fs';
import { stringify as yamlStringify } from 'yaml';
import { slugFromTitle } from '../lib/slug.js';
import { ensureVideoDir, videoFile } from '../lib/paths.js';
import { defaultManifest, manifestExists, writeManifest } from '../lib/manifest.js';

const program = new Command()
  .name('new-topic')
  .description('Scaffold a topic-mode educational explainer video (no paper PDF)')
  .argument('<topic>', 'free-form topic prompt, e.g. "Galois theory" or "explain backpropagation"')
  .argument('[slug]', 'optional slug (derived from the topic if omitted)')
  .option('--force', 'overwrite existing topic.md / config.yaml', false)
  .option('--voice <alias>', 'voice alias for the default manifest', 'pharaoh')
  .option('--captions', 'render bottom captions over the video (default off)', false)
  .option(
    '--target-minutes <n>',
    'target video length in minutes (the critic uses this when planning acts)',
    (v) => Number.parseInt(v, 10),
    12,
  );

program.parse();
const opts = program.opts<{
  force: boolean;
  voice: string;
  captions: boolean;
  targetMinutes: number;
}>();
const [topic, slugArg] = program.args as [string, string | undefined];

if (!topic || topic.trim().length === 0) {
  console.error('new-topic: <topic> is required');
  process.exit(1);
}

const slug = slugArg ?? slugFromTitle(topic);

ensureVideoDir(slug);
writeTopicMd(slug, topic, opts.force);
writeConfigYaml(slug, topic, opts.voice, opts.captions, opts.targetMinutes, opts.force);

if (!manifestExists(slug)) {
  writeManifest(slug, defaultManifest({
    slug,
    paperSource: { kind: 'topic', value: topic },
    paperTitle: topic,
    voiceAlias: opts.voice,
    captions: opts.captions,
  }));
}

console.log(JSON.stringify({ slug, mode: 'topic', topic }, null, 2));

// ---------------------------------------------------------------------------

function writeTopicMd(slug: string, topic: string, force: boolean): void {
  const target = videoFile(slug, 'topic.md');
  if (fs.existsSync(target) && !force) {
    console.log(`topic.md already exists for slug "${slug}". Use --force to overwrite.`);
    return;
  }
  const body =
    `# Topic\n\n` +
    `${topic.trim()}\n\n` +
    `---\n\n` +
    `## Notes for the critic\n\n` +
    `This is a topic-mode video. There is no paper. Do your own research via WebSearch / WebFetch.\n` +
    `If you find a canonical paper (or a small handful) that would strengthen the explanation, ` +
    `propose pulling it in via paper-extractor. Otherwise, the brief lives entirely on your research notes.\n`;
  fs.writeFileSync(target, body);
}

function writeConfigYaml(
  slug: string,
  topic: string,
  voice: string,
  captions: boolean,
  targetMinutes: number,
  force: boolean,
): void {
  const cfgPath = videoFile(slug, 'config.yaml');
  if (fs.existsSync(cfgPath) && !force) return;
  const cfg = {
    slug,
    // Topic-mode marker. The critic / storyteller branch on this.
    mode: 'topic' as const,
    topicPrompt: topic,
    paperSource: { kind: 'topic' as const, value: topic },
    paperTitle: topic,
    voice,
    captions,
    targetLengthMinutes: targetMinutes,
    focusAreas: [] as string[],
    resolution: { width: 1920, height: 1080 },
    fps: 30,
  };
  fs.writeFileSync(cfgPath, yamlStringify(cfg));
}
