import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Edit3, Euro, FileText, Mail, MapPin, Phone, Plus, ReceiptText, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { api } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import {
  Button,
  DataTable,
  EmptyState,
  Field,
  FormSection,
  IconButton,
  Modal,
  Notice,
  PageHeader,
  Panel,
  SearchInput,
  SelectInput,
  TextArea,
  TextInput,
  Toolbar,
  Badge,
} from "@/components/ui/app";
import { formatCurrency, formatDate } from "@/lib/format";

type Client = Doc<"clients">;
type QuoteStatus = "draft" | "sent" | "accepted" | "refused" | "invoiced";
type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "void";

const quoteStatusLabels: Record<QuoteStatus, string> = {
  draft: "Brouillon",
  sent: "Envoye",
  accepted: "Accepte",
  refused: "Refuse",
  invoiced: "Facture",
};

const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyee",
  paid: "Payee",
  overdue: "En retard",
  void: "Annulee",
};

const emptyForm = {
  name: "",
  firstName: "",
  companyName: "",
  customerType: "individual" as "individual" | "business" | "public",
  siren: "",
  vatNumber: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  postalCode: "",
  country: "France",
  notes: "",
};

export function ClientsPage() {
  const navigate = useNavigate();
  const clients = useQuery(api.clients.list, {});
  const createDraft = useMutation(api.quotes.createDraft);
  const createClient = useMutation(api.clients.create);
  const updateClient = useMutation(api.clients.update);
  const archiveClient = useMutation(api.clients.archive);
  const [selectedClientId, setSelectedClientId] = useState<Id<"clients"> | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Client | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [quotePending, setQuotePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activity = useQuery(api.clients.activity, selectedClientId ? { clientId: selectedClientId } : "skip");

  const rows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) {
      return clients ?? [];
    }
    return (clients ?? []).filter((client) =>
      [client.name, client.firstName, client.companyName, client.email, client.phone, client.city, client.postalCode, client.siren, client.vatNumber]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized)),
    );
  }, [clients, search]);

  useEffect(() => {
    if (!selectedClientId && rows[0]) {
      setSelectedClientId(rows[0]._id);
    }
  }, [rows, selectedClientId]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(client: Client) {
    setEditing(client);
    setForm({
      name: client.name,
      firstName: client.firstName ?? "",
      companyName: client.companyName ?? "",
      customerType: client.customerType ?? (client.companyName ? "business" : "individual"),
      siren: client.siren ?? "",
      vatNumber: client.vatNumber ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      address: client.address ?? "",
      city: client.city ?? "",
      postalCode: client.postalCode ?? "",
      country: client.country ?? "France",
      notes: client.notes ?? "",
    });
    setError(null);
    setModalOpen(true);
  }

  async function saveClient() {
    setPending(true);
    setError(null);
    const payload = {
      name: form.name,
      firstName: optional(form.firstName),
      companyName: optional(form.companyName),
      customerType: form.customerType,
      siren: optional(form.siren),
      vatNumber: optional(form.vatNumber),
      email: optional(form.email),
      phone: optional(form.phone),
      address: optional(form.address),
      city: optional(form.city),
      postalCode: optional(form.postalCode),
      country: optional(form.country),
      notes: optional(form.notes),
    };

    try {
      if (editing) {
        await updateClient({ clientId: editing._id, ...payload });
      } else {
        await createClient(payload);
      }
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible");
    } finally {
      setPending(false);
    }
  }

  async function removeClient(clientId: Id<"clients">, name: string) {
    if (!window.confirm(`Archiver ${name} ?`)) {
      return;
    }
    await archiveClient({ clientId });
    if (selectedClientId === clientId) {
      setSelectedClientId(null);
    }
  }

  async function createQuoteForClient(client: Client) {
    setQuotePending(true);
    setError(null);
    try {
      await createDraft({
        clientId: client._id,
        title: `Nouveau chantier - ${formatClientName(client)}`,
        siteDescription: client.address ? `${client.address}${client.city ? `, ${client.city}` : ""}` : undefined,
      });
      void navigate({ to: "/devis" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Creation du devis impossible");
    } finally {
      setQuotePending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM"
        title="Clients"
        description="Une base client simple, rapide a filtrer, et reutilisable dans les devis."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouveau client
          </Button>
        }
      />

      <Panel>
        {error ? <Notice kind="error">{error}</Notice> : null}
        <Toolbar>
          <SearchInput value={search} placeholder="Rechercher nom, societe, ville, email..." onChange={(event) => setSearch(event.target.value)} />
          <span className="toolbar-count">{rows.length} client(s)</span>
        </Toolbar>
        <DataTable
          rows={rows}
          rowKey={(client) => client._id}
          selectedKey={selectedClientId}
          empty={<EmptyState title="Aucun client" description="Ajoute un client pour commencer a creer des devis." action={<Button onClick={openCreate}>Nouveau client</Button>} />}
          columns={[
            {
              key: "client",
              header: "Client",
              render: (client) => (
                <div className="identity-cell">
                  <div className="avatar">{(client.companyName ?? client.name).slice(0, 1).toUpperCase()}</div>
                  <div>
                    <button className="client-select-link" onClick={() => setSelectedClientId(client._id)}>
                      {client.companyName ?? `${client.firstName ?? ""} ${client.name}`.trim()}
                    </button>
                    <span>{client.companyName ? `${client.firstName ?? ""} ${client.name}`.trim() : "Particulier"}</span>
                  </div>
                </div>
              ),
            },
            { key: "email", header: "Email", render: (client) => <Contact icon={<Mail className="h-4 w-4" />} value={client.email} /> },
            { key: "phone", header: "Telephone", render: (client) => <Contact icon={<Phone className="h-4 w-4" />} value={client.phone} /> },
            { key: "city", header: "Ville", render: (client) => <Contact icon={<MapPin className="h-4 w-4" />} value={[client.postalCode, client.city].filter(Boolean).join(" ")} /> },
            {
              key: "actions",
              header: "",
              className: "actions-cell",
              render: (client) => (
                <div className="row-actions">
                  <IconButton label="Modifier" onClick={() => openEdit(client)}>
                    <Edit3 className="h-4 w-4" />
                  </IconButton>
                  <IconButton label="Nouveau devis" onClick={() => void createQuoteForClient(client)}>
                    <FileText className="h-4 w-4" />
                  </IconButton>
                  <IconButton label="Archiver" variant="danger" onClick={() => void removeClient(client._id, client.name)}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              ),
            },
          ]}
        />
      </Panel>

      <ClientActivityPanel
        activity={activity}
        quotePending={quotePending}
        onEdit={openEdit}
        onCreateQuote={createQuoteForClient}
      />

      <Modal
        open={modalOpen}
        title={editing ? "Modifier le client" : "Nouveau client"}
        description="Renseigne les informations utiles pour les devis."
        onClose={() => setModalOpen(false)}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button disabled={pending} onClick={() => void saveClient()}>
              {pending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          {error ? <Notice kind="error">{error}</Notice> : null}
          <FormSection title="Identite" description="Le nom est le seul champ indispensable. Les donnees entreprise servent surtout aux factures B2B.">
            <Field label="Nom" required>
              <TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </Field>
            <Field label="Prenom" optional>
              <TextInput value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
            </Field>
            <Field label="Societe" optional>
              <TextInput value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} />
            </Field>
            <Field label="Type client" optional>
              <SelectInput value={form.customerType} onChange={(event) => setForm({ ...form, customerType: event.target.value as typeof form.customerType })}>
                <option value="individual">Particulier</option>
                <option value="business">Entreprise</option>
                <option value="public">Administration</option>
              </SelectInput>
            </Field>
            <Field label="SIREN" optional>
              <TextInput value={form.siren} onChange={(event) => setForm({ ...form, siren: event.target.value })} />
            </Field>
            <Field label="TVA intracom." optional>
              <TextInput value={form.vatNumber} onChange={(event) => setForm({ ...form, vatNumber: event.target.value })} />
            </Field>
          </FormSection>

          <FormSection title="Contact" description="Utile pour les envois, relances et suivis chantier.">
            <Field label="Telephone" optional>
              <TextInput value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </Field>
            <Field label="Email" optional>
              <TextInput type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </Field>
          </FormSection>

          <FormSection title="Adresse et notes" description="Adresse de facturation par defaut du client.">
            <Field label="Adresse" optional>
              <TextInput value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
            </Field>
            <Field label="Code postal" optional>
              <TextInput value={form.postalCode} onChange={(event) => setForm({ ...form, postalCode: event.target.value })} />
            </Field>
            <Field label="Ville" optional>
              <TextInput value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
            </Field>
            <Field label="Pays" optional>
              <TextInput value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} />
            </Field>
            <Field label="Notes" optional>
              <TextArea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </Field>
          </FormSection>
        </div>
      </Modal>
    </div>
  );
}

function ClientActivityPanel({
  activity,
  quotePending,
  onEdit,
  onCreateQuote,
}: {
  activity:
    | {
        client: Client;
        quotes: Doc<"quotes">[];
        invoices: Doc<"invoices">[];
        totals: {
          quotesTtc: number;
          invoicesTtc: number;
          unpaidTtc: number;
          acceptedQuotes: number;
          unpaidInvoices: number;
        };
      }
    | null
    | undefined;
  quotePending: boolean;
  onEdit: (client: Client) => void;
  onCreateQuote: (client: Client) => void;
}) {
  if (activity === undefined) {
    return (
      <Panel>
        <EmptyState title="Chargement du client..." />
      </Panel>
    );
  }
  if (!activity) {
    return (
      <Panel>
        <EmptyState title="Selectionne un client" description="L'historique devis et factures apparaitra ici." />
      </Panel>
    );
  }

  return (
    <Panel className="client-detail-panel">
      <div className="client-detail-header">
        <div className="identity-cell">
          <div className="avatar avatar-square">{(activity.client.companyName ?? activity.client.name).slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{formatClientName(activity.client)}</strong>
            <span>{formatAddress(activity.client)}</span>
          </div>
        </div>
        <div className="page-actions">
          <Button variant="outline" onClick={() => onEdit(activity.client)}>
            <Edit3 className="h-4 w-4" />
            Modifier
          </Button>
          <Button disabled={quotePending} onClick={() => void onCreateQuote(activity.client)}>
            <Plus className="h-4 w-4" />
            {quotePending ? "Creation..." : "Nouveau devis"}
          </Button>
        </div>
      </div>

      <div className="client-kpis">
        <ClientKpi icon={<FileText className="h-4 w-4" />} label="Devis" value={formatCurrency(activity.totals.quotesTtc)} detail={`${activity.quotes.length} recent(s)`} />
        <ClientKpi icon={<ReceiptText className="h-4 w-4" />} label="Factures" value={formatCurrency(activity.totals.invoicesTtc)} detail={`${activity.invoices.length} recente(s)`} />
        <ClientKpi icon={<Euro className="h-4 w-4" />} label="A encaisser" value={formatCurrency(activity.totals.unpaidTtc)} detail={`${activity.totals.unpaidInvoices} facture(s)`} />
        <ClientKpi icon={<FileText className="h-4 w-4" />} label="Devis gagnes" value={activity.totals.acceptedQuotes} detail="acceptes ou factures" />
      </div>

      <div className="client-history-grid">
        <section>
          <h3>Devis recents</h3>
          <div className="client-history-list">
            {activity.quotes.length === 0 ? <div className="priority-empty">Aucun devis pour ce client.</div> : null}
            {activity.quotes.map((quote) => (
              <div className="client-history-row" key={quote._id}>
                <div>
                  <strong>{quote.number}</strong>
                  <span>{quote.title} - {formatDate(quote.issueDate)}</span>
                </div>
                <div>
                  <Badge tone={quoteTone(quote.status as QuoteStatus)}>{quoteStatusLabels[quote.status as QuoteStatus]}</Badge>
                  <b>{formatCurrency(quote.totalTtc)}</b>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h3>Factures recentes</h3>
          <div className="client-history-list">
            {activity.invoices.length === 0 ? <div className="priority-empty">Aucune facture pour ce client.</div> : null}
            {activity.invoices.map((invoice) => (
              <div className="client-history-row" key={invoice._id}>
                <div>
                  <strong>{invoice.number}</strong>
                  <span>Echeance {formatDate(invoice.dueDate)}</span>
                </div>
                <div>
                  <Badge tone={invoiceTone(invoice.status as InvoiceStatus)}>{invoiceStatusLabels[invoice.status as InvoiceStatus]}</Badge>
                  <b>{formatCurrency(invoice.totalTtc)}</b>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Panel>
  );
}

function ClientKpi({ icon, label, value, detail }: { icon: ReactNode; label: string; value: ReactNode; detail: string }) {
  return (
    <div>
      <span>{icon}{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function Contact({ icon, value }: { icon: ReactNode; value?: string }) {
  return (
    <span className="contact-cell">
      {icon}
      {value || "-"}
    </span>
  );
}

function formatClientName(client: Client | null | undefined) {
  if (!client) {
    return "Client non defini";
  }
  return client.companyName ?? `${client.firstName ?? ""} ${client.name}`.trim();
}

function formatAddress(client: Client) {
  return [client.address, [client.postalCode, client.city].filter(Boolean).join(" "), client.country].filter(Boolean).join(", ") || "Adresse non renseignee";
}

function quoteTone(status: QuoteStatus) {
  const tones: Record<QuoteStatus, "slate" | "indigo" | "emerald" | "rose" | "cyan"> = {
    draft: "slate",
    sent: "indigo",
    accepted: "emerald",
    refused: "rose",
    invoiced: "cyan",
  };
  return tones[status];
}

function invoiceTone(status: InvoiceStatus) {
  const tones: Record<InvoiceStatus, "slate" | "indigo" | "emerald" | "amber" | "rose"> = {
    draft: "slate",
    sent: "indigo",
    paid: "emerald",
    overdue: "amber",
    void: "rose",
  };
  return tones[status];
}

function optional(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
