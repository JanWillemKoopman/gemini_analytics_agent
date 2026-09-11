import { IconBrain } from "@/components/icons";

/**
 * Het merkteken van de sidebar: een brein-icoon in plaats van de eerdere tekstuele
 * "UDENHOUT"-wordmark. Blijft zichtbaar in de ingeklapte, icoon-only sidebar — vandaar
 * een los, vierkant beeldmerk in plaats van een regel tekst zoals de andere iconen.
 */
export default function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-control bg-logo text-on-logo ${className ?? ""}`}
    >
      <IconBrain className="h-[60%] w-[60%]" />
    </span>
  );
}
