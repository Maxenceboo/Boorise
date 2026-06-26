import type {
  ChangeEvent,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useEffect, useId, useMemo, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "icon";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-[#E54715] text-white hover:bg-[#c93d11] shadow-sm shadow-orange-200",
  secondary: "bg-[#622B86] text-white hover:bg-[#491474] shadow-sm shadow-purple-200",
  outline: "border border-[#ddc6aa] bg-[#fffaf3] text-[#491474] hover:bg-[#f1e3d1]",
  ghost: "text-[#622B86] hover:bg-[#f0e5f5] hover:text-[#491474]",
  danger: "bg-[#E54715] text-white hover:bg-[#c93d11] shadow-sm shadow-orange-200",
  success: "bg-[#622B86] text-white hover:bg-[#491474] shadow-sm shadow-purple-200",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  icon: "h-9 w-9 p-0",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-semibold transition disabled:pointer-events-none disabled:opacity-50",
        "clickable-action select-none transition-all duration-150 active:scale-[0.98]",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    />
  );
}

export function IconButton({
  label,
  variant = "ghost",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  variant?: ButtonVariant;
}) {
  return <Button aria-label={label} title={label} size="icon" variant={variant} {...props} />;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  className,
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("panel", className)}>
      {(title || description || actions) ? (
        <div className="panel-header">
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="panel-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  detail,
  icon,
  tone = "indigo",
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  icon?: ReactNode;
  tone?: "indigo" | "emerald" | "amber" | "rose" | "cyan";
}) {
  return (
    <section className={cn("stat-card", `stat-${tone}`)}>
      {icon ? <div className="stat-icon">{icon}</div> : null}
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {detail ? <small>{detail}</small> : null}
      </div>
    </section>
  );
}

export function Field({
  label,
  hint,
  error,
  className,
  required,
  legalRequired,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  required?: boolean;
  legalRequired?: boolean;
  optional?: boolean;
  children: ReactNode;
}) {
  const badge = legalRequired
    ? <b className="legal-required">Legal obligatoire</b>
    : required
      ? <b>Obligatoire</b>
      : optional
        ? <i>Facultatif</i>
        : null;

  return (
    <label className={cn("field", className)}>
      <span className="field-label">
        <span>{label}</span>
        {badge}
      </span>
      {children}
      {hint ? <small>{hint}</small> : null}
      {error ? <em>{error}</em> : null}
    </label>
  );
}

export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("form-section", className)}>
      <div className="form-section-header">
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="form-section-grid">{children}</div>
    </section>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("input", className)} {...props} />;
}

export function NumberInput({ className, min, max, onChange, onBlur, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  function normalize(event: ChangeEvent<HTMLInputElement>) {
    const normalized = clampNumberInput(event.currentTarget.value, min, max);
    if (normalized !== event.currentTarget.value) {
      event.currentTarget.value = normalized;
    }
  }

  return (
    <input
      className={cn("input", className)}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      onChange={(event) => {
        normalize(event);
        onChange?.(event);
      }}
      onBlur={(event) => {
        normalize(event);
        onBlur?.(event);
      }}
      {...props}
    />
  );
}

function clampNumberInput(value: string, min: InputHTMLAttributes<HTMLInputElement>["min"], max: InputHTMLAttributes<HTMLInputElement>["max"]) {
  if (value.trim() === "") {
    return value;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return "";
  }

  const minNumber = boundToNumber(min);
  const maxNumber = boundToNumber(max);
  const clamped = Math.min(maxNumber ?? parsed, Math.max(minNumber ?? parsed, parsed));
  return clamped === parsed ? value : String(clamped);
}

function boundToNumber(value: InputHTMLAttributes<HTMLInputElement>["min"]) {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function SelectInput({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn("input", className)} {...props}>
      {children}
    </select>
  );
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("input min-h-24 resize-y py-2", className)} {...props} />;
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "indigo" | "emerald" | "amber" | "rose" | "cyan";
}) {
  return <span className={cn("badge", `badge-${tone}`)}>{children}</span>;
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="toolbar">{children}</div>;
}

export function SearchInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <TextInput className="search-input" type="search" {...props} />;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={cn("modal", `modal-${size}`)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-block">
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <IconButton className="modal-close" label="Fermer" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

export function DataTable<T>({
  rows,
  columns,
  empty,
  rowKey,
  onRowClick,
  selectedKey,
  density = "comfortable",
  loading = false,
}: {
  rows: T[];
  columns: Array<{
    key: string;
    header: string;
    className?: string;
    render: (row: T) => ReactNode;
    sortValue?: (row: T) => string | number | boolean | null | undefined;
    sortable?: boolean;
  }>;
  empty?: ReactNode;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  density?: "compact" | "comfortable";
  loading?: boolean;
}) {
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const sortedRows = useMemo(() => {
    if (!sort) {
      return rows;
    }
    const column = columns.find((entry) => entry.key === sort.key);
    if (!column?.sortValue) {
      return rows;
    }
    return [...rows].sort((left, right) => compareSortValues(column.sortValue!(left), column.sortValue!(right), sort.direction));
  }, [columns, rows, sort]);

  function toggleSort(column: { key: string; sortValue?: (row: T) => string | number | boolean | null | undefined; sortable?: boolean }) {
    if (column.sortable === false || !column.sortValue) {
      return;
    }
    setSort((current) => {
      if (current?.key !== column.key) {
        return { key: column.key, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { key: column.key, direction: "desc" };
      }
      return null;
    });
  }

  if (loading) {
    return (
      <div className={cn("table-wrap", `table-${density}`)}>
        <table className="data-table data-table-loading" aria-busy="true">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={column.className}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((column) => (
                  <td key={column.key} className={column.className}>
                    <span className="table-skeleton" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (rows.length === 0) {
    return <>{empty ?? <EmptyState title="Aucune donnee" />}</>;
  }

  return (
    <div className={cn("table-wrap", `table-${density}`)}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => {
              const sortable = column.sortable !== false && !!column.sortValue;
              const active = sort?.key === column.key;
              return (
                <th key={column.key} className={column.className} aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}>
                  {sortable ? (
                    <button type="button" className="sort-header" onClick={() => toggleSort(column)}>
                      <span>{column.header}</span>
                      <i>{active ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}</i>
                    </button>
                  ) : column.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => {
            const key = rowKey(row);
            return (
              <tr
                key={key}
                className={cn(onRowClick && "clickable-row", selectedKey === key && "row-selected")}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((column) => (
                  <td key={column.key} className={column.className}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function compareSortValues(
  left: string | number | boolean | null | undefined,
  right: string | number | boolean | null | undefined,
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
  const normalizedLeft = String(left).toLocaleLowerCase("fr-FR");
  const normalizedRight = String(right).toLocaleLowerCase("fr-FR");
  return normalizedLeft.localeCompare(normalizedRight, "fr-FR", { numeric: true, sensitivity: "base" }) * multiplier;
}

export function Notice({
  kind = "info",
  children,
}: {
  kind?: "info" | "success" | "error" | "warning";
  children: ReactNode;
}) {
  return <div className={cn("notice", `notice-${kind}`)}>{children}</div>;
}
