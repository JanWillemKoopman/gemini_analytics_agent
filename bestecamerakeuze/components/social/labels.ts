/**
 * Meta's veldwaarden in gewone taal.
 *
 * Windsor geeft de doelstelling van een campagne en het soort bericht door zoals Meta
 * ze intern noemt (`OUTCOME_LEADS`, `animated_image_video`). Dat is precies het jargon
 * dat volgens de designvisie niet in de altijd-zichtbare UI-tekst hoort, dus het wordt
 * hier één keer vertaald. Een onbekende waarde wordt netjes leesbaar gemaakt in plaats
 * van weggelaten — dan valt meteen op dat er een vertaling bij moet.
 */

const DOELEN: Record<string, string> = {
  OUTCOME_LEADS: "Leads",
  OUTCOME_SALES: "Verkoop",
  OUTCOME_TRAFFIC: "Websiteverkeer",
  OUTCOME_AWARENESS: "Bekendheid",
  OUTCOME_ENGAGEMENT: "Interactie",
  OUTCOME_APP_PROMOTION: "App-promotie",
  LINK_CLICKS: "Websiteclicks",
  LEAD_GENERATION: "Leads",
  CONVERSIONS: "Conversies",
  PRODUCT_CATALOG_SALES: "Verkoop",
  BRAND_AWARENESS: "Bekendheid",
  REACH: "Bereik",
  POST_ENGAGEMENT: "Interactie",
  PAGE_LIKES: "Paginalikes",
  VIDEO_VIEWS: "Videoweergaven",
  MESSAGES: "Berichten",
  APP_INSTALLS: "App-installaties",
  STORE_VISITS: "Winkelbezoek",
};

const BERICHTSOORTEN: Record<string, string> = {
  photo: "Foto",
  album: "Album",
  video: "Video",
  video_inline: "Video",
  animated_image_video: "Animatie",
  reel: "Reel",
  link: "Link",
  status: "Tekst",
  share: "Gedeeld",
  event: "Evenement",
  note: "Notitie",
};

/** Maakt `ANIMATED_IMAGE_VIDEO` of `some_unknown_type` alsnog leesbaar. */
function leesbaar(ruw: string): string {
  const woorden = ruw.toLowerCase().replace(/_/g, " ").trim();
  return woorden.charAt(0).toUpperCase() + woorden.slice(1);
}

export function doelLabel(ruw: string): string {
  if (!ruw) return "—";
  return DOELEN[ruw] ?? leesbaar(ruw);
}

export function berichtsoortLabel(ruw: string): string {
  if (!ruw) return "—";
  return BERICHTSOORTEN[ruw.toLowerCase()] ?? leesbaar(ruw);
}
