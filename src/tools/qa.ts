#!/usr/bin/env tsx
/**
 * qa — run deterministic QA checks against a slug's manifest + filesystem and
 * write `videos/<slug>/qa-report.json`. The agentic interpretation lives in
 * `.claude/agents/video-qa.md`, which reads this report.
 *
 * Usage: npm run qa -- <slug>
 */

import { Command } from 'commander';
import { runQa, writeQaReport } from '../lib/qa.js';

const program = new Command()
  .name('qa')
  .argument('<slug>')
  .option('--json', 'print full report to stdout', false);
program.parse();
const opts = program.opts<{ json: boolean }>();
const [slug] = program.args as [string];

const report = runQa(slug);
const out = writeQaReport(slug, report);

if (opts.json) {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(report, null, 2));
} else {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        slug,
        out,
        bySeverity: report.bySeverity,
        byKind: report.byKind,
        topIssues: report.issues.slice(0, 8).map((i) => ({
          severity: i.severity,
          kind: i.kind,
          message: i.message,
        })),
      },
      null,
      2,
    ),
  );
}

const errs = report.bySeverity.error;
process.exit(errs > 0 ? 2 : 0);
