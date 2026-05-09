import fs from 'node:fs';

export type CharTiming = { char: string; start: number; end: number };

export type WordTiming = { word: string; start: number; end: number };

export type SegmentTimestamps = {
  segmentId: string;
  audioDurationSeconds: number;
  words: WordTiming[];
};

/**
 * ElevenLabs returns alignment as character-level start/end times.
 * We collapse runs of non-space chars into words.
 */
export function charsToWords(chars: CharTiming[]): WordTiming[] {
  const words: WordTiming[] = [];
  let buf = '';
  let bufStart: number | null = null;
  let bufEnd = 0;

  const flush = () => {
    if (buf.length > 0 && bufStart !== null) {
      words.push({ word: buf, start: bufStart, end: bufEnd });
    }
    buf = '';
    bufStart = null;
  };

  for (const c of chars) {
    if (/\s/.test(c.char)) {
      flush();
    } else {
      if (bufStart === null) bufStart = c.start;
      buf += c.char;
      bufEnd = c.end;
    }
  }
  flush();
  return words;
}

export function audioDurationSeconds(words: WordTiming[]): number {
  if (words.length === 0) return 0;
  return words[words.length - 1]!.end;
}

export function readTimestamps(path: string): SegmentTimestamps {
  const raw = fs.readFileSync(path, 'utf8');
  return JSON.parse(raw) as SegmentTimestamps;
}

export function writeTimestamps(path: string, data: SegmentTimestamps): void {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

export function secondsToFrames(seconds: number, fps: number): number {
  return Math.ceil(seconds * fps);
}
