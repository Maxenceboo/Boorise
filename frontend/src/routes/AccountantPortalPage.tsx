import { useAuthActions } from "@convex-dev/auth/react";
import type { FunctionReturnType } from "convex/server";
import { useQuery } from "convex/react";
import { Building2, Download, FileCheck2, FileText, LogOut, ReceiptText, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import { Badge, Button, DataTable, EmptyState, PageHeader, Panel, StatCard } from "@/components/ui/app";
import { downloadInvoicePdf, downloadQuotePdf } from "@/lib/documentPdf";
import { formatCurrency, formatDate } from "@/lib/format";
import { useSeo } from "@/lib/seo";

type AccountantCompany = FunctionReturnType<typeof api.app.accountantWorkspace>[number];
type QuoteRow = AccountantCompany["quotes"][number];
type InvoiceRow = AccountantCompany["invoices"][number];

export function AccountantPortalPage() {
  const { signOut } = useAuthActions();
  const workspace = useQuery(api.app.accountantWorkspace);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  useSeo({
    title: "Espace comptable - Boorise",
    description: "Portail comptable en lecture seule pour consulter et telecharger les documents des entreprises autorisees.",
    canonicalPath: "/",
    noIndex: true,
  });

  const companies = useMemo(() => workspace ?? [], [workspace]);
  const selectedCompany = useMemo(() => {
    if (!companies.length) {
      return null;
    }
    return companies.find((company) => company.organization._id === selectedOrganizationId) ?? companies[0];
  }, [companies, selectedOrganizationId]);

  if (workspace === undefined) {
    return (
      <main className="accountant-portal">
        <div className="loading-screen">
          <span>Chargement de l'espace comptable...</span>
        </div>
      </main>
    );
  }

  if (!selectedCompany) {
    return (
      <main className="accountant-portal">
        <div className="accountant-shell">
          <PageHeader
            title="Espace comptable"
            description="Aucune entreprise ne t'a encore donne un acces comptable actif."
            actions={<Button variant="outline" onClick={() => void signOut()}><LogOut className="h-4 w-4" />Deconnexion</Button>}
          />
          <EmptyState title="Aucun acces actif" description="Demande a l'entreprise de t'envoyer une invitation comptable depuis Boorise." />
        </div>
      </main>
    );
  }

  return (
    <main className="accountant-portal">
      <div className="accountant-shell">
        <PageHeader
          title="Espace comptable"
          description="Consultation lecture seule des entreprises qui t'ont donne acces aux documents."
          actions={<Button variant="outline" onClick={() => void signOut()}><LogOut className="h-4 w-4" />Deconnexion</Button>}
        />

        <div className="accountant-company-grid">
          {companies.map((company) => (
            <button
              key={company.organization._id}
              className={company.organization._id === selectedCompany.organization._id ? "accountant-company is-active" : "accountant-company"}
              type="button"
              onClick={() => setSelectedOrganizationId(company.organization._id)}
            >
              <Building2 className="h-4 w-4" />
              <span>{company.organization.name}</span>
              <small>{company.counts.invoices} factures · {formatCurrency(company.totals.invoicesTtc)}</small>
            </button>
          ))}
        </div>

        <Panel
          title={selectedCompany.organization.name}
          description={companyLegalLine(selectedCompany.organization)}
          actions={<Button variant="outline" onClick={() => downloadCompanyCsv(selectedCompany)}><Download className="h-4 w-4" />Export CSV</Button>}
        >
          <div className="grid gap-3 md:grid-cols-4">
            <StatCard icon={<UsersRound className="h-4 w-4" />} label="Clients" value={selectedCompany.counts.clients} detail="Lecture seule" />
            <StatCard icon={<FileText className="h-4 w-4" />} label="Devis" value={selectedCompany.counts.quotes} detail={formatCurrency(selectedCompany.totals.quotesTtc)} tone="cyan" />
            <StatCard icon={<ReceiptText className="h-4 w-4" />} label="Factures" value={selectedCompany.counts.invoices} detail={formatCurrency(selectedCompany.totals.invoicesTtc)} tone="amber" />
            <StatCard icon={<FileCheck2 className="h-4 w-4" />} label="A encaisser" value={formatCurrency(selectedCompany.totals.unpaidTtc)} detail="Factures non payees" tone="rose" />
          </div>
        </Panel>

        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <Panel title="Factures" description="Telechargement PDF et suivi paiement, sans modification.">
            <DataTable
              rows={selectedCompany.invoices}
              rowKey={(row) => row.invoice._id}
              density="compact"
              empty={<EmptyState title="Aucune facture" />}
              columns={[
                {
                  key: "number",
                  header: "Facture",
                  sortValue: (row) => row.invoice.number,
                  render: (row) => (
                    <div className="min-w-0">
                      <strong className="block truncate text-[#491474]">{row.invoice.number}</strong>
                      <span className="block truncate text-xs text-[#7a5f6c]">{clientName(row.client)}</span>
                    </div>
                  ),
                },
                {
                  key: "status",
                  header: "Statut",
                  sortValue: (row) => invoiceStatusOrder(row.invoice.status),
                  render: (row) => <Badge tone={invoiceTone(row.invoice.status)}>{invoiceStatusLabel(row.invoice.status)}</Badge>,
                },
                {
                  key: "dueDate",
                  header: "Echeance",
                  sortValue: (row) => row.invoice.dueDate,
                  render: (row) => formatDate(row.invoice.dueDate),
                },
                {
                  key: "total",
                  header: "TTC",
                  sortValue: (row) => row.invoice.totalTtc,
                  render: (row) => formatCurrency(row.invoice.totalTtc),
                },
                {
                  key: "actions",
                  header: "PDF",
                  sortable: false,
                  render: (row) => (
                    <Button size="sm" type="button" variant="outline" onClick={() => void downloadInvoicePdf(row, selectedCompany.organization)}>
                      <Download className="h-4 w-4" />
                      PDF
                    </Button>
                  ),
                },
              ]}
            />
          </Panel>

          <Panel title="Devis" description="Devis consultables avec marge reelle indicative.">
            <DataTable
              rows={selectedCompany.quotes}
              rowKey={(row) => row.quote._id}
              density="compact"
              empty={<EmptyState title="Aucun devis" />}
              columns={[
                {
                  key: "number",
                  header: "Devis",
                  sortValue: (row) => row.quote.number,
                  render: (row) => (
                    <div className="min-w-0">
                      <strong className="block truncate text-[#491474]">{row.quote.number}</strong>
                      <span className="block truncate text-xs text-[#7a5f6c]">{row.quote.title}</span>
                    </div>
                  ),
                },
                {
                  key: "status",
                  header: "Statut",
                  sortValue: (row) => quoteStatusOrder(row.quote.status),
                  render: (row) => <Badge tone={quoteTone(row.quote.status)}>{quoteStatusLabel(row.quote.status)}</Badge>,
                },
                {
                  key: "margin",
                  header: "Marge",
                  sortValue: (row) => row.business.marginHt,
                  render: (row) => formatCurrency(row.business.marginHt),
                },
                {
                  key: "total",
                  header: "TTC",
                  sortValue: (row) => row.quote.totalTtc,
                  render: (row) => formatCurrency(row.quote.totalTtc),
                },
                {
                  key: "actions",
                  header: "PDF",
                  sortable: false,
                  render: (row) => (
                    <Button size="sm" type="button" variant="outline" onClick={() => void downloadQuotePdf(row, selectedCompany.organization)}>
                      <Download className="h-4 w-4" />
                      PDF
                    </Button>
                  ),
                },
              ]}
            />
          </Panel>
        </div>

        <Panel title="Clients" description="Liste utile pour controle, relance et rapprochement comptable.">
          <DataTable
            rows={selectedCompany.clients}
            rowKey={(client) => client._id}
            density="compact"
            empty={<EmptyState title="Aucun client" />}
            columns={[
              {
                key: "name",
                header: "Client",
                sortValue: (client) => clientName(client),
                render: (client) => (
                  <div className="min-w-0">
                    <strong className="block truncate text-[#491474]">{clientName(client)}</strong>
                    <span className="block truncate text-xs text-[#7a5f6c]">{client.email ?? "Email absent"}</span>
                  </div>
                ),
              },
              {
                key: "type",
                header: "Type",
                sortValue: (client) => client.customerType ?? "individual",
                render: (client) => <Badge tone={client.customerType === "business" ? "indigo" : "slate"}>{client.customerType === "business" ? "Pro" : client.customerType === "public" ? "Public" : "Particulier"}</Badge>,
              },
              {
                key: "city",
                header: "Ville",
                sortValue: (client) => client.city ?? "",
                render: (client) => [client.postalCode, client.city].filter(Boolean).join(" ") || "-",
              },
              {
                key: "siret",
                header: "SIRET",
                sortValue: (client) => client.siret ?? "",
                render: (client) => client.siret ?? "-",
              },
            ]}
          />
        </Panel>
      </div>
    </main>
  );
}

function companyLegalLine(organization: Doc<"organizations">) {
  return [
    organization.legalName,
    organization.siret ? `SIRET ${organization.siret}` : null,
    organization.vatNumber ? `TVA ${organization.vatNumber}` : null,
    [organization.postalCode, organization.city].filter(Boolean).join(" "),
  ].filter(Boolean).join(" · ") || "Informations legales a completer par l'entreprise.";
}

function clientName(client: Doc<"clients"> | null) {
  if (!client) {
    return "Client non defini";
  }
  return client.companyName || [client.firstName, client.name].filter(Boolean).join(" ") || client.name;
}

function downloadCompanyCsv(company: AccountantCompany) {
  const rows = [
    ["type", "numero", "date", "client", "statut", "total_ht", "total_ttc", "reste_a_encaisser"],
    ...company.quotes.map((row) => [
      "devis",
      row.quote.number,
      formatDate(row.quote.issueDate),
      clientName(row.client),
      quoteStatusLabel(row.quote.status),
      row.quote.totalHt,
      row.quote.totalTtc,
      "",
    ]),
    ...company.invoices.map((row) => [
      "facture",
      row.invoice.number,
      formatDate(row.invoice.issueDate),
      clientName(row.client),
      invoiceStatusLabel(row.invoice.status),
      row.invoice.totalHt,
      row.invoice.totalTtc,
      row.remainingTtc,
    ]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(";")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `export-comptable-${safeFileName(company.organization.name)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function csvCell(value: string | number) {
  const raw = String(value).replaceAll('"', '""');
  return `"${raw}"`;
}

function safeFileName(value: string) {
  return value.replace(/[^a-z0-9-]+/gi, "_").toLowerCase();
}

function quoteStatusLabel(status: QuoteRow["quote"]["status"]) {
  return { draft: "Brouillon", sent: "Envoye", accepted: "Accepte", refused: "Refuse", invoiced: "Facture", void: "Annule" }[status];
}

function invoiceStatusLabel(status: InvoiceRow["invoice"]["status"]) {
  return { draft: "Brouillon", sent: "Envoyee", partially_paid: "Partielle", paid: "Payee", overdue: "En retard", void: "Annulee" }[status];
}

function quoteStatusOrder(status: QuoteRow["quote"]["status"]) {
  return { draft: 1, sent: 2, accepted: 3, invoiced: 4, refused: 5, void: 6 }[status];
}

function invoiceStatusOrder(status: InvoiceRow["invoice"]["status"]) {
  return { draft: 1, sent: 2, partially_paid: 3, overdue: 4, paid: 5, void: 6 }[status];
}

function quoteTone(status: QuoteRow["quote"]["status"]): "slate" | "indigo" | "emerald" | "rose" | "cyan" {
  return status === "accepted" ? "emerald" : status === "sent" ? "indigo" : status === "invoiced" ? "cyan" : status === "refused" || status === "void" ? "rose" : "slate";
}

function invoiceTone(status: InvoiceRow["invoice"]["status"]): "slate" | "indigo" | "emerald" | "amber" | "rose" {
  return status === "paid" ? "emerald" : status === "sent" ? "indigo" : status === "partially_paid" || status === "overdue" ? "amber" : status === "void" ? "rose" : "slate";
}
