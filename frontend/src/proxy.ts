import { NextResponse, type NextRequest } from "next/server";

import { DEFAULT_LANG, LANG_COOKIE, isLang, type Lang } from "./lib/locales";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Highest-weighted supported language in an Accept-Language header. */
function fromAcceptLanguage(header: string): Lang | null {
  const tags = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { base: tag.toLowerCase().split("-")[0], q: q ? Number(q.slice(2)) : 1 };
    })
    .filter((t) => t.q > 0)
    .sort((a, b) => b.q - a.q);
  const match = tags.map((t) => t.base).find(isLang);
  return match ?? null;
}

function preferredLang(request: NextRequest): Lang {
  const saved = request.cookies.get(LANG_COOKIE)?.value;
  if (isLang(saved)) return saved;
  return fromAcceptLanguage(request.headers.get("accept-language") ?? "") ?? DEFAULT_LANG;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1];

  if (isLang(first)) {
    // Remember the language the visitor is reading in, for their next bare-URL visit.
    const response = NextResponse.next();
    if (request.cookies.get(LANG_COOKIE)?.value !== first) {
      response.cookies.set(LANG_COOKIE, first, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
    }
    return response;
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${preferredLang(request)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the backend rewrite, Next internals and files with an extension.
  matcher: ["/((?!api/|_next/|.*\\..*).*)"],
};
