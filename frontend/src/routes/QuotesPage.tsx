import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function QuotesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Devis</h1>
          <p className="text-sm text-muted-foreground">Creation, envoi, signature et conversion en facture.</p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          Nouveau devis
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Pipeline devis</CardTitle>
          <CardDescription>Les statuts V1 : brouillon, envoye, accepte, refuse, facture.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5">
            {["Brouillon", "Envoye", "Accepte", "Refuse", "Facture"].map((status) => (
              <div key={status} className="rounded-md border bg-background p-4 text-center text-sm font-semibold hover:border-primary/40">
                {status}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
