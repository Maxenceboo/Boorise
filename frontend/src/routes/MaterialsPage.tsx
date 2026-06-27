import { useMutation, useQuery } from "convex/react";
import { Boxes, BriefcaseBusiness, Edit3, Filter, Package, Plus, Scissors, Star, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
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
  SearchInput,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/ui/app";
import { useToast } from "@/components/ui/toast-context";
import { useBlurAutosave } from "@/hooks/useBlurAutosave";
import { friendlyError } from "@/lib/errors";
import { formatCurrency } from "@/lib/format";

type Material = Doc<"materials">;
type Service = Doc<"services">;
type MaterialUnit = "piece" | "metre" | "m2" | "m3" | "litre" | "kilogramme" | "lot";
type ServiceUnit = "heure" | "forfait" | "jour" | "m2" | "metre";

const materialUnits: MaterialUnit[] = ["piece", "metre", "m2", "m3", "litre", "kilogramme", "lot"];
const serviceUnits: ServiceUnit[] = ["heure", "forfait", "jour", "m2", "metre"];

const emptyMaterial = {
  name: "",
  reference: "",
  category: "",
  supplier: "",
  description: "",
  unit: "piece" as MaterialUnit,
  purchasePriceHt: 0,
  defaultWasteRate: 0,
  divisible: true,
  quantityPerLot: "",
  length: "",
  width: "",
  height: "",
};

const emptyService = {
  name: "",
  description: "",
  unit: "heure" as ServiceUnit,
  unitPriceHt: 0,
};

export function MaterialsPage({ initialTab = "materials" }: { initialTab?: "materials" | "services" }) {
  const toast = useToast();
  const materials = useQuery(api.materials.list, {});
  const services = useQuery(api.services.list, {});
  const createMaterial = useMutation(api.materials.create);
  const updateMaterial = useMutation(api.materials.update);
  const archiveMaterial = useMutation(api.materials.archive);
  const toggleMaterialFavorite = useMutation(api.materials.toggleFavorite);
  const importMaterialRows = useMutation(api.materials.importCsvRows);
  const createService = useMutation(api.services.create);
  const updateService = useMutation(api.services.update);
  const archiveService = useMutation(api.services.archive);
  const toggleServiceFavorite = useMutation(api.services.toggleFavorite);
  const [tab, setTab] = useState<"materials" | "services">(initialTab);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [materialForm, setMaterialForm] = useState(emptyMaterial);
  const [serviceForm, setServiceForm] = useState(emptyService);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [materialModal, setMaterialModal] = useState(false);
  const [serviceModal, setServiceModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const materialNeedsLength = ["metre", "m2", "m3"].includes(materialForm.unit);
  const materialNeedsWidth = ["m2", "m3"].includes(materialForm.unit);
  const materialNeedsHeight = materialForm.unit === "m3";
  const autoSaveMaterialOnBlur = useBlurAutosave<HTMLDivElement>(() => {
    if (editingMaterial) {
      void saveMaterial(false);
    }
  }, { enabled: materialModal && !!editingMaterial });
  const autoSaveServiceOnBlur = useBlurAutosave<HTMLDivElement>(() => {
    if (editingService) {
      void saveService(false);
    }
  }, { enabled: serviceModal && !!editingService });

  const categories = useMemo(
    () => Array.from(new Set((materials ?? []).map((material) => material.category).filter(Boolean) as string[])).sort(),
    [materials],
  );

  const materialRows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return (materials ?? []).filter((material) => {
      const matchCategory = !category || material.category === category;
      const matchSearch =
        !normalized ||
        [material.name, material.reference, material.category, material.supplier, material.description]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalized));
      return matchCategory && matchSearch;
    }).sort((left, right) => Number(right.favorite ?? false) - Number(left.favorite ?? false));
  }, [materials, search, category]);

  const serviceRows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return (services ?? []).filter((service) => {
      if (!normalized) {
        return true;
      }
      return [service.name, service.description, service.unit]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized));
    }).sort((left, right) => Number(right.favorite ?? false) - Number(left.favorite ?? false));
  }, [services, search]);

  const materialStats = useMemo(() => {
    const activeMaterials = materials ?? [];
    const averageWaste =
      activeMaterials.length > 0
        ? activeMaterials.reduce((sum, material) => sum + material.defaultWasteRate, 0) / activeMaterials.length
        : 0;
    return {
      materialCount: activeMaterials.length,
      serviceCount: (services ?? []).length,
      lotCount: activeMaterials.filter((material) => !material.divisible).length,
      averageWaste,
    };
  }, [materials, services]);

  function openCreateMaterial() {
    setEditingMaterial(null);
    setMaterialForm(emptyMaterial);
    setError(null);
    setMaterialModal(true);
  }

  function openEditMaterial(material: Material) {
    setEditingMaterial(material);
    setMaterialForm({
      name: material.name,
      reference: material.reference ?? "",
      category: material.category ?? "",
      supplier: material.supplier ?? "",
      description: material.description ?? "",
      unit: material.unit,
      purchasePriceHt: material.purchasePriceHt,
      defaultWasteRate: material.defaultWasteRate,
      divisible: material.divisible,
      quantityPerLot: String(material.quantityPerLot ?? ""),
      length: String(material.length ?? ""),
      width: String(material.width ?? ""),
      height: String(material.height ?? ""),
    });
    setError(null);
    setMaterialModal(true);
  }

  function openCreateService() {
    setEditingService(null);
    setServiceForm(emptyService);
    setError(null);
    setServiceModal(true);
  }

  function openEditService(service: Service) {
    setEditingService(service);
    setServiceForm({
      name: service.name,
      description: service.description ?? "",
      unit: service.unit,
      unitPriceHt: service.unitPriceHt,
    });
    setError(null);
    setServiceModal(true);
  }

  function setMaterialUnit(unit: MaterialUnit) {
    setMaterialForm((current) => ({
      ...current,
      unit,
      length: ["metre", "m2", "m3"].includes(unit) ? current.length : "",
      width: ["m2", "m3"].includes(unit) ? current.width : "",
      height: unit === "m3" ? current.height : "",
    }));
  }

  async function saveMaterial(closeOnSave = true) {
    if (!materialForm.divisible && !optionalNumber(materialForm.quantityPerLot)) {
      setError("Renseigne la quantite contenue par achat pour un materiau vendu par unite ou lot.");
      return false;
    }

    setPending(true);
    setError(null);
    const payload = {
      name: materialForm.name,
      reference: optional(materialForm.reference),
      category: optional(materialForm.category),
      supplier: optional(materialForm.supplier),
      description: optional(materialForm.description),
      unit: materialForm.unit,
      purchasePriceHt: materialForm.purchasePriceHt,
      defaultWasteRate: materialForm.defaultWasteRate,
      divisible: materialForm.divisible,
      quantityPerLot: materialForm.divisible ? undefined : optionalNumber(materialForm.quantityPerLot),
      length: materialNeedsLength ? optionalNumber(materialForm.length) : undefined,
      width: materialNeedsWidth ? optionalNumber(materialForm.width) : undefined,
      height: materialNeedsHeight ? optionalNumber(materialForm.height) : undefined,
    };
    try {
      if (editingMaterial) {
        await updateMaterial({ materialId: editingMaterial._id, ...payload });
      } else {
        await createMaterial(payload);
      }
      if (closeOnSave) {
        setMaterialModal(false);
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

  async function saveService(closeOnSave = true) {
    setPending(true);
    setError(null);
    const payload = {
      name: serviceForm.name,
      description: optional(serviceForm.description),
      unit: serviceForm.unit,
      unitPriceHt: serviceForm.unitPriceHt,
    };
    try {
      if (editingService) {
        await updateService({ serviceId: editingService._id, ...payload });
      } else {
        await createService(payload);
      }
      if (closeOnSave) {
        setServiceModal(false);
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

  async function closeMaterialModal() {
    if (!editingMaterial) {
      setMaterialModal(false);
      return;
    }
    if (await saveMaterial(false)) {
      setMaterialModal(false);
    }
  }

  async function closeServiceModal() {
    if (!editingService) {
      setServiceModal(false);
      return;
    }
    if (await saveService(false)) {
      setServiceModal(false);
    }
  }

  async function removeMaterial(materialId: Id<"materials">, name: string) {
    if (window.confirm(`Archiver ${name} ?`)) {
      try {
        await archiveMaterial({ materialId });
      } catch (err) {
        const message = friendlyError(err, "Archivage impossible.");
        setError(message);
        toast.error(message);
      }
    }
  }

  async function removeService(serviceId: Id<"services">, name: string) {
    if (window.confirm(`Archiver ${name} ?`)) {
      try {
        await archiveService({ serviceId });
      } catch (err) {
        const message = friendlyError(err, "Archivage impossible.");
        setError(message);
        toast.error(message);
      }
    }
  }

  async function favoriteMaterial(material: Material) {
    try {
      await toggleMaterialFavorite({ materialId: material._id, favorite: !(material.favorite ?? false) });
    } catch (err) {
      const message = friendlyError(err, "Favori impossible.");
      setError(message);
      toast.error(message);
    }
  }

  async function favoriteService(service: Service) {
    try {
      await toggleServiceFavorite({ serviceId: service._id, favorite: !(service.favorite ?? false) });
    } catch (err) {
      const message = friendlyError(err, "Favori impossible.");
      setError(message);
      toast.error(message);
    }
  }

  async function importCsv() {
    setPending(true);
    setError(null);
    try {
      const rows = parseMaterialsCsv(csvText);
      if (rows.length === 0) {
        throw new Error("Aucune ligne exploitable dans le CSV.");
      }
      const result = await importMaterialRows({ rows });
      setImportModal(false);
      setCsvText("");
      toast.success(`${result.imported} materiau(x) importe(s).`);
    } catch (err) {
      const message = friendlyError(err, "Import impossible.");
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={tab === "materials" ? "Materiaux" : "Prestations"}
        description={
          tab === "materials"
            ? "Declare ce que tu mesures sur chantier, puis comment tu l'achetes. Les devis reprennent exactement cette logique."
            : "Structure la main-d'oeuvre, les forfaits et les prix de vente reutilisables dans chaque devis."
        }
        actions={
          tab === "materials" ? (
            <>
              <Button variant="outline" onClick={() => setImportModal(true)}>
                <Upload className="h-4 w-4" />
                Import CSV
              </Button>
              <Button variant="outline" onClick={openCreateService}>
                <Plus className="h-4 w-4" />
                Prestation
              </Button>
              <Button onClick={openCreateMaterial}>
                <Plus className="h-4 w-4" />
                Materiau
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={openCreateMaterial}>
                <Plus className="h-4 w-4" />
                Materiau
              </Button>
              <Button onClick={openCreateService}>
                <Plus className="h-4 w-4" />
                Prestation
              </Button>
            </>
          )
        }
      />

      <div className="inventory-metrics">
        <div className="inventory-metric">
          <Boxes className="h-5 w-5" />
          <span>Materiaux actifs</span>
          <strong>{materialStats.materialCount}</strong>
        </div>
        <div className="inventory-metric">
          <BriefcaseBusiness className="h-5 w-5" />
          <span>Prestations</span>
          <strong>{materialStats.serviceCount}</strong>
        </div>
        <div className="inventory-metric">
          <Package className="h-5 w-5" />
          <span>Vendus par lot</span>
          <strong>{materialStats.lotCount}</strong>
        </div>
        <div className="inventory-metric">
          <Scissors className="h-5 w-5" />
          <span>Perte moyenne</span>
          <strong>{materialStats.averageWaste.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%</strong>
        </div>
      </div>

      <div className="catalog-shell">
        <aside className="catalog-sidebar">
          <div className="tabs">
            <button className={tab === "materials" ? "active" : ""} onClick={() => setTab("materials")}>Materiaux</button>
            <button className={tab === "services" ? "active" : ""} onClick={() => setTab("services")}>Prestations</button>
          </div>

          <Field label="Recherche">
            <SearchInput
              value={search}
              placeholder={tab === "materials" ? "Nom, reference, fournisseur..." : "Nom, unite, description..."}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Field>

          {tab === "materials" ? (
            <div className="category-filter">
              <div className="filter-title">
                <Filter className="h-4 w-4" />
                Categories
              </div>
              <button className={!category ? "active" : ""} onClick={() => setCategory("")}>
                Toutes <span>{materials?.length ?? 0}</span>
              </button>
              {categories.map((item) => (
                <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>
                  {item} <span>{(materials ?? []).filter((material) => material.category === item).length}</span>
                </button>
              ))}
            </div>
          ) : null}
        </aside>

        <Panel
          title={tab === "materials" ? "Catalogue materiaux" : "Catalogue prestations"}
          description={tab === "materials" ? `${materialRows.length} resultat(s), prix et conditionnements visibles sans ouvrir la fiche.` : `${serviceRows.length} prestation(s) reutilisables dans les devis.`}
          actions={
            tab === "materials" ? (
              <Button onClick={openCreateMaterial}><Plus className="h-4 w-4" />Materiau</Button>
            ) : (
              <Button onClick={openCreateService}><Plus className="h-4 w-4" />Prestation</Button>
            )
          }
        >
          {tab === "materials" ? (
            <DataTable
              density="compact"
              loading={materials === undefined}
              rows={materialRows}
              rowKey={(material) => material._id}
              empty={<EmptyState title="Aucun materiau" action={<Button onClick={openCreateMaterial}>Ajouter un materiau</Button>} />}
              columns={[
                {
                  key: "name",
                  header: "Materiau",
                  sortValue: (material) => material.name,
                  render: (material) => (
                    <button className="material-table-name" onClick={() => openEditMaterial(material)}>
                      <strong>{material.favorite ? "★ " : ""}{material.name}</strong>
                      <span>{material.reference ?? "Sans reference"}</span>
                    </button>
                  ),
                },
                { key: "category", header: "Categorie", sortValue: (material) => material.category ?? "", render: (material) => (
                  <div className="table-stack">
                    <Badge tone="indigo">{material.category ?? "Sans categorie"}</Badge>
                    <span>{material.supplier ?? "Sans fournisseur"}</span>
                  </div>
                ) },
                { key: "unit", header: "Mesure", sortValue: (material) => materialDemandUnit(material), render: (material) => (
                  <div className="table-stack">
                    <strong>{formatUnit(materialDemandUnit(material))}</strong>
                    <span>{formatDimensions(material)}</span>
                  </div>
                ) },
                { key: "packaging", header: "Achat", sortValue: (material) => material.divisible ? 0 : material.quantityPerLot ?? 1, render: (material) => materialPackaging(material) },
                { key: "waste", header: "Perte", sortValue: (material) => material.defaultWasteRate, render: (material) => `${material.defaultWasteRate}%` },
                { key: "price", header: "Prix HT", sortValue: (material) => material.purchasePriceHt, render: (material) => <strong>{formatCurrency(material.purchasePriceHt)}</strong> },
                {
                  key: "actions",
                  header: "",
                  className: "actions-cell",
                  sortable: false,
                  render: (material) => (
                    <div className="row-actions">
                      <IconButton label={material.favorite ? "Retirer des favoris" : "Ajouter aux favoris"} variant="outline" onClick={() => void favoriteMaterial(material)}><Star className={material.favorite ? "h-4 w-4 fill-current" : "h-4 w-4"} /></IconButton>
                      <IconButton label="Modifier" onClick={() => openEditMaterial(material)}><Edit3 className="h-4 w-4" /></IconButton>
                      <IconButton label="Archiver" variant="danger" onClick={() => void removeMaterial(material._id, material.name)}><Trash2 className="h-4 w-4" /></IconButton>
                    </div>
                  ),
                },
              ]}
            />
          ) : (
            <DataTable
              density="compact"
              loading={services === undefined}
              rows={serviceRows}
              rowKey={(service) => service._id}
              empty={<EmptyState title="Aucune prestation" action={<Button onClick={openCreateService}>Ajouter une prestation</Button>} />}
              columns={[
                { key: "name", header: "Nom", sortValue: (service) => service.name, render: (service) => <strong>{service.favorite ? "★ " : ""}{service.name}</strong> },
                { key: "description", header: "Description", sortValue: (service) => service.description ?? "", render: (service) => service.description ?? "-" },
                { key: "unit", header: "Unite", sortValue: (service) => service.unit, render: (service) => service.unit },
                { key: "price", header: "Prix HT", sortValue: (service) => service.unitPriceHt, render: (service) => formatCurrency(service.unitPriceHt) },
                {
                  key: "actions",
                  header: "",
                  className: "actions-cell",
                  sortable: false,
                  render: (service) => (
                    <div className="row-actions">
                      <IconButton label={service.favorite ? "Retirer des favoris" : "Ajouter aux favoris"} variant="outline" onClick={() => void favoriteService(service)}><Star className={service.favorite ? "h-4 w-4 fill-current" : "h-4 w-4"} /></IconButton>
                      <IconButton label="Modifier" onClick={() => openEditService(service)}><Edit3 className="h-4 w-4" /></IconButton>
                      <IconButton label="Archiver" variant="danger" onClick={() => void removeService(service._id, service.name)}><Trash2 className="h-4 w-4" /></IconButton>
                    </div>
                  ),
                },
              ]}
            />
          )}
        </Panel>
      </div>

      <Modal
        open={importModal}
        title="Importer des materiaux"
        description="Colle un CSV avec en-tetes. Les lignes sont creees comme des materiaux actifs."
        onClose={() => setImportModal(false)}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setImportModal(false)}>Annuler</Button>
            <Button disabled={pending} onClick={() => void importCsv()}>
              <Upload className="h-4 w-4" />
              Importer
            </Button>
          </>
        }
      >
        <div className="form-grid">
          {error ? <Notice kind="error">{error}</Notice> : null}
          <Notice kind="info">Colonnes acceptees: nom, reference, categorie, fournisseur, description, prix_achat_ht, unite, divisible, quantite_par_lot, longueur, largeur, hauteur, taux_perte_defaut.</Notice>
          <Field label="CSV" required hint="Separateur virgule ou point-virgule. Exemple: nom;prix_achat_ht;unite;divisible;taux_perte_defaut">
            <TextArea className="csv-import-area" value={csvText} onChange={(event) => setCsvText(event.target.value)} placeholder={"nom;prix_achat_ht;unite;divisible;taux_perte_defaut\nPoutre 2m;12.5;piece;non;5\nPeinture blanche;38;litre;oui;10"} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={materialModal}
        title={editingMaterial ? "Modifier le materiau" : "Nouveau materiau"}
        description="L'unite sert au besoin dans le devis. Le conditionnement sert uniquement a calculer ce qu'il faut acheter."
        onClose={() => void closeMaterialModal()}
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => void closeMaterialModal()}>
              {editingMaterial ? "Fermer" : "Annuler"}
            </Button>
            {!editingMaterial ? <Button disabled={pending} onClick={() => void saveMaterial()}>{pending ? "Creation..." : "Creer"}</Button> : null}
          </>
        }
      >
        <div className="form-grid form-grid-3" onBlurCapture={autoSaveMaterialOnBlur}>
          {error ? <Notice kind="error">{error}</Notice> : null}
          <FormSection title="Identification" description="Le nom est obligatoire. Le reste sert au classement et a la recherche.">
            <Field label="Nom" required><TextInput value={materialForm.name} onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })} /></Field>
            <Field label="Reference" optional><TextInput value={materialForm.reference} onChange={(e) => setMaterialForm({ ...materialForm, reference: e.target.value })} /></Field>
            <Field label="Categorie" optional><TextInput value={materialForm.category} onChange={(e) => setMaterialForm({ ...materialForm, category: e.target.value })} /></Field>
            <Field label="Fournisseur" optional><TextInput value={materialForm.supplier} onChange={(e) => setMaterialForm({ ...materialForm, supplier: e.target.value })} /></Field>
          </FormSection>

          <FormSection title="Prix et besoin" description="Ces champs pilotent directement le calcul dans les devis.">
            <Field label="Unite du besoin" required hint="Ex: piece pour une poutre, m2 pour une plaque, metre pour un tasseau.">
              <SelectInput value={materialForm.unit} onChange={(e) => setMaterialUnit(e.target.value as MaterialUnit)}>
                {materialUnits.map((unit) => <option key={unit} value={unit}>{formatUnit(unit)}</option>)}
              </SelectInput>
            </Field>
            <Field label="Prix achat HT" required><NumberInput min={0} step="0.01" value={materialForm.purchasePriceHt} onChange={(e) => setMaterialForm({ ...materialForm, purchasePriceHt: Number(e.target.value) })} /></Field>
            <Field label="Perte par defaut (%)" optional><NumberInput min={0} max={100} step="0.01" value={materialForm.defaultWasteRate} onChange={(e) => setMaterialForm({ ...materialForm, defaultWasteRate: Number(e.target.value) })} /></Field>
          </FormSection>

          <FormSection title="Conditionnement d'achat" description="Choisis si le fournisseur vend au besoin exact ou par lot.">
            <div className="purchase-mode md:col-span-3">
              <button type="button" className={materialForm.divisible ? "active" : ""} onClick={() => setMaterialForm({ ...materialForm, divisible: true, quantityPerLot: "" })}>
                <strong>Achat au besoin exact</strong>
                <span>Peinture, sable, metre lineaire divisible.</span>
              </button>
              <button type="button" className={!materialForm.divisible ? "active" : ""} onClick={() => setMaterialForm({ ...materialForm, divisible: false, quantityPerLot: materialForm.quantityPerLot || "1" })}>
                <strong>Achat par unite ou lot</strong>
                <span>Pieces, boites, lots avec arrondi automatique.</span>
              </button>
            </div>
            {!materialForm.divisible ? (
              <Field label="Quantite contenue par achat" required hint="Ex: lot de 2 poutres => 2. Boite de 200 vis => 200.">
                <NumberInput min={0.0001} step="0.01" value={materialForm.quantityPerLot} onChange={(e) => setMaterialForm({ ...materialForm, quantityPerLot: e.target.value })} />
              </Field>
            ) : null}
          </FormSection>

          <FormSection title="Details facultatifs" description="Les dimensions apparaissent uniquement quand l'unite du besoin les rend utiles.">
            {materialNeedsLength ? <Field label="Longueur" optional><NumberInput min={0} step="0.01" value={materialForm.length} onChange={(e) => setMaterialForm({ ...materialForm, length: e.target.value })} /></Field> : null}
            {materialNeedsWidth ? <Field label="Largeur" optional><NumberInput min={0} step="0.01" value={materialForm.width} onChange={(e) => setMaterialForm({ ...materialForm, width: e.target.value })} /></Field> : null}
            {materialNeedsHeight ? <Field label="Hauteur" optional><NumberInput min={0} step="0.01" value={materialForm.height} onChange={(e) => setMaterialForm({ ...materialForm, height: e.target.value })} /></Field> : null}
            <Field label="Description" optional><TextArea value={materialForm.description} onChange={(e) => setMaterialForm({ ...materialForm, description: e.target.value })} /></Field>
          </FormSection>
        </div>
      </Modal>

      <Modal
        open={serviceModal}
        title={editingService ? "Modifier la prestation" : "Nouvelle prestation"}
        description="Ajoute une ligne de main d'oeuvre ou un forfait reutilisable dans les devis."
        onClose={() => void closeServiceModal()}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => void closeServiceModal()}>
              {editingService ? "Fermer" : "Annuler"}
            </Button>
            {!editingService ? <Button disabled={pending} onClick={() => void saveService()}>{pending ? "Creation..." : "Creer"}</Button> : null}
          </>
        }
      >
        <div className="form-grid" onBlurCapture={autoSaveServiceOnBlur}>
          {error ? <Notice kind="error">{error}</Notice> : null}
          <FormSection title="Prestation" description="Le nom, l'unite et le prix sont repris dans les devis.">
            <Field label="Nom" required><TextInput value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} /></Field>
            <Field label="Unite" required><SelectInput value={serviceForm.unit} onChange={(e) => setServiceForm({ ...serviceForm, unit: e.target.value as ServiceUnit })}>{serviceUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</SelectInput></Field>
            <Field label="Prix HT" required><NumberInput min={0} step="0.01" value={serviceForm.unitPriceHt} onChange={(e) => setServiceForm({ ...serviceForm, unitPriceHt: Number(e.target.value) })} /></Field>
            <Field label="Description" optional><TextInput value={serviceForm.description} onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })} /></Field>
          </FormSection>
        </div>
      </Modal>
    </div>
  );
}

