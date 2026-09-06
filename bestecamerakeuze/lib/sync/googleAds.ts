import { GoogleAdsApi, type Customer } from "google-ads-api";

/**
 * Directe koppeling met de Google Ads API — in tegenstelling tot lib/sync/bronnen.ts
 * (dat publieke Google Sheets kopieert) praat dit bestand rechtstreeks met Google via
 * OAuth, met een developer token en een refresh token.
 *
 * De accounts hangen onder één manager-account (MCC): GOOGLE_ADS_LOGIN_CUSTOMER_ID is
 * dat MCC, GOOGLE_ADS_CUSTOMER_IDS somt de losse klantaccounts op die uitgelezen worden.
 *
 * Elke rapportfunctie haalt de laatste 90 dagen op — genoeg voor kwartaalvragen, klein
 * genoeg om elke nacht in zijn geheel te verversen (dezelfde "truncate + insert"-
 * filosofie als bronnen.ts; zie app/api/sync-ads/route.ts).
 */

export interface AdsAccount {
  /** Klant-id zonder streepjes, bv. "1234567890". */
  id: string;
  /** Leesbare naam voor in de database en de chat. Valt terug op het id als die ontbreekt. */
  naam: string;
}

const PERIODE = "LAST_90_DAYS";

/**
 * GOOGLE_ADS_CUSTOMER_IDS is een kommagescheiden lijst, elk optioneel voorzien van een
 * leesbare naam: "1234567890:Udenhout Trucks,2345678901:Udenhout Bedrijfswagens".
 * Zonder naam wordt het kale id gebruikt.
 */
function ladenAccounts(): AdsAccount[] {
  const ruw = process.env.GOOGLE_ADS_CUSTOMER_IDS ?? "";
  return ruw
    .split(",")
    .map((deel) => deel.trim())
    .filter(Boolean)
    .map((deel) => {
      const [id, naam] = deel.split(":");
      const schoonId = id.trim().replace(/-/g, "");
      return { id: schoonId, naam: naam?.trim() || schoonId };
    });
}

export function heeftAdsConfig(): boolean {
  return Boolean(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
      process.env.GOOGLE_ADS_CLIENT_ID &&
      process.env.GOOGLE_ADS_CLIENT_SECRET &&
      process.env.GOOGLE_ADS_REFRESH_TOKEN &&
      process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID &&
      ladenAccounts().length > 0,
  );
}

function maakClient(): GoogleAdsApi {
  return new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });
}

function klantVerbinding(client: GoogleAdsApi, account: AdsAccount): Customer {
  return client.Customer({
    customer_id: account.id,
    login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID!.replace(/-/g, ""),
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
  });
}

/** Google Ads geeft bedragen in micros terug (1 euro = 1.000.000 micros). */
function euro(micros: number | null | undefined): number {
  return Math.round(((micros ?? 0) / 1_000_000) * 100) / 100;
}

async function voorElkAccount<T>(
  ophalen: (customer: Customer, account: AdsAccount) => Promise<T[]>,
): Promise<T[]> {
  const client = maakClient();
  const alleRijen: T[] = [];
  for (const account of ladenAccounts()) {
    const customer = klantVerbinding(client, account);
    alleRijen.push(...(await ophalen(customer, account)));
  }
  return alleRijen;
}

export interface CampagneRij {
  klant_id: string;
  klant_naam: string;
  campagne_id: string;
  campagne_naam: string;
  status: string;
  datum: string;
  kosten: number;
  kliks: number;
  vertoningen: number;
  conversies: number;
  conversiewaarde: number;
}

export async function haalCampagnes(): Promise<CampagneRij[]> {
  return voorElkAccount(async (customer, account) => {
    const rijen = await customer.query(`
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        segments.date,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE segments.date DURING ${PERIODE}
    `);
    return (rijen as any[]).map((r) => ({
      klant_id: account.id,
      klant_naam: account.naam,
      campagne_id: String(r.campaign.id),
      campagne_naam: r.campaign.name as string,
      status: r.campaign.status as string,
      datum: r.segments.date as string,
      kosten: euro(r.metrics.cost_micros),
      kliks: r.metrics.clicks ?? 0,
      vertoningen: r.metrics.impressions ?? 0,
      conversies: r.metrics.conversions ?? 0,
      conversiewaarde: r.metrics.conversions_value ?? 0,
    }));
  });
}

