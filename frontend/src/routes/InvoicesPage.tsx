import { useMutation, useQuery } from "convex/react";
import { Check, Coins, Download, Mail, Printer, ReceiptText, Send, X } from "lucide-react";
import { api } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import { Badge, Button, DataTable, EmptyState, Field, IconButton, Modal, Notice, PageHeader, Panel, TextInput } from "@/components/ui/app";
import { formatCurrency, formatDate } from "@/lib/format";
import { Fragment, useEffect, useMemo, useState } from "react";

type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "void";
type InvoiceListItem = Doc<"invoices"> & {
  client: Doc<"clients"> | null;
  quote: Doc<"quotes"> | null;
};
type InvoiceBundle = {
  invoice: Doc<"invoices">;
  client: Doc<"clients"> | null;
  quote: Doc<"quotes"> | null;
  items: Doc<"quoteItems">[];
};
type RelaunchableInvoice = Pick<Doc<"invoices">, "number" | "totalTtc" | "dueDate" | "status"> & {
  client: Doc<"clients"> | null;
};

const labels: Record<InvoiceStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyee",
  paid: "Payee",
  overdue: "En retard",
  void: "Annulee",
};

const tones: Record<InvoiceStatus, "slate" | "indigo" | "emerald" | "amber" | "rose"> = {
  draft: "slate",
  sent: "indigo",
  paid: "emerald",
  overdue: "amber",
  void: "rose",
};

