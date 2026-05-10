/**
 * Depth-aware splitter for LaTeX strings used by `equationCard reveal=stepwise`.
 *
 * Splits at top-level `\\` boundaries so the renderer can stagger reveal
 * one row at a time. Crucially, ignores `\\` that appears INSIDE
 * `\begin{…}\end{…}` environments (pmatrix, bmatrix, aligned, cases, …)
 * because those `\\` are matrix row separators — splitting there tears the
 * environment in half and KaTeX renders the broken pieces as red error
 * text. We hit this with `s_1\begin{pmatrix}1,2,3\\3,1,2\end{pmatrix}` and
 * a few other Cauchy two-line notations; the symptom in the rendered video
 * was a literal `s_1\being{pmatrix}1,2,3` floating on screen.
 *
 * If the splitter produces zero parts (no top-level `\\`), returns
 * `[latex]` so callers always get at least one fragment.
 */
export function splitLatex(latex: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let buf = '';
  let i = 0;
  while (i < latex.length) {
    if (latex.startsWith('\\begin{', i)) {
      const close = latex.indexOf('}', i + 7);
      if (close !== -1) {
        buf += latex.slice(i, close + 1);
        i = close + 1;
        depth++;
        continue;
      }
    }
    if (latex.startsWith('\\end{', i)) {
      const close = latex.indexOf('}', i + 5);
      if (close !== -1) {
        buf += latex.slice(i, close + 1);
        i = close + 1;
        depth = Math.max(0, depth - 1);
        continue;
      }
    }
    if (depth === 0 && latex.startsWith('\\\\', i)) {
      let j = i + 2;
      while (j < latex.length && /\s/.test(latex[j] ?? '')) j++;
      const trimmed = buf.trim();
      if (trimmed.length > 0) parts.push(trimmed);
      buf = '';
      i = j;
      continue;
    }
    buf += latex[i];
    i++;
  }
  const trimmed = buf.trim();
  if (trimmed.length > 0) parts.push(trimmed);
  return parts.length > 0 ? parts : [latex];
}

/**
 * Quick balance check: count `\begin{…}` vs `\end{…}` occurrences. Used by
 * QA to flag equations whose stepwise split produces broken pieces (means
 * either the source LaTeX is malformed, or — historically — a regression
 * in the splitter that tears matrix environments).
 */
export function isLatexBalanced(latex: string): boolean {
  const begins = (latex.match(/\\begin\{[^}]+\}/g) ?? []).length;
  const ends = (latex.match(/\\end\{[^}]+\}/g) ?? []).length;
  return begins === ends;
}
