import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient, useConvexAuth, useMutation, useQuery } from "convex/react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import type { ReactNode } from "react";
import { lazy, Suspense, useState } from "react";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { api } from "#convex/_generated/api";
import type { AuthMode } from "@/components/auth/AuthPage";
import { BooriseMark } from "@/components/brand/BooriseLogo";
import { Button, Notice } from "@/components/ui/app";
import { useToast } from "@/components/ui/toast-context";
import { ToastProvider } from "@/components/ui/toast";
import { friendlyError } from "@/lib/errors";
import { isOrganizationOnboarded } from "@/lib/onboarding";
import { useSeo } from "@/lib/seo";
import { routeTree } from "@/routeTree";

const router = createRouter({ routeTree });
const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
if (!convexUrl) {
  throw new Error("VITE_CONVEX_URL is required to start Boorise.");
}
const convex = new ConvexReactClient(convexUrl);
const AuthPage = lazy(() => import("@/components/auth/AuthPage").then((module) => ({ default: module.AuthPage })));
const LandingPage = lazy(() => import("@/components/marketing/LandingPage").then((module) => ({ default: module.LandingPage })));
const OnboardingPage = lazy(() => import("@/components/auth/OnboardingPage").then((module) => ({ default: module.OnboardingPage })));
const PublicQuotePage = lazy(() => import("@/routes/PublicQuotePage").then((module) => ({ default: module.PublicQuotePage })));
const AccountantPortalPage = lazy(() => import("@/routes/AccountantPortalPage").then((module) => ({ default: module.AccountantPortalPage })));

const publicMarketingPaths = new Set([
  "/logiciel-devis-artisan",
  "/logiciel-facture-artisan",
  "/erp-artisan-batiment",
  "/gestion-materiaux-artisan",
  "/logiciel-artisan-menuisier",
  "/logiciel-artisan-peintre",
  "/logiciel-artisan-plaquiste",
  "/logiciel-artisan-carreleur",
  "/logiciel-artisan-macon",
  "/tarifs",
  "/contact",
  "/mentions-legales",
  "/confidentialite",
  "/conditions-utilisation",
]);

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
  const publicQuoteToken = getPublicQuoteToken();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const publicMarketingPath = isPublicMarketingPath();

  if (publicQuoteToken) {
    return (
      <Suspense fallback={<LoadingScreen label="Chargement du devis..." />}>
        <PublicQuotePage token={publicQuoteToken} />
      </Suspense>
    );
  }

  if (publicMarketingPath) {
    return children;
  }

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
      <>
        <AuthSeo mode={authMode} />
        <Suspense fallback={<LoadingScreen label="Chargement..." />}>
          <AuthPage
            initialMode={authMode}
            onBack={canReturnToLanding() ? () => {
              setAuthMode(null);
              window.history.replaceState({}, "", "/");
            } : undefined}
          />
        </Suspense>
      </>
    );
  }

  return (
    <Suspense fallback={<LoadingScreen label="Chargement..." />}>
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
    </Suspense>
  );
}

function WorkspaceGate({ children }: { children: ReactNode }) {
  const current = useQuery(api.app.current);
  const invitationToken = getInvitationToken();
  const accountantInvitationToken = getAccountantInvitationToken();
  const publicMarketingPath = isPublicMarketingPath();
  useSeo({
    title: "Espace entreprise - Boorise",
    description: "Espace prive Boorise pour gerer clients, devis, factures, materiaux et equipe.",
    canonicalPath: "/",
    noIndex: !publicMarketingPath,
  });

  if (publicMarketingPath) {
    return children;
  }

  if (current === undefined) {
    return <LoadingScreen label="Chargement de l'espace..." />;
  }

  if (invitationToken && !current?.organization) {
    return <InvitationAcceptPage token={invitationToken} />;
  }

  if (accountantInvitationToken) {
    return <AccountantInvitationAcceptPage token={accountantInvitationToken} />;
  }

  if (!current?.organization) {
    if ((current?.accountantAccesses?.length ?? 0) > 0) {
      return (
        <Suspense fallback={<LoadingScreen label="Chargement de l'espace comptable..." />}>
          <AccountantPortalPage />
        </Suspense>
      );
    }
    return (
      <Suspense fallback={<LoadingScreen label="Chargement..." />}>
        <OnboardingPage />
      </Suspense>
    );
  }

  if (!isOrganizationOnboarded(current.organization)) {
    return (
      <Suspense fallback={<LoadingScreen label="Chargement..." />}>
        <OnboardingPage organization={current.organization} />
      </Suspense>
    );
  }

  return children;
}

function AuthSeo({ mode }: { mode: AuthMode }) {
  const labels: Record<AuthMode, string> = {
    reset: "Reinitialisation du mot de passe",
    resetVerify: "Nouveau mot de passe",
    signIn: "Connexion",
    signUp: "Inscription",
  };
  useSeo({
    title: `${labels[mode]} - Boorise`,
    description: "Accede a ton espace Boorise pour gerer clients, devis, factures et catalogue.",
    canonicalPath: "/",
    noIndex: true,
  });
  return null;
}

function getPublicQuoteToken() {
  if (typeof window === "undefined") {
    return null;
  }
  const match = window.location.pathname.match(/^\/public\/quote\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function isPublicMarketingPath() {
  if (typeof window === "undefined") {
    return false;
  }
  return publicMarketingPaths.has(window.location.pathname);
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

function AccountantInvitationAcceptPage({ token }: { token: string }) {
  const acceptInvitation = useMutation(api.app.acceptAccountantInvitation);
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
      const message = friendlyError(err, "Invitation comptable impossible a accepter.");
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
              <div className="text-xs text-slate-500">Acces comptable</div>
            </div>
          </div>
          <h2>Acceder en lecture seule</h2>
          <p>Cette invitation donne un acces comptable a l'entreprise: consultation, PDF et exports, sans modification possible.</p>
          {error ? <Notice kind="error">{error}</Notice> : null}
          <Button className="mt-6 w-full" disabled={pending} onClick={() => void accept()}>
            {pending ? "Acceptation..." : "Accepter l'acces comptable"}
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

function getAccountantInvitationToken() {
  if (typeof window === "undefined") {
    return null;
  }
  return new URLSearchParams(window.location.search).get("accountantInvite");
}

function getInitialPublicAuthMode(): AuthMode | null {
  if (typeof window === "undefined") {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  if (params.get("flow") === "reset" && params.has("code")) {
    return "resetVerify";
  }
  if (params.has("invite") || params.has("accountantInvite")) {
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
  return !params.has("invite") && !params.has("accountantInvite") && !(params.get("flow") === "reset" && params.has("code"));
}
