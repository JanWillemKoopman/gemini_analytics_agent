import { initialenVoor } from "@/lib/initialen";

type Props = {
  naam: string | null;
  avatarUrl: string | null;
  /** Pixelgrootte (breedte = hoogte); default past bij de meeste inline plekken. */
  size?: number;
  className?: string;
};

/** Rond profielfotootje, met initialen als fallback zolang er geen avatar is ingesteld. */
export default function Avatar({ naam, avatarUrl, size = 20, className = "" }: Props) {
  const stijl = { width: size, height: size };

  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- externe, door de gebruiker
    // geüploade Supabase Storage-URL; next/image vereist hiervoor een geconfigureerd
    // extern domein, wat voor een profielfoto niet in verhouding staat.
    return (
      <img
        src={avatarUrl}
        alt=""
        style={stijl}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{ ...stijl, fontSize: Math.max(9, size * 0.4) }}
      className={`flex shrink-0 items-center justify-center rounded-full bg-brand-light font-semibold text-brand ${className}`}
    >
      {initialenVoor(naam)}
    </span>
  );
}