function materialDemandUnit(material: Material) {
  return material.unit === "lot" && material.quantityPerLot ? "piece" : material.unit;
}

function materialPackaging(material: Material) {
  if (material.divisible) {
    return "Achat exact";
  }
  const quantity = material.quantityPerLot ?? 1;
  return `Lot de ${quantity.toLocaleString("fr-FR", { maximumFractionDigits: 4 })} ${formatUnit(materialDemandUnit(material))}`;
}

function formatUnit(unit?: string) {
  const labels: Record<string, string> = {
    piece: "piece",
    metre: "metre",
    m2: "m2",
    m3: "m3",
    litre: "litre",
    kilogramme: "kilogramme",
    lot: "lot",
  };
  return unit ? labels[unit] ?? unit : "";
}

function formatDimensions(material: Material) {
  const hasDimension = material.length !== undefined || material.width !== undefined || material.height !== undefined;
  if (!hasDimension) {
    return "-";
  }
  return [material.length, material.width, material.height].map((value) => value ?? "-").join(" x ");
}

function parseMaterialsCsv(input: string) {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return [];
  }
  const separator = lines[0].includes(";") ? ";" : ",";
  const headers = splitCsvLine(lines[0], separator).map(normalizeHeader);
  const rows = [];
  for (const line of lines.slice(1, 201)) {
    const values = splitCsvLine(line, separator);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""]));
    const name = pick(row, "nom", "name");
    if (!name) {
      continue;
    }
    const unit = normalizeMaterialUnit(pick(row, "unite", "unit"));
    rows.push({
      name,
      reference: optional(pick(row, "reference", "ref")),
      category: optional(pick(row, "categorie", "category")),
      supplier: optional(pick(row, "fournisseur", "supplier")),
      description: optional(pick(row, "description")),
      unit,
      purchasePriceHt: parseFrenchNumber(pick(row, "prix_achat_ht", "prix", "purchasepriceht")),
      divisible: parseBoolean(pick(row, "divisible"), true),
      quantityPerLot: optionalParsedNumber(pick(row, "quantite_par_lot", "quantityperlot")),
      length: optionalParsedNumber(pick(row, "longueur", "length")),
      width: optionalParsedNumber(pick(row, "largeur", "width")),
      height: optionalParsedNumber(pick(row, "hauteur", "height")),
      defaultWasteRate: optionalParsedNumber(pick(row, "taux_perte_defaut", "perte", "defaultwasterate")) ?? 0,
      active: true,
    });
  }
  return rows;
}

function splitCsvLine(line: string, separator: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (const character of line) {
    if (character === "\"") {
      quoted = !quoted;
      continue;
    }
    if (character === separator && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  cells.push(current);
  return cells;
}

function normalizeHeader(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9_]/g, "");
}

function pick(row: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const value = row[normalizeHeader(key)];
    if (value) {
      return value;
    }
  }
  return "";
}

function normalizeMaterialUnit(value: string): MaterialUnit {
  const normalized = normalizeHeader(value);
  const allowed: MaterialUnit[] = ["piece", "metre", "m2", "m3", "litre", "kilogramme", "lot"];
  return allowed.includes(normalized as MaterialUnit) ? normalized as MaterialUnit : "piece";
}

function parseBoolean(value: string, fallback: boolean) {
  const normalized = normalizeHeader(value);
  if (!normalized) {
    return fallback;
  }
  return ["1", "oui", "true", "yes", "y"].includes(normalized);
}

function parseFrenchNumber(value: string) {
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalParsedNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return parseFrenchNumber(trimmed);
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
