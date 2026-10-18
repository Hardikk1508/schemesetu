import { CircleCheck, CircleQuestionMark, CircleX, type LucideIcon } from "lucide-react";

import { getDictionary } from "@/lib/i18n";
import type { Lang } from "@/lib/locales";
import type { RuleOutcome, SchemeStatus } from "@/lib/types";

export const STATUS_STYLE: Record<SchemeStatus, { icon: LucideIcon; badge: string; bar: string; text: string }> = {
  eligible: { icon: CircleCheck, badge: "bg-ok-soft text-ok border-ok-line", bar: "bg-ok", text: "text-ok" },
  needs_info: {
    icon: CircleQuestionMark,
    badge: "bg-wait-soft text-wait border-wait-line",
    bar: "bg-marigold",
    text: "text-wait",
  },
  not_eligible: { icon: CircleX, badge: "bg-no-soft text-no border-no-line", bar: "bg-no", text: "text-no" },
};

export function StatusBadge({ status, lang }: { status: SchemeStatus; lang: Lang }) {
  const { icon: Icon, badge } = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-semibold ${badge}`}>
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {getDictionary(lang).status[status]}
    </span>
  );
}

const OUTCOME: Record<RuleOutcome, { icon: LucideIcon; className: string; label: { en: string; hi: string } }> = {
  pass: { icon: CircleCheck, className: "text-ok", label: { en: "Met", hi: "पूरी" } },
  fail: { icon: CircleX, className: "text-danger", label: { en: "Not met", hi: "पूरी नहीं" } },
  unknown: { icon: CircleQuestionMark, className: "text-wait", label: { en: "Not known yet", hi: "अभी पता नहीं" } },
};

export function OutcomeIcon({ outcome, lang }: { outcome: RuleOutcome; lang: Lang }) {
  const { icon: Icon, className, label } = OUTCOME[outcome];
  return (
    <>
      <Icon className={`mt-0.5 size-5 shrink-0 ${className}`} aria-hidden="true" />
      <span className="sr-only">{label[lang]}: </span>
    </>
  );
}
