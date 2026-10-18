import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/account/login-form";
import { getDictionary } from "@/lib/i18n";
import { getLang } from "@/lib/lang";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLang()).nav.login };
}

export default async function LoginPage() {
  const lang = await getLang();
  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6 md:py-16">
      {/* LoginForm reads ?next=, which is only known at request time. */}
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl border border-line bg-surface" aria-hidden="true" />}>
        <LoginForm lang={lang} />
      </Suspense>
    </div>
  );
}
