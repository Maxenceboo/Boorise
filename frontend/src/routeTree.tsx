import { createRootRoute, createRoute, lazyRouteComponent, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";

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

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/dashboard",
  component: lazyRouteComponent(() => import("@/routes/DashboardPage"), "DashboardPage"),
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

export const routeTree = rootRoute.addChildren([
  indexRoute,
  appRoute.addChildren([dashboardRoute, clientsRoute, materialsRoute, servicesRoute, quotesRoute, invoicesRoute, settingsRoute]),
]);
