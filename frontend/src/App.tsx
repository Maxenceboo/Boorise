import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { api } from "#convex/_generated/api";
import { AuthPage } from "@/components/auth/AuthPage";
import { OnboardingPage } from "@/components/auth/OnboardingPage";
import { Button, Notice } from "@/components/ui/app";
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
    <ConvexAuthProvider client={convex} shouldHandleCode={shouldHandleAuthCode}>
      <AuthGate>
        <WorkspaceGate>{app}</WorkspaceGate>
      </AuthGate>
    </ConvexAuthProvider>
  );
}

function shouldHandleAuthCode() {
  const params = new URLSearchParams(window.location.search);
  return params.get("flow") !== "reset";
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
  const invitationToken = getInvitationToken();

  if (current === undefined) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Chargement de l'espace...
      </div>
    );
  }

  if (invitationToken && !current?.organization) {
    return <InvitationAcceptPage token={invitationToken} />;
  }

  if (!current?.organization) {
    return <OnboardingPage />;
  }

  return children;
}

function InvitationAcceptPage({ token }: { token: string }) {
  const acceptInvitation = useMutation(api.app.acceptInvitation);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setPending(true);
    setError(null);
    try {
      await acceptInvitation({ token });
      window.history.replaceState({}, "", "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invitation impossible a accepter");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <div className="auth-card">
          <div className="eyebrow">Invitation equipe</div>
          <h2>Rejoindre l'entreprise</h2>
          <p>Cette invitation rattache ton compte a l'equipe Boorise de l'entreprise. Un compte ne peut appartenir qu'a une seule equipe.</p>
          {error ? <Notice kind="error">{error}</Notice> : null}
          <Button className="mt-6 w-full" disabled={pending} onClick={() => void accept()}>
            {pending ? "Acceptation..." : "Accepter l'invitation"}
          </Button>
        </div>
      </section>
    </main>
  );
}

function getInvitationToken() {
  if (typeof window === "undefined") {
    return null;
  }
  return new URLSearchParams(window.location.search).get("invite");
}
