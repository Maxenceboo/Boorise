import { useAction, useMutation, useQuery } from "convex/react";
import { Check, Coins, Download, Mail, Printer, ReceiptText, RotateCcw, Send, X } from "lucide-react";
import { api } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import { Badge, Button, ConfirmModal, DataTable, DocumentTimeline, EmptyState, Field, IconButton, Modal, Notice, PageHeader, Panel, SelectInput, TextInput } from "@/components/ui/app";
import { useToast } from "@/components/ui/toast-context";
import { downloadInvoicePdf, invoicePdfAttachment } from "@/lib/documentPdf";
import { friendlyError } from "@/lib/errors";
import { formatCurrency, formatDate } from "@/lib/format";
import { Fragment, useEffect, useMemo, useState } from "react";

type InvoiceStatus = "draft" | "sent" | "partially_paid" | "paid" | "overdue" | "void";
type InvoiceListItem = Doc<"invoices"> & {
  client: Doc<"clients"> | null;
  quote: Doc<"quotes"> | null;
  payments: Doc<"invoicePayments">[];
  paidTotalTtc: number;
  remainingTtc: number;
  paymentCount: number;
  reminderCount: number;
  lastReminderAt?: number;
  creditInvoice: Doc<"invoices"> | null;
  creditedInvoice: Doc<"invoices"> | null;
};
type InvoiceBundle = {
  invoice: Doc<"invoices">;
  client: Doc<"clients"> | null;
  quote: Doc<"quotes"> | null;
  items: Doc<"quoteItems">[];
  emailEvents: Doc<"documentEmailEvents">[];
  payments: Doc<"invoicePayments">[];
  paidTotalTtc: number;
  remainingTtc: number;
  paymentCount: number;
  reminderCount: number;
  lastReminderAt?: number;
  creditInvoice: Doc<"invoices"> | null;
  creditedInvoice: Doc<"invoices"> | null;
};
type ConfirmState = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "primary" | "danger" | "success";
  action: () => Promise<void>;
};

const labels: Record<InvoiceStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyee",
  partially_paid: "Partielle",
  paid: "Payee",
  overdue: "En retard",
  void: "Annulee",
};

const tones: Record<InvoiceStatus, "slate" | "indigo" | "emerald" | "amber" | "rose"> = {
  draft: "slate",
  sent: "indigo",
  partially_paid: "amber",
  paid: "emerald",
  overdue: "amber",
  void: "rose",
};

const invoiceStatusOrder: Record<InvoiceStatus, number> = {
  draft: 1,
  sent: 2,
  partially_paid: 3,
  overdue: 4,
  paid: 5,
  void: 6,
};