export interface ZoekwoordRij {
  klant_id: string;
  klant_naam: string;
  campagne_naam: string;
  advertentiegroep_naam: string;
  zoekwoord_tekst: string;
  zoekwoord_matchtype: string;
  kwaliteitsscore: number | null;
  datum: string;
  kosten: number;
  kliks: number;
  vertoningen: number;
}

export async function haalZoekwoorden(): Promise<ZoekwoordRij[]> {
  return voorElkAccount(async (customer, account) => {
    const rijen = await customer.query(`
      SELECT
        campaign.name,
        ad_group.name,
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group_criterion.quality_info.quality_score,
        segments.date,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions
      FROM keyword_view
      WHERE segments.date DURING ${PERIODE}
    `);
    return (rijen as any[]).map((r) => ({
      klant_id: account.id,
      klant_naam: account.naam,
      campagne_naam: r.campaign.name as string,
      advertentiegroep_naam: r.ad_group.name as string,
      zoekwoord_tekst: r.ad_group_criterion.keyword.text as string,
      zoekwoord_matchtype: r.ad_group_criterion.keyword.match_type as string,
      kwaliteitsscore: r.ad_group_criterion.quality_info?.quality_score ?? null,
      datum: r.segments.date as string,
      kosten: euro(r.metrics.cost_micros),
      kliks: r.metrics.clicks ?? 0,
      vertoningen: r.metrics.impressions ?? 0,
    }));
  });
}

export interface AdvertentiegroepRij {
  klant_id: string;
  klant_naam: string;
  campagne_naam: string;
  advertentiegroep_naam: string;
  status: string;
  datum: string;
  kosten: number;
  kliks: number;
  vertoningen: number;
  conversies: number;
  conversiewaarde: number;
}

export async function haalAdvertentiegroepen(): Promise<AdvertentiegroepRij[]> {
  return voorElkAccount(async (customer, account) => {
    const rijen = await customer.query(`
      SELECT
        campaign.name,
        ad_group.name,
        ad_group.status,
        segments.date,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.conversions,
        metrics.conversions_value
      FROM ad_group
      WHERE segments.date DURING ${PERIODE}
    `);
    return (rijen as any[]).map((r) => ({
      klant_id: account.id,
      klant_naam: account.naam,
      campagne_naam: r.campaign.name as string,
      advertentiegroep_naam: r.ad_group.name as string,
      status: r.ad_group.status as string,
      datum: r.segments.date as string,
      kosten: euro(r.metrics.cost_micros),
      kliks: r.metrics.clicks ?? 0,
      vertoningen: r.metrics.impressions ?? 0,
      conversies: r.metrics.conversions ?? 0,
      conversiewaarde: r.metrics.conversions_value ?? 0,
    }));
  });
}

export interface ConversieRij {
  klant_id: string;
  klant_naam: string;
  campagne_naam: string;
  conversieactie_naam: string;
  conversiecategorie: string;
  datum: string;
  aantal_conversies: number;
  conversiewaarde: number;
}

export async function haalConversies(): Promise<ConversieRij[]> {
  return voorElkAccount(async (customer, account) => {
    const rijen = await customer.query(`
      SELECT
        campaign.name,
        segments.conversion_action_name,
        segments.conversion_action_category,
        segments.date,
        metrics.all_conversions,
        metrics.all_conversions_value
      FROM campaign
      WHERE segments.date DURING ${PERIODE}
    `);
    return (rijen as any[]).map((r) => ({
      klant_id: account.id,
      klant_naam: account.naam,
      campagne_naam: r.campaign.name as string,
      conversieactie_naam: r.segments.conversion_action_name as string,
      conversiecategorie: r.segments.conversion_action_category as string,
      datum: r.segments.date as string,
      aantal_conversies: r.metrics.all_conversions ?? 0,
      conversiewaarde: r.metrics.all_conversions_value ?? 0,
    }));
  });
}
