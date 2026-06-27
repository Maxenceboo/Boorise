import type { jsPDF } from "jspdf";
import type { Doc } from "#convex/_generated/dataModel";
import { formatCurrency, formatDate } from "@/lib/format";

type QuoteBundle = {
  quote: Doc<"quotes">;
  client: Doc<"clients"> | null;
  items: Doc<"quoteItems">[];
};

type InvoiceBundle = {
  invoice: Doc<"invoices">;
  client: Doc<"clients"> | null;
  quote: Doc<"quotes"> | null;
  items: Doc<"quoteItems">[];
};

type PdfLineItem = Pick<Doc<"quoteItems">, "description" | "quantity" | "unit" | "unitPriceHt" | "totalHt">;

const margin = 16;
const pageWidth = 210;

export async function downloadQuotePdf(bundle: QuoteBundle, organization: Doc<"organizations"> | null) {
  const pdf = await createQuotePdf(bundle, organization);
  pdf.save(`${safeFileName(bundle.quote.number)}.pdf`);
}

export async function quotePdfAttachment(bundle: QuoteBundle, organization: Doc<"organizations"> | null) {
  const pdf = await createQuotePdf(bundle, organization);
  return {
    filename: `${safeFileName(bundle.quote.number)}.pdf`,
    contentBase64: dataUriToBase64(pdf.output("datauristring")),
  };
}

export async function invoicePdfAttachment(bundle: InvoiceBundle, organization: Doc<"organizations"> | null) {
  const pdf = await createInvoicePdf(bundle, organization);
  return {
    filename: `${safeFileName(bundle.invoice.number)}.pdf`,
    contentBase64: dataUriToBase64(pdf.output("datauristring")),
  };
}

export async function downloadInvoicePdf(bundle: InvoiceBundle, organization: Doc<"organizations"> | null) {
  const pdf = await createInvoicePdf(bundle, organization);
  pdf.save(`${safeFileName(bundle.invoice.number)}.pdf`);
}

async function createQuotePdf(bundle: QuoteBundle, organization: Doc<"organizations"> | null) {
  const pdf = await createBaseDocument("DEVIS", bundle.quote.number, bundle.quote.title, organization, bundle.client);
  let y = 82;
  y = addMeta(pdf, y, [
    ["Date", formatDate(bundle.quote.issueDate)],
    ["Validite", bundle.quote.validUntil ? formatDate(bundle.quote.validUntil) : "-"],
    ["Statut", quoteStatusLabel(bundle.quote.status)],
  ]);
  addLineItems(pdf, y + 4, bundle.items, bundle.quote.vatRate);
  addTotals(pdf, bundle.quote.totalHt, bundle.quote.totalTtc, bundle.quote.vatRate);
  addTerms(pdf, bundle.quote.paymentTermsText, bundle.quote.legalNotice);
  return pdf;
}

async function createInvoicePdf(bundle: InvoiceBundle, organization: Doc<"organizations"> | null) {
  const pdf = await createBaseDocument(invoiceKindTitle(bundle.invoice), bundle.invoice.number, bundle.quote?.title ?? "Facture", organization, bundle.client);
  let y = 82;
  y = addMeta(pdf, y, [
    ["Emission", formatDate(bundle.invoice.issueDate)],
    ["Echeance", formatDate(bundle.invoice.dueDate)],
    ["Statut", invoiceStatusLabel(bundle.invoice.status)],
  ]);
  addLineItems(pdf, y + 4, invoicePdfLineItems(bundle), bundle.invoice.vatRate);
  addTotals(pdf, bundle.invoice.totalHt, bundle.invoice.totalTtc, bundle.invoice.vatRate);
  addTerms(pdf, bundle.invoice.paymentTermsText, bundle.invoice.legalNotice ?? bundle.invoice.bankDetails);
  return pdf;
}

async function createBaseDocument(
  kind: string,
  number: string,
  title: string,
  organization: Doc<"organizations"> | null,
  client: Doc<"clients"> | null,
) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pdf.setProperties({ title: `${kind} ${number}`, subject: title, creator: "Boorise" });
  pdf.setDrawColor(216, 209, 199);
  pdf.line(margin, 32, pageWidth - margin, 32);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.text(kind, pageWidth - margin, 18, { align: "right" });
  pdf.setFontSize(13);
  pdf.text(number, pageWidth - margin, 27, { align: "right" });

  pdf.setFontSize(11);
  pdf.text(organization?.legalName ?? organization?.name ?? "Entreprise", margin, 16);
  pdf.setFont("helvetica", "normal");
  writeLines(pdf, organizationLines(organization), margin, 22, 4.4);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("CLIENT", margin, 47);
  pdf.setFont("helvetica", "normal");
  writeLines(pdf, clientLines(client), margin, 53, 4.4);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text(title || kind, pageWidth - margin, 47, { align: "right" });
  return pdf;
}

