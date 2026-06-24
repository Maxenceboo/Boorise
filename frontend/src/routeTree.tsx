import { createRootRoute, createRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { ClientsPage } from "@/routes/ClientsPage";
import { DashboardPage } from "@/routes/DashboardPage";
import { MaterialsPage } from "@/routes/MaterialsPage";
import { QuotesPage } from "@/routes/QuotesPage";
import { SettingsPage } from "@/routes/SettingsPage";

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
  component: DashboardPage,
});

const clientsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/clients",
  component: ClientsPage,
});

const materialsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/materiaux",
  component: MaterialsPage,
});

const quotesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/devis",
  component: QuotesPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/parametres",
  component: SettingsPage,
});

export const routeTree = rootRoute.addChildren([
  indexRoute,
  appRoute.addChildren([dashboardRoute, clientsRoute, materialsRoute, quotesRoute, settingsRoute]),
]);
