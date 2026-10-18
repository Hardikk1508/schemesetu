import type { Metadata } from "next";
import { Mukta } from "next/font/google";
import { Suspense } from "react";

import { AssistantLauncher } from "@/components/account/header-links";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { getDictionary } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { LANGS } from "@/lib/locales";

import "../globals.css";

// One family that covers both Latin and Devanagari, so English and Hindi sit together evenly.
const mukta = Mukta({
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-mukta",
  display: "swap",
});

export async function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLang());
  return {
    title: { default: `${t.brand}: ${t.tagline}`, template: `%s · ${t.brand}` },
    description: t.home.body,
    alternates: { languages: { en: "/en", hi: "/hi" } },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const lang = await getLang();
  return (
    <html lang={lang} className={`${mukta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-white"
        >
          {lang === "hi" ? "मुख्य सामग्री पर जाएँ" : "Skip to content"}
        </a>
        <SiteHeader lang={lang} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter lang={lang} />
        <Suspense fallback={null}>
          <AssistantLauncher lang={lang} />
        </Suspense>
      </body>
    </html>
  );
}
