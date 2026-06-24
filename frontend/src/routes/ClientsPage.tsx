import { useMutation, useQuery } from "convex/react";
import { Mail, MapPin, Phone, Plus } from "lucide-react";
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get("name") ?? ""),
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
      setError(err instanceof Error ? err.message : "Creation impossible");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-muted-foreground">Fiches clients, contacts et historique des devis.</p>
        </div>
        <Button onClick={() => setFormOpen((open) => !open)}>
          <Plus className="h-4 w-4" />
          Nouveau client
        </Button>
      </div>

      {formOpen ? (
        <Card>
          <CardHeader>
            <CardTitle>Nouveau client</CardTitle>
            <CardDescription>Ajoute une fiche client qui sera reutilisee dans les devis.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Nom *</span>
                <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" name="name" required />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Societe</span>
                <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" name="companyName" />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Email</span>
                <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" name="email" type="email" />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Telephone</span>
                <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" name="phone" />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium">Ville</span>
                <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" name="city" />
              </label>
              {error ? (
                <div className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive md:col-span-2">
                  {error}
                </div>
              ) : null}
              <div className="flex gap-2 md:col-span-2">
                <Button disabled={pending} type="submit">
                  {pending ? "Creation..." : "Creer le client"}
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
          <CardDescription>Donnees chargees en temps reel depuis Convex.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <div className="grid grid-cols-4 gap-4 border-b bg-muted px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
              <span>Nom</span>
              <span>Email</span>
              <span>Ville</span>
              <span>Statut</span>
            </div>
            {clients === undefined ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">Chargement...</div>
            ) : clients.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                Aucun client pour le moment.
              </div>
            ) : (
              clients.map((client) => (
                <div key={client._id} className="grid grid-cols-4 gap-4 border-t px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium">{client.name}</div>
                    {client.companyName ? (
                      <div className="text-xs text-muted-foreground">{client.companyName}</div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    {client.email ?? "-"}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {client.city ?? "-"}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    {client.phone ?? "Actif"}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function optionalString(value: FormDataEntryValue | null) {
  const stringValue = String(value ?? "").trim();
  return stringValue.length ? stringValue : undefined;
}
