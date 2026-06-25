import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { AlertTriangle, ArrowRight, Boxes, Clock3, Euro, FileText, Plus, ReceiptText, TrendingUp, UsersRound } from "lucide-react";
import { api } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import { Badge, Button, DataTable, EmptyState, PageHeader, Panel, StatCard } from "@/components/ui/app";
import { formatCurrency, formatDate } from "@/lib/format";

type QuoteStatus = "draft" | "sent" | "accepted" | "refused" | "invoiced";
type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "void";

const quoteStatusLabels: Record<QuoteStatus, string> = {
  draft: "Brouillon",
  sent: "Envoye",
  accepted: "Accepte",
  refused: "Refuse",
  invoiced: "Facture",
};

const quoteStatusTones: Record<QuoteStatus, "slate" | "indigo" | "emerald" | "rose" | "cyan"> = {
  draft: "slate",
  sent: "indigo",
  accepted: "emerald",
  refused: "rose",
  invoiced: "cyan",
};

const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyee",
  paid: "Payee",
  overdue: "En retard",
  void: "Annulee",
};

const invoiceStatusTones: Record<InvoiceStatus, "slate" | "indigo" | "emerald" | "amber" | "rose"> = {
  draft: "slate",
  sent: "indigo",
  paid: "emerald",
  overdue: "amber",
  void: "rose",
};

export function DashboardPage() {
  const navigate = useNavigate();
  const dashboard = useQuery(api.app.dashboard);
  const urgentCount = dashboard
    ? dashboard.alerts.overdueInvoices + dashboard.alerts.quotesToFollowUp + dashboard.alerts.expiredQuotes
    : 0;
  const wonQuotes = dashboard ? dashboard.pipeline.accepted + dashboard.pipeline.invoiced : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pilotage"
        title="Dashboard"
        description="Priorites commerciales, encaissements, marge estimee et hygiene catalogue."
        actions={
          <div className="page-actions">
            <Button variant="outline" onClick={() => void navigate({ to: "/factures" })}>
              <ReceiptText className="h-4 w-4" />
              Factures
            </Button>
            <Button onClick={() => void navigate({ to: "/devis" })}>
              <Plus className="h-4 w-4" />
              Nouveau devis
            </Button>
          </div>
        }
      />

      <section className="ops-hero">
        <div>
          <div className="eyebrow border-white/20 bg-white/10 text-cyan-100">Boorise ERP</div>
          <h2>{urgentCount > 0 ? `${urgentCount} priorite(s) a traiter` : "Activite sous controle"}</h2>
          <p>
            Le dashboard met devant toi ce qui demande une action: encaissement, relance, expiration de devis, marge et catalogue.
          </p>
        </div>
        <div className="ops-command">
          <CommandRow label="Factures en retard" value={dashboard?.pipeline.overdueInvoices ?? 0} tone="danger" onClick={() => void navigate({ to: "/factures" })} />
          <CommandRow label="Factures a echeance" value={dashboard?.pipeline.dueSoonInvoices ?? 0} tone="warning" onClick={() => void navigate({ to: "/factures" })} />
          <CommandRow label="Devis a relancer" value={dashboard?.pipeline.quotesToFollowUp ?? 0} tone="info" onClick={() => void navigate({ to: "/devis" })} />
          <CommandRow label="Fiches catalogue a completer" value={dashboard?.alerts.lowCatalogDetail ?? 0} tone="muted" onClick={() => void navigate({ to: "/materiaux" })} />
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="A encaisser" value={dashboard ? formatCurrency(dashboard.totals.unpaidInvoicesTtc) : "-"} detail={`${dashboard?.pipeline.unpaidInvoices ?? 0} facture(s) ouvertes`} icon={<ReceiptText className="h-5 w-5" />} tone="rose" />
        <StatCard label="En retard" value={dashboard ? formatCurrency(dashboard.totals.overdueInvoicesTtc) : "-"} detail={`${dashboard?.pipeline.overdueInvoices ?? 0} dossier(s)`} icon={<AlertTriangle className="h-5 w-5" />} tone="amber" />
        <StatCard label="Marge estimee" value={dashboard ? formatCurrency(dashboard.totals.estimatedMarginHt) : "-"} detail={`${dashboard?.totals.estimatedMarginRate ?? 0}% sur lignes chiffrees`} icon={<TrendingUp className="h-5 w-5" />} tone="emerald" />
        <StatCard label="Conversion" value={dashboard ? `${dashboard.totals.conversionRate}%` : "-"} detail={`${wonQuotes} devis gagnes`} icon={<Euro className="h-5 w-5" />} tone="indigo" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Clients" value={dashboard?.counts.clients ?? "-"} detail="contacts actifs" icon={<UsersRound className="h-5 w-5" />} tone="emerald" />
        <StatCard label="Materiaux" value={dashboard?.counts.materials ?? "-"} detail="references actives" icon={<Boxes className="h-5 w-5" />} tone="amber" />
        <StatCard label="Devis" value={dashboard?.counts.quotes ?? "-"} detail="documents crees" icon={<FileText className="h-5 w-5" />} tone="indigo" />
        <StatCard label="Devis acceptes" value={dashboard ? formatCurrency(dashboard.totals.acceptedQuotesTtc) : "-"} detail="TTC signe ou facture" icon={<Euro className="h-5 w-5" />} tone="rose" />
      </div>

      <div className="dashboard-grid">
        <Panel title="Priorites" description="Ce qui merite une action maintenant.">
          <div className="priority-board">
            <PriorityGroup
              title="Factures en retard"
              empty="Aucun retard de paiement."
              items={(dashboard?.priorities.overdueInvoices ?? []).map((invoice) => ({
                key: invoice._id,
                title: invoice.number,
                detail: `${formatClientName(invoice.client)} - echeance ${formatDate(invoice.dueDate)}`,
                amount: formatCurrency(invoice.totalTtc),
                tone: "danger" as const,
              }))}
            />
            <PriorityGroup
              title="Devis a relancer"
              empty="Aucune relance commerciale urgente."
              items={(dashboard?.priorities.quotesToFollowUp ?? []).map((quote) => ({
                key: quote._id,
                title: quote.number,
                detail: `${quote.title} - ${formatClientName(quote.client)}`,
                amount: formatCurrency(quote.totalTtc),
                tone: "info" as const,
              }))}
            />
            <PriorityGroup
              title="Devis expires"
              empty="Aucun devis expire."
              items={(dashboard?.priorities.expiredQuotes ?? []).map((quote) => ({
                key: quote._id,
                title: quote.number,
                detail: `${quote.title} - validite ${formatDate(quote.validUntil)}`,
                amount: formatCurrency(quote.totalTtc),
                tone: "warning" as const,
              }))}
            />
          </div>
        </Panel>

        <Panel title="Pipeline" description="Etat commercial et encaissement.">
          <div className="pipeline-board">
            <PipelineStep label="Brouillons" value={dashboard?.pipeline.draft ?? 0} />
            <PipelineStep label="Envoyes" value={dashboard?.pipeline.sent ?? 0} />
            <PipelineStep label="Acceptes" value={dashboard?.pipeline.accepted ?? 0} />
            <PipelineStep label="Factures" value={dashboard?.pipeline.invoiced ?? 0} />
            <PipelineStep label="Impayees" value={dashboard?.pipeline.unpaidInvoices ?? 0} alert />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
        <Panel title="Derniers devis" description="Documents recents et statut commercial.">
          <DataTable
            rows={dashboard?.latestQuotes ?? []}
            rowKey={(quote) => quote._id}
            empty={<EmptyState title="Aucun devis" description="Cree ton premier devis depuis le module devis." />}
            columns={[
              { key: "number", header: "Numero", render: (quote) => <strong>{quote.number}</strong> },
              { key: "title", header: "Chantier", render: (quote) => quote.title },
              { key: "client", header: "Client", render: (quote) => formatClientName(quote.client) },
              { key: "date", header: "Date", render: (quote) => formatDate(quote.issueDate) },
              { key: "total", header: "Total TTC", render: (quote) => formatCurrency(quote.totalTtc) },
              {
                key: "status",
                header: "Statut",
                render: (quote) => <Badge tone={quoteStatusTones[quote.status as QuoteStatus]}>{quoteStatusLabels[quote.status as QuoteStatus]}</Badge>,
              },
            ]}
          />
        </Panel>

        <Panel title="Dernieres factures" description="Encaissement et echeances recentes.">
          <div className="stack-list">
            {(dashboard?.latestInvoices ?? []).map((invoice) => {
              const status = displayInvoiceStatus(invoice);
              return (
                <div className="list-item invoice-list-item" key={invoice._id}>
                  <div className="avatar avatar-square"><ReceiptText className="h-4 w-4" /></div>
                  <div className="min-w-0">
                    <strong>{invoice.number}</strong>
                    <span>{formatClientName(invoice.client)} - {formatCurrency(invoice.totalTtc)}</span>
                  </div>
                  <Badge tone={invoiceStatusTones[status]}>{invoiceStatusLabels[status]}</Badge>
                </div>
              );
            })}
            {dashboard && dashboard.latestInvoices.length === 0 ? <EmptyState title="Aucune facture" /> : null}
          </div>
        </Panel>
      </div>

      <Panel title="Clients recents" description="Contacts ajoutes dernierement.">
        <div className="recent-clients-grid">
          {(dashboard?.latestClients ?? []).map((client) => (
            <div className="list-item" key={client._id}>
              <div className="avatar">{(client.companyName ?? client.name).slice(0, 1).toUpperCase()}</div>
              <div className="min-w-0">
                <strong>{client.companyName ?? client.name}</strong>
                <span>{[client.firstName, client.name, client.city].filter(Boolean).join(" - ") || "Contact"}</span>
              </div>
            </div>
          ))}
          {dashboard && dashboard.latestClients.length === 0 ? <EmptyState title="Aucun client" /> : null}
        </div>
      </Panel>
    </div>
  );
}

