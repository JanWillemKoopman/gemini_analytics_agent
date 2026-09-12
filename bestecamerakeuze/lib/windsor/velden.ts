/**
 * Welke velden halen we op, en welke statistieken toont het dashboard?
 *
 * Twee dingen in één bestand, omdat ze één ding zijn: wat we bij Windsor opvragen is
 * precies wat er in een tabel te kiezen valt. Staat een statistiek hieronder niet, dan
 * wordt hij ook niet opgehaald — en andersom halen we niets op wat nergens te zien is.
 *
 * ## Optelbaar versus afgeleid
 *
 * De belangrijkste scheiding hier. Uitgaven, vertoningen en klikken zijn **optelbaar**:
 * de waarde van een selectie is de som van de rijen. CTR, CPC en kosten per lead zijn
 * **afgeleid** en mogen nooit worden opgeteld of gemiddeld — het gemiddelde van tien
 * CTR's is niet de CTR van die tien advertenties samen, want een advertentie met tien
 * vertoningen telt dan even zwaar als een met tienduizend. Een afgeleide statistiek
 * wordt daarom altijd ná het optellen berekend, uit de sommen van zijn twee bronnen.
 * Dat is precies waar dashboards het vaakst stilletjes de mist in gaan.
 */

import type { Connector } from "@/lib/windsor/api";

export type Eenheid = "euro" | "aantal" | "procent" | "seconden";

export interface Statistiek {
  /** Sleutel in de datarij; bij afgeleide statistieken alleen een id. */
  id: string;
  label: string;
  /** Eén zin in gewone taal, voor de "Zo lees je dit"-stand van de tabel. */
  uitleg: string;
  eenheid: Eenheid;
  /** Staat hij meteen in de tabel, of pas als iemand hem aanzet? */
  standaard: boolean;
  /**
   * Alleen bij afgeleide statistieken: teller en noemer, allebei optelbare velden. De
   * UI berekent `teller / noemer` ná het aggregeren, nooit ervoor.
   */
  afgeleid?: { teller: string; noemer: string; maal?: number };
  /** Lager is beter (kosten per klik, kosten per lead) — bepaalt de kleur van een verschil. */
  lagerIsBeter?: boolean;
}

// ---------------------------------------------------------------------------
// Advertenties — gedeeld door de pagina's Social ads en Google Ads
// ---------------------------------------------------------------------------

