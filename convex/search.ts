import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireCurrentOrganizationId } from "./app";

export const global = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const organizationId = await requireCurrentOrganizationId(ctx);
    const needle = normalize(args.query);
    if (needle.length < 2) {
      return { clients: [], quotes: [], invoices: [], materials: [], services: [] };
    }

    const [clients, quotes, invoices, materials, services] = await Promise.all([
      ctx.db.query("clients").withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId)).order("desc").take(100),
      ctx.db.query("quotes").withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId)).order("desc").take(100),
      ctx.db.query("invoices").withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId)).order("desc").take(100),
      ctx.db.query("materials").withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId)).order("desc").take(150),
      ctx.db.query("services").withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId)).order("desc").take(100),
    ]);

    return {
      clients: clients
        .filter((client) => client.active !== false && includesNeedle(needle, client.name, client.firstName, client.companyName, client.email, client.phone, client.city, client.siret, client.siren))
        .slice(0, 6)
        .map((client) => ({
          id: client._id,
          title: client.companyName || [client.firstName, client.name].filter(Boolean).join(" ") || client.name,
          detail: [client.email, client.city].filter(Boolean).join(" - "),
          href: "/clients",
        })),
      quotes: quotes
        .filter((quote) => includesNeedle(needle, quote.number, quote.title, quote.siteDescription))
        .slice(0, 6)
        .map((quote) => ({
          id: quote._id,
          title: `${quote.number} - ${quote.title}`,
          detail: `Devis ${quote.status} - ${formatMoney(quote.totalTtc)}`,
          href: "/devis",
        })),
      invoices: invoices
        .filter((invoice) => includesNeedle(needle, invoice.number, invoice.status))
        .slice(0, 6)
        .map((invoice) => ({
          id: invoice._id,
          title: invoice.number,
          detail: `Facture ${invoice.status} - ${formatMoney(invoice.totalTtc)}`,
          href: "/factures",
        })),
      materials: materials
        .filter((material) => material.active && includesNeedle(needle, material.name, material.reference, material.category, material.supplier, material.description))
        .slice(0, 6)
        .map((material) => ({
          id: material._id,
          title: material.name,
          detail: [material.reference, material.category, formatMoney(material.purchasePriceHt)].filter(Boolean).join(" - "),
          href: "/materiaux",
        })),
      services: services
        .filter((service) => service.active && includesNeedle(needle, service.name, service.description, service.unit))
        .slice(0, 6)
        .map((service) => ({
          id: service._id,
          title: service.name,
          detail: `${service.unit} - ${formatMoney(service.unitPriceHt)}`,
          href: "/prestations",
        })),
    };
  },
});

function includesNeedle(needle: string, ...values: Array<string | number | undefined>) {
  return values.some((value) => normalize(value).includes(needle));
}

function normalize(value: string | number | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatMoney(value: number) {
  return `${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
}
