// Browser speech: recognition (voice in) and synthesis (voice out). Both are free and built in:
// Chrome/Edge use Google's speech service, Safari uses Apple's. Nothing extra is installed.

import type { Lang } from "./locales";

// ---------------------------------------------------------------- recognition

export type RecognitionResultList = ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;

export type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: RecognitionResultList }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
type RecognitionCtor = new () => Recognition;

export function recognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** The recogniser's language: Indian English also transcribes Hinglish into Latin letters. */
export function speechLang(lang: Lang): string {
  return lang === "hi" ? "hi-IN" : "en-IN";
}

// ---------------------------------------------------------------- synthesis

const DEVANAGARI = /[ऀ-ॿ]/;

async function voices(): Promise<SpeechSynthesisVoice[]> {
  const now = speechSynthesis.getVoices();
  if (now.length) return now;
  // Chrome loads voices asynchronously.
  return new Promise((resolve) => {
    const done = () => resolve(speechSynthesis.getVoices());
    speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1200);
  });
}

function quality(v: SpeechSynthesisVoice): number {
  return /premium|enhanced|natural|neural|google/i.test(v.name) ? 1 : 0;
}

/** Hindi voice for Devanagari; Indian English for English and Hinglish (it reads Latin-script Hindi best). */
function pickVoice(all: SpeechSynthesisVoice[], text: string): SpeechSynthesisVoice | undefined {
  const order = DEVANAGARI.test(text) ? ["hi-IN", "hi"] : ["en-IN", "hi-IN", "en-GB", "en-US", "en"];
  for (const want of order) {
    const matches = all.filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith(want.toLowerCase()));
    if (matches.length) return matches.sort((a, b) => quality(b) - quality(a))[0];
  }
  return undefined;
}

/** Text as it should be heard: no links, symbols or markdown; rupee signs read out. */
export function forSpeech(text: string): string {
  const hindi = DEVANAGARI.test(text);
  return text
    .replace(/https?:\/\/\S+|www\.\S+/g, "")
    .replace(/\([^)]*\/[^)]*\)/g, "") // answer hints like "(yes / no)"
    .replace(/₹\s?([\d,.]+(?:\s?(?:lakh|crore|लाख|करोड़))?)/g, hindi ? "$1 रुपये" : "$1 rupees")
    .replace(/₹/g, hindi ? "रुपये" : "rupees")
    .replace(/[*_#`>|]|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

let generation = 0;

/** Speak text and resolve when done (or when stopped). Long text is split into sentences. */
export async function speak(text: string): Promise<void> {
  if (!canSpeak()) return;
  const mine = ++generation;
  speechSynthesis.cancel();
  const clean = forSpeech(text);
  if (!clean) return;
  const voice = pickVoice(await voices(), clean);
  const sentences = clean.match(/[^.!?।]+[.!?।]*/g) ?? [clean];
  for (const sentence of sentences) {
    if (mine !== generation) return; // stopped or replaced
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(sentence.trim());
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      } else {
        u.lang = DEVANAGARI.test(clean) ? "hi-IN" : "en-IN";
      }
      u.rate = 1;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      speechSynthesis.speak(u);
    });
  }
}

export function stopSpeaking() {
  generation++;
  if (canSpeak()) speechSynthesis.cancel();
}

/** Call inside a click handler: some browsers only allow speech that starts from a user gesture. */
export function primeSpeech() {
  if (!canSpeak()) return;
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  speechSynthesis.speak(u);
}
