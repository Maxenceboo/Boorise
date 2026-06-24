import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient, useConvexAuth, useQuery } from "convex/react";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { api } from "#convex/_generated/api";
import { AuthPage } from "@/components/auth/AuthPage";
import { OnboardingPage } from "@/components/auth/OnboardingPage";
import { routeTree } from "@/routeTree";

const router = createRouter({ routeTree });
const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
if (!convexUrl) {
  throw new Error("VITE_CONVEX_URL is required to start Boorise.");
}
const convex = new ConvexReactClient(convexUrl);

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function App() {
  const app = <RouterProvider router={router} />;

  return (
    <ConvexAuthProvider client={convex}>
      <AuthGate>
        <WorkspaceGate>{app}</WorkspaceGate>
      </AuthGate>
    </ConvexAuthProvider>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Chargement...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return children;
}

function WorkspaceGate({ children }: { children: React.ReactNode }) {
  const current = useQuery(api.app.current);

  if (current === undefined) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Chargement de l'espace...
      </div>
    );
  }

  if (!current?.organization) {
    return <OnboardingPage />;
  }

  return children;
}
