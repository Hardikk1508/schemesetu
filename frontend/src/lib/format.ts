import { getDictionary } from "./i18n";
import type { Lang } from "./locales";
import type { FieldMeta, ProfileValue } from "./types";

const inr = new Intl.NumberFormat("en-IN");

/** 250000 -> "₹2,50,000" (Indian digit grouping, as the backend does). */
export function formatINR(amount: number): string {
  return `₹${inr.format(amount)}`;
}

function trimmed(n: number): string {
  return Number(n.toFixed(2)).toString();
}

/** 250000 -> "2.5 lakh"; useful next to a raw rupee figure. Empty below one lakh. */
export function inWords(amount: number, lang: Lang): string {
  if (amount >= 1e7) return `${trimmed(amount / 1e7)} ${lang === "hi" ? "करोड़" : "crore"}`;
  if (amount >= 1e5) return `${trimmed(amount / 1e5)} ${lang === "hi" ? "लाख" : "lakh"}`;
  return "";
}

export function formatValue(meta: FieldMeta | undefined, value: ProfileValue | null | undefined, lang: Lang): string {
  const t = getDictionary(lang);
  if (value === null || value === undefined) return lang === "hi" ? "पता नहीं" : "not known";
  if (typeof value === "boolean") return value ? t.checker.yes : t.checker.no;
  if (typeof value === "number") {
    if (meta?.unit === "inr") return formatINR(value);
    if (meta?.unit === "years") return `${value} ${t.checker.years}`;
    return String(value);
  }
  const option = meta?.options.find((o) => o.value === value);
  return option ? option.label[lang] : value;
}
