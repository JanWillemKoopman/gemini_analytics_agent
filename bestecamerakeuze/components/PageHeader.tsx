import LiveStatus from "@/components/LiveStatus";
import UpdateButton from "@/components/UpdateButton";

type Props = {
  title: string;
  subtitle: string;
  /** Live-status + update-actie horen alleen bij het campagne-overzicht. */
  meta?: { liveCount: number; updatedAt: string };
};

export default function PageHeader({ title, subtitle, meta }: Props) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="titel-theme text-ink">
          {title}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
      </div>

      {meta && (
        <div className="flex flex-wrap items-center gap-4 pt-1.5">
          <LiveStatus liveCount={meta.liveCount} />
          <span aria-hidden="true" className="h-3 w-px bg-line" />
          <span className="text-sm text-ink-muted">Laatst bijgewerkt {meta.updatedAt}</span>
          <UpdateButton />
        </div>
      )}
    </div>
  );
}
