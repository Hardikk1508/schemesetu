import type { Metadata } from "next";

import { AccountPanel } from "@/components/account/account-panel";
import { getDictionary } from "@/lib/i18n";
import { getLang } from "@/lib/lang";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLang()).account.title };
}

export default async function AccountPage() {
  const lang = await getLang();
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 md:py-14">
      <AccountPanel lang={lang} />
    </div>
  );
}
