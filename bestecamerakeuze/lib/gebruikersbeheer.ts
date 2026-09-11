// Server-only regels voor Instellingen → Gebruikers. Bewust hardcoded i.p.v. een
// rol-vlag in de database: dit zijn twee specifieke, nooit-te-verwijderen accounts,
// geen groep die kan groeien.

// Deze twee accounts staan op slot: niet te verwijderen door wie dan ook, via de UI
// noch via de API — de check hieronder wordt ook server-side afgedwongen, niet alleen
// verstopt in de knop.
export const VERGRENDELDE_EMAILS = ["koopman.janwillem@gmail.com", "jkoopman@udenhout.nl"];

// Alleen dit account mag het gedeelde standaardwachtwoord voor nieuwe collega-accounts
// wijzigen. Iedereen anders ziet die sectie niet eens.
export const WACHTWOORD_EIGENAAR_EMAIL = "koopman.janwillem@gmail.com";

// Wachtwoord waarmee nieuw aangemaakte collega-accounts starten, zolang er geen andere
// waarde in dataloket.instellingen (sleutel "gebruikers_standaard_wachtwoord") staat.
// Nooit naar de client gestuurd — alleen server-side gebruikt bij het aanmaken.
export const STANDAARD_WACHTWOORD_FALLBACK = "letsgomarketing";

export function isVergrendeldeEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return VERGRENDELDE_EMAILS.includes(email.toLowerCase());
}

export function isWachtwoordEigenaar(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase() === WACHTWOORD_EIGENAAR_EMAIL;
}
