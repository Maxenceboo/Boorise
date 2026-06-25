import { useAuthActions } from "@convex-dev/auth/react";
import type { FormEvent } from "react";
import { useState } from "react";
import { ArrowRight, CheckCircle2, LockKeyhole, Mail } from "lucide-react";
import { Button, Field, Notice, TextInput } from "@/components/ui/app";

type AuthMode = "signIn" | "signUp" | "reset";

export function AuthPage() {
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);

    const formData = new FormData(event.currentTarget);
    formData.set("flow", mode);

    try {
      const result = await signIn("password", formData);
      if (mode === "reset") {
        setNotice("Si la configuration email Convex Auth est active, un email de reinitialisation sera envoye.");
      } else if (!result.signingIn && !result.redirect) {
        setError("La session n'a pas pu etre ouverte.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible");
    } finally {
      setPending(false);
    }
  }

  const title = mode === "signIn" ? "Connexion" : mode === "signUp" ? "Inscription" : "Reinitialisation";
  const cta = mode === "signIn" ? "Se connecter" : mode === "signUp" ? "Creer mon compte" : "Recevoir le lien";

  return (
    <main className="auth-screen">
      <section className="auth-visual">
        <div className="brand-row px-0">
          <div className="brand-mark bg-white text-slate-950">B</div>
          <div>
            <div className="text-sm font-bold text-white">Boorise</div>
            <div className="text-xs text-slate-300">ERP artisans</div>
          </div>
        </div>
        <div>
          <div className="eyebrow border-white/15 bg-white/10 text-cyan-100">Chiffrage fiable</div>
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
              <div className="brand-mark">B</div>
              <div>
                <div className="text-sm font-bold text-slate-950">Boorise</div>
                <div className="text-xs text-slate-500">ERP artisans</div>
              </div>
            </div>
          </div>

          <div className="eyebrow">Acces securise</div>
          <h2>{title}</h2>
          <p>
            {mode === "signIn"
              ? "Connecte-toi a ton espace de gestion."
              : mode === "signUp"
                ? "Cree ton compte et configure ton entreprise."
                : "Renseigne ton email pour lancer la procedure."}
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <Field label="Email">
              <div className="input-with-icon">
                <Mail className="h-4 w-4" />
                <TextInput name="email" type="email" placeholder="toi@entreprise.fr" required />
              </div>
            </Field>
            {mode !== "reset" ? (
              <Field label="Mot de passe">
                <div className="input-with-icon">
                  <LockKeyhole className="h-4 w-4" />
                  <TextInput name="password" type="password" placeholder="Minimum 8 caracteres" required />
                </div>
              </Field>
            ) : null}

            {error ? <Notice kind="error">{error}</Notice> : null}
            {notice ? <Notice kind="success">{notice}</Notice> : null}

            <Button className="w-full" disabled={pending} type="submit">
              {pending ? "Patiente..." : cta}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="auth-links">
            <button type="button" onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}>
              {mode === "signIn" ? "Creer un compte" : "J'ai deja un compte"}
            </button>
            <button type="button" onClick={() => setMode("reset")}>
              Mot de passe oublie
            </button>
          </div>
        </div>
      </section>
    </main>
  );
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