export function InvoicesPage() {
  const toast = useToast();
  const current = useQuery(api.app.current);
  const invoices = useQuery(api.invoices.list);
  const sendInvoiceEmail = useAction(api.documentEmails.sendInvoiceEmail);
  const sendInvoiceReminder = useAction(api.documentEmails.sendInvoiceReminder);
  const updateStatus = useMutation(api.invoices.updateStatus);
  const recordPayment = useMutation(api.invoices.recordPayment);
  const createCreditNote = useMutation(api.invoices.createCreditNoteFromInvoice);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<Id<"invoices"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<Doc<"invoices"> | null>(null);
  const [previewModal, setPreviewModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmState | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amountTtc: "",
    paidAt: timestampToDateInput(Date.now()),
    paymentMethod: "Virement",
    paymentReference: "",
    notes: "",
  });
  const stats = useMemo(() => {
    const list = invoices ?? [];
    return {
      count: list.length,
      waiting: list.filter((invoice) => invoice.status !== "paid" && invoice.status !== "void").length,
      overdue: list.filter((invoice) => invoice.status !== "paid" && invoice.status !== "void" && invoice.dueDate < Date.now()).length,
      paidTotal: list.reduce((sum, invoice) => sum + (invoice.paidTotalTtc ?? (invoice.status === "paid" ? invoice.totalTtc : 0)), 0),
    };
  }, [invoices]);
  const selectedInvoice = useQuery(api.invoices.get, selectedInvoiceId ? { invoiceId: selectedInvoiceId } : "skip");
  const organization = current?.organization ?? null;
  const paymentNeedsReference = paymentForm.paymentMethod !== "Especes";

  useEffect(() => {
    const focusedInvoiceId = sessionStorage.getItem("boorise:focusInvoiceId");
    if (focusedInvoiceId) {
      sessionStorage.removeItem("boorise:focusInvoiceId");
      setSelectedInvoiceId(focusedInvoiceId as Id<"invoices">);
      return;
    }
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
      const message = friendlyError(err, "Mise a jour impossible.");
      setError(message);
      toast.error(message);
    } finally {
      setPending(null);
    }
  }

  async function sendSelectedInvoiceEmail() {
    if (!selectedInvoice) {
      return;
    }
    setPending(`email-${selectedInvoice.invoice._id}`);
    setError(null);
    try {
      const attachment = await invoicePdfAttachment(selectedInvoice, organization);
      const result = await sendInvoiceEmail({
        invoiceId: selectedInvoice.invoice._id,
        attachment,
      });
      toast.success(`Facture envoyee a ${result.recipient}.`);
    } catch (err) {
      const message = friendlyError(err, "Envoi de la facture impossible.");
      setError(message);
      toast.error(message);
    } finally {
      setPending(null);
    }
  }

  function requestStatus(invoice: Doc<"invoices">, status: "sent" | "void") {
    const copy: Record<"sent" | "void", ConfirmState> = {
      sent: {
        title: "Marquer la facture comme envoyee ?",
        description: "Cette action ajoute l'etape d'envoi dans la timeline et garde la facture prete au suivi client.",
        confirmLabel: "Marquer envoyee",
        action: () => setStatus(invoice._id, "sent"),
      },
      void: {
        title: "Annuler cette facture ?",
        description: "La facture restera dans l'historique en statut annule. Une facture deja encaissee ne peut pas etre annulee ici.",
        confirmLabel: "Annuler la facture",
        tone: "danger",
        action: () => setStatus(invoice._id, "void"),
      },
    };
    setConfirmAction(copy[status]);
  }

  function requestCreditNote(invoice: Doc<"invoices">) {
    setConfirmAction({
      title: "Creer un avoir ?",
      description: "Un document d'avoir brouillon sera cree et lie a cette facture. Quand l'avoir sera envoye, la facture d'origine passera en annulee.",
      confirmLabel: "Creer l'avoir",
      tone: "danger",
      action: () => createCreditForInvoice(invoice._id),
    });
  }

  async function createCreditForInvoice(invoiceId: Id<"invoices">) {
    setPending(`credit-${invoiceId}`);
    setError(null);
    try {
      const creditInvoiceId = await createCreditNote({ invoiceId });
      setSelectedInvoiceId(creditInvoiceId);
      toast.success("Avoir cree en brouillon.");
    } catch (err) {
      const message = friendlyError(err, "Creation de l'avoir impossible.");
      setError(message);
      toast.error(message);
    } finally {
      setPending(null);
    }
  }

  async function runConfirmAction() {
    if (!confirmAction) {
      return;
    }
    setConfirmPending(true);
    try {
      await confirmAction.action();
      setConfirmAction(null);
    } finally {
      setConfirmPending(false);
    }
  }

  function openPayment(invoice: Doc<"invoices">) {
    if (invoice.invoiceKind === "credit") {
      const message = "Un avoir ne s'encaisse pas comme une facture.";
      setError(message);
      toast.error(message);
      return;
    }
    if (invoice.status === "draft") {
      const message = "Envoie la facture avant de l'encaisser.";
      setError(message);
      toast.error(message);
      return;
    }
    setPaymentInvoice(invoice);
    const remaining = invoiceRemaining(invoice);
    setPaymentForm({
      amountTtc: String(remaining > 0 ? remaining : invoice.totalTtc),
      paidAt: timestampToDateInput(invoice.paidAt ?? Date.now()),
      paymentMethod: invoice.paymentMethod ?? "Virement",
      paymentReference: invoice.paymentReference ?? "",
      notes: "",
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
        amountTtc: Number(paymentForm.amountTtc),
        paidAt: dateInputToTimestamp(paymentForm.paidAt),
        paymentMethod: optional(paymentForm.paymentMethod),
        paymentReference: paymentNeedsReference ? optional(paymentForm.paymentReference) : undefined,
        notes: optional(paymentForm.notes),
      });
      setPaymentInvoice(null);
    } catch (err) {
      const message = friendlyError(err, "Encaissement impossible.");
      setError(message);
      toast.error(message);
    } finally {
      setPending(null);
    }
  }

  async function relaunchInvoice(invoice: Doc<"invoices">) {
    setPending(`reminder-${invoice._id}`);
    setError(null);
    try {
      const result = await sendInvoiceReminder({ invoiceId: invoice._id });
      toast.success(`Relance envoyee a ${result.recipient}.`);
    } catch (err) {
      const message = friendlyError(err, "Relance impossible.");
      setError(message);
      toast.error(message);
    } finally {
      setPending(null);
    }
  }

  function exportAccountingCsv() {
    const rows = invoices ?? [];
    if (rows.length === 0) {
      setError("Aucune facture a exporter.");
      return;
    }
    const csv = buildAccountingCsv(rows, organization);
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
          density="compact"
          loading={invoices === undefined}
          rows={invoices ?? []}
          rowKey={(invoice) => invoice._id}
          selectedKey={selectedInvoiceId}
          empty={<EmptyState title="Aucune facture" description="Convertis un devis accepte en facture pour alimenter cette liste." />}
          columns={[
            { key: "number", header: "Numero", sortValue: (invoice) => invoice.number, render: (invoice) => (
              <button className="invoice-table-select" onClick={() => setSelectedInvoiceId(invoice._id)}>
                <span>{invoice.number}</span>
                <strong>{invoice.quote?.title ?? "Facture"}</strong>
              </button>
            ) },
            { key: "client", header: "Client", sortValue: (invoice) => formatClientName(invoice.client), render: (invoice) => formatClientName(invoice.client) },
            { key: "status", header: "Statut", sortValue: (invoice) => invoiceStatusOrder[displayInvoiceStatus(invoice)], render: (invoice) => {
              const status = displayInvoiceStatus(invoice);
              return <Badge tone={tones[status]}>{labels[status]}</Badge>;
            } },
            { key: "total", header: "Total TTC", sortValue: (invoice) => invoice.totalTtc, render: (invoice) => formatCurrency(invoice.totalTtc) },
            { key: "remaining", header: "Reste", sortValue: (invoice) => invoice.remainingTtc, render: (invoice) => <strong>{formatCurrency(invoice.remainingTtc)}</strong> },
            { key: "due", header: "Echeance", sortValue: (invoice) => invoice.dueDate, render: (invoice) => <DueDate invoice={invoice} /> },
            { key: "paid", header: "Paiement", sortValue: (invoice) => invoice.paidAt ?? 0, render: (invoice) => invoice.paidAt ? `${formatDate(invoice.paidAt)} - ${formatCurrency(invoice.paidTotalTtc)}` : "-" },
            { key: "reminder", header: "Relance", sortValue: (invoice) => invoice.lastReminderAt ?? 0, render: (invoice) => invoice.lastReminderAt ? `${formatDate(invoice.lastReminderAt)} (${invoice.reminderCount})` : "-" },
            {
              key: "actions",
              header: "",
              className: "actions-cell",
              sortable: false,
              render: (invoice) => (
                <div className="row-actions">
                  <IconButton disabled={invoice.status === "sent" || invoice.status === "paid" || invoice.status === "void" || pending === `${invoice._id}-sent`} label="Marquer envoyee" onClick={() => requestStatus(invoice, "sent")}><Send className="h-4 w-4" /></IconButton>
                  <IconButton disabled={invoice.status === "draft" || invoice.status === "paid" || invoice.status === "void" || invoice.invoiceKind === "credit"} label="Encaisser" variant="success" onClick={() => openPayment(invoice)}><Check className="h-4 w-4" /></IconButton>
                  <IconButton disabled={invoice.status === "draft" || invoice.status === "paid" || invoice.status === "void" || invoice.invoiceKind === "credit" || pending === `reminder-${invoice._id}`} label="Relancer" onClick={() => void relaunchInvoice(invoice)}><Mail className="h-4 w-4" /></IconButton>
                  {invoice.status === "draft" ? (
                    <IconButton disabled={pending === `${invoice._id}-void`} label="Annuler" variant="danger" onClick={() => requestStatus(invoice, "void")}><X className="h-4 w-4" /></IconButton>
                  ) : (
                    <IconButton disabled={!canCreateCreditNote(invoice) || pending === `credit-${invoice._id}`} label={invoice.creditInvoiceId ? "Voir l'avoir" : "Creer un avoir"} variant="danger" onClick={() => invoice.creditInvoiceId ? setSelectedInvoiceId(invoice.creditInvoiceId) : requestCreditNote(invoice)}><RotateCcw className="h-4 w-4" /></IconButton>
                  )}
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
                <span>{formatCurrency(selectedInvoice.paidTotalTtc)} encaisse</span>
                {selectedInvoice.remainingTtc > 0 ? <span>{formatCurrency(selectedInvoice.remainingTtc)} restant</span> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setPreviewModal(true)}>
                  <Printer className="h-4 w-4" />
                  Apercu
                </Button>
                <Button
                  disabled={selectedInvoice.invoice.status === "paid" || selectedInvoice.invoice.status === "void" || pending === `email-${selectedInvoice.invoice._id}`}
                  onClick={() => void sendSelectedInvoiceEmail()}
                >
                  <Send className="h-4 w-4" />
                  Envoyer au client
                </Button>
                <Button
                  variant="outline"
                  disabled={selectedInvoice.invoice.status === "draft" || selectedInvoice.invoice.status === "paid" || selectedInvoice.invoice.status === "void" || selectedInvoice.invoice.invoiceKind === "credit" || pending === `reminder-${selectedInvoice.invoice._id}`}
                  onClick={() => void relaunchInvoice(selectedInvoice.invoice)}
                >
                  <Mail className="h-4 w-4" />
                  Relancer
                </Button>
                <Button disabled={selectedInvoice.invoice.status === "draft" || selectedInvoice.invoice.status === "paid" || selectedInvoice.invoice.status === "void"} onClick={() => openPayment({ ...selectedInvoice.invoice, remainingTtc: selectedInvoice.remainingTtc } as Doc<"invoices"> & { remainingTtc: number })}>
                  <Check className="h-4 w-4" />
                  Encaisser
                </Button>
                {selectedInvoice.invoice.status === "draft" ? (
                  <Button variant="danger" disabled={pending === `${selectedInvoice.invoice._id}-void`} onClick={() => requestStatus(selectedInvoice.invoice, "void")}>
                    <X className="h-4 w-4" />
                    Annuler
                  </Button>
                ) : (
                  <Button
                    variant="danger"
                    disabled={!canCreateCreditNote(selectedInvoice.invoice) || pending === `credit-${selectedInvoice.invoice._id}`}
                    onClick={() => selectedInvoice.invoice.creditInvoiceId ? setSelectedInvoiceId(selectedInvoice.invoice.creditInvoiceId) : requestCreditNote(selectedInvoice.invoice)}
                  >
                    <RotateCcw className="h-4 w-4" />
                    {selectedInvoice.invoice.creditInvoiceId ? "Voir l'avoir" : "Creer un avoir"}
                  </Button>
                )}
              </div>
            </div>
            {selectedInvoice.creditedInvoice ? (
              <Notice kind="info">Avoir lie a la facture {selectedInvoice.creditedInvoice.number}.</Notice>
            ) : selectedInvoice.creditInvoice ? (
              <Notice kind="warning">Cette facture possede deja un avoir: {selectedInvoice.creditInvoice.number}.</Notice>
            ) : null}
            {selectedInvoice.lastReminderAt ? (
              <Notice kind="info">Derniere relance envoyee le {formatDate(selectedInvoice.lastReminderAt)} ({selectedInvoice.reminderCount} relance{selectedInvoice.reminderCount > 1 ? "s" : ""}).</Notice>
            ) : null}
            <DocumentTimeline events={buildInvoiceTimeline(selectedInvoice.invoice, selectedInvoice.emailEvents ?? [])} />
            <PaymentHistory payments={selectedInvoice.payments ?? []} paidTotal={selectedInvoice.paidTotalTtc} remaining={selectedInvoice.remainingTtc} />
          </div>
        )}
      </Panel>

      <ConfirmModal
        open={!!confirmAction}
        title={confirmAction?.title ?? ""}
        description={confirmAction?.description ?? ""}
        confirmLabel={confirmAction?.confirmLabel ?? "Confirmer"}
        tone={confirmAction?.tone}
        pending={confirmPending}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void runConfirmAction()}
      />

      <Modal
        open={previewModal && !!selectedInvoice}
        title="Apercu de la facture"
        description={selectedInvoice ? `${selectedInvoice.invoice.number} - document client` : undefined}
        onClose={() => setPreviewModal(false)}
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setPreviewModal(false)}>Fermer</Button>
            {selectedInvoice ? (
              <Button onClick={() => void downloadInvoicePdf(selectedInvoice, organization)}>
                <Download className="h-4 w-4" />
                Telecharger PDF
              </Button>
            ) : null}
          </>
        }
      >
        {selectedInvoice ? <InvoiceDocument invoiceBundle={selectedInvoice} organization={organization} /> : null}
      </Modal>

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
              {pending === "payment" ? "Enregistrement..." : "Enregistrer paiement"}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Montant TTC encaisse" required><TextInput type="number" min="0.01" step="0.01" value={paymentForm.amountTtc} onChange={(event) => setPaymentForm({ ...paymentForm, amountTtc: event.target.value })} /></Field>
          <Field label="Date de paiement" required><TextInput type="date" value={paymentForm.paidAt} onChange={(event) => setPaymentForm({ ...paymentForm, paidAt: event.target.value })} /></Field>
          <Field label="Moyen de paiement" required>
            <SelectInput value={paymentForm.paymentMethod} onChange={(event) => setPaymentForm({ ...paymentForm, paymentMethod: event.target.value, paymentReference: event.target.value === "Especes" ? "" : paymentForm.paymentReference })}>
              <option value="Virement">Virement</option>
              <option value="Cheque">Cheque</option>
              <option value="Carte bancaire">Carte bancaire</option>
              <option value="Especes">Especes</option>
              <option value="Autre">Autre</option>
            </SelectInput>
          </Field>
          {paymentNeedsReference ? (
            <Field label="Reference" optional><TextInput value={paymentForm.paymentReference} placeholder="Ex: numero de cheque, virement, transaction..." onChange={(event) => setPaymentForm({ ...paymentForm, paymentReference: event.target.value })} /></Field>
          ) : null}
          <Field label="Note" optional><TextInput value={paymentForm.notes} placeholder="Ex: acompte chantier, solde, echeance 1..." onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })} /></Field>
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

