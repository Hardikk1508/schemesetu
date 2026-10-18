"use client";

import { ArrowRight, LoaderCircle, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { getKinds, getSchemes, getTopics } from "@/lib/api";
import { getDictionary, pick, schemeName } from "@/lib/i18n";
import type { Lang } from "@/lib/locales";
import { buildIndex, search, type SearchEntry } from "@/lib/search";
import type { KindInfo } from "@/lib/types";

type Loaded = { index: SearchEntry[]; kinds: Map<string, KindInfo> };

// Loaded once per page visit, the first time anyone focuses a search box.
let loading: Promise<Loaded> | null = null;
function loadIndex(): Promise<Loaded> {
  loading ??= Promise.all([getSchemes(), getKinds(), getTopics()])
    .then(([{ schemes }, kinds, topics]) => ({
      index: buildIndex(schemes, kinds, topics),
      kinds: new Map(kinds.map((k) => [k.kind, k])),
    }))
    .catch((e) => {
      loading = null; // let the next focus retry
      throw e;
    });
  return loading;
}

const MAX_SUGGESTIONS = 6;

export function SearchBox({
  lang,
  size = "md",
  autoFocus = false,
  showQuick = false,
  onNavigate,
}: {
  lang: Lang;
  size?: "md" | "lg";
  autoFocus?: boolean;
  showQuick?: boolean;
  onNavigate?: () => void;
}) {
  const t = getDictionary(lang).search;
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const matches = useMemo(() => (data ? search(data.index, query) : []), [data, query]);
  const shown = matches.slice(0, MAX_SUGGESTIONS);
  const seeAllHref = `/${lang}/schemes?q=${encodeURIComponent(query.trim())}`;
  // Options: each suggestion, then "see all" when there are more.
  const optionCount = shown.length + (matches.length > MAX_SUGGESTIONS ? 1 : 0);
  const hasQuery = query.trim().length > 0;

  function ensureLoaded() {
    if (data) return;
    loadIndex().then(setData, () => setFailed(true));
  }

  function go(href: string) {
    setOpen(false);
    onNavigate?.();
    router.push(href);
  }

  function hrefFor(i: number) {
    return i < shown.length ? `/${lang}/schemes/${shown[i].id}` : seeAllHref;
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && optionCount > 0) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % optionCount);
    } else if (e.key === "ArrowUp" && optionCount > 0) {
      e.preventDefault();
      setActive((a) => (a <= 0 ? optionCount - 1 : a - 1));
    } else if (e.key === "Enter" && hasQuery) {
      e.preventDefault();
      go(active >= 0 ? hrefFor(active) : shown.length === 1 ? hrefFor(0) : seeAllHref);
    } else if (e.key === "Escape" && open && hasQuery) {
      // Close the suggestions first, not a surrounding dialog.
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  }

  const big = size === "lg";
  const expanded = open && hasQuery;

  return (
    <div className="relative">
      <div
        className={`flex items-center gap-2 rounded-2xl border-2 bg-surface transition-colors focus-within:border-brand ${
          big ? "border-line-strong px-4 shadow-card" : "border-line px-3"
        }`}
      >
        <Search className={`shrink-0 text-ink-3 ${big ? "size-5" : "size-4"}`} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label={t.label}
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
          autoFocus={autoFocus}
          autoComplete="off"
          enterKeyHint="search"
          placeholder={t.placeholder}
          value={query}
          onFocus={() => {
            ensureLoaded();
            setOpen(true);
          }}
          onBlur={() => setOpen(false)}
          onChange={(e) => {
            ensureLoaded();
            setQuery(e.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className={`w-full min-w-0 bg-transparent outline-none placeholder:text-ink-3 [&::-webkit-search-cancel-button]:hidden ${
            big ? "min-h-14 text-lg" : "min-h-11"
          }`}
        />
        {hasQuery && (
          <button
            type="button"
            aria-label={t.clear}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="grid size-8 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-paper hover:text-ink"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {showQuick && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-3">{t.popular}</span>
          {t.quick.map((word) => (
            <button
              key={word}
              type="button"
              onClick={() => {
                ensureLoaded();
                setQuery(word);
                setActive(-1);
                setOpen(true);
                inputRef.current?.focus();
              }}
              className="rounded-full border border-line-strong bg-surface px-3 py-1 font-semibold text-ink-2 transition-colors hover:border-brand hover:text-brand"
            >
              {word}
            </button>
          ))}
        </p>
      )}

      {expanded && (
        <div
          className={`animate-fade absolute inset-x-0 z-30 mt-2 overflow-hidden rounded-2xl border border-line bg-surface shadow-pop ${
            big ? "top-16" : "top-12"
          }`}
        >
          {!data ? (
            <p className="flex items-center gap-2 px-4 py-3 text-ink-3" role="status">
              {failed ? (
                getDictionary(lang).checker.error
              ) : (
                <>
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                  {t.loading}
                </>
              )}
            </p>
          ) : matches.length === 0 ? (
            <div className="px-4 py-3" role="status">
              <p className="font-semibold">{t.none(query.trim())}</p>
              <p className="text-sm text-ink-3">{t.tryWords}</p>
            </div>
          ) : (
            <ul id={listId} role="listbox" aria-label={t.label} className="max-h-[60vh] overflow-y-auto py-1">
              {shown.map((s, i) => (
                <li
                  key={s.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(hrefFor(i))}
                  className={`cursor-pointer px-4 py-2.5 ${i === active ? "bg-brand-soft" : ""}`}
                >
                  <span className="block font-semibold leading-snug">{schemeName(s, lang)}</span>
                  <span className="mt-0.5 block truncate text-sm text-ink-3">
                    <span className="font-semibold text-brand">{pick(data.kinds.get(s.kind)!.label, lang)}</span>
                    {" · "}
                    {pick(s.benefit, lang)}
                  </span>
                </li>
              ))}
              {matches.length > MAX_SUGGESTIONS && (
                <li
                  id={`${listId}-${shown.length}`}
                  role="option"
                  aria-selected={active === shown.length}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(shown.length)}
                  onClick={() => go(seeAllHref)}
                  className={`flex cursor-pointer items-center gap-1.5 border-t border-line px-4 py-2.5 font-semibold text-brand ${
                    active === shown.length ? "bg-brand-soft" : ""
                  }`}
                >
                  {t.seeAll(matches.length)}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
