import { CheckCircle2, FileClock, FileText, Plus, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const statuses = [
  { label: "Brouillon", count: 3, icon: FileText },
  { label: "Envoyé", count: 5, icon: Send },
  { label: "Accepté", count: 2, icon: CheckCircle2 },
  { label: "Refusé", count: 1, icon: XCircle },
  { label: "Facturé", count: 4, icon: FileClock },
];

export function QuotesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Devis</h1>
          <p className="text-sm text-muted-foreground">Création, envoi, signature et conversion en facture.</p>
        </div>
        <Button className="w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Nouveau devis
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pipeline devis</CardTitle>
          <CardDescription>Vue de travail pour suivre les statuts V1.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {statuses.map((status) => {
              const Icon = status.icon;
              return (
                <div key={status.label} className="rounded-md border bg-background p-4 hover:border-primary/40">
                  <div className="flex items-center justify-between gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-md bg-orange-soft text-orange-strong">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="text-2xl font-semibold">{status.count}</div>
                  </div>
                  <div className="mt-4 text-sm font-semibold">{status.label}</div>
                  <p className="mt-1 text-xs text-muted-foreground">À brancher aux vrais devis.</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
