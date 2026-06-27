import { useQuery } from "convex/react";
import { CalendarRange, Check, Eye, EyeOff, GripVertical, Plus, RotateCcw, SlidersHorizontal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "#convex/_generated/api";
import { Button, Field, NumberInput, PageHeader, Panel, SelectInput, TextInput } from "@/components/ui/app";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

type WidgetId = "financial" | "pipeline" | "documents" | "alerts" | "margin" | "custom";
type WidgetSize = "normal" | "wide";
type MetricFormat = "currency" | "number" | "percent";
type CustomStatDisplay = "number" | "target";
type PeriodPreset = "month" | "quarter" | "year" | "custom";

type WidgetConfig = {
  id: WidgetId;
  title: string;
  visible: boolean;
  size: WidgetSize;
};

type CustomStat = {
  id: string;
  label: string;
  metricKey: MetricKey;
  display: CustomStatDisplay;
  target?: number;
};

type MetricKey =
  | "quotesTtc"
  | "acceptedQuotesTtc"
  | "paidInvoicesTtc"
  | "unpaidInvoicesTtc"
  | "overdueInvoicesTtc"
  | "estimatedMarginHt"
  | "estimatedMarginRate"
  | "conversionRate"
  | "clients"
  | "materials"
  | "quotes"
  | "invoices"
  | "quotesToFollowUp"
  | "overdueInvoices";

type DashboardStats = typeof api.app.dashboard["_returnType"];
type BusinessPeriodStats = typeof api.app.businessStats["_returnType"];

const storageKey = "boorise:stats-layout";
const customStorageKey = "boorise:custom-stats";
const chartColors = ["#491474", "#622B86", "#E54715", "#E5D2BA", "#9b6f45", "#c84f26"];

const defaultWidgets: WidgetConfig[] = [
  { id: "financial", title: "Financier", visible: true, size: "wide" },
  { id: "pipeline", title: "Pipeline", visible: true, size: "normal" },
  { id: "documents", title: "Volume", visible: true, size: "normal" },
  { id: "alerts", title: "Risques", visible: true, size: "normal" },
  { id: "margin", title: "Marge", visible: true, size: "normal" },
  { id: "custom", title: "Stats perso", visible: true, size: "wide" },
];

const metricOptions: Array<{
  key: MetricKey;
  label: string;
  format: MetricFormat;
  read: (dashboard: DashboardStats | undefined) => number;
}> = [
  { key: "quotesTtc", label: "Devis total TTC", format: "currency", read: (dashboard) => dashboard?.totals.quotesTtc ?? 0 },
  { key: "acceptedQuotesTtc", label: "Devis acceptes TTC", format: "currency", read: (dashboard) => dashboard?.totals.acceptedQuotesTtc ?? 0 },
  { key: "paidInvoicesTtc", label: "Factures payees TTC", format: "currency", read: (dashboard) => dashboard?.totals.paidInvoicesTtc ?? 0 },
  { key: "unpaidInvoicesTtc", label: "A encaisser TTC", format: "currency", read: (dashboard) => dashboard?.totals.unpaidInvoicesTtc ?? 0 },
  { key: "overdueInvoicesTtc", label: "Retard TTC", format: "currency", read: (dashboard) => dashboard?.totals.overdueInvoicesTtc ?? 0 },
  { key: "estimatedMarginHt", label: "Marge estimee HT", format: "currency", read: (dashboard) => dashboard?.totals.estimatedMarginHt ?? 0 },
  { key: "estimatedMarginRate", label: "Taux marge", format: "percent", read: (dashboard) => dashboard?.totals.estimatedMarginRate ?? 0 },
  { key: "conversionRate", label: "Conversion", format: "percent", read: (dashboard) => dashboard?.totals.conversionRate ?? 0 },
  { key: "clients", label: "Clients", format: "number", read: (dashboard) => dashboard?.counts.clients ?? 0 },
  { key: "materials", label: "Materiaux", format: "number", read: (dashboard) => dashboard?.counts.materials ?? 0 },
  { key: "quotes", label: "Devis", format: "number", read: (dashboard) => dashboard?.counts.quotes ?? 0 },
  { key: "invoices", label: "Factures", format: "number", read: (dashboard) => dashboard?.counts.invoices ?? 0 },
  { key: "quotesToFollowUp", label: "Devis a relancer", format: "number", read: (dashboard) => dashboard?.pipeline.quotesToFollowUp ?? 0 },
  { key: "overdueInvoices", label: "Factures en retard", format: "number", read: (dashboard) => dashboard?.pipeline.overdueInvoices ?? 0 },
];

export function StatsPage() {
  const dashboard = useQuery(api.app.dashboard);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("month");
  const [customStart, setCustomStart] = useState(dateInput(startOfMonth(new Date())));
  const [customEnd, setCustomEnd] = useState(dateInput(endOfDay(new Date())));
  const periodRange = useMemo(() => buildPeriodRange(periodPreset, customStart, customEnd), [periodPreset, customStart, customEnd]);
  const periodStats = useQuery(api.app.businessStats, { startAt: periodRange.startAt, endAt: periodRange.endAt });
  const [widgets, setWidgets] = useState(loadWidgetConfig);
  const [customStats, setCustomStats] = useState(loadCustomStats);
  const [customForm, setCustomForm] = useState({ label: "", metricKey: "quotesTtc" as MetricKey, display: "number" as CustomStatDisplay, target: "" });
  const [editMode, setEditMode] = useState(false);
  const [draggedWidgetId, setDraggedWidgetId] = useState<WidgetId | null>(null);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(widgets));
  }, [widgets]);

  useEffect(() => {
    localStorage.setItem(customStorageKey, JSON.stringify(customStats));
  }, [customStats]);

  const financialData = useMemo(() => [
    { name: "Devis", value: dashboard?.totals.quotesTtc ?? 0 },
    { name: "Acceptes", value: dashboard?.totals.acceptedQuotesTtc ?? 0 },
    { name: "Payees", value: dashboard?.totals.paidInvoicesTtc ?? 0 },
    { name: "A encaisser", value: dashboard?.totals.unpaidInvoicesTtc ?? 0 },
  ], [dashboard]);

  const pipelineData = useMemo(() => [
    { name: "Brouillons", value: dashboard?.pipeline.draft ?? 0 },
    { name: "Envoyes", value: dashboard?.pipeline.sent ?? 0 },
    { name: "Acceptes", value: dashboard?.pipeline.accepted ?? 0 },
    { name: "Refuses", value: dashboard?.pipeline.refused ?? 0 },
    { name: "Factures", value: dashboard?.pipeline.invoiced ?? 0 },
  ], [dashboard]);

  const documentData = useMemo(() => [
    { name: "Clients", value: dashboard?.counts.clients ?? 0 },
    { name: "Materiaux", value: dashboard?.counts.materials ?? 0 },
    { name: "Devis", value: dashboard?.counts.quotes ?? 0 },
    { name: "Factures", value: dashboard?.counts.invoices ?? 0 },
  ], [dashboard]);

  const alertData = useMemo(() => [
    { name: "Retard", value: dashboard?.alerts.overdueInvoices ?? 0 },
    { name: "Echeance", value: dashboard?.alerts.dueSoonInvoices ?? 0 },
    { name: "Relance", value: dashboard?.alerts.quotesToFollowUp ?? 0 },
    { name: "Expires", value: dashboard?.alerts.expiredQuotes ?? 0 },
    { name: "Catalogue", value: dashboard?.alerts.lowCatalogDetail ?? 0 },
  ], [dashboard]);

  function updateWidget(id: WidgetId, patch: Partial<WidgetConfig>) {
    setWidgets((current) => current.map((widget) => widget.id === id ? { ...widget, ...patch } : widget));
  }

  function moveWidget(targetId: WidgetId) {
    if (!draggedWidgetId || draggedWidgetId === targetId) {
      return;
    }

    setWidgets((current) => {
      const draggedIndex = current.findIndex((widget) => widget.id === draggedWidgetId);
      const targetIndex = current.findIndex((widget) => widget.id === targetId);
      if (draggedIndex < 0 || targetIndex < 0) {
        return current;
      }
      const next = [...current];
      const [dragged] = next.splice(draggedIndex, 1);
      next.splice(targetIndex, 0, dragged);
      return next;
    });
  }

  function resetConfiguration() {
    setWidgets(defaultWidgets);
    setCustomStats([]);
    setCustomForm({ label: "", metricKey: "quotesTtc", display: "number", target: "" });
  }

  function addCustomStat() {
    const metric = metricOptions.find((option) => option.key === customForm.metricKey);
    const label = customForm.label.trim() || metric?.label || "Stat";
    const target = optionalPositiveNumber(customForm.target);
    setCustomStats((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        label,
        metricKey: customForm.metricKey,
        display: customForm.display,
        target,
      },
    ]);
    setCustomForm({ label: "", metricKey: customForm.metricKey, display: customForm.display, target: "" });
  }

  const visibleWidgets = widgets.filter((widget) => widget.visible);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stats"
        description="Indicateurs, graphiques, periode business et vues configurables."
        actions={
          <Button type="button" variant={editMode ? "secondary" : "outline"} onClick={() => setEditMode((current) => !current)}>
            {editMode ? <Check className="h-4 w-4" /> : <SlidersHorizontal className="h-4 w-4" />}
            {editMode ? "Terminer" : "Personnaliser"}
          </Button>
        }
      />

      <PeriodBusinessPanel
        preset={periodPreset}
        onPresetChange={setPeriodPreset}
        customStart={customStart}
        customEnd={customEnd}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
        periodLabel={periodRange.label}
        stats={periodStats}
      />

      <div className={cn("stats-layout", editMode && "stats-layout-editing")}>
        <div className={cn("stats-board", editMode && "stats-board-editing")}>
          {visibleWidgets.map((widget) => (
            <section
              className={cn(
                "stats-widget",
                widget.size === "wide" && "stats-widget-wide",
                editMode && "stats-widget-editing",
                draggedWidgetId === widget.id && "stats-widget-dragging",
              )}
              draggable={editMode}
              key={widget.id}
              onDragEnd={() => setDraggedWidgetId(null)}
              onDragOver={(event) => {
                if (!editMode) {
                  return;
                }
                event.preventDefault();
              }}
              onDragStart={(event) => {
                if (!editMode) {
                  return;
                }
                setDraggedWidgetId(widget.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", widget.id);
              }}
              onDrop={(event) => {
                if (!editMode) {
                  return;
                }
                event.preventDefault();
                moveWidget(widget.id);
                setDraggedWidgetId(null);
              }}
            >
              {editMode ? (
                <div className="stats-widget-tools">
                  <span><GripVertical className="h-4 w-4" /> Deplacer</span>
                  <button type="button" onClick={() => updateWidget(widget.id, { visible: false })}>Masquer</button>
                </div>
              ) : null}
              {widget.id === "financial" ? <FinancialWidget data={financialData} dashboard={dashboard} /> : null}
              {widget.id === "pipeline" ? <BarWidget title="Pipeline devis" data={pipelineData} /> : null}
              {widget.id === "documents" ? <DocumentsWidget data={documentData} /> : null}
              {widget.id === "alerts" ? <BarWidget title="Risques actifs" data={alertData} /> : null}
              {widget.id === "margin" ? <MarginWidget dashboard={dashboard} /> : null}
              {widget.id === "custom" ? <CustomStatsWidget customStats={customStats} dashboard={dashboard} onRemove={(id) => setCustomStats((current) => current.filter((stat) => stat.id !== id))} /> : null}
            </section>
          ))}
          {visibleWidgets.length === 0 ? (
            <div className="stats-empty-config">
              <strong>Aucune carte visible</strong>
              <span>Reactive au moins un widget depuis la configuration.</span>
            </div>
          ) : null}
        </div>

        {editMode ? <Panel title="Configuration" description="Widgets visibles, tailles, ordre et stats personnalisees.">
          <div className="stats-config">
            {widgets.map((widget) => (
              <div className="stats-config-row" key={widget.id}>
                <button type="button" className={widget.visible ? "stats-toggle active" : "stats-toggle"} onClick={() => updateWidget(widget.id, { visible: !widget.visible })}>
                  {widget.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <strong>{widget.title}</strong>
                <SelectInput value={widget.size} onChange={(event) => updateWidget(widget.id, { size: event.target.value as WidgetSize })}>
                  <option value="normal">Normal</option>
                  <option value="wide">Large</option>
                </SelectInput>
              </div>
            ))}

            <div className="stats-custom-form">
              <Field label="Nom" optional>
                <TextInput value={customForm.label} onChange={(event) => setCustomForm({ ...customForm, label: event.target.value })} />
              </Field>
              <Field label="Mesure" required>
                <SelectInput value={customForm.metricKey} onChange={(event) => setCustomForm({ ...customForm, metricKey: event.target.value as MetricKey })}>
                  {metricOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                </SelectInput>
              </Field>
              <Field label="Affichage" required>
                <SelectInput value={customForm.display} onChange={(event) => setCustomForm({ ...customForm, display: event.target.value as CustomStatDisplay })}>
                  <option value="number">Chiffre seul</option>
                  <option value="target">Objectif</option>
                </SelectInput>
              </Field>
              {customForm.display === "target" ? (
                <Field label="Objectif" optional>
                  <NumberInput min={0} step="0.01" value={customForm.target} onChange={(event) => setCustomForm({ ...customForm, target: event.target.value })} />
                </Field>
              ) : null}
              <Button type="button" variant="secondary" onClick={addCustomStat}>
                <Plus className="h-4 w-4" />
                Ajouter
              </Button>
            </div>

            <Button type="button" variant="outline" onClick={resetConfiguration}>
              <RotateCcw className="h-4 w-4" />
              Reinitialiser
            </Button>
          </div>
        </Panel> : null}
      </div>
    </div>
  );
}

function PeriodBusinessPanel({
  preset,
  onPresetChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  periodLabel,
  stats,
}: {
  preset: PeriodPreset;
  onPresetChange: (preset: PeriodPreset) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
  periodLabel: string;
  stats: BusinessPeriodStats | undefined;
}) {
  return (
    <Panel
      title="Pilotage par periode"
      description={periodLabel}
      actions={<CalendarRange className="h-5 w-5 text-[#622B86]" />}
      className="period-business-panel"
    >
      <div className="period-controls">
        <Field label="Periode" required>
          <SelectInput value={preset} onChange={(event) => onPresetChange(event.target.value as PeriodPreset)}>
            <option value="month">Mois en cours</option>
            <option value="quarter">Trimestre en cours</option>
            <option value="year">Annee en cours</option>
            <option value="custom">Personnalisee</option>
          </SelectInput>
        </Field>
        {preset === "custom" ? (
          <>
            <Field label="Debut" required>
              <TextInput type="date" value={customStart} onChange={(event) => onCustomStartChange(event.target.value)} />
            </Field>
            <Field label="Fin" required>
              <TextInput type="date" value={customEnd} onChange={(event) => onCustomEndChange(event.target.value)} />
            </Field>
          </>
        ) : null}
      </div>

      <div className="business-kpi-grid">
        <StatsKpi label="CA signe" value={formatCurrency(stats?.totals.signedRevenueTtc ?? 0)} />
        <StatsKpi label="CA facture" value={formatCurrency(stats?.totals.billedRevenueTtc ?? 0)} />
        <StatsKpi label="Taux acceptation" value={`${(stats?.totals.acceptanceRate ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}%`} />
        <StatsKpi label="Panier moyen" value={formatCurrency(stats?.totals.averageBasketTtc ?? 0)} />
        <StatsKpi label="Marge reelle" value={formatCurrency(stats?.totals.realMarginHt ?? 0)} />
        <StatsKpi label="Taux marge" value={`${(stats?.totals.realMarginRate ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}%`} />
      </div>
    </Panel>
  );
}

function FinancialWidget({ data, dashboard }: { data: Array<{ name: string; value: number }>; dashboard: DashboardStats | undefined }) {
  return (
    <Panel title="Financier" description="Montants principaux du portefeuille.">
      <div className="stats-kpi-grid">
        <StatsKpi label="Devis total" value={formatCurrency(dashboard?.totals.quotesTtc ?? 0)} />
        <StatsKpi label="Signe" value={formatCurrency(dashboard?.totals.acceptedQuotesTtc ?? 0)} />
        <StatsKpi label="Paye" value={formatCurrency(dashboard?.totals.paidInvoicesTtc ?? 0)} />
        <StatsKpi label="A encaisser" value={formatCurrency(dashboard?.totals.unpaidInvoicesTtc ?? 0)} />
      </div>
      <ChartFrame>
        <BarChart data={data}>
          <CartesianGrid stroke="#ead8c3" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${Number(value) / 1000}k`} />
          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}
          </Bar>
        </BarChart>
      </ChartFrame>
    </Panel>
  );
}

function BarWidget({ title, data }: { title: string; data: Array<{ name: string; value: number }> }) {
  return (
    <Panel title={title}>
      <ChartFrame>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 14 }}>
          <CartesianGrid stroke="#ead8c3" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={78} tickLine={false} axisLine={false} />
          <Tooltip />
          <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="#622B86" />
        </BarChart>
      </ChartFrame>
    </Panel>
  );
}

function DocumentsWidget({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <Panel title="Volume">
      <ChartFrame>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>
            {data.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ChartFrame>
      <div className="stats-legend">
        {data.map((entry, index) => (
          <span key={entry.name}><i style={{ background: chartColors[index % chartColors.length] }} />{entry.name}: {entry.value}</span>
        ))}
      </div>
    </Panel>
  );
}

function MarginWidget({ dashboard }: { dashboard: DashboardStats | undefined }) {
  const rate = dashboard?.totals.estimatedMarginRate ?? 0;
  const cappedRate = Math.min(100, Math.max(0, rate));
  return (
    <Panel title="Marge">
      <div className="margin-widget">
        <span>Marge estimee</span>
        <strong>{formatCurrency(dashboard?.totals.estimatedMarginHt ?? 0)}</strong>
        <div className="margin-meter"><i style={{ width: `${cappedRate}%` }} /></div>
        <small>{rate.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}% sur lignes chiffrees</small>
      </div>
      <div className="stats-kpi-grid stats-kpi-grid-2">
        <StatsKpi label="Conversion" value={`${dashboard?.totals.conversionRate ?? 0}%`} />
        <StatsKpi label="Gagne" value={formatCurrency(dashboard?.totals.acceptedQuotesTtc ?? 0)} />
      </div>
    </Panel>
  );
}

function CustomStatsWidget({
  customStats,
  dashboard,
  onRemove,
}: {
  customStats: CustomStat[];
  dashboard: DashboardStats | undefined;
  onRemove: (id: string) => void;
}) {
  return (
    <Panel title="Stats perso">
      {customStats.length === 0 ? (
        <div className="empty-state"><strong>Aucune stat perso</strong></div>
      ) : (
        <div className="custom-stats-grid">
          {customStats.map((stat) => {
            const metric = metricOptions.find((option) => option.key === stat.metricKey) ?? metricOptions[0];
            const value = metric.read(dashboard);
            const showTarget = stat.display === "target";
            const progress = showTarget && stat.target && stat.target > 0 ? Math.min(100, Math.max(0, (value / stat.target) * 100)) : undefined;
            return (
              <div className={cn("custom-stat-card", stat.display === "number" && "custom-stat-number")} key={stat.id}>
                <button type="button" aria-label="Supprimer" onClick={() => onRemove(stat.id)}><Trash2 className="h-4 w-4" /></button>
                <span>{stat.label}</span>
                <strong>{formatMetric(value, metric.format)}</strong>
                {showTarget && stat.target ? <small>Objectif {formatMetric(stat.target, metric.format)}</small> : null}
                {progress !== undefined ? <div className="margin-meter"><i style={{ width: `${progress}%` }} /></div> : null}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function ChartFrame({ children }: { children: React.ReactElement }) {
  return (
    <div className="chart-frame">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

function StatsKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="stats-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatMetric(value: number, format: MetricFormat) {
  if (format === "currency") {
    return formatCurrency(value);
  }
  if (format === "percent") {
    return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}%`;
  }
  return value.toLocaleString("fr-FR");
}

function optionalPositiveNumber(value: string) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function loadWidgetConfig(): WidgetConfig[] {
  const parsed = readJson<WidgetConfig[]>(storageKey);
  if (!parsed) {
    return defaultWidgets;
  }

  const defaultsById = new Map(defaultWidgets.map((widget) => [widget.id, widget]));
  const orderedSaved = parsed
    .map((saved) => {
      const fallback = defaultsById.get(saved.id);
      return fallback
        ? { ...fallback, visible: saved.visible, size: saved.size === "wide" ? "wide" : "normal" }
        : null;
    })
    .filter((widget): widget is WidgetConfig => widget !== null);
  const missing = defaultWidgets.filter((widget) => !orderedSaved.some((saved) => saved.id === widget.id));

  return [...orderedSaved, ...missing];
}

function loadCustomStats(): CustomStat[] {
  const parsed = readJson<CustomStat[]>(customStorageKey);
  if (!parsed) {
    return [];
  }
  return parsed
    .filter((stat) => metricOptions.some((option) => option.key === stat.metricKey))
    .map((stat) => ({ ...stat, display: stat.display === "target" ? "target" : "number" }));
}

function readJson<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}

