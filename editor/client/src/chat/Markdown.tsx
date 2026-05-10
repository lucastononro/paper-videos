import React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Renders Markdown the way the chat expects it:
 *  - GitHub-flavored (tables, task lists, strikethrough, autolinks).
 *  - Inline code + fenced code blocks styled to match the editor palette.
 *  - Mention tokens (`#beat-005`, `#vb-003`, `[selection 00:14→00:23]`) get
 *    wrapped in coloured spans so they look like the BeatStrip's chip badges.
 *
 * The mention substitution runs inside a custom `text` component so it
 * applies in paragraphs, list items, blockquotes — everywhere markdown
 * would put plain text.
 */
const MENTION_RE = /(#(?:beat|vb)-\d{3,}|\[selection \d{2}:\d{2}→\d{2}:\d{2}\])/g;

function withMentionChips(value: string): React.ReactNode {
  if (!value.match(MENTION_RE)) return value;
  const parts = value.split(MENTION_RE);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      const isRange = part.startsWith('[');
      return (
        <span key={i} className={`md-mention ${isRange ? 'is-range' : 'is-id'}`}>
          {part}
        </span>
      );
    }
    return part;
  });
}

const components: Components = {
  // Intercept text leaves so we can render mention chips inline.
  // react-markdown 10 invokes this for every text node.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  text: ({ children }: any) => {
    if (typeof children === 'string') return <>{withMentionChips(children)}</>;
    return <>{children}</>;
  },
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="md-link">
      {children}
    </a>
  ),
  code: ({ className, children, ...props }) => {
    // Inline code (no language class) vs fenced code blocks.
    const isInline = !className;
    if (isInline) {
      return (
        <code className="md-code-inline" {...props}>
          {children}
        </code>
      );
    }
    const lang = (className ?? '').replace('language-', '');
    return (
      <code className={`md-code-block language-${lang}`} {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => <pre className="md-pre">{children}</pre>,
  ul: ({ children }) => <ul className="md-ul">{children}</ul>,
  ol: ({ children }) => <ol className="md-ol">{children}</ol>,
  li: ({ children }) => <li className="md-li">{children}</li>,
  blockquote: ({ children }) => <blockquote className="md-blockquote">{children}</blockquote>,
  table: ({ children }) => (
    <div className="md-table-wrap">
      <table className="md-table">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="md-th">{children}</th>,
  td: ({ children }) => <td className="md-td">{children}</td>,
  h1: ({ children }) => <h3 className="md-h md-h1">{children}</h3>,
  h2: ({ children }) => <h3 className="md-h md-h2">{children}</h3>,
  h3: ({ children }) => <h3 className="md-h md-h3">{children}</h3>,
  h4: ({ children }) => <h4 className="md-h md-h4">{children}</h4>,
  hr: () => <hr className="md-hr" />,
  p: ({ children }) => <p className="md-p">{children}</p>,
};

export const Markdown: React.FC<{ source: string; className?: string }> = ({
  source,
  className,
}) => {
  return (
    <div className={`markdown ${className ?? ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
};
