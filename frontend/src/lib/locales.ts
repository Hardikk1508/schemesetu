// Kept free of other imports: proxy.ts uses it too.

export const LANGS = ["en", "hi"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "en";
export const LANG_COOKIE = "lang";

export function isLang(value: string | undefined | null): value is Lang {
  return (LANGS as readonly string[]).includes(value ?? "");
}

/** "/en/schemes/ssy" -> "/hi/schemes/ssy" */
export function switchLangPath(pathname: string, to: Lang): string {
  const rest = pathname.replace(/^\/(en|hi)(?=\/|$)/, "");
  return `/${to}${rest}`;
}
