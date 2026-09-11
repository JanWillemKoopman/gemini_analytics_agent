"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useGrafiekKleuren } from "@/components/ThemeProvider";
import { alsGetal, alsLabel, AS_GROOTTE, formatteer, type Eenheid } from "./chartTheme";

/**
 * De visuele weergave van één queryresultaat.
 *
 * Het model kiest de vorm — het kent de bedoeling van de vraag, en die is uit de
 * datavorm alleen niet af te leiden: "omzet per maand" en "omzet per merk" leveren
 * allebei een label plus een getal op, maar het eerste is een lijn en het tweede een
 * staaf. Kiest het model iets dat niet bij de data past, dan corrigeert `kiesVorm()`
 * hieronder stilletjes naar iets wat wél werkt.
 */

export type Vorm = "verberg" | "kpi" | "staaf" | "lijn" | "donut" | "tabel";

export interface Weergave {
  vorm: Vorm;
  titel: string;
  labelKolom: string;
  waardeKolom: string;
  eenheid: Eenheid;
}

interface Props {
  weergave: Weergave;
  kolommen: string[];
  rijen: Record<string, unknown>[];
}

/**
 * Vangnet tegen een vorm die niet bij de data past. Een staafdiagram met één staaf of
 * een donut met twee segmenten is geen grafiek maar een getal met omhaal; een donut met
 * meer dan zes segmenten wordt onleesbaar.
 */
function kiesVorm(gevraagd: Vorm, aantalRijen: number, heeftWaarde: boolean): Vorm {
  if (gevraagd === "verberg" || gevraagd === "tabel") return gevraagd;
  if (!heeftWaarde) return "tabel";
  if (aantalRijen === 0) return "verberg";
  if (aantalRijen === 1) return "kpi";
  if (gevraagd === "kpi" && aantalRijen > 1) return "staaf";
  if (gevraagd === "donut" && aantalRijen > 6) return "staaf";
  if (aantalRijen > 25) return "tabel";
  return gevraagd;
}

function Kaart({
  titel,
  nevenwaarde,
  children,
}: {
  titel: string;
  nevenwaarde?: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="mt-1 mb-4 rounded-panel border border-line bg-card p-5">
      {(titel || nevenwaarde) && (
        <figcaption className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <span className="font-sans-w7 text-sm font-bold text-ink">{titel}</span>
          {nevenwaarde && (
            <span className="text-sm text-ink-muted">{nevenwaarde}</span>
          )}
        </figcaption>
      )}
      {children}
    </figure>
  );
}

function Tip({
  active,
  payload,
  eenheid,
}: {
  active?: boolean;
  payload?: { payload: { label: string; waarde: number } }[];
  eenheid: Eenheid;
}) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-card border border-line bg-card px-3 py-2 text-xs shadow-card">
      <p className="text-ink-muted">{d.label}</p>
      <p className="font-sans-w7 font-bold text-ink">{formatteer(d.waarde, eenheid)}</p>
    </div>
  );
}

/** Eén getal is geen grafiek. Het getal ís het antwoord, dus toon het als zodanig. */
function KpiTegel({
  waarde,
  label,
  eenheid,
  titel,
}: {
  waarde: number;
  label: string;
  eenheid: Eenheid;
  titel: string;
}) {
  return (
    <figure className="mt-1 mb-4 rounded-panel border border-line bg-surface px-6 py-7">
      {titel && (
        <figcaption className="text-xs font-medium tracking-wide text-ink-muted uppercase">
          {titel}
        </figcaption>
      )}
      {/* Bewust geen tabular-nums: op displaygrootte maken gelijke cijferbreedtes het
          getal los en slordig. Uitlijnen doe je in tabellen, niet hier. */}
      <p className="mt-2 font-sans-w7 text-5xl leading-none font-bold text-ink">
        {formatteer(waarde, eenheid)}
      </p>
      {label && label !== "totaal" && (
        <p className="mt-2 text-sm text-ink-muted">{label}</p>
      )}
    </figure>
  );
}

