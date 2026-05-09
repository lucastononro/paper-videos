## Summary
<!-- One paragraph: what changes, and why. Link the issue this fixes. -->

## What changed
<!-- A bullet list of the concrete changes. -->

## How to verify
<!-- Steps a reviewer can take to confirm the fix works. -->

## Checklist
- [ ] `npm run typecheck` passes
- [ ] No new generated artifacts committed (manifest.json, manim/, narration/, output.mp4)
- [ ] If an agent's behavior changed, its `.claude/agents/<name>.md` is updated
- [ ] If a bug is fixed, a lesson is added to `references/usage/visualization/best-practices.md` § "Common failure modes" OR a CLAUDE.md hard rule
- [ ] Commit message explains the *why*

## Out of scope
<!-- Anything related you deliberately did NOT change in this PR. -->
