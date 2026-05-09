import fs from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { VOICES_YAML } from './paths.js';

const VoiceSettings = z.object({
  voice_id: z.string(),
  model_id: z.string().default('eleven_multilingual_v2'),
  stability: z.number().min(0).max(1).default(0.5),
  similarity_boost: z.number().min(0).max(1).default(0.75),
  style: z.number().min(0).max(1).default(0.15),
  use_speaker_boost: z.boolean().default(true),
  output_format: z.string().default('mp3_44100_128'),
});

const VoicesFile = z.object({
  default_voice: z.string(),
  voices: z.record(z.string(), VoiceSettings),
});

export type VoiceSettings = z.infer<typeof VoiceSettings>;

export function loadVoices(): z.infer<typeof VoicesFile> {
  if (!fs.existsSync(VOICES_YAML)) {
    throw new Error(`Voices catalog not found: ${VOICES_YAML}`);
  }
  const raw = parseYaml(fs.readFileSync(VOICES_YAML, 'utf8'));
  return VoicesFile.parse(raw);
}

export function resolveVoice(alias: string): VoiceSettings {
  const cat = loadVoices();
  const aliasOrDefault = alias && alias.length > 0 ? alias : cat.default_voice;
  const voice = cat.voices[aliasOrDefault];
  if (!voice) {
    throw new Error(
      `Voice alias "${aliasOrDefault}" not found in ${VOICES_YAML}. Available: ${Object.keys(
        cat.voices,
      ).join(', ')}`,
    );
  }
  if (!voice.voice_id || voice.voice_id.startsWith('<')) {
    throw new Error(
      `Voice "${aliasOrDefault}" has no voice_id set. Edit ${VOICES_YAML} and paste a voice id from https://elevenlabs.io/app/voice-library`,
    );
  }
  return voice;
}
