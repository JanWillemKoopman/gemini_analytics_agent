"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useGrafiekKleuren } from "@/components/ThemeProvider";
import { AS_GROOTTE, formatteer, type Eenheid } from "@/components/chat/chartTheme";
import {
  bruikbareKorrels,
  groepeer,
  groepeerPerPeriode,
  periodeLabel,
  periodeSleutel,
  standaardKorrel,
  telOp,
  waardeVan,
  type Korrel,
  type Kubus,
} from "@/lib/kanalen/kubus";
import type { Statistiek } from "@/lib/windsor/velden";

/**
 * De grafiek boven elke Kanalen-pagina.
 *
 * Drie keuzes van de gebruiker, en één die hier vastligt:
 *
 *  - **Statistiek**: welk cijfer staat er op de as. Eén tegelijk — nooit twee assen in
 *    één grafiek. Twee maatstaven met een verschillende schaal naast elkaar zetten is de
 *    snelste manier om een verband te suggereren dat er niet is.
 *  - **Korrel**: dag, week, maand of kwartaal. Alleen de korrels die bij de gekozen
 *    periode iets opleveren zijn aanklikbaar (zie `bruikbareKorrels`). De korrel waarop
 *    de grafiek opengaat volgt de lengte van de periode (`standaardKorrel`) en blijft
 *    daarop staan zolang je zelf niets kiest — een maand opent dus per dag en niet, zoals
 *    eerder, op vijf weekstaven.
 *  - **Uitsplitsing**: één lijn, of een lijn per platform/account. Bij meer dan zes
 *    categorieën gaan de rest op één hoop onder "Overig" — een zevende kleur bestaat
 *    niet in het palet, en een herhaalde kleur liegt over identiteit.
 *
 * Een afgeleide statistiek (CTR, kosten per klik) wordt per periode opnieuw berekend uit
 * de sommen van die periode, nooit door de dagwaarden te middelen.
 */

type Props = {
  kubus: Kubus;
  statistieken: Statistiek[];
  /** Dimensies waarop de reeks uitgesplitst mag worden. */
  uitsplitsbaar: { id: string; label: string }[];
  /** Statistiek die bij het openen getoond wordt. */
  standaardStatistiek: string;
};

const MAX_REEKSEN = 6;

function eenheidVan(statistiek: Statistiek): Eenheid {
  if (statistiek.eenheid === "euro") return "euro";
  if (statistiek.eenheid === "procent") return "procent";
  return "aantal";
}

