import { lang } from "next/root-params";
import { notFound } from "next/navigation";

import { isLang, type Lang } from "./locales";

/** The current page language, from the /[lang] root segment. Server Components only. */
export async function getLang(): Promise<Lang> {
  const value = await lang();
  if (!isLang(value)) notFound();
  return value;
}
