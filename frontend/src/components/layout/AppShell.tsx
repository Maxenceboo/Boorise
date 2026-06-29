import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import {
  Boxes,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  FileCheck2,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import { Button, IconButton } from "@/components/ui/app";
import { useSeo } from "@/lib/seo";
import { cn } from "@/lib/utils";

type NavItemConfig = {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  aliases?: string[];
  requiresAccountantAccess?: boolean;
};

type NavSectionConfig = {
  label: string;
  items: NavItemConfig[];
};

const mobilePrimaryRoutes = ["/dashboard", "/clients", "/devis", "/factures", "/materiaux"];

const navSections: NavSectionConfig[] = [
  {
    label: "Vue d'ensemble",
    items: [
      { to: "/dashboard", label: "Dashboard", description: "Actions et priorites", icon: LayoutDashboard },
      { to: "/stats", label: "Stats", description: "Indicateurs et graphiques", icon: BarChart3 },
    ],
  },
  {
    label: "Commerce",
    items: [
      { to: "/clients", label: "Clients", description: "CRM simple", icon: UsersRound },
      { to: "/devis", label: "Devis", description: "Chiffrage chantier", icon: FileText },
      { to: "/factures", label: "Factures", description: "Suivi paiement", icon: FileCheck2 },
    ],
  },
  {
    label: "Ressources",
    items: [
      { to: "/materiaux", label: "Catalogue", description: "Materiaux et prestations", icon: Boxes, aliases: ["/prestations"] },
    ],
  },
  {
    label: "Administration",
    items: [
      { to: "/parametres", label: "Entreprise", description: "Profil et defauts", icon: Building2 },
      { to: "/equipe", label: "Equipe", description: "Membres et invitations", icon: ShieldCheck },
      { to: "/comptable", label: "Comptable", description: "Acces externes", icon: BriefcaseBusiness, requiresAccountantAccess: true },
    ],
  },
] ;

const navigation = navSections.flatMap((section) => section.items);

export function AppShell() {
  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  const current = useQuery(api.app.current);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchResults = useQuery(api.search.global, globalSearch.trim().length >= 2 ? { query: globalSearch } : "skip");
  const hasAccountantAccess = (current?.accountantAccesses?.length ?? 0) > 0;
  const visibleNavSections = useMemo(() => navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.requiresAccountantAccess || hasAccountantAccess || pathname === item.to),
    }))
    .filter((section) => section.items.length > 0), [hasAccountantAccess, pathname]);
  const visibleNavigation = visibleNavSections.flatMap((section) => section.items);
  const active = visibleNavigation.find((item) => item.to === pathname || item.aliases?.includes(pathname))
    ?? navigation.find((item) => item.to === pathname)
    ?? visibleNavigation[0]
    ?? navigation[0];
  useSeo({
    title: `${active.label} - Boorise`,
    description: `${active.description} dans l'espace prive Boorise.`,
    canonicalPath: "/",
    noIndex: true,
  });

  return (
    <div className="app-shell">
      <Sidebar className="hidden lg:flex" navSections={visibleNavSections} organization={current?.organization ?? null} pathname={pathname} onNavigate={() => setMobileOpen(false)} />

      {mobileOpen ? (
        <div className="mobile-nav">
          <button className="mobile-nav-scrim" aria-label="Fermer le menu" onClick={() => setMobileOpen(false)} />
          <Sidebar className="relative z-10 flex h-full w-80" navSections={visibleNavSections} organization={current?.organization ?? null} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
        </div>
      ) : null}

      <div className="app-main">
        <header className="topbar">
          <div className="flex min-w-0 items-center gap-3">
            <IconButton className="lg:hidden" label="Ouvrir le menu" onClick={() => setMobileOpen(true)}>
              <Menu className="h-4 w-4" />
            </IconButton>
            <div className="topbar-company min-w-0">
              <div className="truncate text-sm font-semibold text-slate-950">{current?.organization?.name ?? "Entreprise"}</div>
              <div className="topbar-section-name truncate text-xs text-slate-500">
                <span>{active.label}</span>
                <span className="topbar-section-description"> - {active.description}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="global-search">
              <Search className="h-4 w-4" />
              <input
                value={globalSearch}
                placeholder="Rechercher client, devis, facture, materiau..."
                onChange={(event) => {
                  setGlobalSearch(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
              />
              {searchOpen && globalSearch.trim().length >= 2 ? (
                <GlobalSearchResults
                  results={searchResults}
                  onClose={() => {
                    setSearchOpen(false);
                    setGlobalSearch("");
                  }}
                  onNavigate={(href, id, group) => {
                    rememberFocusedResult(group, id);
                    setSearchOpen(false);
                    setGlobalSearch("");
                    void navigate({ to: href });
                  }}
                />
              ) : null}
            </div>
            <Button className="hidden md:inline-flex" size="sm" onClick={() => void navigate({ to: "/devis" })}>
              <FileText className="h-4 w-4" />
              Devis
            </Button>
            <Button className="hidden md:inline-flex" variant="outline" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" />
              Deconnexion
            </Button>
            <IconButton className="md:hidden" label="Deconnexion" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" />
            </IconButton>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
        <MobileBottomNav items={visibleNavigation.filter((item) => mobilePrimaryRoutes.includes(item.to))} pathname={pathname} onNavigate={(href) => void navigate({ to: href })} />
      </div>
    </div>
  );
}

function Sidebar({
  className,
  navSections,
  organization,
  pathname,
  onNavigate,
}: {
  className?: string;
  navSections: NavSectionConfig[];
  organization: Doc<"organizations"> | null;
  pathname: string;
  onNavigate: () => void;
}) {
  const companyName = organization?.name ?? "Mon entreprise";
  return (
    <aside className={cn("sidebar", className)}>
      <div className="brand-row">
        <div className="brand-mark company-brand-mark">
          {organization?.logoUrl ? <img src={organization.logoUrl} alt="" /> : companyInitial(companyName)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-base font-black text-slate-950">{companyName}</div>
          <div className="truncate text-xs text-slate-500">Espace gere avec Boorise</div>
        </div>
        <IconButton className="ml-auto lg:hidden" label="Fermer le menu" onClick={onNavigate}>
          <X className="h-4 w-4" />
        </IconButton>
      </div>

      <nav className="nav-list">
        {navSections.map((section) => (
          <div className="nav-section" key={section.label}>
            <p className="nav-section-label">{section.label}</p>
            {section.items.map((item) => (
              <NavItem key={item.to} item={item} pathname={pathname} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-note">
        <strong>Atelier de chiffrage</strong>
        <p>Le catalogue alimente les devis: pertes, lots, achats reels et marges.</p>
      </div>
    </aside>
  );
}

type GlobalSearchPayload = {
  clients: SearchResult[];
  quotes: SearchResult[];
  invoices: SearchResult[];
  materials: SearchResult[];
  services: SearchResult[];
};

type SearchResult = {
  id: string;
  title: string;
  detail: string;
  href: string;
};

function GlobalSearchResults({
  results,
  onClose,
  onNavigate,
}: {
  results: GlobalSearchPayload | undefined;
  onClose: () => void;
  onNavigate: (href: string, id: string, group: keyof GlobalSearchPayload) => void;
}) {
  const groups: Array<[keyof GlobalSearchPayload, string]> = [
    ["clients", "Clients"],
    ["quotes", "Devis"],
    ["invoices", "Factures"],
    ["materials", "Materiaux"],
    ["services", "Prestations"],
  ];
  const total = results ? groups.reduce((sum, [key]) => sum + results[key].length, 0) : 0;

  return (
    <div className="global-search-popover">
      <div className="global-search-head">
        <strong>Recherche globale</strong>
        <button type="button" onClick={onClose}>Fermer</button>
      </div>
      {results === undefined ? <p>Recherche...</p> : total === 0 ? <p>Aucun resultat.</p> : null}
      {results ? groups.map(([key, label]) => {
        const rows = results[key];
        if (rows.length === 0) {
          return null;
        }
        return (
          <section key={key}>
            <span>{label}</span>
            {rows.map((row) => (
              <button key={`${key}-${row.id}`} type="button" onClick={() => onNavigate(row.href, row.id, key)}>
                <strong>{row.title}</strong>
                <small>{row.detail || row.href}</small>
              </button>
            ))}
          </section>
        );
      }) : null}
    </div>
  );
}

function rememberFocusedResult(group: keyof GlobalSearchPayload, id: string) {
  if (typeof window === "undefined") {
    return;
  }
  if (group === "clients") {
    sessionStorage.setItem("boorise:focusClientId", id);
  }
  if (group === "quotes") {
    sessionStorage.setItem("boorise:focusQuoteId", id);
  }
  if (group === "invoices") {
    sessionStorage.setItem("boorise:focusInvoiceId", id);
  }
}

function companyInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "E";
}

function NavItem({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItemConfig;
  pathname: string;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const isActive = pathname === item.to || item.aliases?.includes(pathname);
  return (
    <Link key={item.to} to={item.to} onClick={onNavigate} className={cn("nav-link", isActive && "nav-link-active")}>
      <Icon className="nav-icon h-[18px] w-[18px]" />
      <span className="nav-label truncate">{item.label}</span>
    </Link>
  );
}

function MobileBottomNav({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItemConfig[];
  pathname: string;
  onNavigate: (href: string) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav className="mobile-bottom-nav" aria-label="Navigation principale mobile">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.to || item.aliases?.includes(pathname);
        return (
          <button
            key={item.to}
            type="button"
            className={cn(isActive && "mobile-bottom-nav-active")}
            aria-current={isActive ? "page" : undefined}
            onClick={() => onNavigate(item.to)}
          >
            <Icon className="h-5 w-5" />
            <span>{mobileLabel(item.label)}</span>
          </button>
        );
      })}
    </nav>
  );
}

function mobileLabel(label: string) {
  return label === "Dashboard" ? "Accueil" : label === "Catalogue" ? "Stock" : label;
}