export const ADVERTENTIE_STATISTIEKEN: Statistiek[] = [
  {
    id: "uitgaven",
    label: "Uitgaven",
    uitleg: "Wat er in deze periode daadwerkelijk is uitgegeven, exclusief btw.",
    eenheid: "euro",
    standaard: true,
  },
  {
    id: "vertoningen",
    label: "Vertoningen",
    uitleg: "Hoe vaak de advertentie op iemands scherm is verschenen, herhalingen meegeteld.",
    eenheid: "aantal",
    standaard: true,
  },
  {
    id: "bereik",
    label: "Bereik",
    uitleg: "Hoeveel verschillende mensen de advertentie minstens één keer zagen.",
    eenheid: "aantal",
    standaard: true,
  },
  {
    id: "klikken",
    label: "Klikken",
    uitleg: "Alle klikken op de advertentie, ook die niet naar de website leiden.",
    eenheid: "aantal",
    standaard: true,
  },
  {
    id: "link_klikken",
    label: "Linkklikken",
    uitleg: "Alleen de klikken die iemand daadwerkelijk naar de bestemming brachten.",
    eenheid: "aantal",
    standaard: false,
  },
  {
    id: "interacties",
    label: "Interacties",
    uitleg: "Reacties, likes, opslagen en delen op de advertentie bij elkaar.",
    eenheid: "aantal",
    standaard: false,
  },
  {
    id: "videoweergaven",
    label: "Videoweergaven",
    uitleg: "Hoe vaak de video minstens drie seconden is bekeken.",
    eenheid: "aantal",
    standaard: false,
  },
  {
    id: "leads",
    label: "Leads",
    uitleg: "Ingevulde leadformulieren die het platform aan deze advertentie toeschrijft.",
    eenheid: "aantal",
    standaard: true,
  },
  {
    id: "conversies",
    label: "Conversies",
    uitleg: "Alle conversie-acties samen die het platform aan deze advertentie toeschrijft.",
    eenheid: "aantal",
    standaard: true,
  },
  {
    id: "conversiewaarde",
    label: "Conversiewaarde",
    uitleg: "De waarde die aan die conversies is toegekend, voor zover die is ingesteld.",
    eenheid: "euro",
    standaard: false,
  },

  // Afgeleid — berekend ná het optellen, zie de toelichting bovenaan dit bestand.
  {
    id: "ctr",
    label: "CTR",
    uitleg: "Van elke honderd vertoningen dit percentage geklikt.",
    eenheid: "procent",
    standaard: true,
    afgeleid: { teller: "klikken", noemer: "vertoningen", maal: 100 },
  },
  {
    id: "cpc",
    label: "Kosten per klik",
    uitleg: "Wat één klik gemiddeld kostte in deze selectie.",
    eenheid: "euro",
    standaard: true,
    afgeleid: { teller: "uitgaven", noemer: "klikken" },
    lagerIsBeter: true,
  },
  {
    id: "cpm",
    label: "Kosten per 1.000 vertoningen",
    uitleg: "Wat het kostte om de advertentie duizend keer te laten zien.",
    eenheid: "euro",
    standaard: false,
    afgeleid: { teller: "uitgaven", noemer: "vertoningen", maal: 1000 },
    lagerIsBeter: true,
  },
  {
    id: "cpl",
    label: "Kosten per lead",
    uitleg: "Wat één lead gemiddeld kostte in deze selectie.",
    eenheid: "euro",
    standaard: true,
    afgeleid: { teller: "uitgaven", noemer: "leads" },
    lagerIsBeter: true,
  },
  {
    id: "cpa",
    label: "Kosten per conversie",
    uitleg: "Wat één conversie gemiddeld kostte in deze selectie.",
    eenheid: "euro",
    standaard: false,
    afgeleid: { teller: "uitgaven", noemer: "conversies" },
    lagerIsBeter: true,
  },
  {
    id: "frequentie",
    label: "Frequentie",
    uitleg: "Hoe vaak dezelfde persoon de advertentie gemiddeld zag.",
    eenheid: "aantal",
    standaard: false,
    afgeleid: { teller: "vertoningen", noemer: "bereik" },
  },
  {
    id: "roas",
    label: "Rendement op advertentiebudget",
    uitleg: "Hoeveel euro conversiewaarde elke uitgegeven euro opleverde.",
    eenheid: "aantal",
    standaard: false,
    afgeleid: { teller: "conversiewaarde", noemer: "uitgaven" },
  },
];

// ---------------------------------------------------------------------------
// Organische posts
// ---------------------------------------------------------------------------

