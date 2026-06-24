import { Layers3, PackageOpen, Plus, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const materialRules = [
  {
    title: "Divisible",
    description: "Peinture, enduit, sable ou consommables calculés au prorata.",
    icon: Ruler,
  },
  {
    title: "Non divisible",
    description: "Panneaux, portes, plaques ou éléments achetés à l'unité.",
    icon: PackageOpen,
  },
  {
    title: "Vendu par lot",
    description: "Boîtes, cartons, palettes et lots avec arrondi automatique.",
    icon: Layers3,
  },
];

export function MaterialsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Matériaux</h1>
          <p className="text-sm text-muted-foreground">
            Prix, fournisseurs, dimensions, lots, pertes et divisibilité.
          </p>
        </div>
        <Button className="w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Nouveau matériau
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catalogue</CardTitle>
          <CardDescription>Le moteur de calcul sera isolé et testé avant l'éditeur de devis.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {materialRules.map((rule) => {
              const Icon = rule.icon;
              return (
                <div key={rule.title} className="rounded-md border bg-background p-4 hover:border-primary/40">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-md bg-orange-soft text-orange-strong">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="text-sm font-semibold">{rule.title}</div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{rule.description}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