function buildInvoiceTimeline(invoice: Doc<"invoices">, emailEvents: Doc<"documentEmailEvents">[]) {
  const status = displayInvoiceStatus(invoice);
  const events = [
    {
      label: "Creee",
      date: formatDate(invoice.createdAt),
      done: true,
    },
    {
      label: "Envoyee",
      date: invoice.sentAt ? formatDate(invoice.sentAt) : undefined,
      done: !!invoice.sentAt || ["sent", "partially_paid", "overdue", "paid"].includes(status),
      current: status === "sent" || status === "overdue",
    },
    {
      label: "Echeance",
      date: formatDate(invoice.dueDate),
      done: true,
      current: status === "overdue",
      tone: status === "overdue" ? "danger" as const : "default" as const,
    },
    {
      label: invoice.status === "void" ? "Annulee" : invoice.status === "partially_paid" ? "Paiement partiel" : "Payee",
      date: invoice.status === "void" && invoice.voidedAt ? formatDate(invoice.voidedAt) : invoice.paidAt ? formatDate(invoice.paidAt) : undefined,
      done: invoice.status === "void" || invoice.status === "paid" || invoice.status === "partially_paid",
      current: invoice.status === "void" || invoice.status === "paid" || invoice.status === "partially_paid",
      tone: invoice.status === "void" ? "danger" as const : "success" as const,
    },
  ];
  return [
    ...events.slice(0, 2),
    ...emailEvents.map((event, index) => ({
      label: event.eventKind === "reminder"
        ? index === 0 ? "Relance envoyee" : `Relance envoyee ${emailEvents.length - index}`
        : index === 0 ? "Email envoye" : `Email envoye ${emailEvents.length - index}`,
      date: formatDate(event.createdAt),
      detail: [event.recipient, event.senderName ?? event.senderEmail].filter(Boolean).join(" - "),
      done: true,
      tone: event.eventKind === "reminder" ? "danger" as const : "success" as const,
    })),
    ...events.slice(2),
  ];
}

