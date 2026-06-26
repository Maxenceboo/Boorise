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
import { useToast } from "@/components/ui/toast-context";
import { useBlurAutosave } from "@/hooks/useBlurAutosave";
import { friendlyError } from "@/lib/errors";
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
  siret: "",
  hasVatNumber: false,
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
  const toast = useToast();
  const clients = useQuery(api.clients.list, {});
  const createClient = useMutation(api.clients.create);
  const updateClient = useMutation(api.clients.update);
  const archiveClient = useMutation(api.clients.archive);
  const [selectedClientId, setSelectedClientId] = useState<Id<"clients"> | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Client | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activity = useQuery(api.clients.activity, selectedClientId ? { clientId: selectedClientId } : "skip");
  const isProfessionalClient = form.customerType === "business" || form.customerType === "public";
  const isBusinessClient = form.customerType === "business";
  const autoSaveClientOnBlur = useBlurAutosave<HTMLDivElement>(() => {
    if (editing) {
      void saveClient(false);
    }
  }, { enabled: modalOpen && !!editing });

  const rows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) {
      return clients ?? [];
    }
    return (clients ?? []).filter((client) =>
      [client.name, client.firstName, client.companyName, client.email, client.phone, client.city, client.postalCode, client.siren, client.siret, client.vatNumber]
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
      siret: client.siret ?? "",
      hasVatNumber: !!client.vatNumber,
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

  function setCustomerType(customerType: typeof form.customerType) {
    setForm((current) => ({
      ...current,
      customerType,
      companyName: customerType === "individual" ? "" : current.companyName,
      siren: customerType === "individual" ? "" : current.siren,
      siret: customerType === "individual" ? "" : current.siret,
      hasVatNumber: customerType === "business" ? current.hasVatNumber : false,
      vatNumber: customerType === "business" && current.hasVatNumber ? current.vatNumber : "",
    }));
  }

  function setSiret(value: string) {
    const siren = deriveSirenFromSiret(value);
    setForm((current) => ({ ...current, siret: value, siren: siren ?? current.siren }));
  }

  function setHasVatNumber(value: boolean) {
    setForm((current) => ({ ...current, hasVatNumber: value, vatNumber: value ? current.vatNumber : "" }));
  }

  async function saveClient(closeOnSave = true) {
    if (!form.name.trim() || !form.address.trim() || !form.postalCode.trim() || !form.city.trim() || !form.country.trim()) {
      setError("Renseigne le nom et l'adresse complete du client pour creer des documents exploitables legalement.");
      return false;
    }
    if ((form.customerType === "business" || form.customerType === "public") && !form.companyName.trim()) {
      setError("Renseigne la societe ou l'organisme pour ce client professionnel.");
      return false;
    }
    if ((form.customerType === "business" || form.customerType === "public") && !form.siret.trim()) {
      setError("Renseigne le SIRET du client professionnel. Le SIREN sera calcule automatiquement.");
      return false;
    }
    if (form.customerType === "business" && form.hasVatNumber && !form.vatNumber.trim()) {
      setError("Renseigne le numero de TVA intracommunautaire ou indique que le client n'en a pas.");
      return false;
    }

    setPending(true);
    setError(null);
    const computedSiren = deriveSirenFromSiret(form.siret) ?? form.siren;
    const payload = {
      name: form.name,
      firstName: optional(form.firstName),
      companyName: optional(form.companyName),
      customerType: form.customerType,
      siren: optional(computedSiren),
      siret: optional(form.siret),
      vatNumber: form.customerType === "business" && form.hasVatNumber ? optional(form.vatNumber) : undefined,
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
      if (closeOnSave) {
        setModalOpen(false);
      }
      return true;
    } catch (err) {
      const message = friendlyError(err, "Enregistrement impossible.");
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setPending(false);
    }
  }

  async function closeClientModal() {
    if (!editing) {
      setModalOpen(false);
      return;
    }
    if (await saveClient(false)) {
      setModalOpen(false);
    }
  }

  async function removeClient(clientId: Id<"clients">, name: string) {
    if (!window.confirm(`Archiver ${name} ?`)) {
      return;
    }
    try {
      await archiveClient({ clientId });
      if (selectedClientId === clientId) {
        setSelectedClientId(null);
      }
    } catch (err) {
      const message = friendlyError(err, "Archivage impossible.");
      setError(message);
      toast.error(message);
    }
  }

  function createQuoteForClient(client: Client) {
    const address = client.address ? `${client.address}${client.city ? `, ${client.city}` : ""}` : "";
    sessionStorage.setItem("boorise:quoteDraftSeed", JSON.stringify({
      clientId: client._id,
      title: `Nouveau chantier - ${formatClientName(client)}`,
      siteDescription: address,
      deliveryAddress: address,
    }));
    void navigate({ to: "/devis" });
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
          density="compact"
          loading={clients === undefined}
          rows={rows}
          rowKey={(client) => client._id}
          selectedKey={selectedClientId}
          empty={<EmptyState title="Aucun client" description="Ajoute un client pour commencer a creer des devis." action={<Button onClick={openCreate}>Nouveau client</Button>} />}
          columns={[
            {
              key: "client",
              header: "Client",
              sortValue: (client) => client.companyName ?? `${client.firstName ?? ""} ${client.name}`.trim(),
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
            { key: "email", header: "Email", sortValue: (client) => client.email, render: (client) => <Contact icon={<Mail className="h-4 w-4" />} value={client.email} /> },
            { key: "phone", header: "Telephone", sortValue: (client) => client.phone, render: (client) => <Contact icon={<Phone className="h-4 w-4" />} value={client.phone} /> },
            { key: "city", header: "Ville", sortValue: (client) => `${client.city ?? ""} ${client.postalCode ?? ""}`, render: (client) => <Contact icon={<MapPin className="h-4 w-4" />} value={[client.postalCode, client.city].filter(Boolean).join(" ")} /> },
            {
              key: "actions",
              header: "",
              className: "actions-cell",
              sortable: false,
              render: (client) => (
                <div className="row-actions">
                  <IconButton label="Modifier" onClick={() => openEdit(client)}>
                    <Edit3 className="h-4 w-4" />
                  </IconButton>
                  <IconButton label="Faire un devis" onClick={() => void createQuoteForClient(client)}>
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
        onEdit={openEdit}
        onCreateQuote={createQuoteForClient}
      />

      <Modal
        open={modalOpen}
        title={editing ? "Modifier le client" : "Nouveau client"}
        description="Renseigne les informations utiles pour les devis."
        onClose={() => void closeClientModal()}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => void closeClientModal()}>
              {editing ? "Fermer" : "Annuler"}
            </Button>
            {!editing ? <Button disabled={pending} onClick={() => void saveClient()}>{pending ? "Creation..." : "Creer"}</Button> : null}
          </>
        }
      >
        <div className="form-grid" onBlurCapture={autoSaveClientOnBlur}>
          {error ? <Notice kind="error">{error}</Notice> : null}
          <Notice kind="warning">Le formulaire s'adapte au type client. Un particulier n'a pas de SIREN, SIRET ni TVA intracom.</Notice>
          <FormSection title="Identite" description="Identite de facturation du client. Les champs legaux alimentent les devis et factures.">
            <Field label="Type client" required>
              <SelectInput value={form.customerType} onChange={(event) => setCustomerType(event.target.value as typeof form.customerType)}>
                <option value="individual">Particulier</option>
                <option value="business">Entreprise</option>
                <option value="public">Administration</option>
              </SelectInput>
            </Field>
            {isProfessionalClient ? (
              <Field label={isBusinessClient ? "Societe" : "Organisme"} legalRequired>
                <TextInput required value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} />
              </Field>
            ) : null}
            <Field label={isProfessionalClient ? "Contact - nom" : "Nom"} legalRequired>
              <TextInput required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </Field>
            <Field label="Prenom" optional>
              <TextInput value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
            </Field>
            {isProfessionalClient ? (
              <>
                <Field label="SIRET" legalRequired hint="Le SIREN est calcule automatiquement avec les 9 premiers chiffres.">
                  <TextInput required value={form.siret} onChange={(event) => setSiret(event.target.value)} />
                </Field>
                <Field label="SIREN calcule" optional>
                  <TextInput readOnly value={deriveSirenFromSiret(form.siret) ?? form.siren} />
                </Field>
              </>
            ) : null}
            {isBusinessClient ? (
              <>
                <Field label="TVA intracommunautaire" required>
                  <SelectInput value={form.hasVatNumber ? "yes" : "no"} onChange={(event) => setHasVatNumber(event.target.value === "yes")}>
                    <option value="no">Non / non applicable</option>
                    <option value="yes">Oui</option>
                  </SelectInput>
                </Field>
                {form.hasVatNumber ? (
                  <Field label="Numero TVA intracom." legalRequired>
                    <TextInput required value={form.vatNumber} onChange={(event) => setForm({ ...form, vatNumber: event.target.value })} />
                  </Field>
                ) : null}
              </>
            ) : null}
          </FormSection>

          <FormSection title="Contact" description="Utile pour les envois, relances et suivis chantier.">
            <Field label="Telephone" optional>
              <TextInput value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </Field>
            <Field label="Email" optional>
              <TextInput type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </Field>
          </FormSection>

          <FormSection title="Adresse et notes" description="Adresse de facturation par defaut du client, reprise dans les documents.">
            <Field label="Adresse" legalRequired>
              <TextInput required value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
            </Field>
            <Field label="Code postal" legalRequired>
              <TextInput required value={form.postalCode} onChange={(event) => setForm({ ...form, postalCode: event.target.value })} />
            </Field>
            <Field label="Ville" legalRequired>
              <TextInput required value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
            </Field>
            <Field label="Pays" legalRequired>
              <TextInput required value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} />
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
          <Button onClick={() => void onCreateQuote(activity.client)}>
            <Plus className="h-4 w-4" />
            Faire un devis
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

function deriveSirenFromSiret(siret: string | undefined) {
  const digits = siret?.replace(/\D/g, "");
  return digits && digits.length >= 9 ? digits.slice(0, 9) : undefined;
}

function optional(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
