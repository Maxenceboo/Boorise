import { Building2, Mail, Palette, ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const settings = [
  {
    title: "Informations légales",
    description: "SIRET, TVA, adresse, assurance et mentions obligatoires.",
    icon: Building2,
    color: "bg-[#F2921D]",
  },
  {
    title: "Emails sortants",
    description: "Domaine d'envoi, signature, réponses client et délivrabilité.",
    icon: Mail,
    color: "bg-[#F24F13]",
  },
  {
    title: "Numérotation",
    description: "Préfixes devis, factures, années fiscales et séquences.",
    icon: ReceiptText,
    color: "bg-[#F2C230]",
  },
  {
    title: "Identité visuelle",
    description: "Logo, couleurs des PDF, pied de page et documents publics.",
    icon: Palette,
    color: "bg-[#8082A6]",
  },
];

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-lg border bg-secondary text-white shadow-sm">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_280px]">
          <div>
            <Badge className="border-white/35 bg-white/10 text-white" variant="outline">
              Entreprise
            </Badge>
            <h1 className="mt-4 text-3xl font-semibold">Paramètres de l'atelier</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#d8d9ee]">
              Centralise les informations qui alimentent les devis, factures, emails et pages de
              signature client.
            </p>
          </div>
          <div className="rounded-lg border border-white/15 bg-violet-panel p-4">
            <div className="text-sm text-[#d8d9ee]">Palette active</div>
            <div className="mt-4 grid grid-cols-5 overflow-hidden rounded-md">
              {["#F2C230", "#F2921D", "#F24F13", "#8082A6", "#46334F"].map((color) => (
                <div key={color} className="h-20" style={{ backgroundColor: color }} title={color} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {settings.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title} className="overflow-hidden">
              <CardHeader className="flex-row items-start gap-4">
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-md ${item.color} text-white`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription className="mt-1">{item.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm">
                  Configurer
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuration document</CardTitle>
          <CardDescription>Base visuelle qui sera reprise dans les PDF et emails client.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="space-y-3">
              {[
                ["Couleur principale", "#F2921D"],
                ["Couleur action forte", "#F24F13"],
                ["Couleur structure", "#46334F"],
                ["Couleur secondaire", "#8082A6"],
              ].map(([label, color]) => (
                <div key={label} className="flex items-center justify-between rounded-md border bg-background p-3">
                  <div className="text-sm font-medium">{label}</div>
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-10 rounded" style={{ backgroundColor: color }} />
                    <span className="w-20 text-right text-sm text-muted-foreground">{color}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-lg border bg-[#46334F] p-5 text-white">
              <div className="text-sm text-[#d8d9ee]">Aperçu PDF</div>
              <div className="mt-4 rounded-md bg-white p-4 text-[#241629]">
                <div className="h-2 w-24 rounded bg-[#F2921D]" />
                <div className="mt-5 text-lg font-semibold">Devis D-2026-001</div>
                <div className="mt-2 h-2 w-full rounded bg-[#eee8ef]" />
                <div className="mt-2 h-2 w-3/4 rounded bg-[#eee8ef]" />
                <div className="mt-5 flex justify-between border-t pt-4 text-sm">
                  <span>Total TTC</span>
                  <strong className="text-[#F24F13]">4 820 €</strong>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
