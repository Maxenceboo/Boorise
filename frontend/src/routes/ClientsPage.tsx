import { useMutation, useQuery } from "convex/react";
import { Mail, MapPin, Phone, Plus, UserRound } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { api } from "#convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ClientsPage() {
  const clients = useQuery(api.clients.list);
  const createClient = useMutation(api.clients.create);
  const [formOpen, setFormOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get("name") ?? "").trim(),
      companyName: optionalString(formData.get("companyName")),
      email: optionalString(formData.get("email")),
      phone: optionalString(formData.get("phone")),
      city: optionalString(formData.get("city")),
    };

    try {
      await createClient(payload);
      form.reset();
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-muted-foreground">Fiches clients, contacts et historique des devis.</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setFormOpen((open) => !open)}>
          <Plus className="h-4 w-4" />
          Nouveau client
        </Button>
      </div>

      {formOpen ? (
        <Card>
          <CardHeader>
            <CardTitle>Nouveau client</CardTitle>
            <CardDescription>Ajoute une fiche client réutilisable dans les devis.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
              <TextField label="Nom *" name="name" required />
              <TextField label="Société" name="companyName" />
              <TextField label="Email" name="email" type="email" />
              <TextField label="Téléphone" name="phone" />
              <TextField className="md:col-span-2" label="Ville" name="city" />

              {error ? (
                <div className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive md:col-span-2">
                  {error}
                </div>
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row md:col-span-2">
                <Button disabled={pending} type="submit">
                  {pending ? "Création..." : "Créer le client"}
                </Button>
                <Button variant="outline" type="button" onClick={() => setFormOpen(false)}>
                  Annuler
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Liste clients</CardTitle>
          <CardDescription>Données chargées en temps réel depuis Convex.</CardDescription>
        </CardHeader>
        <CardContent>
          {clients === undefined ? (
            <EmptyState title="Chargement..." description="Récupération des clients." />
          ) : clients.length === 0 ? (
            <EmptyState
              title="Aucun client pour le moment"
              description="Crée une première fiche client pour préparer les devis."
            />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr] gap-4 border-b bg-muted px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
                  <span>Nom</span>
                  <span>Email</span>
                  <span>Ville</span>
                  <span>Téléphone</span>
                </div>
                {clients.map((client) => (
                  <div key={client._id} className="grid grid-cols-[1.2fr_1fr_1fr_1fr] gap-4 border-t px-4 py-3 text-sm">
                    <div>
                      <div className="font-medium">{client.name}</div>
                      {client.companyName ? (
                        <div className="text-xs text-muted-foreground">{client.companyName}</div>
                      ) : null}
                    </div>
                    <Meta icon={Mail}>{client.email ?? "-"}</Meta>
                    <Meta icon={MapPin}>{client.city ?? "-"}</Meta>
                    <Meta icon={Phone}>{client.phone ?? "-"}</Meta>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TextField({
  className,
  label,
  name,
  type = "text",
  required,
}: {
  className?: string;
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className={className ? `space-y-1.5 ${className}` : "space-y-1.5"}>
      <span className="text-sm font-medium">{label}</span>
      <input
        className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
        name={name}
        type={type}
        required={required}
      />
    </label>
  );
}

function Meta({ children, icon: Icon }: { children: ReactNode; icon: typeof Mail }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{children}</span>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid place-items-center rounded-md border border-dashed bg-background px-4 py-12 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-md bg-orange-soft text-orange-strong">
        <UserRound className="h-5 w-5" />
      </div>
      <div className="mt-3 text-sm font-semibold">{title}</div>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function optionalString(value: FormDataEntryValue | null) {
  const stringValue = String(value ?? "").trim();
  return stringValue.length ? stringValue : undefined;
}
