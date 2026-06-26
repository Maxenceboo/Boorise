import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowRight, BarChart3, FileText, ReceiptText } from "lucide-react";
import { api } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import { Badge, Button, DataTable, EmptyState, PageHeader, Panel } from "@/components/ui/app";
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

const quoteStatusOrder: Record<QuoteStatus, number> = {
  draft: 1,
  sent: 2,
  accepted: 3,
  invoiced: 4,
  refused: 5,
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
  const current = useQuery(api.app.current);
  const dashboard = useQuery(api.app.dashboard);
  const companyName = current?.organization?.name ?? "Ton entreprise";
  const urgentCount = dashboard
    ? dashboard.alerts.overdueInvoices + dashboard.alerts.quotesToFollowUp + dashboard.alerts.expiredQuotes
    : 0;

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
            <Button variant="outline" onClick={() => void navigate({ to: "/stats" })}>
              <BarChart3 className="h-4 w-4" />
              Stats
            </Button>
            <Button onClick={() => void navigate({ to: "/devis" })}>
              <FileText className="h-4 w-4" />
              Voir les devis
            </Button>
          </div>
        }
      />

      <section className="ops-hero">
        <div>
          <div className="eyebrow border-white/20 bg-white/10 text-cyan-100">{companyName}</div>
          <h2>{urgentCount > 0 ? `${urgentCount} priorite(s) a traiter` : "Activite sous controle"}</h2>
          <p>
            Ton espace met devant toi ce qui demande une action: encaissement, relance, expiration de devis et catalogue.
          </p>
        </div>
        <div className="ops-command">
          <CommandRow label="Factures en retard" value={dashboard?.pipeline.overdueInvoices ?? 0} tone="danger" onClick={() => void navigate({ to: "/factures" })} />
          <CommandRow label="Factures a echeance" value={dashboard?.pipeline.dueSoonInvoices ?? 0} tone="warning" onClick={() => void navigate({ to: "/factures" })} />
          <CommandRow label="Devis a relancer" value={dashboard?.pipeline.quotesToFollowUp ?? 0} tone="info" onClick={() => void navigate({ to: "/devis" })} />
          <CommandRow label="Fiches catalogue a completer" value={dashboard?.alerts.lowCatalogDetail ?? 0} tone="muted" onClick={() => void navigate({ to: "/materiaux" })} />
        </div>
      </section>

      <Panel title="Priorites" description="Ce qui merite une action maintenant.">
        <div className="priority-board priority-board-wide">
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

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
        <Panel title="Derniers devis" description="Documents recents et statut commercial.">
          <DataTable
            density="compact"
            loading={dashboard === undefined}
            rows={dashboard?.latestQuotes ?? []}
            rowKey={(quote) => quote._id}
            empty={<EmptyState title="Aucun devis" description="Cree ton premier devis depuis le module devis." />}
            columns={[
              { key: "number", header: "Numero", sortValue: (quote) => quote.number, render: (quote) => <strong>{quote.number}</strong> },
              { key: "title", header: "Chantier", sortValue: (quote) => quote.title, render: (quote) => quote.title },
              { key: "client", header: "Client", sortValue: (quote) => formatClientName(quote.client), render: (quote) => formatClientName(quote.client) },
              { key: "date", header: "Date", sortValue: (quote) => quote.issueDate, render: (quote) => formatDate(quote.issueDate) },
              { key: "total", header: "Total TTC", sortValue: (quote) => quote.totalTtc, render: (quote) => formatCurrency(quote.totalTtc) },
              {
                key: "status",
                header: "Statut",
                sortValue: (quote) => quoteStatusOrder[quote.status as QuoteStatus],
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
