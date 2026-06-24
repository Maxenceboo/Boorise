import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  Boxes,
  Building2,
  FileText,
  Menu,
  LayoutDashboard,
  Search,
  Settings,
  UsersRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  { to: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/clients", label: "Clients", icon: UsersRound },
  { to: "/materiaux", label: "Matériaux", icon: Boxes },
  { to: "/devis", label: "Devis", icon: FileText },
  { to: "/parametres", label: "Entreprise", icon: Building2 },
];

export function AppShell() {
  const { signOut } = useAuthActions();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar className="hidden lg:block" pathname={pathname} onNavigate={() => setMobileOpen(false)} />

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-[#241629]/55"
            type="button"
            onClick={() => setMobileOpen(false)}
          />
          <Sidebar className="relative z-10 h-full w-72" pathname={pathname} onNavigate={() => setMobileOpen(false)} />
        </div>
      ) : null}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-card/90 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden"
              aria-label="Ouvrir le menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div>
              <div className="text-sm font-semibold">Espace entreprise</div>
              <div className="text-xs text-muted-foreground">Clients, devis et suivi chantier</div>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void signOut()}>
            <Settings className="h-4 w-4" />
            Déconnexion
          </Button>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-5 lg:px-8 lg:py-7">
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
    <aside className={cn("fixed inset-y-0 left-0 w-72 bg-violet-surface text-white", className)}>
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-primary text-sm font-black text-primary-foreground shadow-lg shadow-orange-950/20">
            B
          </div>
          <div>
            <div className="text-base font-semibold">Boorise</div>
            <div className="text-xs text-violet-200">Devis artisans</div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10 lg:hidden"
          aria-label="Fermer le menu"
          onClick={onNavigate}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-4 py-4">
        <div className="flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/8 px-3 text-sm text-violet-100">
          <Search className="h-4 w-4" />
          Rechercher
        </div>
      </div>

      <nav className="space-y-1 px-3">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-violet-100 transition-colors hover:bg-white/10 hover:text-white",
                active && "bg-primary text-white shadow-sm shadow-orange-950/20",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-4 left-3 right-3 rounded-lg border border-white/10 bg-violet-panel p-4">
        <div className="text-sm font-semibold">MVP en cours</div>
        <p className="mt-1 text-xs leading-5 text-[#d8d9ee]">
          Priorité aux clients, devis propres, calculs fiables et documents PDF.
        </p>
      </div>
    </aside>
  );
}
