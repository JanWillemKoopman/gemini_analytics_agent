export function formatCurrency(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Claude-kosten in dollars. Anders dan formatCurrency (afgerond op hele euro's, prima
 * voor omzetcijfers) kan een enkele chatbeurt een paar dollarcent kosten — met nul
 * decimalen zou dat overal "$ 0" tonen. maxDecimals bepaalt de precisie: 2 voor grote
 * totalen, 4 voor kleine dagbedragen waar centen er juist toe doen.
 */
export function formatUsd(value: number | null, maxDecimals = 2): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value !== 0 && Math.abs(value) < 0.01 ? maxDecimals : 2,
    maximumFractionDigits: maxDecimals,
  }).format(value);
}

/**
 * Bedrag met centen. Anders dan formatCurrency (hele euro's, prima voor budgetten en
 * omzet) gaat het bij kosten per click of per lead juist om de centen — daar zou
 * afronden op hele euro's alles op "€ 0" zetten.
 */
export function formatCurrencyPrecies(value: number | null, maxDecimals = 2): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDecimals,
  }).format(value);
}

/**
 * Een verhouding (0,0123) als percentage. Anders dan formatPercent, dat een getal van
 * 0–100 op hele procenten afrondt: een CTR van 1,2% zou daarin "1%" worden en het
 * verschil met 1,8% verdwijnt dan.
 */
export function formatVerhoudingPercent(fractie: number | null, decimalen = 2): string {
  if (fractie === null || !Number.isFinite(fractie)) return "—";
  return `${(fractie * 100).toLocaleString("nl-NL", {
    minimumFractionDigits: decimalen,
    maximumFractionDigits: decimalen,
  })}%`;
}

export function formatNumber(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 2 }).format(value);
}

/** Data komen als "2026-01-01" (ISO) uit de sheet; val terug op de ruwe waarde als parsen mislukt. */
export function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" }).format(
    date,
  );
}

/** Percentage van een teller t.o.v. een noemer; null zodra een van beide ontbreekt of de noemer 0 is. */
export function ratio(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return (numerator / denominator) * 100;
}

export function formatPercent(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  return `${Math.round(value)}%`;
}

/** Zet een percentage tussen haakjes achter de hoofdwaarde, of laat de haakjes weg als het niet te berekenen is. */
export function withPercent(main: string, percent: string | null): string {
  return percent ? `${main} (${percent})` : main;
}

export type Deviation = {
  text: string;
  tone: "positive" | "negative" | "neutral";
};

/**
 * Doel-versus-realisatie in mensentaal ("+445 boven doel" / "−35 onder doel") in
 * plaats van een kaal percentage — sneller te scannen dan "465 (2325%)".
 */
export function deviationFromTarget(actual: number | null, target: number | null): Deviation | null {
  if (actual === null || target === null) return null;
  const diff = Math.round(actual - target);
  if (diff === 0) return { text: "op doel", tone: "neutral" };
  const formatted = new Intl.NumberFormat("nl-NL").format(Math.abs(diff));
  return diff > 0
    ? { text: `+${formatted} boven doel`, tone: "positive" }
    : { text: `−${formatted} onder doel`, tone: "negative" };
}

/**
 * Wat er van het budget over is, in mensentaal ("nog € 1.500 te besteden" /
 * "€ 200 boven budget") — hetzelfde patroon als deviationFromTarget, maar dan met de
 * tekens omgedraaid: bij uitgaven is méér dan begroot juist ongunstig.
 */
export function budgetRestant(uitgaven: number | null, budget: number | null): Deviation | null {
  if (uitgaven === null || budget === null) return null;
  const restant = Math.round(budget - uitgaven);
  if (restant === 0) return { text: "budget precies op", tone: "neutral" };
  const bedrag = formatCurrency(Math.abs(restant));
  return restant > 0
    ? { text: `nog ${bedrag} te besteden`, tone: "neutral" }
    : { text: `${bedrag} boven budget`, tone: "negative" };
}

/** "van doel"-percentage voor metrics waarbij een absolute afwijking minder zegt (bv. leads). */
export function percentOfTarget(actual: number | null, target: number | null): string | null {
  const percent = formatPercent(ratio(actual, target));
  return percent ? `${percent} van doel` : null;
}

/** Vandaag als "YYYY-MM-DD" in Europe/Amsterdam, zodat de vergelijking met de ISO-
 *  datums uit de sheet los staat van de tijdzone van de server. */
function vandaagISO(vandaag: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(vandaag);
}

/**
 * Of een campagne op dit moment live staat, afgeleid van start- en einddatum in plaats
 * van de handmatig ingevulde kolom "Status" in de sheet — die loopt in de praktijk
 * achter. Live = vandaag ligt op of tussen start- en einddatum; zonder een van beide
 * datums is er niets om op te rekenen, dus dan telt de campagne als offline.
 */
export function isCampagneLive(
  campagne: { startdatum: string | null; einddatum: string | null },
  vandaag: Date = new Date(),
): boolean {
  if (!campagne.startdatum || !campagne.einddatum) return false;
  const vandaagIso = vandaagISO(vandaag);
  return campagne.startdatum <= vandaagIso && vandaagIso <= campagne.einddatum;
}
