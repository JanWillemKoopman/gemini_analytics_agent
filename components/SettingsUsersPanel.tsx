"use client";

import { useEffect, useState } from "react";
import { Lock, Trash2, UserPlus } from "lucide-react";
import { fetchJson, postJson } from "@/lib/fetchJson";
import { Button, Card, ErrorNotice, Textarea } from "@/components/ui";

interface AccountRow {
  id: string;
  email: string;
  created_at: string;
  locked: boolean;
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

// Splitst op regels, komma's of puntkomma's — flexibel genoeg voor een geplakte lijst uit
// mail/Excel zonder dat de gebruiker eerst hoeft op te schonen.
function parseEmails(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\n,;]/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
}

export function SettingsUsersPanel({ isPasswordOwner }: { isPasswordOwner: boolean }) {
  const [users, setUsers] = useState<AccountRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addResult, setAddResult] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function loadUsers() {
    const res = await fetchJson<{ users: AccountRow[] }>("/api/settings/users");
    if (!res.ok) {
      setLoadError(res.error);
      return;
    }
    setLoadError(null);
    setUsers(res.data.users);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const emails = parseEmails(emailInput);
    if (emails.length === 0) return;

    setAdding(true);
    setAddError(null);
    setAddResult(null);
    const res = await postJson<{ created: string[]; skipped: string[]; failed: { email: string; error: string }[] }>(
      "/api/settings/users",
      { emails },
    );
    setAdding(false);

    if (!res.ok) {
      setAddError(res.error);
      return;
    }
    const { created, skipped, failed } = res.data;
    const parts: string[] = [];
    if (created.length) parts.push(`${created.length} account(s) aangemaakt`);
    if (skipped.length) parts.push(`${skipped.length} bestond(en) al`);
    if (failed.length) parts.push(`${failed.length} mislukt (${failed.map((f) => f.email).join(", ")})`);
    setAddResult(parts.join(" · ") || "Niets om toe te voegen.");
    setEmailInput("");
    await loadUsers();
  }

  async function onRemove(user: AccountRow) {
    if (user.locked) return;
    if (!confirm(`${user.email} verwijderen? Dit account kan dan niet meer inloggen.`)) return;

    setRemovingId(user.id);
    const res = await fetchJson(`/api/settings/users/${user.id}`, { method: "DELETE" });
    setRemovingId(null);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    setUsers((prev) => prev?.filter((u) => u.id !== user.id) ?? prev);
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-base font-sans-w7 font-semibold text-fg">Collega's toevoegen</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Plak e-mailadressen (één per regel, of gescheiden door een komma). Ieder account krijgt
          meteen het standaardwachtwoord — dat wordt hier nergens getoond; de collega kan met dat
          e-mailadres direct inloggen op <span className="font-mono text-xs">/login</span>, of het
          wachtwoord later via "Wachtwoord vergeten" wijzigen.
        </p>
        <form onSubmit={onAdd} className="mt-4 space-y-3">
          <Textarea
            rows={4}
            placeholder={"collega1@udenhout.nl\ncollega2@udenhout.nl"}
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
          />
          {addError && <ErrorNotice raw={addError} fallback={addError} />}
          {addResult && <p className="text-sm text-fg-muted">{addResult}</p>}
          <Button type="submit" disabled={adding || parseEmails(emailInput).length === 0}>
            <UserPlus className="h-4 w-4" />
            {adding ? "Bezig…" : "Toevoegen"}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-base font-sans-w7 font-semibold text-fg">Accounts</h2>
        {loadError && <ErrorNotice raw={loadError} fallback={loadError} />}
        {!users && !loadError && <p className="mt-3 text-sm text-fg-muted">Laden…</p>}
        {users && (
          <ul className="mt-3 divide-y divide-border">
            {users.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-fg">{u.email}</span>
                    {u.locked && <Lock className="h-3.5 w-3.5 flex-none text-fg-faint" aria-label="Vergrendeld" />}
                  </div>
                  <p className="text-xs text-fg-faint">sinds {dateLabel(u.created_at)}</p>
                </div>
                <Button
                  variant="danger"
                  type="button"
                  disabled={u.locked || removingId === u.id}
                  onClick={() => onRemove(u)}
                  className="flex-none"
                  title={u.locked ? "Dit account is vergrendeld en kan niet verwijderd worden" : "Verwijderen"}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {removingId === u.id ? "Bezig…" : "Verwijderen"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {isPasswordOwner && <PasswordOwnerPanel />}
    </div>
  );
}

// Alleen zichtbaar voor het ene account dat het gedeelde standaardwachtwoord mag wijzigen —
// server-side afgedwongen op /api/settings/password, dit is puur UI-gating.
function PasswordOwnerPanel() {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await postJson("/api/settings/password", { password });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setPassword("");
    setSaved(true);
  }

  return (
    <Card className="border border-border-strong">
      <h2 className="text-base font-sans-w7 font-semibold text-fg">Standaardwachtwoord wijzigen</h2>
      <p className="mt-1 text-sm text-fg-muted">
        Alleen jij ziet deze sectie. Dit wijzigt het wachtwoord voor <em>nieuw</em> aan te maken
        accounts — bestaande accounts houden hun huidige wachtwoord.
      </p>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-fg">Nieuw standaardwachtwoord</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm text-fg outline-none transition focus:shadow-glow-sm"
          />
        </div>
        <Button type="submit" variant="secondary" disabled={saving}>
          {saving ? "Bezig…" : "Opslaan"}
        </Button>
      </form>
      {error && <div className="mt-2"><ErrorNotice raw={error} fallback={error} /></div>}
      {saved && <p className="mt-2 text-sm text-success">Opgeslagen.</p>}
    </Card>
  );
}