export const POST_STATISTIEKEN: Statistiek[] = [
  {
    id: "vertoningen_organisch",
    label: "Organische vertoningen",
    uitleg: "Hoe vaak de post is getoond zonder dat er advertentiegeld achter zat.",
    eenheid: "aantal",
    standaard: true,
  },
  {
    id: "bereik",
    label: "Bereik",
    uitleg: "Hoeveel verschillende mensen de post minstens één keer zagen.",
    eenheid: "aantal",
    standaard: true,
  },
  {
    id: "interacties",
    label: "Interacties",
    uitleg: "Likes, reacties, opslagen en delen bij elkaar opgeteld.",
    eenheid: "aantal",
    standaard: true,
  },
  {
    id: "likes",
    label: "Likes",
    uitleg: "Het aantal likes en andere reacties op de post.",
    eenheid: "aantal",
    standaard: false,
  },
  {
    id: "reacties",
    label: "Reacties",
    uitleg: "Het aantal geschreven reacties onder de post.",
    eenheid: "aantal",
    standaard: false,
  },
  {
    id: "opgeslagen",
    label: "Opgeslagen",
    uitleg: "Hoe vaak iemand de post bewaarde om later terug te zien.",
    eenheid: "aantal",
    standaard: false,
  },
  {
    id: "gedeeld",
    label: "Gedeeld",
    uitleg: "Hoe vaak de post is doorgestuurd of gedeeld.",
    eenheid: "aantal",
    standaard: false,
  },
  {
    id: "klikken",
    label: "Klikken",
    uitleg: "Klikken op de post, inclusief op een link of op 'meer weergeven'.",
    eenheid: "aantal",
    standaard: false,
  },
  {
    id: "nieuwe_volgers",
    label: "Nieuwe volgers",
    uitleg: "Hoeveel mensen het account gingen volgen na het zien van deze post.",
    eenheid: "aantal",
    standaard: true,
  },
  {
    id: "videoweergaven",
    label: "Videoweergaven",
    uitleg: "Hoe vaak de video van deze post is bekeken.",
    eenheid: "aantal",
    standaard: false,
  },
  {
    id: "vertoningen_betaald",
    label: "Betaalde vertoningen",
    uitleg: "Het deel van de vertoningen dat uit advertentiegeld kwam — nul bij een post die niet is opgehoogd.",
    eenheid: "aantal",
    standaard: false,
  },
  {
    id: "advertentie_uitgaven",
    label: "Advertentiebudget op deze post",
    uitleg: "Wat er aan deze post is uitgegeven toen hij als advertentie liep.",
    eenheid: "euro",
    standaard: false,
  },

  {
    id: "interactieratio",
    label: "Interactieratio",
    uitleg: "Van iedereen die de post zag, dit percentage deed er iets mee.",
    eenheid: "procent",
    standaard: true,
    afgeleid: { teller: "interacties", noemer: "bereik", maal: 100 },
  },
  {
    id: "gemiddelde_kijktijd",
    label: "Gemiddelde kijktijd",
    uitleg: "Hoe lang mensen gemiddeld naar de video keken.",
    eenheid: "seconden",
    standaard: false,
    afgeleid: { teller: "kijktijd_ms", noemer: "videoweergaven", maal: 0.001 },
  },
];

// ---------------------------------------------------------------------------
// Accountontwikkeling
// ---------------------------------------------------------------------------

export const ACCOUNT_STATISTIEKEN: Statistiek[] = [
  {
    id: "volgers",
    label: "Volgers",
    uitleg: "De stand aan het eind van de gekozen periode.",
    eenheid: "aantal",
    standaard: true,
  },
  {
    id: "volgers_netto",
    label: "Groei",
    uitleg: "Nieuwe volgers min vertrokken volgers in deze periode.",
    eenheid: "aantal",
    standaard: true,
  },
  {
    id: "volgers_erbij",
    label: "Nieuwe volgers",
    uitleg: "Hoeveel mensen het account gingen volgen.",
    eenheid: "aantal",
    standaard: true,
  },
  {
    id: "volgers_eraf",
    label: "Vertrokken volgers",
    uitleg: "Hoeveel mensen het account ontvolgden of van het platform verdwenen.",
    eenheid: "aantal",
    standaard: false,
    lagerIsBeter: true,
  },
  {
    id: "vertoningen",
    label: "Vertoningen",
    uitleg: "Hoe vaak er iets van dit account op iemands scherm verscheen.",
    eenheid: "aantal",
    standaard: true,
  },
  {
    id: "vertoningen_organisch",
    label: "Organische vertoningen",
    uitleg: "Het deel daarvan dat niet uit advertenties kwam.",
    eenheid: "aantal",
    standaard: false,
  },
  {
    id: "bereik",
    label: "Bereik",
    uitleg: "Hoeveel verschillende mensen iets van dit account zagen.",
    eenheid: "aantal",
    standaard: false,
  },
  {
    id: "interacties",
    label: "Interacties",
    uitleg: "Alles wat mensen met de posts van dit account deden.",
    eenheid: "aantal",
    standaard: true,
  },
  {
    id: "paginaweergaven",
    label: "Profielbezoeken",
    uitleg: "Hoe vaak het profiel of de bedrijfspagina zelf is bekeken.",
    eenheid: "aantal",
    standaard: false,
  },
  {
    id: "aantal_posts",
    label: "Geplaatste posts",
    uitleg: "Hoeveel er in deze periode is gepubliceerd.",
    eenheid: "aantal",
    standaard: true,
  },
];

