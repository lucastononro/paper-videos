# Contributing to paper-videos

Thanks for your interest. This is an opinionated framework for turning academic
papers into 3Blue1Brown-style explainer videos via a six-agent pipeline driven
by Claude Code. Contributions that sharpen the pipeline are very welcome.

## Ground rules

1. **Read `CLAUDE.md` first.** It is the operating manual. The numbered hard
   rules there are non-negotiable — your changes must respect them.
2. **One PR = one focused change.** Bug fix, feature, doc improvement — not all
   three at once. Easier to review, easier to revert.
3. **Don't open a PR without an issue first** for non-trivial changes. We may
   say "out of scope" before you write the code.
4. **Don't commit generated artifacts.** `.gitignore` already excludes
   `manifest.json`, `manim/`, `narration/`, `output.mp4`, etc. If you find a
   generated file slipping into a diff, gitignore it.

## Local setup

```bash
git clone https://github.com/lucastononro/paper-videos.git
cd paper-videos
git submodule update --init --recursive   # pulls manim / remotion / 3b1b-videos refs
npm install
uv sync                                   # Python side, for Manim
cp .env.example .env                      # add your ELEVENLABS_API_KEY
```

For LaTeX (required by Manim's `MathTex`), install **TinyTeX** in user space:

```bash
curl -sL https://yihui.org/tinytex/install-bin-unix.sh | sh
~/Library/TinyTeX/bin/universal-darwin/tlmgr install standalone preview \
  dvisvgm xcolor amsmath amsfonts physics mathtools wasysym jknapltx \
  fontspec babel-english
```

## Running the pipeline

```bash
# Scaffold a new video and extract the paper
/paper-video new 2210.02747

# Run the full pipeline → output.mp4
/paper-video render flow-matching
```

See `CLAUDE.md` § "How to invoke /paper-video" for all subcommands.

## Code style

- TypeScript strict mode. Run `npm run typecheck` before pushing.
- Prefer editing existing files over creating new ones.
- No comments unless the WHY is non-obvious. Code that needs a long comment
  probably needs a clearer name instead.
- No emoji in code or commit messages unless the user explicitly asks.

## Pull request checklist

- [ ] `npm run typecheck` passes locally.
- [ ] No new files in `videos/<slug>/` unless they are source artifacts
      (`paper.pdf`, `config.yaml`, `script.md`, `brief.json`, `images/`,
      `diagrams/`).
- [ ] If you changed an agent's behavior, the agent doc in `.claude/agents/*.md`
      is updated to match.
- [ ] If you fixed a bug, the lesson is added either to
      `references/usage/visualization/best-practices.md` (failure-modes table)
      or to a CLAUDE.md hard rule.
- [ ] Commit message describes the _why_ in the body, not just the _what_.

## Reporting bugs

Use the bug report template at
[.github/ISSUE_TEMPLATE/bug_report.md](.github/ISSUE_TEMPLATE/bug_report.md).
Include: paper slug, the agent that broke, exact error message, and (if
relevant) the offending Manim scene file.

## Security

Don't open public issues for security concerns. See [SECURITY.md](SECURITY.md).
