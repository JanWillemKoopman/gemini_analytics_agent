"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import FilterSelect from "@/components/FilterSelect";
import PeriodeFilter, { type Periode } from "@/components/kosten/PeriodeFilter";
import StatTegel from "@/components/social/StatTegel";
import { berichtsoortLabel, doelLabel } from "@/components/social/labels";
import { AS_GROOTTE, formatteer, type Eenheid } from "@/components/chat/chartTheme";
import { useGrafiekKleuren } from "@/components/ThemeProvider";
import { IconRefresh } from "@/components/icons";
import {
  formatCurrency,
  formatCurrencyPrecies,
  formatNumber,
  formatVerhoudingPercent,
} from "@/lib/format";
import {
  deel,
  telMetingen,
  type AdvertentieMetingen,
  type FacebookOverzicht,
} from "@/lib/windsor";

/**
 * De metriek die de dagstaven laten zien.
 *
 * Bewust één metriek per keer in plaats van uitgaven en clicks samen in één grafiek:
 * dat zou twee y-assen vragen, en twee assen in één beeld laat de lezer een verband
 * zien dat er niet hoeft te zijn (de schaalkeuze bepaalt dan welke lijn "boven" ligt).
 * Eén as, en je kiest zelf waar je naar kijkt.
 */
const METRIEKEN = [
  { id: "uitgaven", label: "Uitgaven", eenheid: "euro" },
  { id: "weergaven", label: "Weergaven", eenheid: "aantal" },
  { id: "websiteClicks", label: "Clicks naar de site", eenheid: "aantal" },
  { id: "leads", label: "Leads", eenheid: "aantal" },
] as const satisfies readonly {
  id: keyof AdvertentieMetingen;
  label: string;
  eenheid: Eenheid;
}[];

type MetriekId = (typeof METRIEKEN)[number]["id"];

/** Hoeveel berichten de lijst standaard toont; de rest komt met één klik erbij. */
const BERICHTEN_STAP = 10;

function vandaag(): string {
  return new Date().toISOString().slice(0, 10);
}