// ---------------------------------------------------------------------------
// Wat we per connector bij Windsor opvragen
// ---------------------------------------------------------------------------

/**
 * De vaste velden per connector.
 *
 * De maatwerkconversies staan hier bewust níet bij: die heten per account anders en
 * komen erbij zodra marketing er een aanzet. De sync ontdekt ze uit de veldcatalogus en
 * plakt ze achter deze lijst — zie `lib/windsor/sync.ts`.
 *
 * Twee combinaties die Windsor weigert en waar je dus niet omheen kunt ontwerpen:
 * `publisher_platform` + `platform_position` gaan niet samen met de ranking-velden
 * (`quality_ranking` en familie), en `data_fetched_at` schakelt aggregatie helemaal uit.
 */
export const OPHAALVELDEN: Record<Connector, string[]> = {
  facebook: [
    "date",
    "account_id",
    "account_name",
    "campaign_id",
    "campaign",
    "campaign_objective",
    "campaign_effective_status",
    "adset_id",
    "adset_name",
    "ad_id",
    "ad_name",
    "effective_status",
    "thumbnail_url",
    "ad_preview_shareable_link",
    "website_destination_url",
    "effective_object_story_id",
    "instagram_permalink_url",
    "publisher_platform",
    "platform_position",
    "spend",
    "impressions",
    "reach",
    "clicks",
    "actions_link_click",
    "actions_post_engagement",
    "actions_video_view",
    "actions_lead",
  ],
  google_ads: [
    "date",
    "account_id",
    "account_name",
    "campaign_id",
    "campaign",
    "campaign_type",
    "campaign_status",
    "ad_group_id",
    "ad_group_name",
    "ad_id",
    "ad_group_ad_ad_type",
    "ad_group_ad_ad_final_urls",
    "spend",
    "impressions",
    "clicks",
    "conversions",
    "conversions_value",
    // Google kent geen kaal `video_views`; TrueView-weergaven zijn het dichtste
    // equivalent van wat Meta en LinkedIn een videoweergave noemen.
    "video_trueview_views",
    "engagements",
  ],
  linkedin: [
    "date",
    "account_id",
    "account_name",
    "campaign_group_name",
    "campaign_id",
    "campaign",
    "campaign_start_date",
    "creative_id",
    "creative_thumbnail",
    "spend",
    "impressions",
    "approximate_unique_impressions",
    "clicks",
    "landingpageclicks",
    "total_engagements",
    "video_views",
    "oneclickleads",
    "externalwebsiteconversions",
    "conversionvalueinlocalcurrency",
  ],

  // Posts en paginacijfers komen uit dezelfde connector maar hebben een andere korrel;
  // de sync doet daarom twee aparte opvragingen per organische connector. Deze lijst is
  // die van de posts — de paginavelden staan in PAGINAVELDEN hieronder.
  facebook_organic: [
    "date",
    "account_id",
    "account_name",
    "page_id",
    "post_id",
    "post_created_time",
    "post_message_oneline",
    "type",
    "permalink_url",
    "full_picture",
    "post_impressions",
    "post_impressions_organic",
    "post_impressions_paid",
    "post_impressions_unique",
    "post_engagements",
    "post_video_views_organic",
    "post_video_followers",
  ],
  instagram: [
    "date",
    "account_id",
    "account_name",
    "username",
    "media_id",
    "timestamp",
    "media_product_type",
    "media_caption",
    "media_permalink",
    "media_url",
    "media_reach",
    "media_views",
    "media_engagement",
    "media_like_count",
    "media_comments_count",
    "media_saved",
    "media_shares",
    "media_follows",
    "media_reel_total_watch_time",
  ],
  linkedin_organic: [
    "date",
    "account_id",
    "account_name",
    "organization_name",
    "post_id",
    "share_text",
    "share_post_type",
    "share_url",
    "share_impression_count",
    "share_unique_impressions_count",
    "share_total_engagements",
  ],
};

