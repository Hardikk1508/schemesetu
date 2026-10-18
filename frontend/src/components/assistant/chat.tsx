"use client";

import { ArrowRight, AudioLines, Check, Mic, MicOff, RotateCcw, SendHorizontal, Sparkles, Square, Volume2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";

import { LiveProgress } from "@/components/checker/side-panels";
import { LogoMark } from "@/components/logo";
import { useMe } from "@/lib/account";
import { EMPTY_ANSWERS, cleanProfile, loadSaved, persistAnswers, type Answers } from "@/lib/answers";
import { checkEligibility, sendChat } from "@/lib/api";
import { getDictionary, pick } from "@/lib/i18n";
import type { Lang } from "@/lib/locales";
import {
  canSpeak,
  primeSpeech,
  recognitionCtor,
  speak,
  speechLang,
  stopSpeaking,
  type Recognition,
} from "@/lib/speech";
import type { ChatResponse, ChatStatus, EligibilityResponse, FieldMeta } from "@/lib/types";

import { VoiceMode } from "./voice-mode";

type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
  understood?: ChatResponse["understood"];
  decided?: ChatResponse["decided"];
  schemes?: string[];
  error?: boolean;
};

const CHAT_KEY = "schemesetu.chat.v1";

function loadChat(): { messages: Message[]; pending: string | null } | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(CHAT_KEY) ?? "null");
    if (v && Array.isArray(v.messages)) return { messages: v.messages, pending: v.pending ?? null };
  } catch {}
  return null;
}

function saveChat(messages: Message[], pending: string | null) {
  try {
    if (messages.length) sessionStorage.setItem(CHAT_KEY, JSON.stringify({ messages: messages.slice(-40), pending }));
    else sessionStorage.removeItem(CHAT_KEY);
  } catch {}
}

const noSubscribe = () => () => {};

// ---------------------------------------------------------------- component

/** initialMessage: sent automatically once, e.g. typed on the home page (?q=). */
type Props = { lang: Lang; fields: FieldMeta[]; initial: EligibilityResponse; status: ChatStatus; initialMessage?: string };

