import { useMutation, useQuery } from "convex/react";
import { Boxes, BriefcaseBusiness, Edit3, Filter, Package, Plus, Ruler, Scissors, Trash2 } from "lucide-react";
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
  const materials = useQuery(api.materials.list, {});
  const services = useQuery(api.services.list, {});
  const createMaterial = useMutation(api.materials.create);
  const updateMaterial = useMutation(api.materials.update);
  const archiveMaterial = useMutation(api.materials.archive);
  const createService = useMutation(api.services.create);
  const updateService = useMutation(api.services.update);
  const archiveService = useMutation(api.services.archive);
  const [tab, setTab] = useState<"materials" | "services">(initialTab);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [materialForm, setMaterialForm] = useState(emptyMaterial);
  const [serviceForm, setServiceForm] = useState(emptyService);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [materialModal, setMaterialModal] = useState(false);
  const [serviceModal, setServiceModal] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    });
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
    });
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

  async function saveMaterial() {
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
      length: optionalNumber(materialForm.length),
      width: optionalNumber(materialForm.width),
      height: optionalNumber(materialForm.height),
    };
    try {
      if (editingMaterial) {
        await updateMaterial({ materialId: editingMaterial._id, ...payload });
      } else {
        await createMaterial(payload);
      }
      setMaterialModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible");
    } finally {
      setPending(false);
    }
  }

  async function saveService() {
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
      setServiceModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible");
    } finally {
      setPending(false);
    }
  }

  async function removeMaterial(materialId: Id<"materials">, name: string) {
    if (window.confirm(`Archiver ${name} ?`)) {
      await archiveMaterial({ materialId });
    }
  }

  async function removeService(serviceId: Id<"services">, name: string) {
    if (window.confirm(`Archiver ${name} ?`)) {
      await archiveService({ serviceId });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalogue"
        title={tab === "materials" ? "Materiaux" : "Prestations"}
        description={
          tab === "materials"
            ? "Declare ce que tu mesures sur chantier, puis comment tu l'achetes. Les devis reprennent exactement cette logique."
            : "Structure la main-d'oeuvre, les forfaits et les prix de vente reutilisables dans chaque devis."
        }
        actions={
          tab === "materials" ? (
            <>
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
            materialRows.length === 0 ? (
              <EmptyState title="Aucun materiau" action={<Button onClick={openCreateMaterial}>Ajouter un materiau</Button>} />
            ) : (
              <div className="catalog-grid">
                {materialRows.map((material) => (
                  <article key={material._id} className="material-card">
                    <div className="material-card-header">
                      <div className="avatar avatar-square"><Boxes className="h-4 w-4" /></div>
                      <div>
                        <strong>{material.name}</strong>
                        <span>{material.reference ?? "Sans reference"}</span>
                      </div>
                      <div className="row-actions">
                        <IconButton label="Modifier" onClick={() => openEditMaterial(material)}><Edit3 className="h-4 w-4" /></IconButton>
                        <IconButton label="Archiver" variant="danger" onClick={() => void removeMaterial(material._id, material.name)}><Trash2 className="h-4 w-4" /></IconButton>
                      </div>
                    </div>
                    <div className="material-card-body">
                      <MaterialFact label="Prix achat" value={formatCurrency(material.purchasePriceHt)} />
                      <MaterialFact label="Unite besoin" value={formatUnit(materialDemandUnit(material))} />
                      <MaterialFact label="Perte defaut" value={`${material.defaultWasteRate}%`} />
                      <MaterialFact label="Conditionnement" value={materialPackaging(material)} />
                    </div>
                    <div className="material-card-footer">
                      <Badge tone="indigo">{material.category ?? "Sans categorie"}</Badge>
                      {material.supplier ? <span>{material.supplier}</span> : null}
                      <Dimensions material={material} />
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : (
            <DataTable
              rows={serviceRows}
              rowKey={(service) => service._id}
              empty={<EmptyState title="Aucune prestation" action={<Button onClick={openCreateService}>Ajouter une prestation</Button>} />}
              columns={[
                { key: "name", header: "Nom", render: (service) => <strong>{service.name}</strong> },
                { key: "description", header: "Description", render: (service) => service.description ?? "-" },
                { key: "unit", header: "Unite", render: (service) => service.unit },
                { key: "price", header: "Prix HT", render: (service) => formatCurrency(service.unitPriceHt) },
                {
                  key: "actions",
                  header: "",
                  className: "actions-cell",
                  render: (service) => (
                    <div className="row-actions">
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
        open={materialModal}
        title={editingMaterial ? "Modifier le materiau" : "Nouveau materiau"}
        description="L'unite sert au besoin dans le devis. Le conditionnement sert uniquement a calculer ce qu'il faut acheter."
        onClose={() => setMaterialModal(false)}
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setMaterialModal(false)}>
              Annuler
            </Button>
            <Button disabled={pending} onClick={() => void saveMaterial()}>
              {pending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </>
        }
      >
        <div className="form-grid form-grid-3">
          {error ? <Notice kind="error">{error}</Notice> : null}
          <FormSection title="Identification" description="Le nom est obligatoire. Le reste sert au classement et a la recherche.">
            <Field label="Nom" required><TextInput value={materialForm.name} onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })} /></Field>
            <Field label="Reference" optional><TextInput value={materialForm.reference} onChange={(e) => setMaterialForm({ ...materialForm, reference: e.target.value })} /></Field>
            <Field label="Categorie" optional><TextInput value={materialForm.category} onChange={(e) => setMaterialForm({ ...materialForm, category: e.target.value })} /></Field>
            <Field label="Fournisseur" optional><TextInput value={materialForm.supplier} onChange={(e) => setMaterialForm({ ...materialForm, supplier: e.target.value })} /></Field>
          </FormSection>

          <FormSection title="Prix et besoin" description="Ces champs pilotent directement le calcul dans les devis.">
            <Field label="Unite du besoin" required hint="Ex: piece pour une poutre, m2 pour une plaque, metre pour un tasseau.">
              <SelectInput value={materialForm.unit} onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value as MaterialUnit })}>
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
            <Field label="Quantite contenue par achat" optional hint="Ex: lot de 2 poutres => 2. Boite de 200 vis => 200.">
              <NumberInput min={0} step="0.01" disabled={materialForm.divisible} value={materialForm.quantityPerLot} onChange={(e) => setMaterialForm({ ...materialForm, quantityPerLot: e.target.value })} />
            </Field>
          </FormSection>

          <FormSection title="Details facultatifs" description="Dimensions et description interne pour mieux qualifier le catalogue.">
            <Field label="Longueur" optional><NumberInput min={0} step="0.01" value={materialForm.length} onChange={(e) => setMaterialForm({ ...materialForm, length: e.target.value })} /></Field>
            <Field label="Largeur" optional><NumberInput min={0} step="0.01" value={materialForm.width} onChange={(e) => setMaterialForm({ ...materialForm, width: e.target.value })} /></Field>
            <Field label="Hauteur" optional><NumberInput min={0} step="0.01" value={materialForm.height} onChange={(e) => setMaterialForm({ ...materialForm, height: e.target.value })} /></Field>
            <Field label="Description" optional><TextArea value={materialForm.description} onChange={(e) => setMaterialForm({ ...materialForm, description: e.target.value })} /></Field>
          </FormSection>
        </div>
      </Modal>

      <Modal
        open={serviceModal}
        title={editingService ? "Modifier la prestation" : "Nouvelle prestation"}
        description="Ajoute une ligne de main d'oeuvre ou un forfait reutilisable dans les devis."
        onClose={() => setServiceModal(false)}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setServiceModal(false)}>
              Annuler
            </Button>
            <Button disabled={pending} onClick={() => void saveService()}>
              {pending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </>
        }
      >
        <div className="form-grid">
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

function MaterialFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
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

function Dimensions({ material }: { material: Material }) {
  const hasDimension = material.length !== undefined || material.width !== undefined || material.height !== undefined;
  if (!hasDimension) {
    return "-";
  }
  return (
    <span className="contact-cell">
      <Ruler className="h-4 w-4" />
      {[material.length, material.width, material.height].map((value) => value ?? "-").join(" x ")}
    </span>
  );
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
