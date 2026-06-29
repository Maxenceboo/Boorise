import { createRootRoute, createRoute, lazyRouteComponent, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { MarketingSeoPage } from "@/routes/MarketingSeoPage";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  component: AppShell,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});

const quoteSeoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/logiciel-devis-artisan",
  component: () => <MarketingSeoPage pageId="quote" />,
});

const invoiceSeoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/logiciel-facture-artisan",
  component: () => <MarketingSeoPage pageId="invoice" />,
});

const erpSeoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/erp-artisan-batiment",
  component: () => <MarketingSeoPage pageId="erp" />,
});

const materialsSeoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/gestion-materiaux-artisan",
  component: () => <MarketingSeoPage pageId="materials" />,
});

const carpenterSeoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/logiciel-artisan-menuisier",
  component: () => <MarketingSeoPage pageId="menuisier" />,
});

const painterSeoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/logiciel-artisan-peintre",
  component: () => <MarketingSeoPage pageId="peintre" />,
});

const drywallSeoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/logiciel-artisan-plaquiste",
  component: () => <MarketingSeoPage pageId="plaquiste" />,
});

const tilerSeoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/logiciel-artisan-carreleur",
  component: () => <MarketingSeoPage pageId="carreleur" />,
});

const masonSeoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/logiciel-artisan-macon",
  component: () => <MarketingSeoPage pageId="macon" />,
});

const pricingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tarifs",
  component: () => <MarketingSeoPage pageId="pricing" />,
});

const contactRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/contact",
  component: () => <MarketingSeoPage pageId="contact" />,
});

const legalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/mentions-legales",
  component: () => <MarketingSeoPage pageId="legal" />,
});

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/confidentialite",
  component: () => <MarketingSeoPage pageId="privacy" />,
});

const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/conditions-utilisation",
  component: () => <MarketingSeoPage pageId="terms" />,
});

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/dashboard",
  component: lazyRouteComponent(() => import("@/routes/DashboardPage"), "DashboardPage"),
});

const statsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/stats",
  component: lazyRouteComponent(() => import("@/routes/StatsPage"), "StatsPage"),
});

const clientsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/clients",
  component: lazyRouteComponent(() => import("@/routes/ClientsPage"), "ClientsPage"),
});

const materialsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/materiaux",
  component: lazyRouteComponent(() => import("@/routes/MaterialsPage"), "MaterialsPage"),
});

const servicesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/prestations",
  component: lazyRouteComponent(() => import("@/routes/ServicesPage"), "ServicesPage"),
});

const quotesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/devis",
  component: lazyRouteComponent(() => import("@/routes/QuotesPage"), "QuotesPage"),
});

const invoicesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/factures",
  component: lazyRouteComponent(() => import("@/routes/InvoicesPage"), "InvoicesPage"),
});

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/parametres",
  component: lazyRouteComponent(() => import("@/routes/SettingsPage"), "SettingsPage"),
});

const teamRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/equipe",
  component: lazyRouteComponent(() => import("@/routes/TeamPage"), "TeamPage"),
});

const accountantRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/comptable",
  component: lazyRouteComponent(() => import("@/routes/AccountantPortalPage"), "AccountantPortalPage"),
});

export const routeTree = rootRoute.addChildren([
  indexRoute,
  quoteSeoRoute,
  invoiceSeoRoute,
  erpSeoRoute,
  materialsSeoRoute,
  carpenterSeoRoute,
  painterSeoRoute,
  drywallSeoRoute,
  tilerSeoRoute,
  masonSeoRoute,
  pricingRoute,
  contactRoute,
  legalRoute,
  privacyRoute,
  termsRoute,
  appRoute.addChildren([dashboardRoute, statsRoute, clientsRoute, materialsRoute, servicesRoute, quotesRoute, invoicesRoute, settingsRoute, teamRoute, accountantRoute]),
]);
