"use client";

import { MicOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { getDictionary } from "@/lib/i18n";
import type { Lang } from "@/lib/locales";
import { recognitionCtor, speak, speechLang, stopSpeaking, type Recognition } from "@/lib/speech";

type Phase = "listening" | "thinking" | "speaking" | "paused" | "blocked";
type Session = { active: boolean };

// Recognition ends after a few seconds of silence; restart this many times before pausing.
const MAX_SILENT_ROUNDS = 2;

/**
 * Hands-free conversation, like the voice mode of ChatGPT: listen → send → speak the reply → listen again.
 * onSend returns the assistant's reply text (or null on failure); the chat transcript updates as usual.
 */
export function VoiceMode({
  lang,
  onSend,
  onClose,
}: {
  lang: Lang;
  onSend: (text: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const t = getDictionary(lang).assistant;
  const [phase, setPhase] = useState<Phase>("speaking");
  const [heard, setHeard] = useState("");
  const [said, setSaid] = useState(t.voiceGreeting);
  // Each opening is a session; async steps from an ended session (e.g. React's dev double-run) stop quietly.
  const session = useRef<Session>({ active: false });
  const rec = useRef<Recognition | null>(null);
  const silentRounds = useRef(0);
  const sendRef = useRef(onSend);

  useEffect(() => {
    sendRef.current = onSend;
  });

  function listen(run: Session) {
    const Ctor = recognitionCtor();
    if (!Ctor || !run.active) return;
    rec.current?.abort();
    const r = new Ctor();
    r.lang = speechLang(lang);
    r.interimResults = true;
    r.continuous = false;
    let finalText = "";
    r.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      setHeard(last[0].transcript);
      if (last.isFinal) finalText = last[0].transcript;
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setPhase("blocked");
    };
    r.onend = () => {
      if (!run.active || rec.current !== r) return;
      if (finalText.trim()) {
        silentRounds.current = 0;
        void respond(finalText.trim(), run);
      } else if (silentRounds.current++ < MAX_SILENT_ROUNDS) {
        listen(run);
      } else {
        setPhase((p) => (p === "blocked" ? p : "paused"));
      }
    };
    rec.current = r;
    setHeard("");
    setPhase("listening");
    r.start();
  }

  async function respond(text: string, run: Session) {
    setPhase("thinking");
    const reply = await sendRef.current(text);
    if (!run.active) return;
    if (!reply) {
      setPhase("paused");
      return;
    }
    setSaid(reply);
    setPhase("speaking");
    await speak(reply);
    if (run.active) listen(run);
  }

  // Greet, then start listening. Speech was unlocked by the click that opened voice mode.
  useEffect(() => {
    const run: Session = { active: true };
    session.current = run;
    void speak(t.voiceGreeting).then(() => listen(run));
    return () => {
      run.active = false;
      rec.current?.abort();
      stopSpeaking();
    };
    // Runs once per opening; listen/respond read the latest props through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function tapOrb() {
    if (phase === "speaking") {
      stopSpeaking(); // interrupt; the pending speak() resolves and listening starts
    } else if (phase === "paused" || phase === "blocked") {
      silentRounds.current = 0;
      listen(session.current);
    } else if (phase === "listening") {
      rec.current?.stop(); // finish now and send what was heard
    }
  }

  const label = {
    listening: t.listeningLong,
    thinking: t.thinkingLong,
    speaking: t.speakingLong,
    paused: t.paused,
    blocked: t.micBlocked,
  }[phase];

  return (
    <div
      role="dialog"
      aria-label={t.voiceTitle}
      className="animate-fade absolute inset-0 z-20 flex flex-col items-center justify-between overflow-hidden rounded-3xl bg-ink px-6 py-6 text-white"
    >
      <div className="flex w-full items-center justify-between">
        <p className="text-sm font-semibold tracking-wide text-white/70 uppercase">{t.voiceTitle}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.endVoice}
          className="grid size-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-col items-center gap-6">
        <button
          type="button"
          onClick={tapOrb}
          aria-label={label}
          className="relative grid size-44 place-items-center rounded-full outline-offset-8 sm:size-52"
        >
          {/* Glow */}
          <span
            className={`absolute inset-0 rounded-full bg-marigold/30 blur-2xl transition-opacity duration-500 ${
              phase === "paused" || phase === "blocked" ? "opacity-20" : "animate-breathe opacity-100"
            }`}
            aria-hidden="true"
          />
          <span
            className={`relative grid size-full place-items-center rounded-full bg-gradient-to-br from-marigold via-[#f7c46c] to-brand shadow-pop transition-transform duration-300 ${
              phase === "listening" ? "animate-breathe" : phase === "thinking" ? "scale-90" : ""
            }`}
          >
            {phase === "speaking" && (
              <span className="flex h-16 items-center gap-1.5" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className="animate-eq h-full w-2.5 origin-center rounded-full bg-white/90"
                    style={{ animationDelay: `${i * 0.12}s` }}
                  />
                ))}
              </span>
            )}
            {phase === "thinking" && (
              <span className="flex gap-2" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="size-3 animate-bounce rounded-full bg-white" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </span>
            )}
            {phase === "blocked" && <MicOff className="size-12 text-white" aria-hidden="true" />}
          </span>
        </button>
        <p className="max-w-sm text-center font-semibold text-white/90" aria-live="polite">
          {label}
        </p>
      </div>

      <div className="w-full max-w-xl space-y-2 text-center">
        {heard && phase !== "speaking" && <p className="text-white/60 italic">“{heard}”</p>}
        {phase === "speaking" && <p className="line-clamp-4 text-lg leading-relaxed text-white">{said}</p>}
        <p className="text-xs text-white/50">{t.voiceHint}</p>
      </div>
    </div>
  );
}
