export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="none">
      <path d="M4 22C9 11 23 11 28 22" stroke="var(--color-brand)" strokeWidth="2.75" strokeLinecap="round" />
      <path d="M10 16.4V22M16 13.6V22M22 16.4V22" stroke="var(--color-marigold)" strokeWidth="2.25" strokeLinecap="round" />
      <path d="M2.5 22.5h27" stroke="var(--color-ink)" strokeWidth="2.75" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className="text-xl font-bold tracking-tight text-ink">
        Scheme<span className="text-brand">Setu</span>
      </span>
    </span>
  );
}
