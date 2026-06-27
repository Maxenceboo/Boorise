import { useAuthActions } from "@convex-dev/auth/react";
import { useAction } from "convex/react";
import type { FormEvent } from "react";
import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Chrome, LockKeyhole, Mail } from "lucide-react";
import { BooriseMark } from "@/components/brand/BooriseLogo";
import { Button, Field, Notice, TextInput } from "@/components/ui/app";
import { useToast } from "@/components/ui/toast-context";
import { friendlyError } from "@/lib/errors";
import { api } from "#convex/_generated/api";

export type AuthMode = "signIn" | "signUp" | "reset" | "resetVerify";

export function AuthPage({ initialMode, onBack }: { initialMode?: AuthMode; onBack?: () => void }) {
  const { signIn } = useAuthActions();
  const toast = useToast();
  const requestPasswordReset = useAction(api.app.requestPasswordReset);
  const [mode, setMode] = useState<AuthMode>(() => getInitialAuthMode(initialMode));
  const [pending, setPending] = useState(false);
  const [oauthPending, setOauthPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const resetCode = getResetCode();
  const resetEmail = getStoredResetEmail();

  async function handleGoogleSignIn() {
    setOauthPending(true);
    setError(null);
    setNotice(null);

    try {
      const result = await signIn("google", { redirectTo: getPostAuthRedirect() });
      if (!result.redirect && !result.signingIn) {
        setError("La redirection Google n'a pas pu etre lancee.");
      }
    } catch (err) {
      const message = friendlyError(err, "Connexion Google impossible.");
      setError(message);
      toast.error(message);
      setOauthPending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);

    const formData = new FormData(event.currentTarget);
    if (mode === "reset") {
      const email = String(formData.get("email") ?? "");
      storeResetEmail(email);
      try {
        await requestPasswordReset({ email });
      } catch {
        // Keep the same public response to avoid exposing whether the address exists.
      } finally {
        setNotice("Si un compte existe avec cet email, les instructions viennent d'etre envoyees.");
        setPending(false);
      }
      return;
    } else if (mode === "resetVerify") {
      formData.set("flow", "reset-verification");
      if (resetCode) {
        formData.set("code", resetCode);
      }
    } else {
      formData.set("flow", mode);
    }

    try {
      const result = await signIn("password", formData);
      if (mode === "resetVerify") {
        if (!result.signingIn) {
          setError("Le mot de passe n'a pas pu etre mis a jour. Verifie le code ou redemande un lien.");
        } else {
          clearResetEmail();
          setNotice("Mot de passe mis a jour. Connexion en cours...");
        }
      } else if (!result.signingIn && !result.redirect) {
        setError("La session n'a pas pu etre ouverte.");
      }
    } catch (err) {
      const message = friendlyError(err, "Action impossible.");
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  const title =
    mode === "signIn"
      ? "Connexion"
      : mode === "signUp"
        ? "Inscription"
        : mode === "resetVerify"
          ? "Nouveau mot de passe"
          : "Reinitialisation";
  const cta =
    mode === "signIn"
      ? "Se connecter"
      : mode === "signUp"
        ? "Creer mon compte"
        : mode === "resetVerify"
          ? "Mettre a jour"
          : "Recevoir le lien";

  return (
    <main className="auth-screen">
      <section className="auth-visual">
        <div className="brand-row px-0">
          <BooriseMark />
          <div>
            <div className="text-sm font-bold text-white">Boorise</div>
            <div className="text-xs text-slate-300">ERP artisans</div>
          </div>
        </div>
        <div>
          <h1>Gerer clients, materiaux et devis sans friction.</h1>
          <p>
            Une interface simple pour preparer les chantiers, calculer les achats reels et suivre les documents de vente.
          </p>
        </div>
        <div className="auth-proof">
          <Proof label="Calcul pertes" value="Auto" />
          <Proof label="Lots" value="Arrondis" />
          <Proof label="Suivi" value="Temps reel" />
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="lg:hidden">
            <div className="brand-row px-0 pb-6">
              <BooriseMark />
              <div>
                <div className="text-sm font-bold text-slate-950">Boorise</div>
                <div className="text-xs text-slate-500">ERP artisans</div>
              </div>
            </div>
          </div>

          {onBack && mode !== "resetVerify" ? (
            <button className="auth-back" type="button" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              Presentation
            </button>
          ) : null}
          <h2>{title}</h2>
          <p>
            {mode === "signIn"
              ? "Connecte-toi a ton espace de gestion."
              : mode === "signUp"
                ? "Cree ton compte et configure ton entreprise."
                : mode === "resetVerify"
                  ? "Choisis un nouveau mot de passe pour ton compte."
                  : "Renseigne ton email pour recevoir un lien securise."}
          </p>

          {mode === "signIn" || mode === "signUp" ? (
            <>
              <Button
                className="auth-oauth-button mt-6 w-full"
                disabled={oauthPending || pending}
                type="button"
                variant="outline"
                onClick={() => void handleGoogleSignIn()}
              >
                <Chrome className="h-4 w-4" />
                {oauthPending ? "Redirection Google..." : "Continuer avec Google"}
              </Button>

              <div className="auth-divider" role="separator">
                <span>ou</span>
              </div>
            </>
          ) : null}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <Field label="Email" required>
              <div className="input-with-icon">
                <Mail className="h-4 w-4" />
                <TextInput name="email" type="email" placeholder="toi@entreprise.fr" defaultValue={mode === "resetVerify" ? resetEmail : undefined} required />
              </div>
            </Field>
            {mode === "resetVerify" && !resetCode ? (
              <Field label="Code de reinitialisation" required>
                <TextInput name="code" placeholder="Code recu par email" required />
              </Field>
            ) : null}
            {mode !== "reset" ? (
              <Field label="Mot de passe" required>
                <div className="input-with-icon">
                  <LockKeyhole className="h-4 w-4" />
                  <TextInput
                    name={mode === "resetVerify" ? "newPassword" : "password"}
                    type="password"
                    placeholder="Minimum 8 caracteres"
                    required
                  />
                </div>
              </Field>
            ) : null}

            {error ? <Notice kind="error">{error}</Notice> : null}
            {notice ? <Notice kind="success">{notice}</Notice> : null}

            <Button className="w-full" disabled={pending || oauthPending} type="submit">
              {pending ? "Patiente..." : cta}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="auth-links">
            <button type="button" onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}>
              {mode === "signIn" ? "Creer un compte" : "J'ai deja un compte"}
            </button>
            {mode !== "resetVerify" ? (
              <button type="button" onClick={() => setMode("reset")}>
                Mot de passe oublie
              </button>
            ) : (
              <button type="button" onClick={() => switchToResetRequest(setMode, setError, setNotice)}>
                Redemander un lien
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function getInitialAuthMode(initialMode?: AuthMode): AuthMode {
  if (typeof window === "undefined") {
    return initialMode ?? "signIn";
  }
  const params = new URLSearchParams(window.location.search);
  if (params.get("flow") === "reset" && params.has("code")) {
    return "resetVerify";
  }
  const auth = params.get("auth");
  if (auth === "signup") {
    return "signUp";
  }
  if (auth === "reset") {
    return "reset";
  }
  return initialMode ?? "signIn";
}

function getResetCode() {
  if (typeof window === "undefined") {
    return null;
  }
  return new URLSearchParams(window.location.search).get("code");
}

function getStoredResetEmail() {
  if (typeof window === "undefined") {
    return "";
  }
  return window.sessionStorage.getItem("boorise-reset-email") ?? "";
}

function storeResetEmail(email: string) {
  if (typeof window === "undefined") {
    return;
  }
  const normalized = email.trim().toLowerCase();
  if (normalized) {
    window.sessionStorage.setItem("boorise-reset-email", normalized);
  }
}

function clearResetEmail() {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem("boorise-reset-email");
}

function switchToResetRequest(
  setMode: (mode: AuthMode) => void,
  setError: (message: string | null) => void,
  setNotice: (message: string | null) => void,
) {
  if (typeof window !== "undefined") {
    window.history.replaceState({}, "", "/");
  }
  setError(null);
  setNotice(null);
  setMode("reset");
}

function getPostAuthRedirect() {
  if (typeof window === "undefined") {
    return "/";
  }
  const params = new URLSearchParams(window.location.search);
  const invite = params.get("invite");
  return invite ? `/?invite=${encodeURIComponent(invite)}` : "/";
}

function Proof({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <CheckCircle2 className="mb-3 h-4 w-4 text-cyan-200" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