export default function Visual({ weergave, kolommen, rijen }: Props) {
  // Het palet volgt het gekozen theme (het oogje rechtsboven): een grafiek op het
  // Audi- of CUPRA-theme staat op een donkere kaart en heeft dus andere marks nodig
  // dan dezelfde grafiek op een licht theme.
  const kleuren = useGrafiekKleuren();
  const asStijl = { fontSize: AS_GROOTTE, fill: kleuren.as } as const;
  // Eén serie = één kleur; de eerste kleur van de reeks is de seriekleur.
  const serieKleur = kleuren.categorieen[0];

  const labelKolom =
    weergave.labelKolom && kolommen.includes(weergave.labelKolom)
      ? weergave.labelKolom
      : kolommen[0];
  const waardeKolom =
    weergave.waardeKolom && kolommen.includes(weergave.waardeKolom)
      ? weergave.waardeKolom
      : kolommen.find((k) => k !== labelKolom && rijen.some((r) => alsGetal(r[k]) !== null));

  const data = waardeKolom
    ? rijen
        .map((r) => ({
          label: alsLabel(r[labelKolom]),
          waarde: alsGetal(r[waardeKolom]),
        }))
        .filter((d): d is { label: string; waarde: number } => d.waarde !== null)
    : [];

  const vorm = kiesVorm(weergave.vorm, data.length, Boolean(waardeKolom));
  const { eenheid, titel } = weergave;

  if (vorm === "verberg") return null;

  if (vorm === "kpi") {
    const enige = data[0];
    if (!enige) return null;
    return (
      <KpiTegel
        waarde={enige.waarde}
        label={enige.label}
        eenheid={eenheid}
        titel={titel}
      />
    );
  }

  if (vorm === "tabel") {
    return (
      <Kaart titel={titel}>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr>
                {kolommen.map((k) => (
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
              {rijen.slice(0, 50).map((rij, i) => (
                <tr key={i} className={i % 2 === 1 ? "bg-surface" : "bg-card"}>
                  {kolommen.map((k) => (
                    <td key={k} className="px-3 py-2 text-ink tabular-nums">
                      {alsLabel(rij[k])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rijen.length > 50 && (
          <p className="mt-2 text-xs text-ink-faint">
            Eerste 50 van {rijen.length} rijen.
          </p>
        )}
      </Kaart>
    );
  }

  if (vorm === "donut") {
    const totaal = data.reduce((s, d) => s + d.waarde, 0);
    return (
      <Kaart titel={titel}>
        <div className="flex flex-wrap items-center gap-6">
          <ResponsiveContainer width={200} height={200}>
            <PieChart>
              <Pie
                data={data}
                dataKey="waarde"
                nameKey="label"
                innerRadius={52}
                outerRadius={92}
                // 2px tussenruimte in de vlakkleur i.p.v. een rand om elk segment.
                paddingAngle={1.5}
                stroke={kleuren.vlak}
                strokeWidth={2}
                isAnimationActive={false}
              >
                {data.map((d, i) => (
                  <Cell
                    key={d.label}
                    fill={kleuren.categorieen[i % kleuren.categorieen.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<Tip eenheid={eenheid} />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Legenda met de waarden erbij: identiteit hangt zo nooit alleen aan kleur. */}
          <ul className="flex min-w-[180px] flex-1 flex-col gap-2">
            {data.map((d, i) => (
              <li key={d.label} className="flex items-baseline gap-2.5 text-sm">
                <span
                  aria-hidden="true"
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: kleuren.categorieen[i % kleuren.categorieen.length] }}
                />
                <span className="flex-1 text-ink">{d.label}</span>
                <span className="font-sans-w7 font-semibold text-ink tabular-nums">
                  {formatteer(d.waarde, eenheid)}
                </span>
                {totaal > 0 && (
                  <span className="w-12 text-right text-ink-faint tabular-nums">
                    {((d.waarde / totaal) * 100).toLocaleString("nl-NL", {
                      maximumFractionDigits: 0,
                    })}
                    %
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </Kaart>
    );
  }

  if (vorm === "lijn") {
    // De laatste stand hoort afleesbaar te zijn zonder te hoveren; een tooltip mag
    // nooit de enige weg naar een waarde zijn.
    const laatste = data[data.length - 1];
    return (
      <Kaart
        titel={titel}
        nevenwaarde={
          laatste ? `${laatste.label}: ${formatteer(laatste.waarde, eenheid)}` : undefined
        }
      >
        {/* Hoogte omvat de asband, zodat de labels niet buiten de kaart vallen. */}
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid stroke={kleuren.raster} vertical={false} />
            <XAxis dataKey="label" tick={asStijl} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis
              tick={asStijl}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(v: number) => formatteer(v, eenheid, true)}
            />
            <Tooltip content={<Tip eenheid={eenheid} />} />
            <Line
              dataKey="waarde"
              type={kleuren.lijnvorm}
              stroke={serieKleur}
              strokeWidth={kleuren.lijndikte}
              // Alleen het eindpunt krijgt een marker: dat is de stand van nu, en het
              // maakt de laatste waarde afleesbaar zonder te hoveren.
              dot={(props: { cx?: number; cy?: number; index?: number }) => {
                const laatste = props.index === data.length - 1;
                if (!laatste || props.cx === undefined || props.cy === undefined) {
                  return <g key={props.index} />;
                }
                // De vorm van dat eindpunt hoort bij het merk: een gevulde stip, een
                // open ring (Bentley) of een vierkantje (Porsche, CUPRA).
                if (kleuren.punt === "vierkant") {
                  return (
                    <rect
                      key={props.index}
                      x={props.cx - 4}
                      y={props.cy - 4}
                      width={8}
                      height={8}
                      fill={serieKleur}
                      stroke={kleuren.vlak}
                      strokeWidth={2}
                    />
                  );
                }
                return (
                  <circle
                    key={props.index}
                    cx={props.cx}
                    cy={props.cy}
                    r={4}
                    fill={kleuren.punt === "open" ? kleuren.vlak : serieKleur}
                    stroke={kleuren.punt === "open" ? serieKleur : kleuren.vlak}
                    strokeWidth={2}
                  />
                );
              }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: kleuren.vlak }}
              isAnimationActive={false}
            >
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </Kaart>
    );
  }

  // Staaf: horizontaal, want categorienamen (merken, campagnes) zijn lang en blijven
  // zo gewoon leesbaar. Eén serie, dus één kleur voor alle staven — de lengte draagt
  // het verschil al, kleur zou niets toevoegen.
  const gesorteerd = [...data].sort((a, b) => b.waarde - a.waarde);
  return (
    <Kaart titel={titel}>
      <ResponsiveContainer width="100%" height={Math.max(120, gesorteerd.length * 38 + 30)}>
        <BarChart
          data={gesorteerd}
          layout="vertical"
          margin={{ top: 4, right: 56, bottom: 4, left: 4 }}
        >
          <CartesianGrid stroke={kleuren.raster} horizontal={false} />
          <XAxis
            type="number"
            tick={asStijl}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => formatteer(v, eenheid, true)}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={asStijl}
            tickLine={false}
            axisLine={false}
            width={120}
          />
          <Tooltip content={<Tip eenheid={eenheid} />} cursor={{ fill: kleuren.raster }} />
          <Bar
            dataKey="waarde"
            fill={serieKleur}
            // Afgeronde uiteinden aan de datazijde; de staaf blijft op de nullijn staan.
            // Hoeveel afgerond verschilt per merk: een pil bij Volkswagen, recht bij
            // CUPRA en Bentley.
            radius={[0, kleuren.staafradius, kleuren.staafradius, 0]}
            barSize={16}
            isAnimationActive={false}
          >
            {/* Waarde buiten het staafeinde: zo is de grafiek af te lezen zonder te
                hoveren, en kan een label nooit in een korte staaf worden afgekapt. */}
            <LabelList
              dataKey="waarde"
              position="right"
              offset={8}
              fill={kleuren.label}
              fontSize={12}
              fontWeight={600}
              formatter={(v: unknown) => formatteer(Number(v), eenheid, true)}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Kaart>
  );
}