export default function TijdGrafiek({
  kubus,
  statistieken,
  uitsplitsbaar,
  standaardStatistiek,
}: Props) {
  const kleuren = useGrafiekKleuren();
  const korrels = useMemo(() => bruikbareKorrels(kubus), [kubus]);
  // `null` betekent "volg de periode". Zodra je zelf een korrel aanklikt blijft die staan
  // zolang hij kan; wordt hij door een periodewissel onmogelijk (dag verdwijnt boven de
  // 120 dagen), dan valt de grafiek terug op wat bij die periode hoort in plaats van leeg
  // te blijven.
  const [korrelKeuze, setKorrelKeuze] = useState<Korrel | null>(null);
  const [statistiekId, setStatistiekId] = useState(standaardStatistiek);
  const [splitsing, setSplitsing] = useState<string>("");

  const actieveKorrel =
    korrelKeuze && korrels.includes(korrelKeuze) ? korrelKeuze : standaardKorrel(kubus, korrels);
  const statistiek =
    statistieken.find((s) => s.id === statistiekId) ?? statistieken[0];

  // Een stand (het aantal volgers) is geen hoeveelheid die je per periode optelt maar een
  // niveau dat meebeweegt. Als staaf vanaf nul zijn vijf weken groei niet van elkaar te
  // onderscheiden — vandaar: altijd een lijn, en een as die zich naar de data voegt.
  const isStand = Boolean(statistiek && kubus.standKolommen?.includes(statistiek.id));

  const { data, reeksen } = useMemo(() => {
    if (!statistiek) return { data: [] as Record<string, number | string | boolean | null>[], reeksen: [] as string[] };

    const perPeriode = groepeerPerPeriode(kubus, kubus.rijen, actieveKorrel);

    if (!splitsing) {
      return {
        data: perPeriode.map((g) => ({
          periode: g.label,
          waarde: waardeVan(statistiek, g.totalen),
          volledig: g.volledig !== false,
        })),
        reeksen: [],
      };
    }

    // Uitsplitsen: bepaal eerst welke categorieën groot genoeg zijn om een eigen lijn te
    // krijgen, gemeten over de hele periode. Zo houdt een categorie dezelfde kleur van
    // begin tot eind, ook als hij in één week even wegvalt.
    const perCategorie = groepeer(kubus, kubus.rijen, splitsing)
      .map((g) => ({ naam: g.label, omvang: Math.abs(waardeVan(statistiek, g.totalen) ?? 0) }))
      .sort((a, b) => b.omvang - a.omvang);

    const groot = perCategorie.slice(0, MAX_REEKSEN).map((c) => c.naam);
    const heeftOverig = perCategorie.length > MAX_REEKSEN;
    const namen = heeftOverig ? [...groot, "Overig"] : groot;

    const kolom = kubus.dimensies.indexOf(splitsing);
    const datumKolom = kubus.dimensies.indexOf("datum");
    const labels = kubus.labels[splitsing] ?? [];
    const datums = kubus.labels.datum ?? [];
    const start = kubus.dimensies.length;

    // Per periode én per categorie optellen, daarna pas de afgeleide berekenen.
    const emmers = new Map<string, Map<string, number[]>>();
    for (const rij of kubus.rijen) {
      const datum = datums[rij[datumKolom]];
      if (!datum) continue;
      const periode = periodeSleutel(datum, actieveKorrel);
      const naam = labels[rij[kolom]] ?? "—";
      const categorie = groot.includes(naam) ? naam : "Overig";

      let perNaam = emmers.get(periode);
      if (!perNaam) {
        perNaam = new Map();
        emmers.set(periode, perNaam);
      }
      let totalen = perNaam.get(categorie);
      if (!totalen) {
        totalen = new Array(kubus.kolommen.length).fill(0);
        perNaam.set(categorie, totalen);
      }
      for (let i = 0; i < kubus.kolommen.length; i++) totalen[i] += rij[start + i] ?? 0;
    }

    const rijen = perPeriode.map((g) => {
      const punt: Record<string, number | string | boolean | null> = {
        periode: g.label,
        volledig: g.volledig !== false,
      };
      const perNaam = emmers.get(g.sleutel);
      for (const naam of namen) {
        const rauw = perNaam?.get(naam);
        if (!rauw) {
          punt[naam] = null;
          continue;
        }
        const totalen: Record<string, number> = {};
        kubus.kolommen.forEach((k, i) => (totalen[k] = rauw[i]));
        punt[naam] = waardeVan(statistiek, totalen);
      }
      return punt;
    });

    return { data: rijen, reeksen: namen };
  }, [kubus, actieveKorrel, splitsing, statistiek]);

  const totaal = useMemo(() => {
    if (!statistiek) return null;
    return waardeVan(statistiek, telOp(kubus, kubus.rijen));
  }, [kubus, statistiek]);

  if (!statistiek) return null;
  const eenheid = eenheidVan(statistiek);

  // Een afgeleide statistiek is een verhouding en hoort als lijn, een stand net zo; een
  // optelbare hoeveelheid per periode hoort als staaf. De vorm volgt dus wat het cijfer
  // is, niet wat er toevallig mooi uitziet.
  const alsLijn = Boolean(statistiek.afgeleid) || isStand || reeksen.length > 0;

  // Een as vanaf nul hoort bij een hoeveelheid: dan zegt de hoogte van de staaf iets. Bij
  // een stand van tienduizenden volgers drukt diezelfde nul de hele beweging plat.
  const asBereik: [number | "auto", number | "auto"] = isStand ? ["auto", "auto"] : [0, "auto"];

  // De eerste en de laatste periode vallen vaak maar deels binnen de gekozen datumrange.
  // Dat is geen daling maar een halve week, en zonder dit zinnetje leest het als het
  // eerste.
  const deelperiodes = data.filter((d) => d.volledig === false).map((d) => String(d.periode));

  return (
    <section className="kaart-omlijst kaart-accent rounded-panel border border-line bg-card p-5 shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-sans-w7 text-cell font-semibold text-ink">{statistiek.label}</h2>
          <p className="mt-0.5 text-meta text-ink-muted">{statistiek.uitleg}</p>
        </div>
        <div className="text-right">
          <p className="font-sans-w7 text-title font-semibold text-ink">
            {formatteer(totaal, eenheid)}
          </p>
          <p className="text-meta text-ink-faint">
            {statistiek.afgeleid ? "over de hele selectie" : "totaal in deze selectie"}
          </p>
        </div>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 border-y border-line-soft py-3">
        <Keuze label="Statistiek">
          <select
            id="grafiek-statistiek"
            value={statistiek.id}
            onChange={(e) => setStatistiekId(e.target.value)}
            className="rounded-control border border-line bg-card px-2 py-1 text-sm text-ink"
          >
            {statistieken.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Keuze>

        <Keuze label="Per">
          <div className="flex rounded-control border border-line p-0.5">
            {(["dag", "week", "maand", "kwartaal"] as Korrel[]).map((k) => {
              const kan = korrels.includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  disabled={!kan}
                  onClick={() => setKorrelKeuze(k)}
                  title={kan ? undefined : "Niet beschikbaar bij deze periode"}
                  className={`rounded-control px-2.5 py-1 text-sm capitalize transition-colors duration-[var(--duur-snel)] ease-merk ${
                    k === actieveKorrel
                      ? "bg-primary text-on-primary"
                      : kan
                        ? "text-ink-muted hover:bg-surface"
                        : "cursor-not-allowed text-ink-faint opacity-50"
                  }`}
                >
                  {k}
                </button>
              );
            })}
          </div>
        </Keuze>

        {uitsplitsbaar.length > 0 && (
          <Keuze label="Uitsplitsen naar">
            <select
              id="grafiek-splitsing"
              value={splitsing}
              onChange={(e) => setSplitsing(e.target.value)}
              className="rounded-control border border-line bg-card px-2 py-1 text-sm text-ink"
            >
              <option value="">Niets — één lijn</option>
              {uitsplitsbaar.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </Keuze>
        )}
      </div>

      {deelperiodes.length > 0 && (
        <p className="mt-3 text-meta text-ink-faint">
          {deelperiodes.length === 1 ? `${deelperiodes[0]} is een` : `${deelperiodes.join(" en ")} zijn`}{" "}
          deelperiode{deelperiodes.length === 1 ? "" : "s"}: {deelperiodes.length === 1 ? "hij valt" : "ze vallen"}{" "}
          maar gedeeltelijk binnen de gekozen datumrange en {deelperiodes.length === 1 ? "telt" : "tellen"} dus minder
          dagen dan de rest.
        </p>
      )}

      <div className="mt-4 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {alsLijn ? (
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid stroke={kleuren.raster} vertical={false} />
              <XAxis
                dataKey="periode"
                tick={{ fontSize: AS_GROOTTE, fill: kleuren.as }}
                tickLine={false}
                axisLine={{ stroke: kleuren.raster }}
                minTickGap={16}
              />
              <YAxis
                tick={{ fontSize: AS_GROOTTE, fill: kleuren.as }}
                tickLine={false}
                axisLine={false}
                width={64}
                domain={asBereik}
                tickFormatter={(v: number) => formatteer(v, eenheid, true)}
              />
              <Tooltip
                formatter={(v) => formatteer(typeof v === "number" ? v : null, eenheid)}
                contentStyle={{
                  borderRadius: 10,
                  border: "1px solid var(--color-line)",
                  background: "var(--color-card)",
                  color: "var(--color-ink)",
                  fontSize: 13,
                }}
              />
              {reeksen.length > 0 && <Legend wrapperStyle={{ fontSize: 12, color: kleuren.as }} />}
              {reeksen.length === 0 ? (
                <Line
                  type={kleuren.lijnvorm}
                  dataKey="waarde"
                  name={statistiek.label}
                  stroke={kleuren.categorieen[0]}
                  strokeWidth={kleuren.lijndikte}
                  dot={false}
                  connectNulls
                />
              ) : (
                reeksen.map((naam, i) => (
                  <Line
                    key={naam}
                    type={kleuren.lijnvorm}
                    dataKey={naam}
                    stroke={
                      naam === "Overig"
                        ? kleuren.context
                        : kleuren.categorieen[i % kleuren.categorieen.length]
                    }
                    strokeWidth={kleuren.lijndikte}
                    dot={false}
                    connectNulls
                  />
                ))
              )}
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid stroke={kleuren.raster} vertical={false} />
              <XAxis
                dataKey="periode"
                tick={{ fontSize: AS_GROOTTE, fill: kleuren.as }}
                tickLine={false}
                axisLine={{ stroke: kleuren.raster }}
                minTickGap={16}
              />
              <YAxis
                tick={{ fontSize: AS_GROOTTE, fill: kleuren.as }}
                tickLine={false}
                axisLine={false}
                width={64}
                tickFormatter={(v: number) => formatteer(v, eenheid, true)}
              />
              <Tooltip
                cursor={{ fill: kleuren.raster }}
                formatter={(v) => formatteer(typeof v === "number" ? v : null, eenheid)}
                contentStyle={{
                  borderRadius: 10,
                  border: "1px solid var(--color-line)",
                  background: "var(--color-card)",
                  color: "var(--color-ink)",
                  fontSize: 13,
                }}
              />
              <Bar
                dataKey="waarde"
                name={statistiek.label}
                fill={kleuren.categorieen[0]}
                radius={[kleuren.staafradius, kleuren.staafradius, 0, 0]}
              >
                {data.map((punt, i) => (
                  <Cell
                    key={i}
                    fill={kleuren.categorieen[0]}
                    fillOpacity={punt.volledig === false ? 0.35 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function Keuze({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2">
      <span className="label-theme text-label text-ink-faint">{label}</span>
      {children}
    </label>
  );
}

/** Herbruikt door de tabel, zodat kop en grafiek dezelfde periodenaam tonen. */
export { periodeLabel };
