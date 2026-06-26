import { useMutation, useQuery } from "convex/react";
import { Check, Coins, Copy, Edit3, FileText, Plus, Printer, ReceiptText, Send, Trash2, UserPlus, X } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { api } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  Field,
  FormSection,
  IconButton,
  Modal,
  Notice,
  NumberInput,
  PageHeader,
  Panel,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/ui/app";
import { useToast } from "@/components/ui/toast-context";
import { useBlurAutosave } from "@/hooks/useBlurAutosave";
import { friendlyError } from "@/lib/errors";
import { formatCurrency, formatDate } from "@/lib/format";

type QuoteStatus = "draft" | "sent" | "accepted" | "refused" | "invoiced";
type LineKind = "material" | "service" | "custom";
type Material = Doc<"materials">;
type Service = Doc<"services">;
type MaterialUnit = "piece" | "metre" | "m2" | "m3" | "litre" | "kilogramme" | "lot";
type QuoteBundle = {
  quote: Doc<"quotes">;
  client: Doc<"clients"> | null;
  items: Doc<"quoteItems">[];
};

const statusLabels: Record<QuoteStatus, string> = {
  draft: "Brouillon",
  sent: "Envoye",
  accepted: "Accepte",
  refused: "Refuse",
  invoiced: "Facture",
};

