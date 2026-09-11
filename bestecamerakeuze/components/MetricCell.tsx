import ProgressBar from "@/components/ProgressBar";

type Tone = "positive" | "negative" | "neutral";

const toneClass: Record<Tone, string> = {
  positive: "text-positive",
  negative: "text-negative",
  neutral: "text-ink-faint",
};

type Props = {
  /** Hoofdwaarde: primaire informatie, dus iets zwaarder en donkerder dan de rest. */
  primary: string;
  /** Ondersteunende regel: afwijking t.o.v. doel, of een percentage — secundair, kleiner. */
  secondary?: string;
  tone?: Tone;
  /** 0–100; alleen tonen wanneer er een echte doelwaarde is. */
  progress?: number;
};

/** Eén tabelcel: primaire waarde + optionele secundaire regel + optionele progress bar. */
export default function MetricCell({ primary, secondary, tone = "neutral", progress }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-semibold tabular-nums text-ink">{primary}</span>
      {secondary && <span className={`text-meta ${toneClass[tone]}`}>{secondary}</span>}
      {progress !== undefined && <ProgressBar percent={progress} />}
    </div>
  );
}

/** Ondersteunende waarde zonder nadruk (bv. een startdatum of een doelaantal). */
export function PlainCell({ value, muted = false }: { value: string; muted?: boolean }) {
  return <span className={`text-sm tabular-nums ${muted ? "text-ink-faint" : "text-ink"}`}>{value}</span>;
}