export function InvoicesPage() {
  const current = useQuery(api.app.current);
  const invoices = useQuery(api.invoices.list);
  const updateStatus = useMutation(api.invoices.updateStatus);
  const recordPayment = useMutation(api.invoices.recordPayment);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<Id<"invoices"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<Doc<"invoices"> | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    paidAt: timestampToDateInput(Date.now()),
    paymentMethod: "Virement",
    paymentReference: "",
  });
  const stats = useMemo(() => {
    const list = invoices ?? [];
    return {
      count: list.length,
      waiting: list.filter((invoice) => invoice.status !== "paid" && invoice.status !== "void").length,
      overdue: list.filter((invoice) => invoice.status !== "paid" && invoice.status !== "void" && invoice.dueDate < Date.now()).length,
      paidTotal: list.filter((invoice) => invoice.status === "paid").reduce((sum, invoice) => sum + invoice.totalTtc, 0),
    };
  }, [invoices]);
  const selectedInvoice = useQuery(api.invoices.get, selectedInvoiceId ? { invoiceId: selectedInvoiceId } : "skip");
  const organization = current?.organization ?? null;

  useEffect(() => {
    if (!selectedInvoiceId && invoices?.[0]) {
      setSelectedInvoiceId(invoices[0]._id);
    }
  }, [invoices, selectedInvoiceId]);

  async function setStatus(invoiceId: Id<"invoices">, status: "sent" | "overdue" | "void") {
    setPending(`${invoiceId}-${status}`);
    setError(null);
    try {
      await updateStatus({ invoiceId, status });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise a jour impossible");
    } finally {
      setPending(null);
    }
  }

  function openPayment(invoice: Doc<"invoices">) {
    setPaymentInvoice(invoice);
    setPaymentForm({
      paidAt: timestampToDateInput(invoice.paidAt ?? Date.now()),
      paymentMethod: invoice.paymentMethod ?? "Virement",
      paymentReference: invoice.paymentReference ?? "",
    });
  }

  async function savePayment() {
    if (!paymentInvoice) {
      return;
    }
    setPending("payment");
    setError(null);
    try {
      await recordPayment({
        invoiceId: paymentInvoice._id,
        paidAt: dateInputToTimestamp(paymentForm.paidAt),
        paymentMethod: optional(paymentForm.paymentMethod),
        paymentReference: optional(paymentForm.paymentReference),
      });
      setPaymentInvoice(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Encaissement impossible");
    } finally {
      setPending(null);
    }
  }

  function relaunchInvoice(invoice: RelaunchableInvoice) {
    const email = invoice.client?.email;
    if (!email) {
      setError("Email client manquant pour envoyer une relance.");
      return;
    }
    const subject = `Relance facture ${invoice.number}`;
    const body = [
      `Bonjour ${formatClientName(invoice.client)},`,
      "",
      `Je me permets de vous relancer concernant la facture ${invoice.number} d'un montant de ${formatCurrency(invoice.totalTtc)}, arrivee a echeance le ${formatDate(invoice.dueDate)}.`,
      "",
      "Pouvez-vous me confirmer la date de reglement ?",
      "",
      "Cordialement,",
    ].join("\n");
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function exportAccountingCsv() {
    const rows = invoices ?? [];
    if (rows.length === 0) {
      setError("Aucune facture a exporter.");
      return;
    }
    const csv = buildAccountingCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `boorise-factures-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Facturation"
        title="Factures"
        description="Suivi simple des factures generees depuis les devis acceptes."
        actions={
          <Button variant="outline" onClick={exportAccountingCsv}>
            <Download className="h-4 w-4" />
            Export comptable
          </Button>
        }
      />
      {error ? <Notice kind="error">{error}</Notice> : null}
      <div className="quote-overview">
        <div>
          <ReceiptText className="h-5 w-5" />
          <span>Factures</span>
          <strong>{stats.count}</strong>
        </div>
        <div>
          <Send className="h-5 w-5" />
          <span>A suivre</span>
          <strong>{stats.waiting}</strong>
        </div>
        <div>
          <X className="h-5 w-5" />
          <span>En retard</span>
          <strong>{stats.overdue}</strong>
        </div>
        <div>
          <Coins className="h-5 w-5" />
          <span>Encaisse</span>
          <strong>{formatCurrency(stats.paidTotal)}</strong>
        </div>
      </div>
      <Panel>
        <DataTable
          rows={invoices ?? []}
          rowKey={(invoice) => invoice._id}
          selectedKey={selectedInvoiceId}
          empty={<EmptyState title="Aucune facture" description="Convertis un devis accepte en facture pour alimenter cette liste." />}
          columns={[
            { key: "number", header: "Numero", render: (invoice) => (
              <button className="invoice-table-select" onClick={() => setSelectedInvoiceId(invoice._id)}>
                <span>{invoice.number}</span>
                <strong>{invoice.quote?.title ?? "Facture"}</strong>
              </button>
            ) },
            { key: "client", header: "Client", render: (invoice) => formatClientName(invoice.client) },
            { key: "status", header: "Statut", render: (invoice) => {
              const status = displayInvoiceStatus(invoice);
              return <Badge tone={tones[status]}>{labels[status]}</Badge>;
            } },
            { key: "total", header: "Total TTC", render: (invoice) => formatCurrency(invoice.totalTtc) },
            { key: "due", header: "Echeance", render: (invoice) => <DueDate invoice={invoice} /> },
            { key: "paid", header: "Paiement", render: (invoice) => invoice.paidAt ? `${formatDate(invoice.paidAt)} - ${invoice.paymentMethod ?? "regle"}` : "-" },
            {
              key: "actions",
              header: "",
              className: "actions-cell",
              render: (invoice) => (
                <div className="row-actions">
                  <IconButton disabled={pending === `${invoice._id}-sent`} label="Marquer envoyee" onClick={() => void setStatus(invoice._id, "sent")}><Send className="h-4 w-4" /></IconButton>
                  <IconButton disabled={invoice.status === "void"} label="Encaisser" variant="success" onClick={() => openPayment(invoice)}><Check className="h-4 w-4" /></IconButton>
                  <IconButton disabled={invoice.status === "paid" || invoice.status === "void"} label="Relancer" onClick={() => relaunchInvoice(invoice)}><Mail className="h-4 w-4" /></IconButton>
                  <IconButton disabled={pending === `${invoice._id}-void`} label="Annuler" variant="danger" onClick={() => void setStatus(invoice._id, "void")}><X className="h-4 w-4" /></IconButton>
                </div>
              ),
            },
          ]}
        />
      </Panel>

      <Panel className="invoice-stage">
        {!selectedInvoiceId ? (
          <EmptyState title="Selectionne une facture" description="Le document client et les actions apparaissent ici." />
        ) : selectedInvoice === undefined ? (
          <EmptyState title="Chargement..." />
        ) : !selectedInvoice ? (
          <EmptyState title="Facture introuvable" />
        ) : (
          <div className="space-y-4">
            <div className="invoice-summary">
              <div>
                <span>{selectedInvoice.invoice.number}</span>
                <h2>{selectedInvoice.quote?.title ?? "Facture"}</h2>
                <p>{formatClientName(selectedInvoice.client)} - echeance {formatDate(selectedInvoice.invoice.dueDate)}</p>
              </div>
              <div className="quote-total-block">
                <Badge tone={tones[displayInvoiceStatus(selectedInvoice.invoice)]}>{labels[displayInvoiceStatus(selectedInvoice.invoice)]}</Badge>
                <strong>{formatCurrency(selectedInvoice.invoice.totalTtc)}</strong>
                <span>{formatCurrency(selectedInvoice.invoice.totalHt)} HT</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => printInvoiceDocument(selectedInvoice.invoice.number)}>
                  <Printer className="h-4 w-4" />
                  PDF
                </Button>
                <Button
                  variant="outline"
                  disabled={selectedInvoice.invoice.status === "paid" || selectedInvoice.invoice.status === "void"}
                  onClick={() => relaunchInvoice({ ...selectedInvoice.invoice, client: selectedInvoice.client })}
                >
                  <Mail className="h-4 w-4" />
                  Relancer
                </Button>
                <Button disabled={selectedInvoice.invoice.status === "void"} onClick={() => openPayment(selectedInvoice.invoice)}>
                  <Check className="h-4 w-4" />
                  Encaisser
                </Button>
              </div>
            </div>
            <InvoiceDocument invoiceBundle={selectedInvoice} organization={organization} />
          </div>
        )}
      </Panel>

      <Modal
        open={!!paymentInvoice}
        title="Encaisser la facture"
        description={paymentInvoice ? `${paymentInvoice.number} - ${formatCurrency(paymentInvoice.totalTtc)}` : undefined}
        onClose={() => setPaymentInvoice(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setPaymentInvoice(null)}>Annuler</Button>
            <Button disabled={pending === "payment"} onClick={() => void savePayment()}>
              <Check className="h-4 w-4" />
              {pending === "payment" ? "Enregistrement..." : "Marquer payee"}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Date de paiement"><TextInput type="date" value={paymentForm.paidAt} onChange={(event) => setPaymentForm({ ...paymentForm, paidAt: event.target.value })} /></Field>
          <Field label="Moyen de paiement"><TextInput value={paymentForm.paymentMethod} onChange={(event) => setPaymentForm({ ...paymentForm, paymentMethod: event.target.value })} /></Field>
          <Field label="Reference"><TextInput value={paymentForm.paymentReference} placeholder="Ex: virement, cheque, transaction..." onChange={(event) => setPaymentForm({ ...paymentForm, paymentReference: event.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}

function DueDate({ invoice }: { invoice: Doc<"invoices"> }) {
  const days = daysUntil(invoice.dueDate);
  if (invoice.status === "paid") {
    return <span>{formatDate(invoice.dueDate)}</span>;
  }
  if (invoice.status === "void") {
    return <span>{formatDate(invoice.dueDate)}</span>;
  }
  if (days < 0) {
    return <span className="due-date due-date-late">{formatDate(invoice.dueDate)} · {Math.abs(days)} j retard</span>;
  }
  if (days <= 7) {
    return <span className="due-date due-date-soon">{formatDate(invoice.dueDate)} · J-{days}</span>;
  }
  return <span>{formatDate(invoice.dueDate)}</span>;
}

function InvoiceDocument({
  invoiceBundle,
  organization,
}: {
  invoiceBundle: InvoiceBundle;
  organization: Doc<"organizations"> | null;
}) {
  const { invoice, client, quote, items } = invoiceBundle;
  const organizationAddress = formatAddress([organization?.address, joinPostalCity(organization?.postalCode, organization?.city), organization?.country]);
  const clientAddress = formatAddress([client?.address, joinPostalCity(client?.postalCode, client?.city), client?.country]);
  const vatAmount = Math.max(0, invoice.totalTtc - invoice.totalHt);
  const paymentTermsText = invoice.paymentTermsText ?? organization?.paymentTermsText;
  const latePenaltyText = invoice.latePenaltyText ?? organization?.latePenaltyText;
  const discountTermsText = organization?.discountTermsText;
  const taxExemptionText = invoice.vatRate === 0 ? organization?.taxExemptionText : undefined;
  const legalNotice = invoice.legalNotice ?? organization?.legalNotice;
  const taxDebitOption = invoice.taxDebitOption ?? organization?.taxDebitOption;
  const professionalInsurance = organization?.professionalInsurance;
  const mediatorInfo = organization?.mediatorInfo;

  return (
    <Panel title="Apercu PDF facture" description="Document client pret a imprimer ou enregistrer en PDF.">
      <article id="invoice-print-document" className="quote-document invoice-document">
        <header className="quote-document-header">
          <div>
            <span className="quote-document-kicker">Facture</span>
            <h1>{invoice.number}</h1>
            <p>{quote?.title ?? "Travaux realises"}</p>
          </div>
          <div className="quote-document-company">
            {organization?.logoUrl ? <img src={organization.logoUrl} alt="" /> : <strong>B</strong>}
            <div>
              <b>{organization?.legalName ?? organization?.name ?? "Boorise"}</b>
              {[organization?.legalForm, organization?.shareCapital ? `Capital: ${organization.shareCapital}` : undefined].filter(Boolean).map((line) => <span key={line}>{line}</span>)}
              {organizationAddress ? <span>{organizationAddress}</span> : null}
              {organization?.email ? <span>{organization.email}</span> : null}
              {organization?.phone ? <span>{organization.phone}</span> : null}
              {organization?.registerNumber ? <span>{organization.registerNumber}</span> : null}
            </div>
          </div>
        </header>

        <section className="quote-document-meta">
          <div>
            <span>Client facture</span>
            <strong>{formatClientName(client)}</strong>
            {clientAddress ? <p>{clientAddress}</p> : null}
            {client?.email ? <p>{client.email}</p> : null}
            {client?.siren ? <p>SIREN: {client.siren}</p> : null}
            {client?.vatNumber ? <p>TVA: {client.vatNumber}</p> : null}
          </div>
          <div>
            <span>Date emission</span>
            <strong>{formatDate(invoice.issueDate)}</strong>
            <span>Date prestation</span>
            <strong>{formatDate(invoice.serviceDate ?? invoice.issueDate)}</strong>
            <span>Echeance</span>
            <strong>{formatDate(invoice.dueDate)}</strong>
            <span>Nature</span>
            <strong>{operationTypeLabel(invoice.operationType ?? organization?.defaultOperationType)}</strong>
          </div>
          <div>
            <span>SIREN</span>
            <strong>{organization?.siren ?? deriveSiren(organization?.siret) ?? "-"}</strong>
            <span>SIRET</span>
            <strong>{organization?.siret ?? "-"}</strong>
            <span>TVA intracom.</span>
            <strong>{organization?.vatNumber ?? "-"}</strong>
            {organization?.apeCode ? <><span>APE</span><strong>{organization.apeCode}</strong></> : null}
          </div>
        </section>

        {invoice.deliveryAddress ? (
          <section className="quote-document-note">
            <span>Adresse livraison / chantier</span>
            <p>{invoice.deliveryAddress}</p>
          </section>
        ) : null}

        <table className="quote-document-table">
          <thead>
            <tr>
              <th>Designation</th>
              <th>Quantite</th>
              <th>PU HT</th>
              <th>Total HT</th>
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? (
              groupInvoiceItems(items).map((group) => (
                <Fragment key={group.section}>
                  <tr className="quote-document-section">
                    <td colSpan={4}>{group.section}</td>
                  </tr>
                  {group.items.map((item) => (
                    <tr key={item._id}>
                      <td>{item.description}</td>
                      <td>{formatQuantity(item.quantity, item.unit)}</td>
                      <td>{formatCurrency(item.unitPriceHt)}</td>
                      <td>{formatCurrency(item.totalHt)}</td>
                    </tr>
                  ))}
                </Fragment>
              ))
            ) : (
              <tr>
                <td>{quote?.title ?? "Prestation facturee"}</td>
                <td>1</td>
                <td>{formatCurrency(invoice.totalHt)}</td>
                <td>{formatCurrency(invoice.totalHt)}</td>
              </tr>
            )}
          </tbody>
        </table>

        <section className="quote-document-bottom">
          <div className="quote-document-terms">
            {paymentTermsText ? <div><span>Reglement</span><p>{paymentTermsText}</p></div> : null}
            {invoice.bankDetails ?? organization?.bankDetails ? <div><span>Coordonnees bancaires</span><p>{invoice.bankDetails ?? organization?.bankDetails}</p></div> : null}
            {latePenaltyText ? <div><span>Retard</span><p>{latePenaltyText}</p></div> : null}
            {discountTermsText ? <div><span>Escompte</span><p>{discountTermsText}</p></div> : null}
            {taxExemptionText ? <div><span>TVA</span><p>{taxExemptionText}</p></div> : null}
            {taxDebitOption ? <div><span>TVA</span><p>Option pour le paiement de la TVA d'apres les debits.</p></div> : null}
            {professionalInsurance ? <div><span>Assurance</span><p>{professionalInsurance}</p></div> : null}
            {mediatorInfo ? <div><span>Mediateur</span><p>{mediatorInfo}</p></div> : null}
            {legalNotice ? <div><span>Mentions</span><p>{legalNotice}</p></div> : null}
          </div>
          <div className="quote-document-totals">
            <div><span>Total HT</span><strong>{formatCurrency(invoice.totalHt)}</strong></div>
            <div><span>TVA {formatNumber(invoice.vatRate)}%</span><strong>{formatCurrency(vatAmount)}</strong></div>
            <div><span>Total TTC</span><strong>{formatCurrency(invoice.totalTtc)}</strong></div>
            {invoice.paidAt ? <div className="invoice-paid-line"><span>Reglee le</span><strong>{formatDate(invoice.paidAt)}</strong></div> : null}
          </div>
        </section>
      </article>
    </Panel>
  );
}

function displayInvoiceStatus(invoice: Doc<"invoices">): InvoiceStatus {
  if (invoice.status !== "paid" && invoice.status !== "void" && invoice.dueDate < Date.now()) {
    return "overdue";
  }
  return invoice.status as InvoiceStatus;
}

function timestampToDateInput(timestamp: number | undefined) {
  if (!timestamp) {
    return "";
  }
  return new Date(timestamp).toISOString().slice(0, 10);
}

function dateInputToTimestamp(value: string) {
  if (!value) {
    return undefined;
  }
  const timestamp = new Date(`${value}T12:00:00`).getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function optional(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function groupInvoiceItems(items: Doc<"quoteItems">[]) {
  const groups = new Map<string, { section: string; items: Doc<"quoteItems">[] }>();
  for (const item of items) {
    const section = item.section?.trim() || "General";
    const group = groups.get(section) ?? { section, items: [] };
    group.items.push(item);
    groups.set(section, group);
  }
  return Array.from(groups.values());
}

function formatClientName(client: Doc<"clients"> | null | undefined) {
  if (!client) {
    return "Client non defini";
  }
  return client.companyName ?? `${client.firstName ?? ""} ${client.name}`.trim();
}

function joinPostalCity(postalCode?: string, city?: string) {
  return [postalCode, city].filter(Boolean).join(" ");
}

function formatAddress(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(", ");
}

function deriveSiren(siret: string | undefined) {
  const digits = siret?.replace(/\D/g, "");
  return digits && digits.length >= 9 ? digits.slice(0, 9) : undefined;
}

function operationTypeLabel(type: "goods" | "services" | "mixed" | undefined) {
  if (type === "goods") {
    return "Livraison de biens";
  }
  if (type === "services") {
    return "Prestation de services";
  }
  return "Biens et services";
}

function formatQuantity(value: number, unit?: string) {
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 4 })}${unit ? ` ${unit}` : ""}`;
}

function formatNumber(value: number) {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 4 });
}

