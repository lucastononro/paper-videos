import crypto from 'node:crypto';
import path from 'node:path';

const ARXIV_ID_RE = /^(\d{4}\.\d{4,5})(v\d+)?$/;
const ARXIV_URL_RE = /arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})(?:v\d+)?(?:\.pdf)?/i;

export type PaperSource =
  | { kind: 'arxiv'; value: string; arxivId: string }
  | { kind: 'url'; value: string }
  | { kind: 'local'; value: string };

export function classifySource(input: string): PaperSource {
  if (ARXIV_ID_RE.test(input)) {
    const id = input.replace(/v\d+$/, '');
    return { kind: 'arxiv', value: input, arxivId: id };
  }
  const m = input.match(ARXIV_URL_RE);
  if (m && m[1]) {
    return { kind: 'arxiv', value: input, arxivId: m[1] };
  }
  if (/^https?:\/\//.test(input)) {
    return { kind: 'url', value: input };
  }
  return { kind: 'local', value: input };
}

export function kebab(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function slugFromTitle(title: string): string {
  const k = kebab(title);
  return k.length > 0 ? k : `paper-${shortHash(title)}`;
}

export function slugFromSource(source: PaperSource, title?: string): string {
  if (title) return slugFromTitle(title);
  switch (source.kind) {
    case 'arxiv':
      return `arxiv-${source.arxivId.replace('.', '-')}`;
    case 'local':
      return slugFromTitle(path.basename(source.value, path.extname(source.value)));
    case 'url':
      return `url-${shortHash(source.value)}`;
  }
}

function shortHash(s: string): string {
  return crypto.createHash('sha1').update(s).digest('hex').slice(0, 8);
}