function CommandRow({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  tone: "danger" | "warning" | "info" | "muted";
  onClick: () => void;
}) {
  return (
    <button className={`ops-command-row ops-command-${tone}`} onClick={onClick}>
      <span>{label}</span>
      <strong>{value}</strong>
      <ArrowRight className="h-4 w-4" />
    </button>
  );
}

function PriorityGroup({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: Array<{ key: string; title: string; detail: string; amount: string; tone: "danger" | "warning" | "info" }>;
}) {
  return (
    <section className="priority-group">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <div className="priority-empty">{empty}</div>
      ) : (
        items.map((item) => (
          <div className={`priority-card priority-${item.tone}`} key={item.key}>
            <div>
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </div>
            <b>{item.amount}</b>
          </div>
        ))
      )}
    </section>
  );
}

function PipelineStep({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className={alert && value > 0 ? "pipeline-step pipeline-step-alert" : "pipeline-step"}>
      <Clock3 className="h-4 w-4" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function displayInvoiceStatus(invoice: Doc<"invoices">): InvoiceStatus {
  if (invoice.status !== "paid" && invoice.status !== "void" && invoice.dueDate < Date.now()) {
    return "overdue";
  }
  return invoice.status as InvoiceStatus;
}

function formatClientName(client: Doc<"clients"> | null | undefined) {
  if (!client) {
    return "Client non defini";
  }
  return client.companyName ?? `${client.firstName ?? ""} ${client.name}`.trim();
}
