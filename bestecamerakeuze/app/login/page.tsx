import InlogFormulier from "@/components/login/InlogFormulier";
import MerkPaneel from "@/components/login/MerkPaneel";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { IconLock } from "@/components/icons";

/**
 * Het inlogscherm.
 *
 * Opzet is een tweeluik over de volle schermhoogte, zoals het dashboard erachter: links
 * de donkere merkschil (`components/login/MerkPaneel.tsx`, hetzelfde vlak als de
 * sidebar), rechts het formulier op het warme paginavlak. Het formulier staat in een
 * dragend paneel met een accentlijn erboven en een haarlijn net binnen de rand — de twee
 * details waarmee elk theme zijn eigen afwerking op een kaart legt.
 *
 * Alles staat in semantische tokens, dus het inlogscherm verandert net zo goed mee met
 * het oogje rechtsboven als de rest van het dashboard; controleer bij wijzigingen ook
 * even Audi of CUPRA (de twee donkere themes).
 */
export default function LoginPage() {
  return (
    <div className="pagina-vlak grid min-h-screen grid-cols-[minmax(28rem,1.05fr)_minmax(34rem,1fr)]">
      <ThemeSwitcher />

      <MerkPaneel />

      <main className="flex items-center justify-center px-16 py-14">
        <div className="w-full max-w-[26rem]">
          <div className="kaart-accent kaart-omlijst rounded-panel border border-line bg-card px-10 py-11 shadow-card">
            <p className="label-theme text-label text-ink-faint">Campagnedashboard</p>
            <h1 className="titel-theme mt-3 text-ink">Welkom terug</h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              Log in met het e-mailadres en wachtwoord die je van Udenhout hebt gekregen.
            </p>

            <div className="mt-9">
              <InlogFormulier />
            </div>

            <p className="mt-9 flex items-center gap-2.5 border-t border-line-soft pt-6 text-meta text-ink-faint">
              <IconLock className="h-[14px] w-[14px] shrink-0" />
              Beveiligde verbinding — je sessie blijft op dit apparaat.
            </p>
          </div>

          <p className="mt-6 px-1 text-meta text-ink-faint">
            Nog geen account? Vraag iemand met toegang tot Supabase om er een voor je aan
            te maken.
          </p>
        </div>
      </main>
    </div>
  );
}