function buildPeriodRange(preset: PeriodPreset, customStart: string, customEnd: string) {
  const now = new Date();
  if (preset === "quarter") {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    const start = new Date(now.getFullYear(), quarterStartMonth, 1);
    const end = endOfDay(new Date(now.getFullYear(), quarterStartMonth + 3, 0));
    return { startAt: start.getTime(), endAt: end.getTime(), label: `Du ${formatDateLabel(start)} au ${formatDateLabel(end)}` };
  }
  if (preset === "year") {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = endOfDay(new Date(now.getFullYear(), 11, 31));
    return { startAt: start.getTime(), endAt: end.getTime(), label: `Annee ${now.getFullYear()}` };
  }
  if (preset === "custom") {
    const start = parseDateInput(customStart, startOfMonth(now));
    const end = endOfDay(parseDateInput(customEnd, now));
    return { startAt: start.getTime(), endAt: end.getTime(), label: `Du ${formatDateLabel(start)} au ${formatDateLabel(end)}` };
  }

  const start = startOfMonth(now);
  const end = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  return { startAt: start.getTime(), endAt: end.getTime(), label: `Mois de ${now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}` };
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function parseDateInput(value: string, fallback: Date) {
  if (!value) {
    return fallback;
  }
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isFinite(parsed.getTime()) ? parsed : fallback;
}

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
