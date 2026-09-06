/**
 * Het merkteken van de sidebar: een "AI"-logo in plaats van de eerdere tekstuele
 * "UDENHOUT"-wordmark. Blijft zichtbaar in de ingeklapte, icoon-only sidebar — vandaar
 * een los, vierkant beeldmerk in plaats van een regel tekst zoals de andere iconen.
 */
export default function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-control bg-logo font-sans-w7 text-[13px] font-bold tracking-tight text-on-logo ${className ?? ""}`}
    >
      AI
    </span>
  );
}