function dagenGeleden(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function kortDatumLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function volDatumLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Kolomkop van een cijfertabel: klein, uppercase, gedempt — net als de groepskoppen. */
function Kop({
  children,
  rechts,
  titel,
}: {
  children: React.ReactNode;
  rechts?: boolean;
  titel?: string;
}) {
  return (
    <th
      scope="col"
      title={titel}
      className={`sticky top-0 z-10 border-b border-line bg-surface-tint px-3 py-2 font-sans-w7 text-label tracking-wide text-ink-muted uppercase ${
        rechts ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Paneel({
  titel,
  uitleg,
  actie,
  children,
}: {
  titel: string;
  uitleg: string;
  actie?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="kaart-accent rounded-panel border border-line bg-card shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-5 py-4">
        <div>
          <h2 className="titel-theme font-sans-w7 text-cell font-bold text-ink">{titel}</h2>
          {/* De leeswijzer staat er vast bij, niet achter een knop: wie hier één keer
              per week komt, moet niet eerst hoeven uitzoeken wat "bereik" betekent. */}
          <p className="mt-1 max-w-3xl text-meta text-ink-muted">{uitleg}</p>
        </div>
        {actie}
      </header>
      {children}
    </section>
  );
}

export default function Facebook({ ingelogd }: { ingelogd: boolean }) {
  const kleuren = useGrafiekKleuren();
  const asStijl = { fontSize: AS_GROOTTE, fill: kleuren.as } as const;

  const [periode, setPeriode] = useState<Periode>({ van: dagenGeleden(29), tot: vandaag() });
  const [gekozenAccounts, setGekozenAccounts] = useState<string[]>([]);
  const [metriek, setMetriek] = useState<MetriekId>("uitgaven");
  const [berichtenLimiet, setBerichtenLimiet] = useState(BERICHTEN_STAP);
  const [data, setData] = useState<FacebookOverzicht | null>(null);
  const [laden, setLaden] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const laad = useCallback(async () => {
    setLaden(true);
    setFout(null);
    try {
      const params = new URLSearchParams({ van: periode.van, tot: periode.tot });
      const res = await fetch(`/api/social/facebook?${params.toString()}`);
      const json = (await res.json()) as FacebookOverzicht & { fout?: string };
      if (!res.ok) throw new Error(json.fout ?? "Kon de Facebook-cijfers niet ophalen.");
      setData(json);
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Kon de Facebook-cijfers niet ophalen.");
    } finally {
      setLaden(false);
    }
  }, [periode.van, periode.tot]);

  useEffect(() => {
    if (ingelogd) void laad();
  }, [ingelogd, laad]);

  useEffect(() => {
    setBerichtenLimiet(BERICHTEN_STAP);
  }, [periode.van, periode.tot, gekozenAccounts]);

  /**
   * Kleur hangt aan het account, niet aan zijn plek in de ranglijst.
   *
   * De reeks wordt toegekend over de accounts die in de opgehaalde periode
   * advertentiedata hebben — dat zijn precies de series in de grafiek — in de vaste
   * alfabetische volgorde van `data.accounts`. Het accountfilter verft de overblijvers
   * dus niet om, want die lijst hangt alleen aan wat er is opgehaald.
   *
   * Wie geen kleur krijgt (een pagina zonder advertentieaccount, of een zevende account
   * als de reeks vol is) krijgt de neutrale contextkleur, nooit een herhaalde tint:
   * twee accounts in dezelfde kleur is erger dan een account zonder kleur.
   */
  const kleurPerAccount = useMemo(() => {
    const metAdvertenties = new Set(
      (data?.betaald.perDagPerAccount ?? [])
        .filter((r) => r.uitgaven > 0 || r.weergaven > 0)
        .map((r) => r.account),
    );
    const map = new Map<string, string>();
    (data?.accounts ?? [])
      .filter((a) => metAdvertenties.has(a))
      .forEach((account, i) => {
        if (i < kleuren.categorieen.length) map.set(account, kleuren.categorieen[i]);
      });
    return map;
  }, [data, kleuren]);

  const accountKleur = useCallback(
    (account: string): string => kleurPerAccount.get(account) ?? kleuren.context,
    [kleurPerAccount, kleuren],
  );

  const toonAlleAccounts = gekozenAccounts.length === 0;
  const isZichtbaar = useCallback(
    (account: string) => toonAlleAccounts || gekozenAccounts.includes(account),
    [toonAlleAccounts, gekozenAccounts],
  );

  const dagRijen = useMemo(
    () => (data?.betaald.perDagPerAccount ?? []).filter((r) => isZichtbaar(r.account)),
    [data, isZichtbaar],
  );
  const campagnes = useMemo(
    () => (data?.betaald.campagnes ?? []).filter((c) => isZichtbaar(c.account)),
    [data, isZichtbaar],
  );
  const paginas = useMemo(
    () => (data?.organisch.paginas ?? []).filter((p) => isZichtbaar(p.account)),
    [data, isZichtbaar],
  );
  const berichten = useMemo(
    () => (data?.organisch.berichten ?? []).filter((b) => isZichtbaar(b.account)),
    [data, isZichtbaar],
  );

  // Alles wordt uit dezelfde grondgetallen opgeteld met dezelfde functie als de server
  // gebruikt, dus het filteren in de browser kan geen ander totaal opleveren.
  const totalen = useMemo(() => telMetingen(dagRijen), [dagRijen]);

  /** De series in de grafiek: de accounts uit de selectie die advertentiedata hebben. */
  const advertentieAccounts = useMemo(() => {
    const gezien = new Set(
      dagRijen.filter((r) => r.uitgaven > 0 || r.weergaven > 0).map((r) => r.account),
    );
    return (data?.accounts ?? []).filter((a) => gezien.has(a));
  }, [data, dagRijen]);

  const actieveMetriek = METRIEKEN.find((m) => m.id === metriek) ?? METRIEKEN[0];

  /** Eén rij per dag, met per account een kolom — de vorm die een gestapelde staaf vraagt. */
  const staven = useMemo(() => {
    if (!data) return [];
    const perDag = new Map<string, Record<string, number | string>>();
    for (const datum of data.dagen) {
      perDag.set(datum, { datum, label: kortDatumLabel(datum) });
    }
    for (const rij of dagRijen) {
      const doel = perDag.get(rij.datum);
      if (!doel) continue;
      doel[rij.account] = ((doel[rij.account] as number) ?? 0) + rij[metriek];
    }
    return [...perDag.values()];
  }, [data, dagRijen, metriek]);

  const dichteAs = (data?.dagen.length ?? 0) > 45;
  // Bij weinig dagen is een haarlijn in de paginakleur een nette scheiding tussen de
  // gestapelde delen; bij 90+ dagen zijn de staven zo smal dat de lijn de staaf opeet.
  const segmentLijn = !dichteAs;

  const perDagGemiddeld = deel(totalen.uitgaven, data?.dagen.length ?? 0);

  if (!ingelogd) {
    return (
      <div className="rounded-panel border border-line bg-surface p-8 text-center">
        <p className="font-sans-w7 text-lg font-bold text-ink">
          Log in om de social-mediacijfers te bekijken
        </p>
        <a
          href="/login"
          className="mt-5 inline-block rounded-button bg-primary px-5 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-dark"
        >
          Inloggen
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Eén coherente controlbalk, zoals boven de campagnetabel: links wat je ziet,
          rechts waarmee je het bijstelt. */}
      <div className="kaart-omlijst flex flex-wrap items-center justify-between gap-3 rounded-panel border border-line bg-card px-4 py-3 shadow-subtle">
        <div>
          <p className="text-sm font-semibold text-ink">
            {toonAlleAccounts
              ? `Alle ${data?.accounts.length ?? 0} accounts`
              : `${gekozenAccounts.length} van ${data?.accounts.length ?? 0} accounts`}
          </p>
          <p className="text-xs text-ink-faint">
            {kortDatumLabel(periode.van)} – {kortDatumLabel(periode.tot)} · {campagnes.length}{" "}
            {campagnes.length === 1 ? "campagne" : "campagnes"} ·{" "}
            {berichten.length === 1 ? "1 bericht" : `${berichten.length} berichten`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            label="Account"
            options={data?.accounts ?? []}
            selected={gekozenAccounts}
            onChange={setGekozenAccounts}
          />
          <PeriodeFilter periode={periode} onChange={setPeriode} />
          <button
            type="button"
            onClick={() => void laad()}
            disabled={laden}
            className="flex shrink-0 items-center gap-1.5 rounded-control px-3 py-2 text-sm font-medium text-ink-muted transition-colors duration-[var(--duur-snel)] hover:bg-surface hover:text-ink disabled:cursor-wait disabled:opacity-70"
          >
            <IconRefresh className={`h-3.5 w-3.5 ${laden ? "animate-spin" : ""}`} />
            {laden ? "Bezig…" : "Bijwerken"}
          </button>
        </div>
      </div>

      {fout && (
        <p className="rounded-card border border-orange bg-card px-4 py-3 text-sm text-orange">
          {fout}
        </p>
      )}
      {data?.waarschuwingen.map((w) => (
        <p key={w} className="rounded-card border border-orange bg-card px-4 py-3 text-sm text-orange">
          {w}
        </p>
      ))}

      {/* ── Betaald ─────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        <StatTegel
          label="Uitgaven"
          waarde={formatCurrency(totalen.uitgaven)}
          onder={
            perDagGemiddeld === null
              ? undefined
              : `${formatCurrency(perDagGemiddeld)} per dag gemiddeld`
          }
        />
        <StatTegel
          label="Weergaven"
          waarde={formatteer(totalen.weergaven, "aantal", true)}
          onder={`dagbereik opgeteld ${formatteer(totalen.bereik, "aantal")}`}
        />
        <StatTegel
          label="Clicks naar de site"
          waarde={formatteer(totalen.websiteClicks, "aantal", true)}
          onder={`CTR ${formatVerhoudingPercent(
            deel(totalen.clicks, totalen.weergaven),
          )} · ${formatCurrencyPrecies(deel(totalen.uitgaven, totalen.clicks))} per click`}
        />
        <StatTegel
          label="Leads"
          waarde={formatNumber(totalen.leads)}
          onder={
            totalen.leads > 0
              ? `${formatCurrencyPrecies(deel(totalen.uitgaven, totalen.leads))} per lead`
              : "geen leadformulieren in deze periode"
          }
        />
      </div>

      <Paneel
        titel="Advertenties per dag"
        uitleg="Elke staaf is één dag, opgedeeld per advertentieaccount. Weergaven is het aantal keer dat een advertentie in beeld kwam. Bereik is het aantal personen per dág: opgeteld over de periode telt iemand die je op meer dagen bereikte dus meer dan één keer mee — een uniek bereik over een hele periode geeft Meta niet mee."
        actie={
          <div
            role="group"
            aria-label="Metriek in de grafiek"
            className="flex shrink-0 rounded-control border border-line bg-surface p-0.5"
          >
            {METRIEKEN.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMetriek(m.id)}
                aria-pressed={metriek === m.id}
                className={`rounded-control px-3 py-1.5 text-meta font-medium transition-colors duration-[var(--duur-snel)] ease-merk ${
                  metriek === m.id
                    ? "bg-card text-ink shadow-subtle"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        }
      >
        <div className="px-5 py-5">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={staven} margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
              <CartesianGrid stroke={kleuren.raster} vertical={false} />
              <XAxis
                dataKey="label"
                tick={asStijl}
                tickLine={false}
                axisLine={false}
                interval={dichteAs ? "preserveStartEnd" : 0}
                minTickGap={dichteAs ? 24 : 4}
              />
              <YAxis
                tick={asStijl}
                tickLine={false}
                axisLine={false}
                width={72}
                tickFormatter={(v: number) => formatteer(v, actieveMetriek.eenheid, true)}
              />
              <Tooltip
                cursor={{ fill: kleuren.raster }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const datum = payload[0]?.payload?.datum as string | undefined;
                  const totaal = payload.reduce((s, p) => s + (Number(p.value) || 0), 0);
                  return (
                    <div className="rounded-card border border-line bg-card px-3 py-2 text-xs shadow-dropdown">
                      <p className="text-ink-muted">
                        {datum ? volDatumLabel(datum) : String(label)}
                      </p>
                      <p className="mt-0.5 font-sans-w7 font-bold text-ink tabular-nums">
                        {formatteer(totaal, actieveMetriek.eenheid)}
                      </p>
                      <ul className="mt-1.5 flex flex-col gap-1">
                        {[...payload]
                          .filter((p) => Number(p.value) > 0)
                          .sort((a, b) => Number(b.value) - Number(a.value))
                          .map((p) => (
                            <li key={String(p.dataKey)} className="flex items-center gap-2">
                              <span
                                aria-hidden="true"
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ background: p.color }}
                              />
                              <span className="flex-1 text-ink">{String(p.dataKey)}</span>
                              <span className="text-ink tabular-nums">
                                {formatteer(Number(p.value), actieveMetriek.eenheid)}
                              </span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  );
                }}
              />
              {advertentieAccounts.map((account, i) => (
                <Bar
                  key={account}
                  dataKey={account}
                  stackId="account"
                  fill={accountKleur(account)}
                  stroke={segmentLijn ? kleuren.vlak : undefined}
                  strokeWidth={segmentLijn ? 1 : 0}
                  // Alleen het bovenste deel van de stapel krijgt afgeronde hoeken; de
                  // staaf blijft met een rechte voet op de nullijn staan.
                  radius={
                    i === advertentieAccounts.length - 1
                      ? [kleuren.staafradius, kleuren.staafradius, 0, 0]
                      : undefined
                  }
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>

          {/* Legenda met het periodetotaal erbij: identiteit hangt zo nooit alleen aan
              kleur, en de stand is af te lezen zonder te hoveren. */}
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-line-soft pt-3">
            {advertentieAccounts.map((account) => {
              const som = telMetingen(dagRijen.filter((r) => r.account === account));
              return (
                <li key={account} className="flex items-center gap-2 text-meta">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: accountKleur(account) }}
                  />
                  <span className="text-ink">{account}</span>
                  <span className="font-sans-w7 font-semibold text-ink tabular-nums">
                    {formatteer(som[metriek], actieveMetriek.eenheid, true)}
                  </span>
                </li>
              );
            })}
            {advertentieAccounts.length === 0 && (
              <li className="text-meta text-ink-faint">
                {laden ? "Laden…" : "Geen advertentiedata in deze periode."}
              </li>
            )}
          </ul>
        </div>
      </Paneel>

      <Paneel
        titel="Advertentiecampagnes"
        uitleg="Elke campagne uit Meta Ads over de gekozen periode, de duurste bovenaan. CTR, kosten per click en kosten per lead zijn berekend uit de opgetelde cijfers van de hele periode — niet als gemiddelde van losse dagen, want dan zou een dag met weinig uitgaven even zwaar meewegen als een dag met veel."
      >
        <div className="max-h-[560px] overflow-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <Kop>Campagne</Kop>
                <Kop>Doel</Kop>
                <Kop rechts>Uitgaven</Kop>
                <Kop rechts>Weergaven</Kop>
                <Kop rechts titel="Som van het dagbereik; wie op meer dagen bereikt is, telt vaker mee.">
                  Dagbereik
                </Kop>
                <Kop rechts>Clicks</Kop>
                <Kop rechts>CTR</Kop>
                <Kop rechts>Per click</Kop>
                <Kop rechts>Leads</Kop>
                <Kop rechts>Per lead</Kop>
              </tr>
            </thead>
            <tbody>
              {campagnes.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-ink-faint">
                    {laden ? "Laden…" : "Geen advertentiecampagnes in deze periode."}
                  </td>
                </tr>
              ) : (
                campagnes.map((c) => (
                  <tr key={`${c.account}-${c.campagne}`}>
                    <td className="border-b border-line-soft px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: accountKleur(c.account) }}
                        />
                        <span className="font-medium text-ink">{c.campagne}</span>
                      </span>
                      <span className="mt-0.5 block pl-4 text-meta text-ink-faint">
                        {c.account}
                      </span>
                    </td>
                    <td className="border-b border-line-soft px-3 py-2.5 text-ink-muted">
                      {doelLabel(c.doel)}
                    </td>
                    <td className="border-b border-line-soft px-3 py-2.5 text-right font-medium text-ink tabular-nums">
                      {formatCurrency(c.uitgaven)}
                    </td>
                    <td className="border-b border-line-soft px-3 py-2.5 text-right text-ink tabular-nums">
                      {formatteer(c.weergaven, "aantal")}
                    </td>
                    <td className="border-b border-line-soft px-3 py-2.5 text-right text-ink-muted tabular-nums">
                      {formatteer(c.bereik, "aantal")}
                    </td>
                    <td className="border-b border-line-soft px-3 py-2.5 text-right text-ink tabular-nums">
                      {formatteer(c.websiteClicks, "aantal")}
                    </td>
                    <td className="border-b border-line-soft px-3 py-2.5 text-right text-ink-muted tabular-nums">
                      {formatVerhoudingPercent(deel(c.clicks, c.weergaven))}
                    </td>
                    <td className="border-b border-line-soft px-3 py-2.5 text-right text-ink-muted tabular-nums">
                      {formatCurrencyPrecies(deel(c.uitgaven, c.clicks))}
                    </td>
                    <td className="border-b border-line-soft px-3 py-2.5 text-right font-medium text-ink tabular-nums">
                      {c.leads > 0 ? formatNumber(c.leads) : "—"}
                    </td>
                    <td className="border-b border-line-soft px-3 py-2.5 text-right text-ink-muted tabular-nums">
                      {formatCurrencyPrecies(deel(c.uitgaven, c.leads))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {campagnes.length > 0 && (
              <tfoot>
                <tr>
                  <td className="sticky bottom-0 border-t border-line bg-surface-tint px-3 py-2.5 font-sans-w7 font-bold text-ink">
                    Totaal
                  </td>
                  <td className="sticky bottom-0 border-t border-line bg-surface-tint px-3 py-2.5" />
                  {(
                    [
                      formatCurrency(totalen.uitgaven),
                      formatteer(totalen.weergaven, "aantal"),
                      formatteer(totalen.bereik, "aantal"),
                      formatteer(totalen.websiteClicks, "aantal"),
                      formatVerhoudingPercent(deel(totalen.clicks, totalen.weergaven)),
                      formatCurrencyPrecies(deel(totalen.uitgaven, totalen.clicks)),
                      totalen.leads > 0 ? formatNumber(totalen.leads) : "—",
                      formatCurrencyPrecies(deel(totalen.uitgaven, totalen.leads)),
                    ] as const
                  ).map((waarde, i) => (
                    <td
                      key={i}
                      className="sticky bottom-0 border-t border-line bg-surface-tint px-3 py-2.5 text-right font-sans-w7 font-bold text-ink tabular-nums"
                    >
                      {waarde}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Paneel>

      {/* ── Onbetaald ───────────────────────────────────────────────────────────── */}
      <Paneel
        titel="De pagina's zelf"
        uitleg="Het onbetaalde deel: volgers en paginaweergaven. Deze cijfers staan los van de advertenties hierboven en mogen er niet bij opgeteld worden — Facebook rekent in de paginaweergaven het betaalde bereik al mee. Volgers is de laatste stand in de periode, niet een som."
      >
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <Kop>Pagina</Kop>
                <Kop rechts>Volgers</Kop>
                <Kop rechts>Erbij in periode</Kop>
                <Kop rechts>Paginaweergaven</Kop>
                <Kop rechts titel="Het deel van de paginaweergaven dat niet uit een advertentie kwam.">
                  Waarvan organisch
                </Kop>
                <Kop rechts>Interacties</Kop>
                <Kop rechts>Berichten</Kop>
              </tr>
            </thead>
            <tbody>
              {paginas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-ink-faint">
                    {laden ? "Laden…" : "Geen paginacijfers in deze periode."}
                  </td>
                </tr>
              ) : (
                paginas.map((p) => (
                  <tr key={p.account}>
                    <td className="border-b border-line-soft px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: accountKleur(p.account) }}
                        />
                        <span className="font-medium text-ink">{p.account}</span>
                      </span>
                    </td>
                    <td className="border-b border-line-soft px-3 py-2.5 text-right font-medium text-ink tabular-nums">
                      {p.volgers === null ? "—" : formatNumber(p.volgers)}
                    </td>
                    <td
                      className={`border-b border-line-soft px-3 py-2.5 text-right tabular-nums ${
                        p.volgersErbij > 0 ? "text-positive" : "text-ink-muted"
                      }`}
                    >
                      {p.volgersErbij > 0 ? `+${formatNumber(p.volgersErbij)}` : "0"}
                    </td>
                    <td className="border-b border-line-soft px-3 py-2.5 text-right text-ink tabular-nums">
                      {formatteer(p.weergaven, "aantal")}
                    </td>
                    <td className="border-b border-line-soft px-3 py-2.5 text-right text-ink-muted tabular-nums">
                      {formatteer(p.organischeWeergaven, "aantal")}
                    </td>
                    <td className="border-b border-line-soft px-3 py-2.5 text-right text-ink tabular-nums">
                      {formatteer(p.interacties, "aantal")}
                    </td>
                    <td className="border-b border-line-soft px-3 py-2.5 text-right text-ink-muted tabular-nums">
                      {formatNumber(p.berichten)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Paneel>

      <Paneel
        titel="Berichten"
        uitleg="Elk bericht dat in de periode geplaatst is, het meest bekeken bovenaan. De cijfers per bericht zijn levenslang (alles sinds plaatsing), dus ze lopen nog op zolang een bericht aandacht krijgt. Klik op de tekst om het bericht op Facebook te openen."
      >
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <Kop>Geplaatst</Kop>
                <Kop>Bericht</Kop>
                <Kop>Soort</Kop>
                <Kop rechts>Weergaven</Kop>
                <Kop rechts>Bereik</Kop>
                <Kop rechts>Reacties</Kop>
                <Kop rechts>Opmerkingen</Kop>
                <Kop rechts>Clicks</Kop>
              </tr>
            </thead>
            <tbody>
              {berichten.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-ink-faint">
                    {laden ? "Laden…" : "Geen berichten geplaatst in deze periode."}
                  </td>
                </tr>
              ) : (
                berichten.slice(0, berichtenLimiet).map((b) => (
                  <tr key={b.postId}>
                    <td className="border-b border-line-soft px-3 py-2.5 whitespace-nowrap text-ink-muted tabular-nums">
                      {kortDatumLabel(b.datum)}
                    </td>
                    <td className="max-w-[480px] border-b border-line-soft px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: accountKleur(b.account) }}
                        />
                        {b.url ? (
                          <a
                            href={b.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-ink underline decoration-line underline-offset-2 transition-colors hover:decoration-primary"
                            title={b.bericht}
                          >
                            {b.bericht || "Bericht zonder tekst"}
                          </a>
                        ) : (
                          <span className="truncate text-ink" title={b.bericht}>
                            {b.bericht || "Bericht zonder tekst"}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block pl-4 text-meta text-ink-faint">
                        {b.account}
                      </span>
                    </td>
                    <td className="border-b border-line-soft px-3 py-2.5 whitespace-nowrap text-ink-muted">
                      {berichtsoortLabel(b.soort)}
                    </td>
                    <td className="border-b border-line-soft px-3 py-2.5 text-right font-medium text-ink tabular-nums">
                      {formatteer(b.weergaven, "aantal")}
                    </td>
                    <td className="border-b border-line-soft px-3 py-2.5 text-right text-ink-muted tabular-nums">
                      {formatteer(b.bereik, "aantal")}
                    </td>
                    <td className="border-b border-line-soft px-3 py-2.5 text-right text-ink tabular-nums">
                      {formatNumber(b.reacties)}
                    </td>
                    <td className="border-b border-line-soft px-3 py-2.5 text-right text-ink tabular-nums">
                      {formatNumber(b.opmerkingen)}
                    </td>
                    <td className="border-b border-line-soft px-3 py-2.5 text-right text-ink tabular-nums">
                      {formatteer(b.clicks, "aantal")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {berichten.length > berichtenLimiet && (
          <div className="border-t border-line-soft px-5 py-3">
            <button
              type="button"
              onClick={() => setBerichtenLimiet((n) => n + BERICHTEN_STAP)}
              className="text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            >
              Nog {Math.min(BERICHTEN_STAP, berichten.length - berichtenLimiet)} berichten laten
              zien · {berichten.length - berichtenLimiet} te gaan
            </button>
          </div>
        )}
      </Paneel>

      <p className="text-meta text-ink-faint">
        Bron: Windsor.ai — de connectors <code className="text-ink-muted">facebook</code> (Meta
        Ads) en <code className="text-ink-muted">facebook_organic</code> (de pagina&apos;s zelf).
        Windsor haalt de cijfers een paar keer per dag bij Meta op, dus vandaag kan nog
        onvolledig zijn.
      </p>
    </div>
  );
}