const statusTones: Record<QuoteStatus, "slate" | "indigo" | "emerald" | "rose" | "cyan"> = {
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

const emptyQuote = {
  clientId: "",
  title: "Nouveau chantier",
  siteDescription: "",
  deliveryAddress: "",
  operationType: "mixed" as "goods" | "services" | "mixed",
  taxDebitOption: false,
  vatRate: 20,
  validUntil: "",
  paymentTermsText: "",
  latePenaltyText: "",
  legalNotice: "",
  notes: "",
};

const emptyLine = {
  kind: "material" as LineKind,
  materialId: "",
  serviceId: "",
  section: "Fournitures",
  description: "",
  unit: "",
  quantity: 1,
  unitPriceHt: "",
  wasteRate: "",
  marginRate: 0,
};

const emptyQuickClient = {
  name: "",
  firstName: "",
  companyName: "",
  customerType: "individual" as "individual" | "business" | "public",
  siren: "",
  siret: "",
  hasVatNumber: false,
  vatNumber: "",
  phone: "",
  email: "",
  address: "",
  postalCode: "",
  city: "",
  country: "France",
};

const emptyQuickMaterial = {
  name: "",
  unit: "piece" as MaterialUnit,
  purchasePriceHt: 0,
  defaultWasteRate: 0,
  divisible: true,
  quantityPerLot: "",
};

const materialUnits: MaterialUnit[] = ["piece", "metre", "m2", "m3", "litre", "kilogramme", "lot"];

export function QuotesPage() {
  const toast = useToast();
  const current = useQuery(api.app.current);
  const clients = useQuery(api.clients.list, {});
  const materials = useQuery(api.materials.list, {});
  const services = useQuery(api.services.list, {});
  const quotes = useQuery(api.quotes.list);
  const createClient = useMutation(api.clients.create);
  const createMaterial = useMutation(api.materials.create);
  const createDraft = useMutation(api.quotes.createDraft);
  const updateQuoteDetails = useMutation(api.quotes.updateDetails);
  const addItem = useMutation(api.quotes.addItem);
  const updateItem = useMutation(api.quotes.updateItem);
  const removeItem = useMutation(api.quotes.removeItem);
  const changeStatus = useMutation(api.quotes.changeStatus);
  const convertToInvoice = useMutation(api.quotes.convertToInvoice);
  const duplicateQuote = useMutation(api.quotes.duplicate);
  const [quoteForm, setQuoteForm] = useState(emptyQuote);
  const [editQuoteForm, setEditQuoteForm] = useState(emptyQuote);
  const [lineForm, setLineForm] = useState(emptyLine);
  const [editLineForm, setEditLineForm] = useState(emptyLine);
  const [quickClientForm, setQuickClientForm] = useState(emptyQuickClient);
  const [quickMaterialForm, setQuickMaterialForm] = useState(emptyQuickMaterial);
  const [selectedQuoteId, setSelectedQuoteId] = useState<Id<"quotes"> | null>(null);
  const [quoteModal, setQuoteModal] = useState(false);
  const [editQuoteModal, setEditQuoteModal] = useState(false);
  const [editLineModal, setEditLineModal] = useState(false);
  const [previewModal, setPreviewModal] = useState(false);
  const [editingLineId, setEditingLineId] = useState<Id<"quoteItems"> | null>(null);
  const [quickClientModal, setQuickClientModal] = useState(false);
  const [quickMaterialModal, setQuickMaterialModal] = useState(false);
  const [scrollToSelectedQuote, setScrollToSelectedQuote] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedQuote = useQuery(api.quotes.get, selectedQuoteId ? { quoteId: selectedQuoteId } : "skip");
  const organization = current?.organization ?? null;
  const isQuickProfessionalClient = quickClientForm.customerType === "business" || quickClientForm.customerType === "public";
  const isQuickBusinessClient = quickClientForm.customerType === "business";
  const selectedMaterial = (materials ?? []).find((material) => material._id === lineForm.materialId) ?? null;
  const selectedService = (services ?? []).find((service) => service._id === lineForm.serviceId) ?? null;
  const autoSaveQuoteDetailsOnBlur = useBlurAutosave<HTMLDivElement>(() => {
    if (selectedQuote) {
      void saveQuoteDetails(false);
    }
  }, { enabled: editQuoteModal && !!selectedQuote });
  const preview = useMemo(() => calculatePreview(lineForm, selectedMaterial, selectedService), [lineForm, selectedMaterial, selectedService]);
  const quoteStats = useMemo(() => {
    const list = quotes ?? [];
    return {
      count: list.length,
      totalHt: list.reduce((sum, quote) => sum + quote.totalHt, 0),
      totalTtc: list.reduce((sum, quote) => sum + quote.totalTtc, 0),
      drafts: list.filter((quote) => quote.status === "draft").length,
    };
  }, [quotes]);

  useEffect(() => {
    const rawDraftSeed = sessionStorage.getItem("boorise:quoteDraftSeed");
    if (!rawDraftSeed) {
      return;
    }

    sessionStorage.removeItem("boorise:quoteDraftSeed");
    try {
      const seed = JSON.parse(rawDraftSeed) as Partial<typeof emptyQuote>;
      setQuoteForm({
        ...emptyQuote,
        clientId: typeof seed.clientId === "string" ? seed.clientId : "",
        title: typeof seed.title === "string" && seed.title.trim() ? seed.title : emptyQuote.title,
        siteDescription: typeof seed.siteDescription === "string" ? seed.siteDescription : "",
        deliveryAddress: typeof seed.deliveryAddress === "string" ? seed.deliveryAddress : "",
      });
      setQuoteModal(true);
    } catch {
      setQuoteForm(emptyQuote);
    }
  }, []);

  useEffect(() => {
    if (selectedQuoteId || !quotes?.length) {
      return;
    }

    setSelectedQuoteId(quotes[0]._id);
  }, [quotes, selectedQuoteId]);

  useEffect(() => {
    if (!scrollToSelectedQuote || !selectedQuoteId || selectedQuote?.quote._id !== selectedQuoteId) {
      return;
    }
    window.history.replaceState(null, "", "#devis-detail");
    requestAnimationFrame(() => {
      document.getElementById("devis-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
      setScrollToSelectedQuote(false);
    });
  }, [scrollToSelectedQuote, selectedQuote, selectedQuoteId]);

  function selectQuote(quoteId: Id<"quotes">) {
    setSelectedQuoteId(quoteId);
    setScrollToSelectedQuote(true);
  }

  async function createQuote() {
    if (!quoteForm.clientId) {
      setError("Selectionne un client avant de creer un devis exploitable legalement.");
      return;
    }
    setPending("quote");
    setError(null);
    try {
      const quoteId = await createDraft({
        clientId: quoteForm.clientId ? (quoteForm.clientId as Id<"clients">) : undefined,
        title: quoteForm.title,
        siteDescription: optional(quoteForm.siteDescription),
        deliveryAddress: optional(quoteForm.deliveryAddress),
        operationType: quoteForm.operationType,
        taxDebitOption: quoteForm.taxDebitOption,
        vatRate: quoteForm.vatRate,
        validUntil: dateInputToTimestamp(quoteForm.validUntil),
        paymentTermsText: optional(quoteForm.paymentTermsText),
        latePenaltyText: optional(quoteForm.latePenaltyText),
        legalNotice: optional(quoteForm.legalNotice),
        notes: optional(quoteForm.notes),
      });
      setSelectedQuoteId(quoteId);
      setQuoteForm(emptyQuote);
      setQuoteModal(false);
    } catch (err) {
      const message = friendlyError(err, "Creation impossible.");
      setError(message);
      toast.error(message);
    } finally {
      setPending(null);
    }
  }

  function openEditQuote() {
    if (!selectedQuote) {
      return;
    }
    setEditQuoteForm({
      clientId: selectedQuote.quote.clientId ?? "",
      title: selectedQuote.quote.title,
      siteDescription: selectedQuote.quote.siteDescription ?? "",
      deliveryAddress: selectedQuote.quote.deliveryAddress ?? "",
      operationType: selectedQuote.quote.operationType ?? organization?.defaultOperationType ?? "mixed",
      taxDebitOption: selectedQuote.quote.taxDebitOption ?? organization?.taxDebitOption ?? false,
      vatRate: selectedQuote.quote.vatRate,
      validUntil: timestampToDateInput(selectedQuote.quote.validUntil),
      paymentTermsText: selectedQuote.quote.paymentTermsText ?? "",
      latePenaltyText: selectedQuote.quote.latePenaltyText ?? "",
      legalNotice: selectedQuote.quote.legalNotice ?? "",
      notes: selectedQuote.quote.notes ?? "",
    });
    setEditQuoteModal(true);
  }

  async function saveQuoteDetails(closeOnSave = true) {
    if (!selectedQuote) {
      return false;
    }
    if (!editQuoteForm.clientId) {
      setError("Selectionne un client avant d'enregistrer ce devis.");
      return false;
    }
    setPending("quote-details");
    setError(null);
    try {
      await updateQuoteDetails({
        quoteId: selectedQuote.quote._id,
        clientId: editQuoteForm.clientId ? (editQuoteForm.clientId as Id<"clients">) : undefined,
        title: editQuoteForm.title,
        siteDescription: optional(editQuoteForm.siteDescription),
        deliveryAddress: optional(editQuoteForm.deliveryAddress),
        operationType: editQuoteForm.operationType,
        taxDebitOption: editQuoteForm.taxDebitOption,
        vatRate: editQuoteForm.vatRate,
        issueDate: selectedQuote.quote.issueDate,
        validUntil: dateInputToTimestamp(editQuoteForm.validUntil),
        paymentTermsText: optional(editQuoteForm.paymentTermsText),
        latePenaltyText: optional(editQuoteForm.latePenaltyText),
        legalNotice: optional(editQuoteForm.legalNotice),
        notes: optional(editQuoteForm.notes),
      });
      if (closeOnSave) {
        setEditQuoteModal(false);
      }
      return true;
    } catch (err) {
      const message = friendlyError(err, "Modification impossible.");
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setPending(null);
    }
  }

  async function closeEditQuoteModal() {
    if (await saveQuoteDetails(false)) {
      setEditQuoteModal(false);
    }
  }

  async function addLine() {
    if (!selectedQuoteId) {
      setError("Selectionne d'abord un devis.");
      return;
    }
    setPending("line");
    setError(null);
    try {
      await addItem({
        quoteId: selectedQuoteId,
        kind: lineForm.kind,
        materialId: lineForm.kind === "material" && lineForm.materialId ? (lineForm.materialId as Id<"materials">) : undefined,
        serviceId: lineForm.kind === "service" && lineForm.serviceId ? (lineForm.serviceId as Id<"services">) : undefined,
        section: optional(lineForm.section),
        description: optional(lineForm.description),
        unit: optional(lineForm.unit),
        quantity: lineForm.quantity,
        unitPriceHt: optionalNumber(lineForm.unitPriceHt),
        wasteRate: optionalNumber(lineForm.wasteRate),
        marginRate: lineForm.marginRate,
      });
      setLineForm(emptyLine);
    } catch (err) {
      const message = friendlyError(err, "Ajout impossible.");
      setError(message);
      toast.error(message);
    } finally {
      setPending(null);
    }
  }

  function openEditLine(item: Doc<"quoteItems">) {
    setEditingLineId(item._id);
    setEditLineForm({
      kind: item.kind,
      materialId: item.materialId ?? "",
      serviceId: item.serviceId ?? "",
      section: item.section ?? "Fournitures",
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      unitPriceHt: String(item.unitPriceHt),
      wasteRate: String(item.wasteRate),
      marginRate: item.marginRate,
    });
    setEditLineModal(true);
  }

  async function saveEditedLine(closeOnSave = true) {
    if (!editingLineId) {
      return false;
    }
    setPending("edit-line");
    setError(null);
    try {
      await updateItem({
        itemId: editingLineId,
        kind: editLineForm.kind,
        materialId: editLineForm.kind === "material" && editLineForm.materialId ? (editLineForm.materialId as Id<"materials">) : undefined,
        serviceId: editLineForm.kind === "service" && editLineForm.serviceId ? (editLineForm.serviceId as Id<"services">) : undefined,
        section: optional(editLineForm.section),
        description: optional(editLineForm.description),
        unit: optional(editLineForm.unit),
        quantity: editLineForm.quantity,
        unitPriceHt: optionalNumber(editLineForm.unitPriceHt),
        wasteRate: optionalNumber(editLineForm.wasteRate),
        marginRate: editLineForm.marginRate,
      });
      if (closeOnSave) {
        setEditLineModal(false);
        setEditingLineId(null);
        setEditLineForm(emptyLine);
      }
      return true;
    } catch (err) {
      const message = friendlyError(err, "Modification de ligne impossible.");
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setPending(null);
    }
  }

  async function closeEditLineModal() {
    if (await saveEditedLine(false)) {
      setEditLineModal(false);
      setEditingLineId(null);
      setEditLineForm(emptyLine);
    }
  }

  async function setStatus(quoteId: Id<"quotes">, status: "sent" | "accepted" | "refused") {
    setPending(`${quoteId}-${status}`);
    setError(null);
    try {
      await changeStatus({ quoteId, status });
    } catch (err) {
      const message = friendlyError(err, "Statut impossible.");
      setError(message);
      toast.error(message);
    } finally {
      setPending(null);
    }
  }

  async function invoiceQuote(quoteId: Id<"quotes">) {
    setPending(`invoice-${quoteId}`);
    setError(null);
    try {
      await convertToInvoice({ quoteId });
    } catch (err) {
      const message = friendlyError(err, "Conversion impossible.");
      setError(message);
      toast.error(message);
    } finally {
      setPending(null);
    }
  }

  async function copyQuote(quoteId: Id<"quotes">) {
    setPending(`copy-${quoteId}`);
    setError(null);
    try {
      const newQuoteId = await duplicateQuote({ quoteId });
      selectQuote(newQuoteId);
    } catch (err) {
      const message = friendlyError(err, "Duplication impossible.");
      setError(message);
      toast.error(message);
    } finally {
      setPending(null);
    }
  }

  function setQuickClientType(customerType: typeof quickClientForm.customerType) {
    setQuickClientForm((current) => ({
      ...current,
      customerType,
      companyName: customerType === "individual" ? "" : current.companyName,
      siren: customerType === "individual" ? "" : current.siren,
      siret: customerType === "individual" ? "" : current.siret,
      hasVatNumber: customerType === "business" ? current.hasVatNumber : false,
      vatNumber: customerType === "business" && current.hasVatNumber ? current.vatNumber : "",
    }));
  }

  function setQuickClientSiret(value: string) {
    const siren = deriveSiren(value);
    setQuickClientForm((current) => ({ ...current, siret: value, siren: siren ?? current.siren }));
  }

  function setQuickClientHasVatNumber(value: boolean) {
    setQuickClientForm((current) => ({ ...current, hasVatNumber: value, vatNumber: value ? current.vatNumber : "" }));
  }

  async function saveQuickClient() {
    if (!quickClientForm.name.trim() || !quickClientForm.address.trim() || !quickClientForm.postalCode.trim() || !quickClientForm.city.trim() || !quickClientForm.country.trim()) {
      setError("Renseigne le nom et l'adresse complete du client avant de l'utiliser dans un devis.");
      return;
    }
    if ((quickClientForm.customerType === "business" || quickClientForm.customerType === "public") && !quickClientForm.companyName.trim()) {
      setError("Renseigne la societe ou l'organisme pour ce client professionnel.");
      return;
    }
    if ((quickClientForm.customerType === "business" || quickClientForm.customerType === "public") && !quickClientForm.siret.trim()) {
      setError("Renseigne le SIRET du client professionnel. Le SIREN sera calcule automatiquement.");
      return;
    }
    if (quickClientForm.customerType === "business" && quickClientForm.hasVatNumber && !quickClientForm.vatNumber.trim()) {
      setError("Renseigne le numero de TVA intracommunautaire ou indique que le client n'en a pas.");
      return;
    }

    setPending("quick-client");
    setError(null);
    const computedSiren = deriveSiren(quickClientForm.siret) ?? quickClientForm.siren;
    try {
      const clientId = await createClient({
        name: quickClientForm.name,
        firstName: optional(quickClientForm.firstName),
        companyName: optional(quickClientForm.companyName),
        customerType: quickClientForm.customerType,
        siren: optional(computedSiren),
        siret: optional(quickClientForm.siret),
        vatNumber: quickClientForm.customerType === "business" && quickClientForm.hasVatNumber ? optional(quickClientForm.vatNumber) : undefined,
        phone: optional(quickClientForm.phone),
        email: optional(quickClientForm.email),
        address: optional(quickClientForm.address),
        postalCode: optional(quickClientForm.postalCode),
        city: optional(quickClientForm.city),
        country: optional(quickClientForm.country),
      });
      setQuoteForm((current) => ({ ...current, clientId }));
      setQuickClientForm(emptyQuickClient);
      setQuickClientModal(false);
    } catch (err) {
      const message = friendlyError(err, "Creation client impossible.");
      setError(message);
      toast.error(message);
    } finally {
      setPending(null);
    }
  }

  async function saveQuickMaterial() {
    if (!quickMaterialForm.name.trim()) {
      setError("Renseigne le nom du materiau avant de l'ajouter au catalogue.");
      return;
    }
    if (!quickMaterialForm.divisible && !optionalNumber(quickMaterialForm.quantityPerLot)) {
      setError("Renseigne la quantite contenue par achat pour un materiau vendu par lot.");
      return;
    }

    setPending("quick-material");
    setError(null);
    try {
      const materialId = await createMaterial({
        name: quickMaterialForm.name,
        unit: quickMaterialForm.unit,
        purchasePriceHt: quickMaterialForm.purchasePriceHt,
        defaultWasteRate: quickMaterialForm.defaultWasteRate,
        divisible: quickMaterialForm.divisible,
        quantityPerLot: quickMaterialForm.divisible ? undefined : optionalNumber(quickMaterialForm.quantityPerLot),
      });
      setLineForm((current) => ({ ...current, kind: "material", materialId }));
      setQuickMaterialForm(emptyQuickMaterial);
      setQuickMaterialModal(false);
    } catch (err) {
      const message = friendlyError(err, "Creation materiau impossible.");
      setError(message);
      toast.error(message);
    } finally {
      setPending(null);
    }
  }

  async function deleteLine(itemId: Id<"quoteItems">) {
    if (window.confirm("Supprimer cette ligne ?")) {
      await removeItem({ itemId });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Chiffrage"
        title="Devis"
        description="Un atelier de chiffrage clair : choisir un devis, ajouter les lignes, controler les pertes et valider les totaux."
      />
      {error ? <Notice kind="error">{error}</Notice> : null}

      <div className="quote-overview">
        <div>
          <FileText className="h-5 w-5" />
          <span>Devis</span>
          <strong>{quoteStats.count}</strong>
        </div>
        <div>
          <Coins className="h-5 w-5" />
          <span>Total HT</span>
          <strong>{formatCurrency(quoteStats.totalHt)}</strong>
        </div>
        <div>
          <Coins className="h-5 w-5" />
          <span>Total TTC</span>
          <strong>{formatCurrency(quoteStats.totalTtc)}</strong>
        </div>
        <div>
          <FileText className="h-5 w-5" />
          <span>Brouillons</span>
          <strong>{quoteStats.drafts}</strong>
        </div>
      </div>

      <div className="space-y-4">
        <Panel
          title="Dossiers devis"
          description="Tableau de suivi des devis. La selection se fait sur le numero ou le titre souligne."
          actions={
            <Button onClick={() => setQuoteModal(true)}>
              <Plus className="h-4 w-4" />
              Nouveau devis
            </Button>
          }
        >
          <DataTable
            density="compact"
            loading={quotes === undefined}
            rows={quotes ?? []}
            rowKey={(quote) => quote._id}
            selectedKey={selectedQuoteId}
            empty={<EmptyState title="Aucun devis" description="Utilise l'action principale en haut de page pour creer ton premier devis." />}
            columns={[
              {
                key: "number",
                header: "Devis",
                sortValue: (quote) => quote.number,
                render: (quote) => (
                  <a className="quote-table-select" href="#devis-detail" onClick={(event) => {
                    event.preventDefault();
                    selectQuote(quote._id);
                  }}>
                    <span>{quote.number}</span>
                    <strong>{quote.title}</strong>
                  </a>
                ),
              },
              { key: "client", header: "Client", sortValue: (quote) => formatClientName(quote.client), render: (quote) => formatClientName(quote.client) },
              { key: "date", header: "Date", sortValue: (quote) => quote.issueDate, render: (quote) => formatDate(quote.issueDate) },
              { key: "totalHt", header: "HT", sortValue: (quote) => quote.totalHt, render: (quote) => formatCurrency(quote.totalHt) },
              { key: "totalTtc", header: "TTC", sortValue: (quote) => quote.totalTtc, render: (quote) => <strong>{formatCurrency(quote.totalTtc)}</strong> },
              { key: "status", header: "Statut", sortValue: (quote) => quoteStatusOrder[quote.status as QuoteStatus], render: (quote) => <Badge tone={statusTones[quote.status as QuoteStatus]}>{statusLabels[quote.status as QuoteStatus]}</Badge> },
              {
                key: "actions",
                header: "",
                className: "actions-cell",
                sortable: false,
                render: (quote) => (
                  <div className="row-actions">
                    <IconButton label="Dupliquer" onClick={() => void copyQuote(quote._id)}><Copy className="h-4 w-4" /></IconButton>
                    <IconButton label="Envoye" onClick={() => void setStatus(quote._id, "sent")}><Send className="h-4 w-4" /></IconButton>
                    <IconButton label="Accepte" variant="success" onClick={() => void setStatus(quote._id, "accepted")}><Check className="h-4 w-4" /></IconButton>
                    <IconButton label="Refuse" variant="danger" onClick={() => void setStatus(quote._id, "refused")}><X className="h-4 w-4" /></IconButton>
                  </div>
                ),
              },
            ]}
          />
        </Panel>

        <div>
          <Panel className="quote-stage">
          {!selectedQuoteId ? (
            <EmptyState title="Selectionne un devis" description="Le detail et l'editeur de lignes apparaitront ici." />
          ) : selectedQuote === undefined ? (
            <EmptyState title="Chargement..." />
          ) : !selectedQuote ? (
            <EmptyState title="Devis introuvable" />
          ) : (
            <div className="space-y-5">
              <div id="devis-detail" className="quote-summary">
                <div>
                  <span>{selectedQuote.quote.number}</span>
                  <h2>{selectedQuote.quote.title}</h2>
                  <p>{formatClientName(selectedQuote.client)} - {formatDate(selectedQuote.quote.issueDate)}</p>
                </div>
                <div className="quote-total-block">
                  <Badge tone={statusTones[selectedQuote.quote.status as QuoteStatus]}>{statusLabels[selectedQuote.quote.status as QuoteStatus]}</Badge>
                  <strong>{formatCurrency(selectedQuote.quote.totalTtc)}</strong>
                  <span>{formatCurrency(selectedQuote.quote.totalHt)} HT</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={openEditQuote}><Edit3 className="h-4 w-4" />Modifier</Button>
                  <Button variant="outline" onClick={() => setPreviewModal(true)}><Printer className="h-4 w-4" />Apercu</Button>
                  <Button variant="outline" disabled={pending === `copy-${selectedQuote.quote._id}`} onClick={() => void copyQuote(selectedQuote.quote._id)}><Copy className="h-4 w-4" />Dupliquer</Button>
                  <Button disabled={selectedQuote.quote.status === "invoiced"} onClick={() => void invoiceQuote(selectedQuote.quote._id)}><ReceiptText className="h-4 w-4" />Facturer</Button>
                </div>
              </div>

              <div className="quote-workspace">
                <div className="line-editor">
                  <div className="line-editor-head">
                    <div>
                      <span>Ligne de devis</span>
                      <strong>Ajouter au chiffrage</strong>
                    </div>
                    <div className="line-type-toggle" aria-label="Type de ligne">
                      {(["material", "service", "custom"] as LineKind[]).map((kind) => (
                        <button key={kind} className={lineForm.kind === kind ? "active" : ""} onClick={() => setLineForm({ ...emptyLine, kind })}>
                          {kind === "material" ? "Materiau" : kind === "service" ? "Prestation" : "Libre"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="line-editor-grid">
                    {lineForm.kind === "material" ? (
                    <Field label="Materiau" required>
                        <div className="quote-client-picker">
                          <SelectInput value={lineForm.materialId} onChange={(event) => setLineForm({ ...lineForm, materialId: event.target.value })}>
                            <option value="">Choisir un materiau</option>
                            {(materials ?? []).map((material) => <option key={material._id} value={material._id}>{material.name}</option>)}
                          </SelectInput>
                          <Button type="button" variant="outline" onClick={() => setQuickMaterialModal(true)}>
                            <Plus className="h-4 w-4" />
                            Materiau
                          </Button>
                        </div>
                      </Field>
                    ) : null}
                    {lineForm.kind === "service" ? (
                    <Field label="Prestation" required>
                        <SelectInput value={lineForm.serviceId} onChange={(event) => setLineForm({ ...lineForm, serviceId: event.target.value })}>
                          <option value="">Choisir une prestation</option>
                          {(services ?? []).map((service) => <option key={service._id} value={service._id}>{service.name}</option>)}
                        </SelectInput>
                      </Field>
                    ) : null}
                    <Field label="Designation" optional>
                      <TextInput value={lineForm.description} placeholder={selectedMaterial?.name ?? selectedService?.name ?? "Ex: pose, fourniture, ajustement..."} onChange={(event) => setLineForm({ ...lineForm, description: event.target.value })} />
                    </Field>
                    <Field label="Lot de travaux" optional>
                      <TextInput value={lineForm.section} placeholder="Ex: Fournitures, Pose, Finitions..." onChange={(event) => setLineForm({ ...lineForm, section: event.target.value })} />
                    </Field>
                    {lineForm.kind === "custom" ? <Field label="Unite" required><TextInput value={lineForm.unit} onChange={(event) => setLineForm({ ...lineForm, unit: event.target.value })} /></Field> : null}
                    <Field label="Besoin chantier" required><NumberInput min={0.0001} step="0.01" value={lineForm.quantity} onChange={(event) => setLineForm({ ...lineForm, quantity: Number(event.target.value) })} /></Field>
                    <Field label="Prix HT force" optional><NumberInput min={0} step="0.01" value={lineForm.unitPriceHt} placeholder={selectedMaterial ? String(selectedMaterial.purchasePriceHt) : selectedService ? String(selectedService.unitPriceHt) : "0"} onChange={(event) => setLineForm({ ...lineForm, unitPriceHt: event.target.value })} /></Field>
                    <Field label="Perte chantier (%)" optional><NumberInput min={0} max={100} step="0.01" value={lineForm.wasteRate} placeholder={selectedMaterial ? String(selectedMaterial.defaultWasteRate) : "0"} onChange={(event) => setLineForm({ ...lineForm, wasteRate: event.target.value })} /></Field>
                    <Field label="Marge (%)" optional><NumberInput min={0} max={100} step="0.01" value={lineForm.marginRate} onChange={(event) => setLineForm({ ...lineForm, marginRate: Number(event.target.value) })} /></Field>
                  </div>

                  {lineForm.kind === "material" && selectedMaterial ? (
                    <div className="line-context">
                      <strong>{selectedMaterial.name}</strong>
                      <span>
                        Besoin en {formatUnit(materialDemandUnit(selectedMaterial))} - {selectedMaterial.divisible ? "achat au besoin exact" : `achat par lot de ${formatQuantity(selectedMaterial.quantityPerLot ?? 1, materialDemandUnit(selectedMaterial))}`} - perte defaut {selectedMaterial.defaultWasteRate}%
                      </span>
                    </div>
                  ) : null}
                  {lineForm.kind === "service" && selectedService ? (
                    <div className="line-context">
                      <strong>{selectedService.name}</strong>
                      <span>{formatCurrency(selectedService.unitPriceHt)} HT / {selectedService.unit}</span>
                    </div>
                  ) : null}

                  <Button disabled={pending === "line"} onClick={() => void addLine()}><Plus className="h-4 w-4" />Ajouter la ligne</Button>
                </div>
                <div className="calc-card">
                  <strong>Calcul instantane</strong>
                  <Calc label="Besoin saisi" value={formatPreviewNeed(lineForm, selectedMaterial)} />
                  <Calc label="Avec pertes" value={formatPreviewWithWaste(lineForm, preview, selectedMaterial)} />
                  <Calc label="A acheter" value={formatPreviewPurchased(lineForm, preview, selectedMaterial)} />
                  <Calc label="Livre" value={formatPreviewDelivered(lineForm, preview, selectedMaterial)} />
                  <Calc label="Perte generee" value={formatPreviewWaste(lineForm, preview, selectedMaterial)} />
                  <Calc label="Cout reel" value={formatCurrency(preview.realCostHt)} />
                  <Calc label="Total HT" value={formatCurrency(preview.totalHt)} />
                  {lineForm.kind === "material" && selectedMaterial ? <PreviewSketch form={lineForm} material={selectedMaterial} preview={preview} /> : null}
                </div>
              </div>

              <QuoteLinesTable items={selectedQuote.items} materials={materials ?? []} onEdit={openEditLine} onDelete={deleteLine} />
              <PurchaseList items={selectedQuote.items} materials={materials ?? []} />
            </div>
          )}
          </Panel>
        </div>
      </div>

      <Modal
        open={quoteModal}
        title="Nouveau devis"
        description="Cree un brouillon, puis ajoute les lignes et controle les calculs dans l'atelier de chiffrage."
        onClose={() => setQuoteModal(false)}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setQuoteModal(false)}>
              Annuler
            </Button>
            <Button disabled={pending === "quote"} onClick={() => void createQuote()}>
              <Plus className="h-4 w-4" />
              {pending === "quote" ? "Creation..." : "Creer le devis"}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          {error ? <Notice kind="error">{error}</Notice> : null}
          <Notice kind="warning">Le client, l'objet et la TVA structurent le devis. Les mentions vides reprennent le profil entreprise quand un defaut existe.</Notice>
          <FormSection title="Base du devis" description="Le client, la date, la validite et le detail des prix structurent le document client.">
            <Field label="Client" legalRequired>
              <div className="quote-client-picker">
                <SelectInput required value={quoteForm.clientId} onChange={(event) => setQuoteForm({ ...quoteForm, clientId: event.target.value })}>
                  <option value="">Client non defini</option>
                  {(clients ?? []).map((client) => (
                    <option key={client._id} value={client._id}>{formatClientName(client)}</option>
                  ))}
                </SelectInput>
                <Button type="button" variant="outline" onClick={() => setQuickClientModal(true)}>
                  <UserPlus className="h-4 w-4" />
                  Client
                </Button>
              </div>
            </Field>
            <Field label="Titre / objet" required><TextInput required value={quoteForm.title} onChange={(event) => setQuoteForm({ ...quoteForm, title: event.target.value })} /></Field>
            <Field label="TVA (%)" required><NumberInput required min={0} max={100} step="0.01" value={quoteForm.vatRate} onChange={(event) => setQuoteForm({ ...quoteForm, vatRate: Number(event.target.value) })} /></Field>
            <Field label="Valable jusqu'au" optional hint="Si vide, la validite par defaut du profil entreprise est appliquee."><TextInput type="date" value={quoteForm.validUntil} onChange={(event) => setQuoteForm({ ...quoteForm, validUntil: event.target.value })} /></Field>
          </FormSection>

          <FormSection title="Chantier" description="Ces informations identifient le lieu et la nature des travaux sur le document client.">
            <Field label="Description chantier" optional><TextArea value={quoteForm.siteDescription} onChange={(event) => setQuoteForm({ ...quoteForm, siteDescription: event.target.value })} /></Field>
            <Field label="Adresse chantier / livraison" optional><TextArea value={quoteForm.deliveryAddress} onChange={(event) => setQuoteForm({ ...quoteForm, deliveryAddress: event.target.value })} /></Field>
          </FormSection>

          <FormSection title="Mentions avancees" description="Ces mentions sont reprises depuis le profil entreprise si elles restent vides ici.">
            <Field label="Nature operation" legalRequired>
              <SelectInput value={quoteForm.operationType} onChange={(event) => setQuoteForm({ ...quoteForm, operationType: event.target.value as typeof quoteForm.operationType })}>
                <option value="mixed">Biens et services</option>
                <option value="services">Services</option>
                <option value="goods">Livraison de biens</option>
              </SelectInput>
            </Field>
            <Field label="TVA sur les debits" required>
              <SelectInput value={quoteForm.taxDebitOption ? "true" : "false"} onChange={(event) => setQuoteForm({ ...quoteForm, taxDebitOption: event.target.value === "true" })}>
                <option value="false">Non</option>
                <option value="true">Oui</option>
              </SelectInput>
            </Field>
            <Field label="Conditions de reglement" optional hint="Si vide, les conditions du profil entreprise sont appliquees."><TextArea value={quoteForm.paymentTermsText} onChange={(event) => setQuoteForm({ ...quoteForm, paymentTermsText: event.target.value })} /></Field>
            <Field label="Mentions" optional hint="Assurance, reserves, validite ou mentions propres a ce devis."><TextArea value={quoteForm.legalNotice} onChange={(event) => setQuoteForm({ ...quoteForm, legalNotice: event.target.value })} /></Field>
          </FormSection>
        </div>
      </Modal>

      <Modal
        open={editQuoteModal}
        title="Modifier le devis"
        description="Corrige les informations principales sans toucher aux lignes deja chiffrees."
        onClose={() => void closeEditQuoteModal()}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => void closeEditQuoteModal()}>
              Fermer
            </Button>
          </>
        }
      >
        <div className="form-grid" onBlurCapture={autoSaveQuoteDetailsOnBlur}>
          {error ? <Notice kind="error">{error}</Notice> : null}
          <Notice kind="warning">Le client, l'objet et la TVA structurent le devis. Les mentions vides reprennent le profil entreprise quand un defaut existe.</Notice>
          <FormSection title="Base du devis" description="Le client, l'objet, la validite et la TVA structurent le document.">
            <Field label="Client" legalRequired>
              <SelectInput required value={editQuoteForm.clientId} onChange={(event) => setEditQuoteForm({ ...editQuoteForm, clientId: event.target.value })}>
                <option value="">Client non defini</option>
                {(clients ?? []).map((client) => (
                  <option key={client._id} value={client._id}>{formatClientName(client)}</option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Titre / objet" required><TextInput required value={editQuoteForm.title} onChange={(event) => setEditQuoteForm({ ...editQuoteForm, title: event.target.value })} /></Field>
            <Field label="TVA (%)" required><NumberInput required min={0} max={100} step="0.01" value={editQuoteForm.vatRate} onChange={(event) => setEditQuoteForm({ ...editQuoteForm, vatRate: Number(event.target.value) })} /></Field>
            <Field label="Valable jusqu'au" optional><TextInput type="date" value={editQuoteForm.validUntil} onChange={(event) => setEditQuoteForm({ ...editQuoteForm, validUntil: event.target.value })} /></Field>
          </FormSection>

          <FormSection title="Chantier" description="Visible sur le document client.">
            <Field label="Description chantier" optional><TextArea value={editQuoteForm.siteDescription} onChange={(event) => setEditQuoteForm({ ...editQuoteForm, siteDescription: event.target.value })} /></Field>
            <Field label="Adresse chantier / livraison" optional><TextArea value={editQuoteForm.deliveryAddress} onChange={(event) => setEditQuoteForm({ ...editQuoteForm, deliveryAddress: event.target.value })} /></Field>
          </FormSection>

          <FormSection title="Mentions avancees" description="Surcharge les valeurs du profil entreprise uniquement si ce devis est particulier.">
            <Field label="Nature operation" legalRequired>
              <SelectInput value={editQuoteForm.operationType} onChange={(event) => setEditQuoteForm({ ...editQuoteForm, operationType: event.target.value as typeof editQuoteForm.operationType })}>
                <option value="mixed">Biens et services</option>
                <option value="services">Services</option>
                <option value="goods">Livraison de biens</option>
              </SelectInput>
            </Field>
            <Field label="TVA sur les debits" required>
              <SelectInput value={editQuoteForm.taxDebitOption ? "true" : "false"} onChange={(event) => setEditQuoteForm({ ...editQuoteForm, taxDebitOption: event.target.value === "true" })}>
                <option value="false">Non</option>
                <option value="true">Oui</option>
              </SelectInput>
            </Field>
            <Field label="Conditions de reglement" optional hint="Si vide, les conditions du profil entreprise sont appliquees."><TextArea value={editQuoteForm.paymentTermsText} onChange={(event) => setEditQuoteForm({ ...editQuoteForm, paymentTermsText: event.target.value })} /></Field>
            <Field label="Penalites / retard" optional hint="Si vide, les penalites du profil entreprise sont appliquees."><TextArea value={editQuoteForm.latePenaltyText} onChange={(event) => setEditQuoteForm({ ...editQuoteForm, latePenaltyText: event.target.value })} /></Field>
            <Field label="Mentions" optional><TextArea value={editQuoteForm.legalNotice} onChange={(event) => setEditQuoteForm({ ...editQuoteForm, legalNotice: event.target.value })} /></Field>
            <Field label="Notes internes" optional><TextArea value={editQuoteForm.notes} onChange={(event) => setEditQuoteForm({ ...editQuoteForm, notes: event.target.value })} /></Field>
          </FormSection>
        </div>
      </Modal>

      <Modal
        open={quickClientModal}
        title="Client rapide"
        description="Ajoute les informations utiles au devis. La fiche client pourra etre completee plus tard."
        onClose={() => setQuickClientModal(false)}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setQuickClientModal(false)}>
              Annuler
            </Button>
            <Button disabled={pending === "quick-client"} onClick={() => void saveQuickClient()}>
              <UserPlus className="h-4 w-4" />
              {pending === "quick-client" ? "Creation..." : "Creer le client"}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          {error ? <Notice kind="error">{error}</Notice> : null}
          <Notice kind="warning">Le formulaire s'adapte au type client. Pour un professionnel, saisis le SIRET: le SIREN est calcule automatiquement.</Notice>
          <Field label="Type client" required>
            <SelectInput value={quickClientForm.customerType} onChange={(event) => setQuickClientType(event.target.value as typeof quickClientForm.customerType)}>
              <option value="individual">Particulier</option>
              <option value="business">Entreprise</option>
              <option value="public">Administration</option>
            </SelectInput>
          </Field>
          {isQuickProfessionalClient ? (
            <Field label={isQuickBusinessClient ? "Societe" : "Organisme"} legalRequired>
              <TextInput required value={quickClientForm.companyName} onChange={(event) => setQuickClientForm({ ...quickClientForm, companyName: event.target.value })} />
            </Field>
          ) : null}
          <Field label={isQuickProfessionalClient ? "Contact - nom" : "Nom"} legalRequired><TextInput required value={quickClientForm.name} onChange={(event) => setQuickClientForm({ ...quickClientForm, name: event.target.value })} /></Field>
          <Field label="Prenom" optional><TextInput value={quickClientForm.firstName} onChange={(event) => setQuickClientForm({ ...quickClientForm, firstName: event.target.value })} /></Field>
          {isQuickProfessionalClient ? (
            <>
              <Field label="SIRET" legalRequired hint="Le SIREN est calcule automatiquement avec les 9 premiers chiffres."><TextInput required value={quickClientForm.siret} onChange={(event) => setQuickClientSiret(event.target.value)} /></Field>
              <Field label="SIREN calcule" optional><TextInput readOnly value={deriveSiren(quickClientForm.siret) ?? quickClientForm.siren} /></Field>
            </>
          ) : null}
          {isQuickBusinessClient ? (
            <>
              <Field label="TVA intracommunautaire" required>
                <SelectInput value={quickClientForm.hasVatNumber ? "yes" : "no"} onChange={(event) => setQuickClientHasVatNumber(event.target.value === "yes")}>
                  <option value="no">Non / non applicable</option>
                  <option value="yes">Oui</option>
                </SelectInput>
              </Field>
              {quickClientForm.hasVatNumber ? (
                <Field label="Numero TVA intracom." legalRequired><TextInput required value={quickClientForm.vatNumber} onChange={(event) => setQuickClientForm({ ...quickClientForm, vatNumber: event.target.value })} /></Field>
              ) : null}
            </>
          ) : null}
          <Field label="Telephone" optional><TextInput value={quickClientForm.phone} onChange={(event) => setQuickClientForm({ ...quickClientForm, phone: event.target.value })} /></Field>
          <Field label="Email" optional><TextInput value={quickClientForm.email} onChange={(event) => setQuickClientForm({ ...quickClientForm, email: event.target.value })} /></Field>
          <Field label="Adresse" legalRequired><TextInput required value={quickClientForm.address} onChange={(event) => setQuickClientForm({ ...quickClientForm, address: event.target.value })} /></Field>
          <Field label="Code postal" legalRequired><TextInput required value={quickClientForm.postalCode} onChange={(event) => setQuickClientForm({ ...quickClientForm, postalCode: event.target.value })} /></Field>
          <Field label="Ville" legalRequired><TextInput required value={quickClientForm.city} onChange={(event) => setQuickClientForm({ ...quickClientForm, city: event.target.value })} /></Field>
          <Field label="Pays" legalRequired><TextInput required value={quickClientForm.country} onChange={(event) => setQuickClientForm({ ...quickClientForm, country: event.target.value })} /></Field>
        </div>
      </Modal>

      <LineEditModal
        open={editLineModal}
        form={editLineForm}
        materials={materials ?? []}
        services={services ?? []}
        pending={pending === "edit-line"}
        onClose={closeEditLineModal}
        onChange={setEditLineForm}
        onAutoSave={() => void saveEditedLine(false)}
      />

      <Modal
        open={previewModal && !!selectedQuote}
        title="Apercu du devis"
        description={selectedQuote ? `${selectedQuote.quote.number} - document client` : undefined}
        onClose={() => setPreviewModal(false)}
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setPreviewModal(false)}>Fermer</Button>
            {selectedQuote ? (
              <Button onClick={() => printQuoteDocument(selectedQuote.quote.number)}>
                <Printer className="h-4 w-4" />
                Imprimer / PDF
              </Button>
            ) : null}
          </>
        }
      >
        {selectedQuote ? <QuoteDocument quoteBundle={selectedQuote} organization={organization} /> : null}
      </Modal>

      <Modal
        open={quickMaterialModal}
        title="Materiau rapide"
        description="Ajoute le materiau minimum pour chiffrer maintenant. Tu pourras completer sa fiche depuis le catalogue."
        onClose={() => setQuickMaterialModal(false)}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setQuickMaterialModal(false)}>
              Annuler
            </Button>
            <Button disabled={pending === "quick-material"} onClick={() => void saveQuickMaterial()}>
              <Plus className="h-4 w-4" />
              {pending === "quick-material" ? "Creation..." : "Creer le materiau"}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Nom" required><TextInput value={quickMaterialForm.name} onChange={(event) => setQuickMaterialForm({ ...quickMaterialForm, name: event.target.value })} /></Field>
          <Field label="Unite du besoin" required>
            <SelectInput value={quickMaterialForm.unit} onChange={(event) => setQuickMaterialForm({ ...quickMaterialForm, unit: event.target.value as MaterialUnit })}>
              {materialUnits.map((unit) => <option key={unit} value={unit}>{formatUnit(unit)}</option>)}
            </SelectInput>
          </Field>
          <Field label="Prix achat HT" required><NumberInput min={0} step="0.01" value={quickMaterialForm.purchasePriceHt} onChange={(event) => setQuickMaterialForm({ ...quickMaterialForm, purchasePriceHt: Number(event.target.value) })} /></Field>
          <Field label="Perte defaut (%)" optional><NumberInput min={0} max={100} step="0.01" value={quickMaterialForm.defaultWasteRate} onChange={(event) => setQuickMaterialForm({ ...quickMaterialForm, defaultWasteRate: Number(event.target.value) })} /></Field>
          <div className="purchase-mode md:col-span-2">
            <button type="button" className={quickMaterialForm.divisible ? "active" : ""} onClick={() => setQuickMaterialForm({ ...quickMaterialForm, divisible: true, quantityPerLot: "" })}>
              <strong>Achat exact</strong>
              <span>Pas d'arrondi, la quantite achetee suit le besoin.</span>
            </button>
            <button type="button" className={!quickMaterialForm.divisible ? "active" : ""} onClick={() => setQuickMaterialForm({ ...quickMaterialForm, divisible: false, quantityPerLot: quickMaterialForm.quantityPerLot || "1" })}>
              <strong>Achat par lot</strong>
              <span>Arrondi au lot entier dans le devis.</span>
            </button>
          </div>
          {!quickMaterialForm.divisible ? (
            <Field label="Quantite contenue par achat" required hint="Ex: lot de 2 poutres => 2. Boite de 200 vis => 200.">
              <NumberInput min={0.0001} step="0.01" value={quickMaterialForm.quantityPerLot} onChange={(event) => setQuickMaterialForm({ ...quickMaterialForm, quantityPerLot: event.target.value })} />
            </Field>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}

function calculatePreview(form: typeof emptyLine, material: Material | null, service: Service | null) {
  const quantity = Math.max(0, form.quantity || 0);
  const marginRate = clampPercent(form.marginRate || 0);
  const unitPriceHt = Math.max(0, optionalNumber(form.unitPriceHt) ?? (form.kind === "material" ? material?.purchasePriceHt : form.kind === "service" ? service?.unitPriceHt : 0) ?? 0);
  const wasteRate = clampPercent(optionalNumber(form.wasteRate) ?? (form.kind === "material" ? material?.defaultWasteRate ?? 0 : 0));
  const quantityWithWaste = round4(quantity * (1 + wasteRate / 100));

  if (form.kind === "material" && material && !material.divisible) {
    const quantityPerLot = material.quantityPerLot && material.quantityPerLot > 0 ? material.quantityPerLot : 1;
    const lots = Math.ceil(quantityWithWaste / quantityPerLot);
    const deliveredPhysicalQuantity = round4(lots * quantityPerLot);
    const realCostHt = round2(lots * unitPriceHt);
    return {
      quantityWithWaste,
      purchasedQuantity: lots,
      deliveredPhysicalQuantity,
      waste: round4(Math.max(0, deliveredPhysicalQuantity - quantity)),
      realCostHt,
      totalHt: round2(realCostHt * (1 + marginRate / 100)),
    };
  }

  const realCostHt = round2(quantityWithWaste * unitPriceHt);
  return {
    quantityWithWaste,
    purchasedQuantity: quantityWithWaste,
    deliveredPhysicalQuantity: quantityWithWaste,
    waste: round4(Math.max(0, quantityWithWaste - quantity)),
    realCostHt,
    totalHt: round2(realCostHt * (1 + marginRate / 100)),
  };
}

function Calc({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{typeof value === "number" ? value.toLocaleString("fr-FR") : value}</strong>
    </div>
  );
}

function PreviewSketch({
  form,
  material,
  preview,
}: {
  form: typeof emptyLine;
  material: Material;
  preview: ReturnType<typeof calculatePreview>;
}) {
  const quantityPerLot = material.quantityPerLot && material.quantityPerLot > 0 ? material.quantityPerLot : undefined;
  const wasteRate = optionalNumber(form.wasteRate) ?? material.defaultWasteRate;
  if (!quantityPerLot && wasteRate <= 0) {
    return null;
  }

  const unit = materialDemandUnit(material);
  const steps = [
    wasteRate > 0
      ? `${formatQuantity(form.quantity, unit)} + ${wasteRate}% = ${formatQuantity(preview.quantityWithWaste, unit)}`
      : `Besoin ${formatQuantity(form.quantity, unit)}`,
  ];

  if (quantityPerLot) {
    steps.push(`lot de ${formatQuantity(quantityPerLot, unit)}`);
    steps.push(`${formatNumber(preview.quantityWithWaste)} / ${formatNumber(quantityPerLot)} = ${formatNumber(preview.quantityWithWaste / quantityPerLot)}`);
    steps.push(`arrondi a ${formatLots(preview.purchasedQuantity)}`);
    steps.push(`${formatLots(preview.purchasedQuantity)} = ${formatQuantity(preview.deliveredPhysicalQuantity, unit)} livres`);
  }

  if (preview.waste > 0) {
    steps.push(`perte ${formatQuantity(preview.waste, unit)}`);
  }

  return (
    <div className="calc-sketch">
      {steps.map((step) => (
        <span key={step}>{step}</span>
      ))}
    </div>
  );
}

function QuoteLinesTable({
  items,
  materials,
  onEdit,
  onDelete,
}: {
  items: Doc<"quoteItems">[];
  materials: Material[];
  onEdit: (item: Doc<"quoteItems">) => void;
  onDelete: (itemId: Id<"quoteItems">) => void;
}) {
  const [sort, setSort] = useState<{ key: QuoteLineSortKey; direction: "asc" | "desc" } | null>(null);
  const sortedItems = useMemo(() => {
    if (!sort) {
      return items;
    }
    return [...items].sort((left, right) => {
      const leftMaterial = left.materialId ? materials.find((entry) => entry._id === left.materialId) ?? null : null;
      const rightMaterial = right.materialId ? materials.find((entry) => entry._id === right.materialId) ?? null : null;
      return compareLineSortValues(
        quoteLineSortValue(left, leftMaterial, sort.key),
        quoteLineSortValue(right, rightMaterial, sort.key),
        sort.direction,
      );
    });
  }, [items, materials, sort]);

  function toggleSort(key: QuoteLineSortKey) {
    setSort((current) => {
      if (current?.key !== key) {
        return { key, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { key, direction: "desc" };
      }
      return null;
    });
  }

  if (items.length === 0) {
    return <EmptyState title="Aucune ligne" />;
  }

  return (
    <div className="table-wrap quote-lines-wrap">
      <table className="data-table quote-lines-table">
        <thead>
          <tr>
            <SortableQuoteLineHeader label="Designation" sortKey="description" activeSort={sort} onSort={toggleSort} />
            <SortableQuoteLineHeader label="Besoin" sortKey="quantity" activeSort={sort} onSort={toggleSort} />
            <SortableQuoteLineHeader label="Avec pertes" sortKey="quantityWithWaste" activeSort={sort} onSort={toggleSort} />
            <SortableQuoteLineHeader label="Achete" sortKey="purchased" activeSort={sort} onSort={toggleSort} />
            <SortableQuoteLineHeader label="Perte" sortKey="waste" activeSort={sort} onSort={toggleSort} />
            <SortableQuoteLineHeader label="Cout reel" sortKey="realCost" activeSort={sort} onSort={toggleSort} />
            <SortableQuoteLineHeader label="Total HT" sortKey="total" activeSort={sort} onSort={toggleSort} />
            <th className="actions-cell" />
          </tr>
        </thead>
        <tbody>
          {groupQuoteItems(sortedItems).map((group) => (
            <Fragment key={group.section}>
              <tr className="quote-section-row">
                <td colSpan={8}>
                  <span>{group.section}</span>
                  <strong>{formatCurrency(group.totalHt)} HT</strong>
                </td>
              </tr>
              {group.items.map((item) => {
                const material = item.materialId ? materials.find((entry) => entry._id === item.materialId) : null;
                const sketch = getLineSketch(item, material ?? null);
                return (
                  <Fragment key={item._id}>
                    <tr>
                      <td><strong>{item.description}</strong></td>
                      <td>{formatLineNeed(item, material ?? null)}</td>
                      <td>{formatLineWithWaste(item, material ?? null)}</td>
                      <td>{formatLinePurchased(item, material ?? null)}</td>
                      <td>{formatLineWaste(item, material ?? null)}</td>
                      <td>{formatCurrency(item.realCostHt ?? item.totalHt)}</td>
                      <td>{formatCurrency(item.totalHt)}</td>
                      <td className="actions-cell">
                        <div className="row-actions">
                        <IconButton label="Modifier" onClick={() => onEdit(item)}><Edit3 className="h-4 w-4" /></IconButton>
                        <IconButton label="Supprimer" variant="danger" onClick={() => void onDelete(item._id)}><Trash2 className="h-4 w-4" /></IconButton>
                        </div>
                      </td>
                    </tr>
                    {sketch ? (
                      <tr className="quote-sketch-row">
                        <td colSpan={8}>
                          <div className="quote-sketch">
                            <span className="quote-sketch-label">Calcul</span>
                            {sketch.steps.map((step) => (
                              <span key={step}>{step}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type QuoteLineSortKey = "description" | "quantity" | "quantityWithWaste" | "purchased" | "waste" | "realCost" | "total";

function SortableQuoteLineHeader({
  label,
  sortKey,
  activeSort,
  onSort,
}: {
  label: string;
  sortKey: QuoteLineSortKey;
  activeSort: { key: QuoteLineSortKey; direction: "asc" | "desc" } | null;
  onSort: (key: QuoteLineSortKey) => void;
}) {
  const active = activeSort?.key === sortKey;
  return (
    <th aria-sort={active ? (activeSort.direction === "asc" ? "ascending" : "descending") : undefined}>
      <button type="button" className="sort-header" onClick={() => onSort(sortKey)}>
        <span>{label}</span>
        <i>{active ? (activeSort.direction === "asc" ? "↑" : "↓") : "↕"}</i>
      </button>
    </th>
  );
}

function quoteLineSortValue(item: Doc<"quoteItems">, material: Material | null, key: QuoteLineSortKey) {
  switch (key) {
    case "description":
      return item.description;
    case "quantity":
      return item.quantity;
    case "quantityWithWaste":
      return item.quantityWithWaste ?? item.quantity;
    case "purchased":
      return item.purchasedQuantity ?? item.quantity;
    case "waste":
      return item.wasteQuantity ?? 0;
    case "realCost":
      return item.realCostHt ?? item.totalHt;
    case "total":
      return item.totalHt;
    default:
      return material?.name ?? "";
  }
}

function compareLineSortValues(
  left: string | number | null | undefined,
  right: string | number | null | undefined,
  direction: "asc" | "desc",
) {
  const multiplier = direction === "asc" ? 1 : -1;
  if (left == null && right == null) {
    return 0;
  }
  if (left == null) {
    return 1;
  }
  if (right == null) {
    return -1;
  }
  if (typeof left === "number" && typeof right === "number") {
    return (left - right) * multiplier;
  }
  return String(left).localeCompare(String(right), "fr-FR", { numeric: true, sensitivity: "base" }) * multiplier;
}

function LineEditModal({
  open,
  form,
  materials,
  services,
  pending,
  onClose,
  onChange,
  onAutoSave,
}: {
  open: boolean;
  form: typeof emptyLine;
  materials: Material[];
  services: Service[];
  pending: boolean;
  onClose: () => void | Promise<void>;
  onChange: (form: typeof emptyLine) => void;
  onAutoSave: () => void;
}) {
  const selectedMaterial = materials.find((material) => material._id === form.materialId) ?? null;
  const selectedService = services.find((service) => service._id === form.serviceId) ?? null;
  const preview = calculatePreview(form, selectedMaterial, selectedService);
  const autoSaveLineOnBlur = useBlurAutosave<HTMLDivElement>(() => {
    onAutoSave();
  }, { enabled: open });

  return (
    <Modal
      open={open}
      title="Modifier la ligne"
      description="Corrige quantite, prix, perte, marge ou lot de travaux. Le calcul est recalcule automatiquement."
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="outline" disabled={pending} onClick={() => void onClose()}>
            Fermer
          </Button>
        </>
      }
    >
      <div className="form-grid" onBlurCapture={autoSaveLineOnBlur}>
        <Field label="Type" required>
          <SelectInput value={form.kind} onChange={(event) => onChange({ ...emptyLine, kind: event.target.value as LineKind })}>
            <option value="material">Materiau</option>
            <option value="service">Prestation</option>
            <option value="custom">Libre</option>
          </SelectInput>
        </Field>
        {form.kind === "material" ? (
          <Field label="Materiau" required>
            <SelectInput value={form.materialId} onChange={(event) => onChange({ ...form, materialId: event.target.value })}>
              <option value="">Choisir un materiau</option>
              {materials.map((material) => <option key={material._id} value={material._id}>{material.name}</option>)}
            </SelectInput>
          </Field>
        ) : null}
        {form.kind === "service" ? (
          <Field label="Prestation" required>
            <SelectInput value={form.serviceId} onChange={(event) => onChange({ ...form, serviceId: event.target.value })}>
              <option value="">Choisir une prestation</option>
              {services.map((service) => <option key={service._id} value={service._id}>{service.name}</option>)}
            </SelectInput>
          </Field>
        ) : null}
        <Field label="Designation" optional><TextInput value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} /></Field>
        <Field label="Lot de travaux" optional><TextInput value={form.section} onChange={(event) => onChange({ ...form, section: event.target.value })} /></Field>
        {form.kind === "custom" ? <Field label="Unite" required><TextInput value={form.unit} onChange={(event) => onChange({ ...form, unit: event.target.value })} /></Field> : null}
        <Field label="Besoin chantier" required><NumberInput min={0.0001} step="0.01" value={form.quantity} onChange={(event) => onChange({ ...form, quantity: Number(event.target.value) })} /></Field>
        <Field label="Prix HT force" optional><NumberInput min={0} step="0.01" value={form.unitPriceHt} onChange={(event) => onChange({ ...form, unitPriceHt: event.target.value })} /></Field>
        <Field label="Perte chantier (%)" optional><NumberInput min={0} max={100} step="0.01" value={form.wasteRate} onChange={(event) => onChange({ ...form, wasteRate: event.target.value })} /></Field>
        <Field label="Marge (%)" optional><NumberInput min={0} max={100} step="0.01" value={form.marginRate} onChange={(event) => onChange({ ...form, marginRate: Number(event.target.value) })} /></Field>
      </div>
      <div className="edit-line-preview">
        <Calc label="Besoin" value={formatPreviewNeed(form, selectedMaterial)} />
        <Calc label="A acheter" value={formatPreviewPurchased(form, preview, selectedMaterial)} />
        <Calc label="Livre" value={formatPreviewDelivered(form, preview, selectedMaterial)} />
        <Calc label="Perte" value={formatPreviewWaste(form, preview, selectedMaterial)} />
        <Calc label="Total HT" value={formatCurrency(preview.totalHt)} />
      </div>
    </Modal>
  );
}

function PurchaseList({ items, materials }: { items: Doc<"quoteItems">[]; materials: Material[] }) {
  const rows = buildPurchaseList(items, materials);
  if (rows.length === 0) {
    return null;
  }

  return (
    <Panel title="Liste d'achat" description="Synthese interne des materiaux a commander pour ce devis.">
      <div className="purchase-list">
        {rows.map((row) => (
          <div key={row.key} className="purchase-row">
            <div>
              <strong>{row.name}</strong>
              <span>{row.supplier || "Fournisseur non renseigne"}</span>
            </div>
            <div>
              <span>Besoin</span>
              <strong>{formatQuantity(row.need, row.unit)}</strong>
            </div>
            <div>
              <span>A commander</span>
              <strong>{row.lotSize ? `${formatLots(row.purchasedLots)} (${formatQuantity(row.delivered, row.unit)})` : formatQuantity(row.delivered, row.unit)}</strong>
            </div>
            <div>
              <span>Perte</span>
              <strong>{formatQuantity(row.waste, row.unit)}</strong>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function QuoteDocument({
  quoteBundle,
  organization,
}: {
  quoteBundle: QuoteBundle;
  organization: Doc<"organizations"> | null;
}) {
  const { quote, client, items } = quoteBundle;
  const organizationAddress = formatAddress([organization?.address, joinPostalCity(organization?.postalCode, organization?.city), organization?.country]);
  const clientAddress = formatAddress([client?.address, joinPostalCity(client?.postalCode, client?.city), client?.country]);
  const paymentTermsText = quote.paymentTermsText ?? organization?.paymentTermsText;
  const latePenaltyText = quote.latePenaltyText ?? organization?.latePenaltyText;
  const discountTermsText = organization?.discountTermsText;
  const taxExemptionText = quote.vatRate === 0 ? organization?.taxExemptionText : undefined;
  const quotePricingText = organization?.quotePricingText;
  const legalNotice = quote.legalNotice ?? organization?.legalNotice;
  const professionalInsurance = organization?.professionalInsurance;
  const mediatorInfo = organization?.mediatorInfo;
  const acceptanceText = organization?.acceptanceText;
  const taxDebitOption = quote.taxDebitOption ?? organization?.taxDebitOption;
  const vatAmount = Math.max(0, quote.totalTtc - quote.totalHt);

  return (
    <article id="quote-print-document" className="quote-document">
        <header className="quote-document-header">
          <div>
            <span className="quote-document-kicker">Devis</span>
            <h1>{quote.number}</h1>
            <p>{quote.title}</p>
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
            <span>Client</span>
            <strong>{formatClientName(client)}</strong>
            {clientAddress ? <p>{clientAddress}</p> : null}
            {client?.email ? <p>{client.email}</p> : null}
            {client?.siren ? <p>SIREN: {client.siren}</p> : null}
            {client?.siret ? <p>SIRET: {client.siret}</p> : null}
            {client?.vatNumber ? <p>TVA: {client.vatNumber}</p> : null}
          </div>
          <div>
            <span>Date</span>
            <strong>{formatDate(quote.issueDate)}</strong>
            <span>Validite</span>
            <strong>{formatDate(quote.validUntil)}</strong>
            <span>Nature</span>
            <strong>{operationTypeLabel(quote.operationType ?? organization?.defaultOperationType)}</strong>
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

        {quote.siteDescription ? (
          <section className="quote-document-note">
            <span>Chantier</span>
            <p>{quote.siteDescription}</p>
          </section>
        ) : null}

        {quote.deliveryAddress ? (
          <section className="quote-document-note">
            <span>Adresse chantier / livraison</span>
            <p>{quote.deliveryAddress}</p>
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
            {groupQuoteItems(items).map((group) => (
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
            ))}
          </tbody>
        </table>

        <section className="quote-document-bottom">
          <div className="quote-document-terms">
            {paymentTermsText ? (
              <div>
                <span>Reglement</span>
                <p>{paymentTermsText}</p>
              </div>
            ) : null}
            {latePenaltyText ? (
              <div>
                <span>Retard</span>
                <p>{latePenaltyText}</p>
              </div>
            ) : null}
            {discountTermsText ? (
              <div>
                <span>Escompte</span>
                <p>{discountTermsText}</p>
              </div>
            ) : null}
            {quotePricingText ? (
              <div>
                <span>Prix du devis</span>
                <p>{quotePricingText}</p>
              </div>
            ) : null}
            {taxExemptionText ? (
              <div>
                <span>TVA</span>
                <p>{taxExemptionText}</p>
              </div>
            ) : null}
            {taxDebitOption ? (
              <div>
                <span>TVA</span>
                <p>Option pour le paiement de la TVA d'apres les debits.</p>
              </div>
            ) : null}
            {professionalInsurance ? (
              <div>
                <span>Assurance</span>
                <p>{professionalInsurance}</p>
              </div>
            ) : null}
            {mediatorInfo ? (
              <div>
                <span>Mediateur</span>
                <p>{mediatorInfo}</p>
              </div>
            ) : null}
            {legalNotice ? (
              <div>
                <span>Mentions</span>
                <p>{legalNotice}</p>
              </div>
            ) : null}
          </div>
          <div className="quote-document-totals">
            <div><span>Total HT</span><strong>{formatCurrency(quote.totalHt)}</strong></div>
            <div><span>TVA {formatNumber(quote.vatRate)}%</span><strong>{formatCurrency(vatAmount)}</strong></div>
            <div><span>Total TTC</span><strong>{formatCurrency(quote.totalTtc)}</strong></div>
          </div>
        </section>

        <footer className="quote-document-footer">
          <span>Bon pour accord</span>
          <span>{acceptanceText ?? "Date et signature client"}</span>
        </footer>
    </article>
  );
}

function getLineSketch(item: Doc<"quoteItems">, material: Material | null) {
  if (item.kind !== "material") {
    return null;
  }

  const quantityWithWaste = item.quantityWithWaste ?? item.quantity;
  const purchasedQuantity = item.purchasedQuantity ?? item.quantity;
  const deliveredPhysicalQuantity = item.deliveredPhysicalQuantity ?? quantityWithWaste;
  const wasteQuantity = item.wasteQuantity ?? 0;
  const quantityPerLot = material?.quantityPerLot && material.quantityPerLot > 0 ? material.quantityPerLot : undefined;
  const hasLotRounding = !!quantityPerLot && purchasedQuantity !== quantityWithWaste;
  const hasWasteRate = item.wasteRate > 0;
  const hasGeneratedWaste = wasteQuantity > 0;

  if (!hasLotRounding && !hasWasteRate && !hasGeneratedWaste) {
    return null;
  }

  const steps: string[] = [];
  if (hasWasteRate) {
    steps.push(`${formatLineNeed(item, material)} + ${item.wasteRate}% = ${formatLineWithWaste(item, material)}`);
  } else {
    steps.push(`Besoin: ${formatLineNeed(item, material)}`);
  }

  if (quantityPerLot) {
    steps.push(`lot de ${formatQuantity(quantityPerLot, demandUnit(material, item.unit))}`);
    steps.push(`${formatNumber(quantityWithWaste)} / ${formatNumber(quantityPerLot)} = ${formatNumber(quantityWithWaste / quantityPerLot)}`);
    steps.push(`arrondi a ${formatNumber(purchasedQuantity)} lot(s)`);
    steps.push(`${formatNumber(purchasedQuantity)} lot(s) x ${formatNumber(quantityPerLot)} = ${formatQuantity(deliveredPhysicalQuantity, demandUnit(material, item.unit))} achetes`);
  }

  if (hasGeneratedWaste) {
    steps.push(`perte: ${formatQuantity(deliveredPhysicalQuantity, demandUnit(material, item.unit))} - ${formatLineNeed(item, material)} = ${formatQuantity(wasteQuantity, demandUnit(material, item.unit))}`);
  }

  return { steps };
}

function groupQuoteItems(items: Doc<"quoteItems">[]) {
  const groups = new Map<string, { section: string; items: Doc<"quoteItems">[]; totalHt: number }>();
  for (const item of items) {
    const section = cleanSectionLabel(item.section);
    const group = groups.get(section) ?? { section, items: [], totalHt: 0 };
    group.items.push(item);
    group.totalHt += item.totalHt;
    groups.set(section, group);
  }
  return Array.from(groups.values());
}

function cleanSectionLabel(section: string | undefined) {
  const trimmed = section?.trim();
  return trimmed ? trimmed : "General";
}

function buildPurchaseList(items: Doc<"quoteItems">[], materials: Material[]) {
  const rows = new Map<
    string,
    {
      key: string;
      name: string;
      supplier?: string;
      unit: string;
      need: number;
      delivered: number;
      waste: number;
      purchasedLots: number;
      lotSize?: number;
    }
  >();

  for (const item of items) {
    if (item.kind !== "material" || !item.materialId) {
      continue;
    }
    const material = materials.find((entry) => entry._id === item.materialId);
    const key = item.materialId;
    const unit = materialDemandUnit(material ?? null, item.unit) ?? item.unit;
    const existing = rows.get(key) ?? {
      key,
      name: material?.name ?? item.description,
      supplier: material?.supplier,
      unit,
      need: 0,
      delivered: 0,
      waste: 0,
      purchasedLots: 0,
      lotSize: material?.quantityPerLot,
    };
    existing.need += item.quantity;
    existing.delivered += item.deliveredPhysicalQuantity ?? item.quantityWithWaste ?? item.quantity;
    existing.waste += item.wasteQuantity ?? 0;
    existing.purchasedLots += material?.quantityPerLot ? item.purchasedQuantity ?? 0 : 0;
    rows.set(key, existing);
  }

  return Array.from(rows.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function formatLineNeed(item: Doc<"quoteItems">, material: Material | null) {
  return formatQuantity(item.quantity, demandUnit(material, item.unit));
}

function formatLineWithWaste(item: Doc<"quoteItems">, material: Material | null) {
  return formatQuantity(item.quantityWithWaste ?? item.quantity, demandUnit(material, item.unit));
}

function formatLinePurchased(item: Doc<"quoteItems">, material: Material | null) {
  if (material?.quantityPerLot && material.quantityPerLot > 0) {
    return formatLots(item.purchasedQuantity ?? item.quantity);
  }
  return formatQuantity(item.purchasedQuantity ?? item.quantity, item.unit);
}

function formatLineWaste(item: Doc<"quoteItems">, material: Material | null) {
  return formatQuantity(item.wasteQuantity ?? 0, demandUnit(material, item.unit));
}

function demandUnit(material: Material | null, fallback?: string) {
  return materialDemandUnit(material, fallback);
}

function materialDemandUnit(material: Material | null, fallback?: string) {
  if (material?.quantityPerLot && material.quantityPerLot > 0) {
    return "p";
  }
  if (material?.unit === "lot" && material.quantityPerLot) {
    return "p";
  }
  return material?.unit ?? fallback;
}

function formatPreviewNeed(form: typeof emptyLine, material: Material | null) {
  return formatQuantity(form.quantity, previewDemandUnit(form, material));
}

function formatPreviewWithWaste(form: typeof emptyLine, preview: ReturnType<typeof calculatePreview>, material: Material | null) {
  return formatQuantity(preview.quantityWithWaste, previewDemandUnit(form, material));
}

function formatPreviewPurchased(form: typeof emptyLine, preview: ReturnType<typeof calculatePreview>, material: Material | null) {
  if (form.kind === "material" && material?.quantityPerLot && material.quantityPerLot > 0) {
    return formatLots(preview.purchasedQuantity);
  }
  return formatQuantity(preview.purchasedQuantity, previewDemandUnit(form, material));
}

function formatPreviewDelivered(form: typeof emptyLine, preview: ReturnType<typeof calculatePreview>, material: Material | null) {
  return formatQuantity(preview.deliveredPhysicalQuantity, previewDemandUnit(form, material));
}

function formatPreviewWaste(form: typeof emptyLine, preview: ReturnType<typeof calculatePreview>, material: Material | null) {
  return formatQuantity(preview.waste, previewDemandUnit(form, material));
}

function previewDemandUnit(form: typeof emptyLine, material: Material | null) {
  if (form.kind === "material") {
    return materialDemandUnit(material, "p");
  }
  return form.kind === "service" ? "u" : form.unit || undefined;
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

function formatLots(value: number) {
  return `${formatNumber(value)} lot${value > 1 ? "s" : ""}`;
}

function formatUnit(unit?: string) {
  const labels: Record<string, string> = {
    p: "piece",
    piece: "piece",
    metre: "metre",
    m2: "m2",
    m3: "m3",
    litre: "litre",
    kilogramme: "kilogramme",
    lot: "lot",
    heure: "heure",
    forfait: "forfait",
    jour: "jour",
    u: "unite",
  };
  return unit ? labels[unit] ?? unit : "";
}

function formatNumber(value: number) {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 4 });
}

function optional(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function optionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
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

function printQuoteDocument(title: string) {
  const element = document.getElementById("quote-print-document");
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
    .quote-document-kicker, .quote-document-meta span, .quote-document-note span, .quote-document-terms span { color: #622B86; font-size: 11px; font-weight: 800; text-transform: uppercase; }
    h1 { color: #491474; font-size: 34px; margin: 5px 0; }
    p { margin: 4px 0; line-height: 1.5; }
    .quote-document-company { display: flex; gap: 12px; max-width: 48%; text-align: right; justify-content: flex-end; }
    .quote-document-company img { width: 54px; height: 54px; object-fit: contain; }
    .quote-document-company strong { display: grid; place-items: center; width: 54px; height: 54px; background: #491474; color: white; border-radius: 12px; }
    .quote-document-company div { display: grid; gap: 3px; font-size: 12px; }
    .quote-document-meta { display: grid; grid-template-columns: 1.4fr 0.8fr 0.8fr; gap: 16px; margin: 24px 0; }
    .quote-document-meta > div, .quote-document-note, .quote-document-terms > div, .quote-document-totals { border: 1px solid #e5d2ba; border-radius: 12px; padding: 12px; background: white; }
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
    .quote-document-footer { display: flex; justify-content: space-between; margin-top: 34px; padding-top: 18px; border-top: 1px solid #e5d2ba; color: #622B86; font-weight: 800; }
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

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000;
}
