"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { getDictionary } from "@/lib/i18n";
import type { Lang } from "@/lib/locales";

import { SearchBox } from "./search-box";

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

/** Header search button; also opens with "/" or Ctrl/⌘+K from anywhere on the page. */
export function SearchDialog({ lang }: { lang: Lang }) {
  const t = getDictionary(lang).search;
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Remount the search box on every open so it starts empty and takes focus.
  const [session, setSession] = useState(0);

  function show() {
    setSession((n) => n + 1);
    dialogRef.current?.showModal();
  }

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      const combo = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (combo || (e.key === "/" && !isTyping(e.target))) {
        e.preventDefault();
        if (!dialogRef.current?.open) show();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-label={t.label}
        aria-keyshortcuts="/ Control+K Meta+K"
        className="flex h-9 items-center gap-2 rounded-full border border-line-strong bg-surface px-2.5 text-sm text-ink-2 transition-colors hover:border-ink-3 hover:text-ink xl:w-48 xl:px-3"
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="hidden xl:inline">{t.open}…</span>
        <kbd className="ml-auto hidden rounded border border-line px-1.5 font-sans text-xs text-ink-3 xl:inline">/</kbd>
      </button>
      <dialog
        ref={dialogRef}
        aria-label={t.label}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current.close(); // backdrop click
        }}
        className="open:animate-rise m-0 mx-auto mt-[10vh] w-[min(40rem,calc(100%-2rem))] overflow-visible bg-transparent p-0 backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
      >
        <div className="rounded-3xl bg-paper p-3 shadow-pop sm:p-4">
          {session > 0 && (
            <SearchBox key={session} lang={lang} size="lg" autoFocus onNavigate={() => dialogRef.current?.close()} />
          )}
          <p className="mt-3 hidden px-1 text-xs text-ink-3 sm:block">
            {t.shortcut} · <kbd className="font-sans">Esc</kbd> {t.close.toLowerCase()}
          </p>
        </div>
      </dialog>
    </>
  );
}
