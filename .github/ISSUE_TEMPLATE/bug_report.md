---
name: Bug report
about: Something in the pipeline produced wrong output
title: '[bug] '
labels: bug
assignees: ''
---

**Which agent broke?**
paper-extractor / critic / storyteller / asset-fetcher / producer / visualizer / Remotion render

**Paper slug**
e.g. `flow-matching` (the directory under `videos/`)

**What you ran**
The exact command, e.g. `/paper-video render flow-matching` or
`npm run render-manim -- flow-matching scene__X_.py ClassName`.

**What happened**
Concise description. Screenshots / a short clip of the output.mp4 segment if it
is a visual bug.

**What you expected**
1-2 sentences.

**Environment**

- OS + version: (e.g. macOS 14.5)
- Node: `node --version`
- Python: `python --version`
- Manim: `uv run manim --version`
- LaTeX: `latex --version | head -1` (or "TinyTeX" / "BasicTeX" / "none")

**Logs**
Paste the relevant terminal output. For Manim errors, also include the LaTeX
log path the error message points to.

**Anything else**
