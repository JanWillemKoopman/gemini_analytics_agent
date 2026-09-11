// Server-only regels voor de Instellingen-pagina (/settings). Bewust hardcoded i.p.v.
// een "rol"-vlag in de database: dit zijn twee specifieke, nooit-te-verwijderen accounts,
// geen groep die kan groeien — een letterlijke lijst is hier duidelijker dan een schema.

// Deze twee accounts staan op slot: niet te verwijderen door wie dan ook, via de UI noch
// via de API (de check hieronder wordt ook server-side afgedwongen, niet alleen verstopt
// in de knop).
export const LOCKED_EMAILS = ["koopman.janwillem@gmail.com", "jkoopman@udenhout.nl"];

// Alleen dit account mag het gedeelde standaardwachtwoord voor nieuwe collega-accounts
// wijzigen. Iedereen anders ziet die sectie niet eens.
export const PASSWORD_OWNER_EMAIL = "koopman.janwillem@gmail.com";

// Wachtwoord waarmee nieuw aangemaakte collega-accounts starten, zolang er geen andere
// waarde in mmm.app_settings (key "bulk_default_password") staat. Nooit naar de client
// gestuurd — alleen server-side gebruikt bij het aanmaken van accounts.
export const FALLBACK_DEFAULT_PASSWORD = "letsgomarketing";

export function isLockedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return LOCKED_EMAILS.includes(email.toLowerCase());
}

export function isPasswordOwner(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase() === PASSWORD_OWNER_EMAIL;
}
