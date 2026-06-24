import { ArrowUpRight, Clock3, Euro, FileText, PackageCheck, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const stats = [
  { label: "Devis en cours", value: "12", detail: "4 à relancer", icon: FileText },
  { label: "CA prévisionnel", value: "18 420 €", detail: "+12% ce mois", icon: Euro },
  { label: "Matériaux suivis", value: "126", detail: "9 prix à vérifier", icon: PackageCheck },
];

const quoteRows = [
  ["Martin Rénovation", "Envoyé", "4 820 €", "Relancer"],
  ["SCI Les Pins", "Brouillon", "9 340 €", "Compléter"],
  ["Claire Dubois", "Accepté", "2 180 €", "Facturer"],
];

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-lg border bg-violet-surface text-white shadow-sm">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_320px] lg:p-8">
          <div>
            <Badge className="border-white/35 bg-white/12 text-white" variant="outline">
              Tableau de bord
            </Badge>
            <h1 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight">
              Les devis, clients et achats chantier au même endroit.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-violet-100">
              Suis les devis, prépare les quantités, relance les clients et garde le contexte du
              chantier sans passer d'un outil à l'autre.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button>
                Nouveau devis
                <ArrowUpRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" className="border border-white/15 text-white hover:bg-white/10">
                Importer matériaux
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/8 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-violet-100">À traiter aujourd'hui</div>
                <div className="mt-1 text-2xl font-semibold">7 actions</div>
              </div>
              <Clock3 className="h-8 w-8 text-accent" />
            </div>
            <div className="mt-5 space-y-3">
              {["Relancer devis D-2026-014", "Vérifier prix bois terrasse", "Envoyer PDF client Martin"].map(
                (item) => (
                  <div key={item} className="flex items-center gap-3 rounded-md bg-white/8 px-3 py-2 text-sm">
                    <span className="h-2 w-2 rounded-full bg-accent" />
                    {item}
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                <div className="grid h-9 w-9 place-items-center rounded-md bg-orange-soft text-orange-strong">
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{stat.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.detail}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader>
            <CardTitle>Suivi devis</CardTitle>
            <CardDescription>Une vue rapide pour savoir quoi signer, relancer ou facturer.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <div className="min-w-[620px]">
                <div className="grid grid-cols-[1fr_120px_120px_120px] bg-muted px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
                  <span>Client</span>
                  <span>Statut</span>
                  <span>Total</span>
                  <span>Action</span>
                </div>
                {quoteRows.map(([client, status, total, action]) => (
                  <div
                    key={client}
                    className="grid grid-cols-[1fr_120px_120px_120px] items-center border-t px-4 py-3 text-sm"
                  >
                    <span className="font-medium">{client}</span>
                    <Badge variant={status === "Accepté" ? "default" : "secondary"}>{status}</Badge>
                    <span>{total}</span>
                    <Button variant="outline" size="sm">
                      <Send className="h-3.5 w-3.5" />
                      {action}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Construction MVP</CardTitle>
            <CardDescription>Ordre des prochains modules.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {["Organisation", "Clients", "Matériaux", "Calculs", "Devis", "PDF"].map((item, index) => (
                <div key={item} className="flex items-center gap-3 rounded-md border bg-background p-3">
                  <div className="grid h-7 w-7 place-items-center rounded-md bg-violet-100 text-xs font-bold text-violet-800">
                    {index + 1}
                  </div>
                  <span className="text-sm font-medium">{item}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
