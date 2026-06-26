import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import {
  Boxes,
  BarChart3,
  Building2,
  FileCheck2,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  UsersRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { api } from "#convex/_generated/api";
import { Button, IconButton } from "@/components/ui/app";
import { cn } from "@/lib/utils";

type NavItemConfig = {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  aliases?: string[];
};

type NavSectionConfig = {
  label: string;
  items: NavItemConfig[];
};

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
  const active = navigation.find((item) => item.to === pathname || item.aliases?.includes(pathname)) ?? navigation[0];

  return (
    <div className="app-shell">
      <Sidebar className="hidden lg:flex" pathname={pathname} onNavigate={() => setMobileOpen(false)} />

      {mobileOpen ? (
        <div className="mobile-nav">
          <button className="mobile-nav-scrim" aria-label="Fermer le menu" onClick={() => setMobileOpen(false)} />
          <Sidebar className="relative z-10 flex h-full w-80" pathname={pathname} onNavigate={() => setMobileOpen(false)} />
        </div>
      ) : null}

      <div className="app-main">
        <header className="topbar">
          <div className="flex min-w-0 items-center gap-3">
            <IconButton className="lg:hidden" label="Ouvrir le menu" onClick={() => setMobileOpen(true)}>
              <Menu className="h-4 w-4" />
            </IconButton>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-950">{active.label}</div>
              <div className="truncate text-xs text-slate-500">{current?.organization?.name ?? active.description}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
      </div>
    </div>
  );
}

function Sidebar({
  className,
  pathname,
  onNavigate,
}: {
  className?: string;
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <aside className={cn("sidebar", className)}>
      <div className="brand-row">
        <div className="brand-mark">B</div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-slate-950">Boorise</div>
          <div className="truncate text-xs text-slate-500">ERP artisans</div>
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