function PaymentHistory({ payments, paidTotal, remaining }: { payments: Doc<"invoicePayments">[]; paidTotal: number; remaining: number }) {
  return (
    <Panel title="Paiements" description="Historique des encaissements enregistres sur cette facture.">
      <div className="payment-summary">
        <div><span>Encaisse</span><strong>{formatCurrency(paidTotal)}</strong></div>
        <div><span>Reste</span><strong>{formatCurrency(remaining)}</strong></div>
      </div>
      {payments.length === 0 ? (
        <EmptyState title="Aucun paiement" description="Enregistre un encaissement pour suivre le solde restant." />
      ) : (
        <DataTable
          density="compact"
          rows={payments}
          rowKey={(payment) => payment._id}
          columns={[
            { key: "date", header: "Date", sortValue: (payment) => payment.paidAt, render: (payment) => formatDate(payment.paidAt) },
            { key: "amount", header: "Montant", sortValue: (payment) => payment.amountTtc, render: (payment) => <strong>{formatCurrency(payment.amountTtc)}</strong> },
            { key: "method", header: "Moyen", sortValue: (payment) => payment.paymentMethod, render: (payment) => payment.paymentMethod ?? "-" },
            { key: "reference", header: "Reference", sortValue: (payment) => payment.paymentReference, render: (payment) => payment.paymentReference ?? payment.notes ?? "-" },
          ]}
        />
      )}
    </Panel>
  );
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
    <article id="invoice-print-document" className="quote-document invoice-document">
        <header className="quote-document-header">
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
          <div className="quote-document-identity">
            <span className="quote-document-kicker">{invoiceKindLabel(invoice)}</span>
            <h1>{invoice.number}</h1>
            <p>{quote?.title ?? "Travaux realises"}</p>
          </div>
        </header>

        <section className="quote-document-meta">
          <div>
            <span>Client facture</span>
            <strong>{formatClientName(client)}</strong>
            {clientAddress ? <p>{clientAddress}</p> : null}
            {client?.email ? <p>{client.email}</p> : null}
            {client?.siren ? <p>SIREN: {client.siren}</p> : null}
            {client?.siret ? <p>SIRET: {client.siret}</p> : null}
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
              <th>Unite</th>
              <th>PU HT</th>
              <th>TVA</th>
              <th>Total HT</th>
            </tr>
          </thead>
          <tbody>
            {items.length > 0 && (!invoice.invoiceKind || invoice.invoiceKind === "standard") ? (
              groupInvoiceItems(items).map((group) => (
                <Fragment key={group.section}>
                  <tr className="quote-document-section">
                    <td colSpan={6}>{group.section}</td>
                  </tr>
                  {group.items.map((item) => (
                    <tr key={item._id}>
                      <td>{item.description}</td>
                      <td>{formatNumber(item.quantity)}</td>
                      <td>{item.unit}</td>
                      <td>{formatCurrency(item.unitPriceHt)}</td>
                      <td>{formatNumber(invoice.vatRate)}%</td>
                      <td>{formatCurrency(item.totalHt)}</td>
                    </tr>
                  ))}
                </Fragment>
              ))
            ) : (
              invoiceDocumentRows(invoice, quote).map((row) => (
                <tr key={row.description}>
                  <td>{row.description}</td>
                  <td>{formatNumber(row.quantity)}</td>
                  <td>{row.unit}</td>
                  <td>{formatCurrency(row.unitPriceHt)}</td>
                  <td>{formatNumber(invoice.vatRate)}%</td>
                  <td>{formatCurrency(row.totalHt)}</td>
                </tr>
              ))
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

function formatNumber(value: number) {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 4 });
}

function invoiceKindLabel(invoice: Doc<"invoices">) {
  if (invoice.invoiceKind === "deposit") {
    return "Facture d'acompte";
  }
  if (invoice.invoiceKind === "balance") {
    return "Facture de solde";
  }
  if (invoice.invoiceKind === "credit") {
    return "Facture d'avoir";
  }
  return "Facture";
}

function invoiceLineLabel(invoice: Doc<"invoices">, quote: Doc<"quotes"> | null) {
  if (invoice.invoiceKind === "deposit") {
    return `Acompte ${invoice.depositRate?.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) ?? ""}% - ${quote?.title ?? "Travaux"}`;
  }
  if (invoice.invoiceKind === "credit") {
    return `Avoir sur facture d'origine${quote?.title ? ` - ${quote.title}` : ""}`;
  }
  return quote?.title ?? "Prestation facturee";
}

function invoiceDocumentRows(invoice: Doc<"invoices">, quote: Doc<"quotes"> | null) {
  if (invoice.invoiceKind === "balance") {
    const sourceTotalHt = invoice.sourceQuoteTotalHt ?? quote?.totalHt ?? invoice.totalHt + (invoice.deductedDepositHt ?? 0);
    const deductedDepositHt = invoice.deductedDepositHt ?? Math.max(0, sourceTotalHt - invoice.totalHt);
    return [
      {
        description: `Total du devis initial - ${quote?.title ?? "Travaux"}`,
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
  if (invoice.invoiceKind === "credit") {
    return [{
      description: invoiceLineLabel(invoice, quote),
      quantity: 1,
      unit: "avoir",
      unitPriceHt: invoice.totalHt,
      totalHt: invoice.totalHt,
    }];
  }
  return [{
    description: invoiceLineLabel(invoice, quote),
    quantity: 1,
    unit: "forfait",
    unitPriceHt: invoice.totalHt,
    totalHt: invoice.totalHt,
  }];
}

function invoiceRemaining(invoice: Doc<"invoices"> | InvoiceListItem) {
  if ("remainingTtc" in invoice && typeof invoice.remainingTtc === "number") {
    return invoice.remainingTtc;
  }
  return invoice.status === "paid" ? 0 : invoice.totalTtc;
}

function canCreateCreditNote(invoice: Doc<"invoices">) {
  return invoice.invoiceKind !== "credit" && invoice.status !== "draft" && invoice.status !== "void";
}

function daysUntil(timestamp: number) {
  const day = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(timestamp);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / day);
}

function buildAccountingCsv(invoices: InvoiceListItem[], organization: Doc<"organizations"> | null) {
  const accounts = accountingAccounts(organization);
  const header = [
    "Journal",
    "Date",
    "Piece",
    "Type piece",
    "Type ligne",
    "Compte",
    "Libelle",
    "Debit",
    "Credit",
    "Client",
    "Statut",
    "Echeance",
    "Date paiement",
    "Mode paiement",
    "Reference paiement",
    "Facture origine",
  ];
  const rows = invoices.flatMap((invoice) => {
    const vatAmount = roundMoney(invoice.totalTtc - invoice.totalHt);
    const clientName = formatClientName(invoice.client);
    const saleAccount = revenueAccount(invoice.operationType, accounts);
    const documentType = invoiceKindLabel(invoice);
    const label = `${documentType} ${invoice.number} - ${clientName}`;
    const base = {
      client: clientName,
      documentType,
      sourceInvoice: invoice.creditedInvoice?.number ?? "",
      status: labels[displayInvoiceStatus(invoice)],
      dueDate: isoDate(invoice.dueDate),
      paidAt: "",
      paymentMethod: "",
      paymentReference: "",
    };
    const saleRows = [
      signedAccountingRow("VE", invoice.issueDate, invoice.number, "document", accounts.client, label, invoice.totalTtc, "debit", base),
      signedAccountingRow("VE", invoice.issueDate, invoice.number, "document", saleAccount, label, invoice.totalHt, "credit", base),
    ];
    if (vatAmount !== 0) {
      saleRows.push(signedAccountingRow("VE", invoice.issueDate, invoice.number, "document", accounts.vatCollected, label, vatAmount, "credit", base));
    }

    for (const payment of invoice.payments ?? []) {
      const paymentBase = {
        ...base,
        paidAt: isoDate(payment.paidAt),
        paymentMethod: payment.paymentMethod ?? "",
        paymentReference: payment.paymentReference ?? "",
      };
      const paymentLabel = `Reglement ${invoice.number} - ${clientName}`;
      saleRows.push(
        signedAccountingRow("BQ", payment.paidAt, invoice.number, "paiement", accounts.bank, paymentLabel, payment.amountTtc, "debit", paymentBase),
        signedAccountingRow("BQ", payment.paidAt, invoice.number, "paiement", accounts.client, paymentLabel, payment.amountTtc, "credit", paymentBase),
      );
    }
    return saleRows;
  });
  return [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
}

function signedAccountingRow(
  journal: string,
  date: number,
  piece: string,
  lineType: string,
  account: string,
  label: string,
  signedAmount: number,
  normalSide: "debit" | "credit",
  meta: {
    client: string;
    documentType: string;
    sourceInvoice: string;
    status: string;
    dueDate: string;
    paidAt: string;
    paymentMethod: string;
    paymentReference: string;
  },
) {
  const amount = Math.abs(roundMoney(signedAmount));
  const side = signedAmount >= 0 ? normalSide : normalSide === "debit" ? "credit" : "debit";
  return accountingRow(journal, date, piece, lineType, account, label, side === "debit" ? amount : 0, side === "credit" ? amount : 0, meta);
}

function accountingRow(
  journal: string,
  date: number,
  piece: string,
  lineType: string,
  account: string,
  label: string,
  debit: number,
  credit: number,
  meta: {
    client: string;
    documentType: string;
    sourceInvoice: string;
    status: string;
    dueDate: string;
    paidAt: string;
    paymentMethod: string;
    paymentReference: string;
  },
) {
  return [
    journal,
    isoDate(date),
    piece,
    meta.documentType,
    lineType,
    account,
    label,
    debit > 0 ? moneyCsv(debit) : "",
    credit > 0 ? moneyCsv(credit) : "",
    meta.client,
    meta.status,
    meta.dueDate,
    meta.paidAt,
    meta.paymentMethod,
    meta.paymentReference,
    meta.sourceInvoice,
  ];
}

function accountingAccounts(organization: Doc<"organizations"> | null) {
  return {
    client: organization?.accountingClientAccount ?? "411000",
    bank: organization?.accountingBankAccount ?? "512000",
    vatCollected: organization?.accountingVatCollectedAccount ?? "445710",
    salesGoods: organization?.accountingSalesGoodsAccount ?? "707000",
    salesServices: organization?.accountingSalesServicesAccount ?? "706000",
  };
}

function revenueAccount(operationType: Doc<"invoices">["operationType"], accounts: ReturnType<typeof accountingAccounts>) {
  if (operationType === "goods") {
    return accounts.salesGoods;
  }
  return accounts.salesServices;
}

function isoDate(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function moneyCsv(value: number) {
  return value.toFixed(2).replace(".", ",");
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
