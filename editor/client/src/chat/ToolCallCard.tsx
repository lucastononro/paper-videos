import React from 'react';
import type { ChatToolItem } from './useChatStream';

const TOOL_ICON: Record<string, string> = {
  Read: '▶',
  Write: '✎',
  Edit: '✂',
  Bash: '$',
  Grep: '⌕',
  Glob: '✱',
  WebFetch: '⇩',
  WebSearch: '⌕',
  Task: '→',
  TodoWrite: '☑',
  Skill: '↻',
};

export const ToolCallCard: React.FC<{ tool: ChatToolItem }> = ({ tool }) => {
  const [expanded, setExpanded] = React.useState(false);
  const icon = TOOL_ICON[tool.name] ?? '⚙';
  const summary = summarizeInput(tool.name, tool.input);
  const stateClass =
    tool.status === 'running' ? 'is-running' : tool.status === 'error' ? 'is-error' : '';

  return (
    <div className={`tool-card ${stateClass}`} data-tool={tool.name}>
      <button
        type="button"
        className="tool-card-header"
        onClick={() => setExpanded((o) => !o)}
        aria-expanded={expanded}
      >
        <span className={`tool-card-chevron ${expanded ? 'expanded' : ''}`}>▸</span>
        <span className="tool-card-icon">{icon}</span>
        <span className="tool-card-name">{tool.name}</span>
        {summary && <span className="tool-card-summary">{summary}</span>}
        <span className="tool-card-status">
          {tool.status === 'running' ? (
            <span className="tool-card-spinner" />
          ) : tool.status === 'error' ? (
            <span className="tool-card-warn">⚠</span>
          ) : (
            <span className="tool-card-check">✓</span>
          )}
        </span>
      </button>
      {expanded && (
        <div className="tool-card-body">
          <div className="tool-card-section">
            <div className="tool-card-section-label">Input</div>
            <pre className="tool-card-pre">{prettyJson(tool.input)}</pre>
          </div>
          {tool.result !== null && (
            <div className="tool-card-section">
              <div className="tool-card-section-label">Result</div>
              <pre className={`tool-card-pre ${tool.status === 'error' ? 'is-error' : ''}`}>
                {tool.result.length > 6000
                  ? `${tool.result.slice(0, 6000)}\n…(truncated)`
                  : tool.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function summarizeInput(name: string, input: unknown): string {
  if (input == null || typeof input !== 'object') return '';
  const o = input as Record<string, unknown>;
  switch (name) {
    case 'Bash':
      return short(String(o['command'] ?? ''), 64);
    case 'Read':
    case 'Write':
    case 'Edit':
      return tail(String(o['file_path'] ?? ''));
    case 'Grep':
      return short(`/${o['pattern'] ?? ''}/${o['path'] ? ' ' + o['path'] : ''}`, 64);
    case 'Glob':
      return String(o['pattern'] ?? '');
    case 'WebFetch':
      return short(String(o['url'] ?? ''), 60);
    case 'WebSearch':
      return short(String(o['query'] ?? ''), 60);
    case 'Task':
      return short(String(o['description'] ?? o['prompt'] ?? ''), 64);
    case 'Skill':
      return String(o['skill'] ?? '');
    case 'TodoWrite':
      return `${(o['todos'] as unknown[] | undefined)?.length ?? 0} tasks`;
    default: {
      const first = Object.values(o).find((v) => typeof v === 'string') as string | undefined;
      return first ? short(first, 64) : '';
    }
  }
}

function short(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
function tail(p: string): string {
  return p.split('/').slice(-2).join('/');
}
function prettyJson(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
