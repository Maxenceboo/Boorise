import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient, useConvexAuth, useMutation, useQuery } from "convex/react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { api } from "#convex/_generated/api";
import { AuthPage, type AuthMode } from "@/components/auth/AuthPage";
import { BooriseMark } from "@/components/brand/BooriseLogo";
import { OnboardingPage } from "@/components/auth/OnboardingPage";
import { LandingPage } from "@/components/marketing/LandingPage";
import { Button, Notice } from "@/components/ui/app";
import { useToast } from "@/components/ui/toast-context";
import { ToastProvider } from "@/components/ui/toast";
import { friendlyError } from "@/lib/errors";
import { isOrganizationOnboarded } from "@/lib/onboarding";
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
    <ToastProvider>
      <ConvexAuthProvider client={convex} shouldHandleCode={shouldHandleAuthCode}>
        <AuthGate>
          <WorkspaceGate>{app}</WorkspaceGate>
        </AuthGate>
      </ConvexAuthProvider>
      <Analytics />
      <SpeedInsights />
    </ToastProvider>
  );
}

function shouldHandleAuthCode() {
  const params = new URLSearchParams(window.location.search);
  return params.get("flow") !== "reset";
}

function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return <LoadingScreen label="Chargement..." />;
  }

  if (!isAuthenticated) {
    return <PublicAccess />;
  }

  return children;
}

function PublicAccess() {
  const [authMode, setAuthMode] = useState<AuthMode | null>(() => getInitialPublicAuthMode());

  if (authMode) {
    return (
      <AuthPage
        initialMode={authMode}
        onBack={canReturnToLanding() ? () => {
          setAuthMode(null);
          window.history.replaceState({}, "", "/");
        } : undefined}
      />
    );
  }

  return (
    <LandingPage
      onSignIn={() => {
        setAuthMode("signIn");
        window.history.replaceState({}, "", "/?auth=signin");
      }}
      onSignUp={() => {
        setAuthMode("signUp");
        window.history.replaceState({}, "", "/?auth=signup");
      }}
    />
  );
}

function WorkspaceGate({ children }: { children: ReactNode }) {
  const current = useQuery(api.app.current);
  const invitationToken = getInvitationToken();

  if (current === undefined) {
    return <LoadingScreen label="Chargement de l'espace..." />;
  }

  if (invitationToken && !current?.organization) {
    return <InvitationAcceptPage token={invitationToken} />;
  }

  if (!current?.organization) {
    return <OnboardingPage />;
  }

  if (!isOrganizationOnboarded(current.organization)) {
    return <OnboardingPage organization={current.organization} />;
  }

  return children;
}

function InvitationAcceptPage({ token }: { token: string }) {
  const acceptInvitation = useMutation(api.app.acceptInvitation);
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setPending(true);
    setError(null);
    try {
      await acceptInvitation({ token });
      window.history.replaceState({}, "", "/");
    } catch (err) {
      const message = friendlyError(err, "Invitation impossible a accepter.");
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <div className="auth-card">
          <div className="brand-row px-0 pb-6">
            <BooriseMark />
            <div>
              <div className="text-sm font-bold text-slate-950">Boorise</div>
              <div className="text-xs text-slate-500">Invitation equipe</div>
            </div>
          </div>
          <div className="eyebrow">Invitation equipe</div>
          <h2>Rejoindre l'entreprise</h2>
          <p>Cette invitation rattache ton compte a l'equipe de l'entreprise dans Boorise. Un compte ne peut appartenir qu'a une seule equipe.</p>
          {error ? <Notice kind="error">{error}</Notice> : null}
          <Button className="mt-6 w-full" disabled={pending} onClick={() => void accept()}>
            {pending ? "Acceptation..." : "Accepter l'invitation"}
          </Button>
        </div>
      </section>
    </main>
  );
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="loading-screen">
      <BooriseMark />
      <span>{label}</span>
    </div>
  );
}

function getInvitationToken() {
  if (typeof window === "undefined") {
    return null;
  }
  return new URLSearchParams(window.location.search).get("invite");
}

function getInitialPublicAuthMode(): AuthMode | null {
  if (typeof window === "undefined") {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  if (params.get("flow") === "reset" && params.has("code")) {
    return "resetVerify";
  }
  if (params.has("invite")) {
    return "signIn";
  }
  const auth = params.get("auth");
  if (auth === "signin") {
    return "signIn";
  }
  if (auth === "signup") {
    return "signUp";
  }
  if (auth === "reset") {
    return "reset";
  }
  return null;
}

function canReturnToLanding() {
  if (typeof window === "undefined") {
    return false;
  }
  const params = new URLSearchParams(window.location.search);
  return !params.has("invite") && !(params.get("flow") === "reset" && params.has("code"));
}