export function ChatAssistant({ lang, fields, initial, status, initialMessage }: Props) {
  const t = getDictionary(lang);
  const ta = t.assistant;
  const me = useMe();
  const meta = useMemo(() => new Map(fields.map((f) => [f.field, f])), [fields]);
  const order = useMemo(() => initial.results.map((r) => r.scheme_id), [initial]);
  const names = useMemo(() => new Map(initial.results.map((r) => [r.scheme_id, r])), [initial]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [pendingField, setPendingField] = useState<string | null>(null);
  const [result, setResult] = useState<EligibilityResponse>(initial);
  const [aiMode, setAiMode] = useState(status);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [ready, setReady] = useState(false); // saved conversation (if any) restored
  const sentInitial = useRef(false);
  const canListen = useSyncExternalStore(noSubscribe, () => !!recognitionCtor(), () => false);
  const canTalk = useSyncExternalStore(noSubscribe, () => !!recognitionCtor() && canSpeak(), () => false);
  const canRead = useSyncExternalStore(noSubscribe, canSpeak, () => false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [speakingId, setSpeakingId] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<Recognition | null>(null);
  const nextId = useRef(1);

  // Restore this tab's conversation and answers (shared with the step-by-step check).
  useEffect(() => {
    const saved = loadSaved();
    const chat = loadChat();
    if (!saved && !chat) {
      void Promise.resolve().then(() => setReady(true));
      return;
    }
    const restored = saved?.answers ?? EMPTY_ANSWERS;
    checkEligibility({ profile: restored.profile, skipped: restored.skipped })
      .then((res) => {
        setAnswers(restored);
        setResult(res);
        if (chat) {
          setMessages(chat.messages);
          nextId.current = Math.max(0, ...chat.messages.map((m) => m.id)) + 1;
        }
        setPendingField(chat?.pending ?? res.next_fields[0] ?? null);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  /** Sends a message; resolves to the assistant's reply text, or null if it couldn't be sent. */
  async function send(raw: string, voice = false): Promise<string | null> {
    const text = raw.trim();
    if (!text || busy) return null;
    const userMsg: Message = { id: nextId.current++, role: "user", text };
    const withUser = [...messages, userMsg];
    setMessages(withUser);
    setDraft("");
    setBusy(true);
    try {
      const res = await sendChat({
        message: text,
        lang,
        profile: answers.profile,
        skipped: answers.skipped,
        pending_field: pendingField,
        history: withUser.slice(-7, -1).map((m) => ({ role: m.role, text: m.text })),
        voice,
      });
      const profile = cleanProfile(res.profile);
      const newFields = [...res.understood.map((u) => u.field), ...res.skipped].filter(
        (f) => meta.has(f) && !answers.history.includes(f),
      );
      const nextAnswers: Answers = { profile, skipped: res.skipped, history: [...answers.history, ...new Set(newFields)] };
      setAnswers(nextAnswers);
      persistAnswers(nextAnswers);
      setPendingField(res.pending_field);
      setResult({ results: res.results, summary: res.summary, next_fields: res.pending_field ? [res.pending_field] : [], data_note: "" });
      // Short taps skip the AI on purpose, so only an AI turn updates the badge.
      if (res.ai_mode === "llm") setAiMode({ ai_mode: "llm", model: res.model ?? status.model });
      const bot: Message = {
        id: nextId.current++,
        role: "assistant",
        text: res.reply,
        understood: res.understood,
        decided: res.decided,
        schemes: res.schemes,
      };
      const all = [...withUser, bot];
      setMessages(all);
      saveChat(all, res.pending_field);
      return res.reply;
    } catch {
      setMessages((m) => [...m, { id: nextId.current++, role: "assistant", text: ta.error, error: true }]);
      return null;
    } finally {
      setBusy(false);
      if (!voice) inputRef.current?.focus();
    }
  }

  async function readAloud(id: number, text: string) {
    if (speakingId === id) {
      stopSpeaking();
      setSpeakingId(null);
      return;
    }
    setSpeakingId(id);
    await speak(text);
    setSpeakingId((current) => (current === id ? null : current));
  }

  function openVoice() {
    primeSpeech(); // inside the click, so browsers allow the assistant to talk
    recRef.current?.abort();
    setSpeakingId(null);
    setVoiceOpen(true);
  }

  useEffect(() => () => stopSpeaking(), []);


  const sendInitialMessage = useEffectEvent(() => {
    if (!initialMessage) return;
    window.history.replaceState(null, "", window.location.pathname); // don't resend on reload
    void send(initialMessage);
  });
  useEffect(() => {
    if (ready && !sentInitial.current) {
      sentInitial.current = true;
      sendInitialMessage();
    }
  }, [ready]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(draft);
  }

  function startOver() {
    recRef.current?.stop();
    setMessages([]);
    setAnswers(EMPTY_ANSWERS);
    setPendingField(null);
    setResult(initial);
    saveChat([], null);
    persistAnswers(null);
    inputRef.current?.focus();
  }

  function toggleListening() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = speechLang(lang);
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      setDraft(last[0].transcript);
      if (last.isFinal) void send(last[0].transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  // One-tap answers for the question the assistant just asked.
  const pendingMeta = pendingField ? meta.get(pendingField) : undefined;
  const quickReplies: string[] = !pendingMeta
    ? []
    : pendingMeta.kind === "bool"
      ? [t.checker.yes, t.checker.no, ta.dontKnow]
      : pendingMeta.kind === "enum"
        ? [...pendingMeta.options.map((o) => pick(o.label, lang)), ta.dontKnow]
        : [ta.dontKnow];

  const chip = "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <section className="relative flex h-[min(78dvh,46rem)] min-h-[30rem] flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
        {voiceOpen && (
          <VoiceMode lang={lang} onSend={(text) => send(text, true)} onClose={() => setVoiceOpen(false)} />
        )}
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h1 className="text-lg font-bold">{ta.title}</h1>
            <p
              className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                aiMode.ai_mode === "llm" ? "bg-brand-soft text-brand-strong" : "bg-paper text-ink-3"
              }`}
            >
              <Sparkles className="size-3" aria-hidden="true" />
              {aiMode.ai_mode === "llm" && aiMode.model ? ta.aiOn(aiMode.model) : ta.aiOff}
            </p>
          </div>
          <div className="flex items-center gap-2">
          {canTalk && (
            <button
              type="button"
              onClick={openVoice}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-strong"
            >
              <AudioLines className="size-4 text-marigold" aria-hidden="true" />
              {ta.voice}
            </button>
          )}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={startOver}
              className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-sm font-semibold text-ink-2 hover:border-ink-3 hover:text-ink"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              {ta.newChat}
            </button>
          )}
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5" aria-live="polite">
          <Bubble
            role="assistant"
            text={ta.welcome}
            label={ta.bot}
            speech={canRead ? { active: speakingId === 0, onToggle: () => void readAloud(0, ta.welcome), labels: ta } : undefined}
          />
          {messages.length === 0 && (
            <div className="animate-rise flex flex-wrap gap-2 pl-11" style={{ animationDelay: "150ms" }}>
              {ta.starters.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className={`${chip} border-line-strong bg-paper text-left text-ink-2 hover:border-brand hover:text-brand`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {messages.map((m) => (
            <Bubble
              key={m.id}
              role={m.role}
              text={m.text}
              label={m.role === "user" ? ta.you : ta.bot}
              error={m.error}
              speech={
                canRead && m.role === "assistant" && !m.error
                  ? { active: speakingId === m.id, onToggle: () => void readAloud(m.id, m.text), labels: ta }
                  : undefined
              }
            >
              {m.understood && m.understood.length > 0 && (
                <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="font-semibold text-ink-3">{ta.understood}:</span>
                  {m.understood
                    .filter((u) => u.field !== "state")
                    .map((u) => (
                      <span key={u.field} className="rounded-md bg-brand-soft px-2 py-0.5 font-semibold text-brand-strong">
                        {pick(u.label, lang)}: {pick(u.value, lang)}
                      </span>
                    ))}
                </p>
              )}
              {m.decided && m.decided.length > 0 && (
                <p className="mt-2 flex flex-wrap gap-1.5">
                  {m.decided.map((d) => (
                    <Link
                      key={d.scheme_id}
                      href={`/${lang}/schemes/${d.scheme_id}`}
                      className={`animate-pop inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        d.status === "eligible" ? "border-ok-line bg-ok-soft text-ok" : "border-no-line bg-no-soft text-no"
                      }`}
                    >
                      {d.status === "eligible" ? <Check className="size-3" aria-hidden="true" /> : <X className="size-3" aria-hidden="true" />}
                      {pick(d.name, lang)}
                    </Link>
                  ))}
                </p>
              )}
              {m.schemes && m.schemes.length > 0 && (
                <p className="mt-2 flex flex-wrap gap-1.5">
                  {m.schemes.map((id) => (
                    <Link
                      key={id}
                      href={`/${lang}/schemes/${id}`}
                      className="inline-flex items-center gap-1 rounded-full border border-line-strong px-2.5 py-0.5 text-xs font-semibold text-brand hover:border-brand"
                    >
                      {names.get(id) ? (lang === "hi" ? names.get(id)!.name_hi : names.get(id)!.name) : id}
                      <ArrowRight className="size-3" aria-hidden="true" />
                    </Link>
                  ))}
                </p>
              )}
            </Bubble>
          ))}
          {busy && (
            <div className="flex items-center gap-3" role="status">
              <Avatar />
              <span className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-paper px-4 py-3" aria-label={ta.thinking}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="size-2 animate-bounce rounded-full bg-ink-3" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </span>
            </div>
          )}
        </div>

        {quickReplies.length > 0 && !busy && (
          <div className="flex gap-2 overflow-x-auto border-t border-line px-4 py-2.5 sm:px-5">
            {quickReplies.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void send(q)}
                className={`${chip} shrink-0 border-brand/30 bg-brand-soft text-brand-strong hover:border-brand`}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-line p-3 sm:p-4">
          {canListen && (
            <button
              type="button"
              onClick={toggleListening}
              aria-pressed={listening}
              aria-label={listening ? ta.listening : ta.listen}
              title={listening ? ta.listening : ta.listen}
              className={`grid size-11 shrink-0 place-items-center rounded-full border transition-colors ${
                listening ? "animate-pulse border-danger bg-danger-soft text-danger" : "border-line-strong text-ink-2 hover:border-ink-3 hover:text-ink"
              }`}
            >
              {listening ? <MicOff className="size-5" aria-hidden="true" /> : <Mic className="size-5" aria-hidden="true" />}
            </button>
          )}
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={listening ? ta.listening : ta.placeholder}
            aria-label={ta.placeholder}
            maxLength={1000}
            autoComplete="off"
            enterKeyHint="send"
            className="min-h-11 w-full min-w-0 rounded-full border-2 border-line-strong bg-paper px-4 outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            aria-label={ta.send}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-white transition hover:bg-brand-strong disabled:opacity-40"
          >
            <SendHorizontal className="size-5" aria-hidden="true" />
          </button>
        </form>
      </section>

      <aside className="space-y-4 lg:sticky lg:top-24">
        <LiveProgress result={result} order={order} lang={lang} />
        <Link
          href={`/${lang}/check`}
          className="group flex items-center justify-between rounded-2xl border border-line bg-surface px-5 py-3 font-semibold text-brand transition hover:border-brand"
        >
          {ta.seeResults}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </Link>
        {me === null && (
          <Link
            href={`/${lang}/login?next=/${lang}/assistant`}
            className="block rounded-2xl border border-dashed border-line-strong px-5 py-3 text-sm font-semibold text-ink-2 hover:border-brand hover:text-brand"
          >
            {t.account.loginToSave}
          </Link>
        )}
      </aside>
    </div>
  );
}

function Avatar() {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-paper">
      <LogoMark className="size-5" />
    </span>
  );
}

type Speech = { active: boolean; onToggle: () => void; labels: { readAloud: string; stopReading: string } };

function Bubble({
  role,
  text,
  label,
  error,
  speech,
  children,
}: {
  role: "user" | "assistant";
  text: string;
  label: string;
  error?: boolean;
  speech?: Speech;
  children?: React.ReactNode;
}) {
  if (role === "user") {
    return (
      <div className="animate-rise flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-tr-sm bg-brand px-4 py-2.5 whitespace-pre-line text-white">
          <span className="sr-only">{label}: </span>
          {text}
        </p>
      </div>
    );
  }
  return (
    <div className="animate-rise flex gap-3">
      <Avatar />
      <div className="max-w-[85%] min-w-0">
        <p
          className={`rounded-2xl rounded-tl-sm px-4 py-2.5 whitespace-pre-line ${
            error ? "bg-danger-soft text-danger" : "bg-paper text-ink"
          }`}
        >
          <span className="sr-only">{label}: </span>
          {text}
        </p>
        {speech && (
          <button
            type="button"
            onClick={speech.onToggle}
            aria-pressed={speech.active}
            className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold transition-colors ${
              speech.active ? "bg-brand-soft text-brand-strong" : "text-ink-3 hover:text-brand"
            }`}
          >
            {speech.active ? <Square className="size-3" aria-hidden="true" /> : <Volume2 className="size-3.5" aria-hidden="true" />}
            {speech.active ? speech.labels.stopReading : speech.labels.readAloud}
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
