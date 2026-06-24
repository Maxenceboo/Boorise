import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function MaterialsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Materiaux</h1>
          <p className="text-sm text-muted-foreground">
            Prix, fournisseurs, dimensions, lots, pertes et divisibilite.
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          Nouveau materiau
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Catalogue</CardTitle>
          <CardDescription>Le moteur de calcul sera isole et teste avant l'editeur de devis.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {["Divisible", "Non divisible", "Vendu par lot"].map((label) => (
              <div key={label} className="rounded-md border bg-background p-4 hover:border-primary/40">
                <div className="text-sm font-semibold">{label}</div>
                <p className="mt-1 text-sm text-muted-foreground">Regle d'achat dediee pour eviter les chutes mal estimees.</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
