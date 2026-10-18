import type { Metadata } from "next";
import { Mukta } from "next/font/google";
import Link from "next/link";

import { Wordmark } from "@/components/logo";

import "./globals.css";

const mukta = Mukta({ subsets: ["latin", "devanagari"], weight: ["400", "700"], variable: "--font-mukta" });

export const metadata: Metadata = {
  title: "Page not found · SchemeSetu",
};

// Unmatched URLs never reach the /[lang] layout, so we don't know the language: show both.
export default function GlobalNotFound() {
  return (
    <html lang="en" className={`${mukta.variable} h-full antialiased`}>
      <body className="flex min-h-full items-center justify-center px-4 font-sans">
        <div className="max-w-md text-center">
          <div className="flex justify-center">
            <Wordmark />
          </div>
          <h1 className="mt-10 text-3xl font-bold">Page not found</h1>
          <p className="mt-1 text-xl font-bold" lang="hi">
            पेज नहीं मिला
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/en" className="rounded-full bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-strong">
              Go home
            </Link>
            <Link
              href="/hi"
              lang="hi"
              className="rounded-full border border-line-strong bg-surface px-5 py-2.5 font-semibold hover:border-ink-3"
            >
              होम पेज
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