/** De paginacijfers per dag — de tweede opvraging per organische connector. */
export const PAGINAVELDEN: Partial<Record<Connector, string[]>> = {
  facebook_organic: [
    "date",
    "account_id",
    "account_name",
    "page_name",
    "page_fans",
    "page_follows",
    "page_daily_follows",
    "page_daily_unfollows",
    "page_impressions",
    "page_impressions_organic",
    "page_impressions_unique",
    "page_post_engagements",
    "page_views_total",
  ],
  linkedin_organic: [
    "date",
    "account_id",
    "account_name",
    "organization_name",
    "organization_follower_count",
    "followers_gain_organic",
    "followers_gain_paid",
    "all_page_views",
    "account_analytics_impression_count",
    "account_analytics_total_engagements",
  ],
  // Instagram staat hier bewust niet bij: `followers_count` negeert de opgegeven periode
  // en geeft altijd precies één rij met de stand van vandaag. De sync vraagt hem daarom
  // apart op, zonder periode, en schrijft hem weg op de datum van vandaag — zo bouwen we
  // de historie op die de API zelf niet heeft.
};

/** Herkent de maatwerkconversies in de veldcatalogus van Windsor. */
export function isConversieActie(veld: string, connector: string): boolean {
  if (connector === "facebook") {
    // De vaste actions_* velden (actions_lead, actions_link_click, …) halen we al op als
    // gewone statistiek; alleen de maatwerkconversies horen in de jsonb-kolom.
    return veld.startsWith("actions_") && !VASTE_META_ACTIES.has(veld);
  }
  if (connector === "google_ads") {
    return (
      veld.startsWith("conversions_") &&
      !veld.startsWith("conversions_value") &&
      !VASTE_GOOGLE_CONVERSIES.has(veld)
    );
  }
  return false;
}

const VASTE_META_ACTIES = new Set([
  "actions_lead",
  "actions_link_click",
  "actions_post_engagement",
  "actions_video_view",
  "actions_total",
  "actions_purchase",
  "actions_landing_page_view",
  "actions_page_engagement",
  "actions_post_reaction",
  "actions_comment",
  "actions_post",
  "actions_like",
  "actions_photo_view",
  "actions_search",
  "actions_view_content",
]);

const VASTE_GOOGLE_CONVERSIES = new Set([
  "conversions_by_conversion_date",
  "conversions_from_interactions_value_per_interaction",
  "conversions_unique_query_clusters",
  "conversions_value",
  "conversions_value_by_conversion_date",
  "conversions_value_per_cost",
]);

/**
 * Maakt van een veldnaam een leesbaar label: `actions_proefrit_aanvraag` wordt
 * "Proefrit aanvraag", `conversions_ga4_https_udenhout_nl_web_generate_lead_offerte`
 * wordt "Offerte". De ruwe naam blijft in de database staan, dus een label dat er naast
 * zit is in de koppeltabel te corrigeren zonder dat er data verloren gaat.
 */
export function labelVoorConversie(veld: string): string {
  const kaal = veld
    .replace(/^actions_/, "")
    .replace(/^conversions_/, "")
    .replace(/^ga4_https_udenhout_nl_web_/, "")
    .replace(/^bic_bedrijfswagen_inbouw_centrum_ga4_web_/, "BIC ")
    .replace(/^ud_(macro|micro)_/, "")
    .replace(/^generate_lead_/, "")
    .replace(/_\d+_udenhout_nl_losse_conversies_[ab]_$/, "")
    .replace(/_+/g, " ")
    .trim();
  if (!kaal) return veld;
  return kaal.charAt(0).toUpperCase() + kaal.slice(1);
}