function addMeta(pdf: jsPDF, y: number, rows: Array<[string, string]>) {
  pdf.setDrawColor(216, 209, 199);
  pdf.setFillColor(244, 238, 230);
  pdf.rect(margin, y, pageWidth - margin * 2, 11, "F");
  const cellWidth = (pageWidth - margin * 2) / rows.length;
  rows.forEach(([label, value], index) => {
    const x = margin + index * cellWidth + 3;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text(label.toUpperCase(), x, y + 4);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(value, x, y + 8.3);
  });
  return y + 13;
}

function addLineItems(pdf: jsPDF, startY: number, items: PdfLineItem[], vatRate: number) {
  let y = startY;
  const widths = [78, 22, 22, 27, 27];
  const headers = ["Designation", "Qte", "Unite", "PU HT", "Total HT"];
  pdf.setFillColor(36, 23, 43);
  pdf.rect(margin, y, pageWidth - margin * 2, 8, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  let x = margin + 2;
  headers.forEach((header, index) => {
    pdf.text(header, x, y + 5.2);
    x += widths[index];
  });
  pdf.setTextColor(36, 23, 43);
  y += 8;

  const rows = items.length > 0 ? items : [];
  for (const item of rows) {
    if (y > 238) {
      pdf.addPage();
      y = margin;
    }
    const description = pdf.splitTextToSize(item.description, widths[0] - 4).slice(0, 3);
    const rowHeight = Math.max(8, description.length * 4.2 + 3);
    pdf.setDrawColor(229, 222, 213);
    pdf.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.text(description, margin + 2, y + 4.5);
    pdf.text(formatNumber(item.quantity), margin + widths[0] + 2, y + 4.5);
    pdf.text(item.unit, margin + widths[0] + widths[1] + 2, y + 4.5);
    pdf.text(formatCurrency(item.unitPriceHt), pageWidth - margin - widths[4] - 4, y + 4.5, { align: "right" });
    pdf.text(formatCurrency(item.totalHt), pageWidth - margin - 2, y + 4.5, { align: "right" });
    y += rowHeight;
  }

  if (rows.length === 0) {
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(9);
    pdf.text("Aucune ligne detaillee.", margin + 2, y + 8);
    y += 14;
  }
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(`TVA appliquee: ${formatNumber(vatRate)}%`, margin, y + 5);
  return y + 10;
}

function addTotals(pdf: jsPDF, totalHt: number, totalTtc: number, vatRate: number) {
  const x = pageWidth - margin - 58;
  const y = 242;
  pdf.setDrawColor(207, 197, 184);
  pdf.rect(x, y, 58, 28);
  totalRow(pdf, "Total HT", formatCurrency(totalHt), x, y + 7);
  totalRow(pdf, `TVA ${formatNumber(vatRate)}%`, formatCurrency(totalTtc - totalHt), x, y + 15);
  pdf.setFont("helvetica", "bold");
  totalRow(pdf, "Total TTC", formatCurrency(totalTtc), x, y + 24);
}

function totalRow(pdf: jsPDF, label: string, value: string, x: number, y: number) {
  pdf.setFontSize(9);
  pdf.text(label, x + 4, y);
  pdf.text(value, x + 54, y, { align: "right" });
}

function addTerms(pdf: jsPDF, paymentTerms?: string, legalNotice?: string) {
  const lines = [paymentTerms, legalNotice].filter(Boolean).join("\n");
  if (!lines) {
    return;
  }
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(93, 81, 89);
  pdf.text(pdf.splitTextToSize(lines, 112), margin, 247);
  pdf.setTextColor(36, 23, 43);
}

function writeLines(pdf: jsPDF, lines: string[], x: number, y: number, lineHeight: number) {
  lines.forEach((line, index) => {
    pdf.text(line, x, y + index * lineHeight);
  });
}

function organizationLines(organization: Doc<"organizations"> | null) {
  return [
    addressLine([organization?.address, joinPostalCity(organization?.postalCode, organization?.city), organization?.country]),
    organization?.email,
    organization?.phone,
    organization?.siret ? `SIRET: ${organization.siret}` : undefined,
    organization?.vatNumber ? `TVA: ${organization.vatNumber}` : undefined,
  ].filter(Boolean) as string[];
}

function clientLines(client: Doc<"clients"> | null) {
  return [
    clientName(client),
    addressLine([client?.address, joinPostalCity(client?.postalCode, client?.city), client?.country]),
    client?.email,
    client?.siret ? `SIRET: ${client.siret}` : undefined,
    client?.vatNumber ? `TVA: ${client.vatNumber}` : undefined,
  ].filter(Boolean) as string[];
}

function clientName(client: Doc<"clients"> | null) {
  if (!client) {
    return "Client non defini";
  }
  return client.companyName || [client.firstName, client.name].filter(Boolean).join(" ") || client.name;
}

function joinPostalCity(postalCode?: string, city?: string) {
  return [postalCode, city].filter(Boolean).join(" ");
}

function addressLine(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(", ");
}

function quoteStatusLabel(status: Doc<"quotes">["status"]) {
  return { draft: "Brouillon", sent: "Envoye", accepted: "Accepte", refused: "Refuse", invoiced: "Facture", void: "Annule" }[status];
}

function invoiceStatusLabel(status: Doc<"invoices">["status"]) {
  return { draft: "Brouillon", sent: "Envoyee", partially_paid: "Partiellement payee", paid: "Payee", overdue: "En retard", void: "Annulee" }[status];
}

function formatNumber(value: number) {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function safeFileName(value: string) {
  return value.replace(/[^a-z0-9-]+/gi, "_");
}

function dataUriToBase64(value: string) {
  return value.includes(",") ? value.split(",").pop() ?? "" : value;
}

function invoiceKindTitle(invoice: Doc<"invoices">) {
  if (invoice.invoiceKind === "deposit") {
    return "FACTURE D'ACOMPTE";
  }
  if (invoice.invoiceKind === "balance") {
    return "FACTURE DE SOLDE";
  }
  if (invoice.invoiceKind === "credit") {
    return "FACTURE D'AVOIR";
  }
  return "FACTURE";
}

function invoicePdfLineItems(bundle: InvoiceBundle): PdfLineItem[] {
  if (bundle.items.length > 0 && (!bundle.invoice.invoiceKind || bundle.invoice.invoiceKind === "standard")) {
    return bundle.items;
  }
  if (bundle.invoice.invoiceKind === "balance") {
    const sourceTotalHt = bundle.invoice.sourceQuoteTotalHt ?? bundle.quote?.totalHt ?? bundle.invoice.totalHt + (bundle.invoice.deductedDepositHt ?? 0);
    const deductedDepositHt = bundle.invoice.deductedDepositHt ?? Math.max(0, sourceTotalHt - bundle.invoice.totalHt);
    return [
      {
        description: `Total du devis initial - ${bundle.quote?.title ?? "Travaux"}`,
        quantity: 1,
        unit: "forfait",
        unitPriceHt: sourceTotalHt,
        totalHt: sourceTotalHt,
      },
      {
        description: "Acomptes deja factures a deduire",
        quantity: 1,
        unit: "deduction",
        unitPriceHt: -deductedDepositHt,
        totalHt: -deductedDepositHt,
      },
    ];
  }
  if (bundle.invoice.invoiceKind === "credit") {
    return [{
      description: `Avoir sur facture d'origine${bundle.quote?.title ? ` - ${bundle.quote.title}` : ""}`,
      quantity: 1,
      unit: "avoir",
      unitPriceHt: bundle.invoice.totalHt,
      totalHt: bundle.invoice.totalHt,
    }];
  }
  const depositLabel = bundle.invoice.invoiceKind === "deposit" && bundle.invoice.depositRate
    ? `Acompte ${formatNumber(bundle.invoice.depositRate)}%`
    : "Prestation facturee";
  return [{
    description: `${depositLabel} - ${bundle.quote?.title ?? "Travaux"}`,
    quantity: 1,
    unit: "forfait",
    unitPriceHt: bundle.invoice.totalHt,
    totalHt: bundle.invoice.totalHt,
  }];
}