function daysUntil(timestamp: number) {
  const day = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(timestamp);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / day);
}

function buildAccountingCsv(invoices: InvoiceListItem[]) {
  const header = [
    "Numero",
    "Date emission",
    "Client",
    "Statut",
    "Total HT",
    "TVA",
    "Total TTC",
    "Echeance",
    "Date paiement",
    "Mode paiement",
    "Reference paiement",
  ];
  const rows = invoices.map((invoice) => {
    const vatAmount = Math.max(0, invoice.totalTtc - invoice.totalHt);
    return [
      invoice.number,
      formatDate(invoice.issueDate),
      formatClientName(invoice.client),
      labels[displayInvoiceStatus(invoice)],
      moneyCsv(invoice.totalHt),
      moneyCsv(vatAmount),
      moneyCsv(invoice.totalTtc),
      formatDate(invoice.dueDate),
      invoice.paidAt ? formatDate(invoice.paidAt) : "",
      invoice.paymentMethod ?? "",
      invoice.paymentReference ?? "",
    ];
  });
  return [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
}

function moneyCsv(value: number) {
  return value.toFixed(2).replace(".", ",");
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function printInvoiceDocument(title: string) {
  const element = document.getElementById("invoice-print-document");
  if (!element) {
    window.print();
    return;
  }
  const popup = window.open("", "_blank", "width=980,height=1200");
  if (!popup) {
    window.print();
    return;
  }
  popup.document.write(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f6efe7; color: #24172b; font-family: Inter, Arial, sans-serif; }
    .quote-document { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fffaf3; padding: 18mm; }
    .quote-document-header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 3px solid #E54715; padding-bottom: 18px; }
    .quote-document-kicker, .quote-document-meta span, .quote-document-terms span { color: #622B86; font-size: 11px; font-weight: 800; text-transform: uppercase; }
    h1 { color: #491474; font-size: 34px; margin: 5px 0; }
    p { margin: 4px 0; line-height: 1.5; white-space: pre-line; }
    .quote-document-company { display: flex; gap: 12px; max-width: 48%; text-align: right; justify-content: flex-end; }
    .quote-document-company img { width: 54px; height: 54px; object-fit: contain; }
    .quote-document-company strong { display: grid; place-items: center; width: 54px; height: 54px; background: #491474; color: white; border-radius: 12px; }
    .quote-document-company div { display: grid; gap: 3px; font-size: 12px; }
    .quote-document-meta { display: grid; grid-template-columns: 1.4fr 0.8fr 0.8fr; gap: 16px; margin: 24px 0; }
    .quote-document-meta > div, .quote-document-terms > div, .quote-document-totals { border: 1px solid #e5d2ba; border-radius: 12px; padding: 12px; background: white; }
    .quote-document-meta strong { display: block; color: #491474; margin: 3px 0 9px; }
    .quote-document-table { width: 100%; border-collapse: collapse; margin-top: 18px; }
    .quote-document-table th { background: #491474; color: white; padding: 10px; text-align: left; font-size: 12px; }
    .quote-document-table td { border-bottom: 1px solid #ead9c5; padding: 10px; font-size: 12px; }
    .quote-document-table th:nth-child(n+2), .quote-document-table td:nth-child(n+2) { text-align: right; }
    .quote-document-section td { background: #f1e3d1; color: #491474; font-weight: 800; text-align: left !important; }
    .quote-document-bottom { display: grid; grid-template-columns: 1fr 260px; gap: 18px; margin-top: 24px; align-items: start; }
    .quote-document-terms { display: grid; gap: 10px; }
    .quote-document-totals { display: grid; gap: 9px; }
    .quote-document-totals div { display: flex; justify-content: space-between; gap: 16px; }
    .quote-document-totals div:last-child { border-top: 2px solid #E54715; padding-top: 10px; color: #E54715; font-size: 18px; }
    .invoice-paid-line { color: #622B86 !important; font-size: 13px !important; border-top: 1px solid #e5d2ba !important; }
    @page { size: A4; margin: 0; }
    @media print { body { background: white; } .quote-document { margin: 0; box-shadow: none; } }
  </style>
</head>
<body>${element.outerHTML}</body>
</html>`);
  popup.document.close();
  popup.focus();
  popup.print();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character];
  });
}
