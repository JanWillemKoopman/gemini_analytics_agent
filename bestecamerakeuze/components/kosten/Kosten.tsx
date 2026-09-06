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
import { formatNumber, formatUsd } from "@/lib/format";
import { AS_GROOTTE } from "@/components/chat/chartTheme";
import { useGrafiekKleuren } from "@/components/ThemeProvider";

interface KostenRegel {
  datum: string;
  model: string;
  tokens: number;
  kostenUsd: number;
}

interface KostenPerDag {
  datum: string;
  kostenUsd: number;
}

interface Overzicht {
  totaalKostenUsd: number;
  totaalTokens: number;
  perDag: KostenPerDag[];
  regels: KostenRegel[];
  beschikbareModellen: string[];
}

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

function DagTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { datum: string; kostenUsd: number } }[];
}) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-card border border-line bg-card px-3 py-2 text-xs shadow-card">
      <p className="text-ink-muted">{volDatumLabel(d.datum)}</p>
      <p className="font-sans-w7 font-bold text-ink">{formatUsd(d.kostenUsd, 4)}</p>
    </div>
  );
}

export default function Kosten({ ingelogd }: { ingelogd: boolean }) {
  // Zelfde palet als de chatgrafieken; volgt het gekozen theme.
  const kleuren = useGrafiekKleuren();
  const asStijl = { fontSize: AS_GROOTTE, fill: kleuren.as } as const;
  const [periode, setPeriode] = useState<Periode>({ van: dagenGeleden(29), tot: vandaag() });
  const [modellen, setModellen] = useState<string[]>([]);
  const [data, setData] = useState<Overzicht | null>(null);
  const [laden, setLaden] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const laad = useCallback(async () => {
    setLaden(true);
    setFout(null);
    try {
      const params = new URLSearchParams({ van: periode.van, tot: periode.tot });
      if (modellen.length > 0) params.set("modellen", modellen.join(","));
      const res = await fetch(`/api/kosten?${params.toString()}`);
      const json = (await res.json()) as Overzicht & { fout?: string };
      if (!res.ok) throw new Error(json.fout ?? "Kon de kosten niet ophalen.");
      setData(json);
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Kon de kosten niet ophalen.");
    } finally {
      setLaden(false);
    }
  }, [periode.van, periode.tot, modellen]);

  useEffect(() => {
    if (ingelogd) void laad();
  }, [ingelogd, laad]);

  // Bij veel dagen in de grafiek wordt elk label tonen onleesbaar; laat de as dan zelf
  // een leesbare selectie kiezen in plaats van alles op te proppen.
  const dichteAs = (data?.perDag.length ?? 0) > 45;

  const balkjes = useMemo(
    () => data?.perDag.map((d) => ({ ...d, label: kortDatumLabel(d.datum) })) ?? [],
    [data],
  );

  if (!ingelogd) {
    return (
      <div className="rounded-panel border border-line bg-surface p-8 text-center">
        <p className="font-sans-w7 text-lg font-bold text-ink">Log in om de kosten te bekijken</p>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-sans-w7 text-base font-bold text-ink">Claude API-kosten</p>
          <p className="mt-1 text-sm text-ink-muted">
            Schatting op basis van de gepubliceerde prijs per model — Anthropic factureert
            in dollars, geen omrekening naar euro&apos;s dus.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            label="Model"
            options={data?.beschikbareModellen ?? []}
            selected={modellen}
            onChange={setModellen}
          />
          <PeriodeFilter periode={periode} onChange={setPeriode} />
        </div>
      </div>

      {fout && (
        <p className="rounded-card border border-orange bg-card px-4 py-3 text-sm text-orange">
          {fout}
        </p>
      )}

      <div className="rounded-panel border border-line bg-surface px-6 py-7">
        <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
          Totale uitgaven in gekozen periode
        </p>
        <p className="mt-2 font-sans-w7 text-5xl leading-none font-bold text-ink">
          {formatUsd(data?.totaalKostenUsd ?? 0)}
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          {formatNumber(data?.totaalTokens ?? 0)} tokens · {kortDatumLabel(periode.van)} –{" "}
          {kortDatumLabel(periode.tot)}
        </p>
      </div>

      <div className="rounded-panel border border-line bg-card p-5">
        <p className="mb-4 font-sans-w7 text-sm font-bold text-ink">Uitgaven per dag</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={balkjes} margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
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
              width={64}
              tickFormatter={(v: number) => formatUsd(v, 2)}
            />
            <Tooltip content={<DagTooltip />} cursor={{ fill: "rgba(25,36,59,0.04)" }} />
            <Bar
              dataKey="kostenUsd"
              fill={kleuren.categorieen[0]}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
              // Elke dag krijgt een staaf, ook bij €0 — anders lijkt een stille dag
              // afwezig in plaats van "niets uitgegeven".
              minPointSize={2}
            />
          </BarChart>
        </ResponsiveContainer>
        {laden && <p className="mt-2 text-xs text-ink-faint">Bijwerken…</p>}
      </div>

      <div className="rounded-panel border border-line bg-card p-5">
        <p className="mb-4 font-sans-w7 text-sm font-bold text-ink">Uitgaven per dag en model</p>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr>
                {["Dag", "Model", "Tokens", "Uitgaven"].map((k) => (
                  <th
                    key={k}
                    className="border-b border-line bg-accent px-3 py-2 text-left font-sans-w7 text-xs font-semibold tracking-wide text-ink uppercase"
                  >
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.regels.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-ink-faint">
                    {laden ? "Laden…" : "Geen uitgaven in deze periode."}
                  </td>
                </tr>
              ) : (
                data?.regels.map((r, i) => (
                  <tr key={`${r.datum}-${r.model}`} className={i % 2 === 1 ? "bg-surface" : "bg-card"}>
                    <td className="px-3 py-2 text-ink tabular-nums">{volDatumLabel(r.datum)}</td>
                    <td className="px-3 py-2 text-ink">{r.model}</td>
                    <td className="px-3 py-2 text-ink tabular-nums">{formatNumber(r.tokens)}</td>
                    <td className="px-3 py-2 text-ink tabular-nums">{formatUsd(r.kostenUsd, 4)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
