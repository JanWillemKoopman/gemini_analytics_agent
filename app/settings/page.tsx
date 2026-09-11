import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { PageHeader, TopBar } from "@/components/ui";
import { isPasswordOwner } from "@/lib/settings/accounts";
import { SettingsUsersPanel } from "@/components/SettingsUsersPanel";

export const dynamic = "force-dynamic";

// Toegankelijk voor iedereen die is ingelogd — geen builder-check zoals /projects. Dit is
// bewust een gedeelde pagina waar collega's zelf accounts voor elkaar kunnen aanmaken.
export default async function SettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  return (
    <div className="min-h-screen bg-bg">
      <TopBar email={viewer.email} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <PageHeader
          title="Instellingen"
          subtitle="Beheer wie kan inloggen op de MMM-wizard."
        />
        <SettingsUsersPanel isPasswordOwner={isPasswordOwner(viewer.email)} />
      </main>
    </div>
  );
}
