import React from 'react';
import { ws } from '../ws/client';
import type { ChatToolItem } from './useChatStream';

/**
 * Specialised renderer for the `AskUserQuestion` tool call.
 *
 * The default ToolCallCard would just print the input JSON and the agent's
 * dummy result string ("Answer questions?") — and crucially the agent in
 * headless `-p` mode doesn't actually wait for an answer, so it kept going.
 *
 * This card surfaces the question(s) as an interactive picker. Clicking an
 * option:
 *   1. Records the answer locally so the buttons disable + show your pick.
 *   2. Sends the chosen label as a regular chat turn — that interrupts any
 *      in-flight agent activity (the chat store cancels the prior subprocess
 *      and starts a new turn) and feeds the answer back as the next user
 *      message, which the agent reads as the response to its question.
 *
 * For multi-select questions you can pick several options and hit "Send".
 * "Other…" is always available — picks open a text box so you can answer
 * free-form when none of the canned options fit.
 */
type Question = {
  question: string;
  header?: string;
  multiSelect?: boolean;
  options: Array<{ label: string; description?: string }>;
};

type Input = {
  questions: Question[];
};

export const AskUserQuestionCard: React.FC<{
  tool: ChatToolItem;
  /** Slug for the parent chat — required when no `onAnswer` override is given. */
  slug: string | null;
  /** Optional callback. If provided, used in place of the default `chat:turn`
   *  send (e.g. forked threads route via `thread:turn`). */
  onAnswer?: (text: string) => void;
}> = ({ tool, slug, onAnswer }) => {
  const parsed = parseInput(tool.input);
  const [answered, setAnswered] = React.useState<string | null>(null);
  const [picks, setPicks] = React.useState<Record<number, Set<number>>>({});
  const [otherText, setOtherText] = React.useState<Record<number, string>>({});

  if (!parsed) {
    return (
      <div className="askq-card askq-error">
        <div className="askq-error-text">AskUserQuestion: malformed input</div>
        <pre className="askq-error-pre">{prettyJson(tool.input)}</pre>
      </div>
    );
  }

  const send = (text: string) => {
    if (!text.trim()) return;
    setAnswered(text);
    // Server's chat store cancels any in-flight turn before starting the new
    // one — so this both interrupts the agent (which kept running past its
    // own AskUserQuestion call) and supplies the actual answer.
    if (onAnswer) {
      onAnswer(text);
    } else if (slug) {
      ws.send({ kind: 'chat:turn', slug, sessionId: null, text });
    }
  };

  const buildAnswerText = (): string => {
    const parts: string[] = [];
    const single = parsed.questions.length === 1;
    parsed.questions.forEach((q, qi) => {
      const set = picks[qi];
      const other = otherText[qi]?.trim();
      let value = '';
      if (q.multiSelect) {
        const labels = [...(set ?? [])].map((oi) => q.options[oi]?.label).filter(Boolean);
        if (other) labels.push(other);
        value = labels.join(', ');
      } else {
        const oi = set ? [...set][0] : undefined;
        const label = oi != null ? q.options[oi]?.label : undefined;
        value = (other || label) ?? '';
      }
      if (!value) return;
      // For a single-question card we send the bare value (cleaner read in
      // the chat); multi-question cards prefix each line with the header so
      // the agent can attribute answers back to its questions.
      parts.push(single ? value : `${q.header ?? q.question}: ${value}`);
    });
    return parts.join('\n');
  };

  const submit = () => {
    const text = buildAnswerText();
    if (!text) return;
    send(text);
  };

  const togglePick = (qi: number, oi: number, multi: boolean) => {
    setPicks((prev) => {
      const cur = new Set(prev[qi] ?? []);
      if (multi) {
        if (cur.has(oi)) cur.delete(oi);
        else cur.add(oi);
      } else {
        cur.clear();
        cur.add(oi);
      }
      return { ...prev, [qi]: cur };
    });
  };

  const hasAnything = buildAnswerText().length > 0;

  return (
    <div className={`askq-card ${answered ? 'is-answered' : ''}`}>
      <div className="askq-header">
        <span className="askq-icon">?</span>
        <span className="askq-title">claude is asking</span>
        {answered && <span className="askq-answered-pill">answered</span>}
      </div>
      {parsed.questions.map((q, qi) => {
        const picksForQ = picks[qi] ?? new Set<number>();
        return (
          <div className="askq-question" key={qi}>
            <div className="askq-question-text">{q.question}</div>
            <div className="askq-options">
              {q.options.map((opt, oi) => {
                const selected = picksForQ.has(oi);
                const disabled = answered != null;
                return (
                  <button
                    key={oi}
                    type="button"
                    className={`askq-option ${selected ? 'is-selected' : ''}`}
                    onClick={() => {
                      if (disabled) return;
                      togglePick(qi, oi, Boolean(q.multiSelect));
                    }}
                    disabled={disabled}
                  >
                    <div className="askq-option-label">{opt.label}</div>
                    {opt.description && (
                      <div className="askq-option-desc">{opt.description}</div>
                    )}
                  </button>
                );
              })}
              <div className="askq-other">
                <div className="askq-other-label">Other / write your own:</div>
                <textarea
                  className="askq-other-input"
                  placeholder="Type your answer…"
                  value={otherText[qi] ?? ''}
                  // Capture .value synchronously: by the time React runs the
                  // lazy setState updater the synthetic event's currentTarget
                  // can already be null (especially after a re-render flips
                  // the textarea to disabled), which crashes the component.
                  onChange={(e) => {
                    const v = e.target.value;
                    setOtherText((p) => ({ ...p, [qi]: v }));
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.key === 'Enter' &&
                      (e.metaKey || e.ctrlKey) &&
                      parsed.questions.length === 1
                    ) {
                      // Cmd/Ctrl + Enter inside the textarea submits the card.
                      e.preventDefault();
                      submit();
                    }
                  }}
                  rows={2}
                  disabled={answered != null}
                />
              </div>
            </div>
          </div>
        );
      })}
      {!answered && (
        <div className="askq-actions">
          <span className="askq-hint">
            Pick {parsed.questions.some((q) => q.multiSelect) ? 'one or more' : 'one'}, or type
            your own — then submit.
          </span>
          <button
            type="button"
            className="askq-send"
            onClick={submit}
            disabled={!hasAnything}
          >
            Submit ↵
          </button>
        </div>
      )}
      {answered && <div className="askq-your-pick">→ you answered: {answered}</div>}
    </div>
  );
};

function parseInput(raw: unknown): Input | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const qs = o['questions'];
  if (!Array.isArray(qs)) return null;
  const out: Question[] = [];
  for (const q of qs) {
    if (!q || typeof q !== 'object') return null;
    const qo = q as Record<string, unknown>;
    const question = String(qo['question'] ?? '');
    const opts = qo['options'];
    if (!question || !Array.isArray(opts)) return null;
    const options = opts.map((op) => {
      const opObj = (op ?? {}) as Record<string, unknown>;
      return {
        label: String(opObj['label'] ?? ''),
        description: opObj['description'] ? String(opObj['description']) : undefined,
      };
    });
    out.push({
      question,
      header: typeof qo['header'] === 'string' ? (qo['header'] as string) : undefined,
      multiSelect: Boolean(qo['multiSelect']),
      options,
    });
  }
  return { questions: out };
}

function prettyJson(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
