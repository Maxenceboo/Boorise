import { useAuthActions } from "@convex-dev/auth/react";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function AuthPage() {
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    formData.set("flow", mode);

    try {
      const result = await signIn("password", formData);
      if (!result.signingIn && !result.redirect) {
        setError("La session n'a pas pu etre ouverte.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden bg-secondary p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-primary text-sm font-black">B</div>
          <div>
            <div className="font-semibold">Boorise</div>
            <div className="text-sm text-[#d8d9ee]">Devis artisans</div>
          </div>
        </div>
        <div>
          <div className="mb-6 grid grid-cols-5 overflow-hidden rounded-lg">
            {["#F2C230", "#F2921D", "#F24F13", "#8082A6", "#46334F"].map((color) => (
              <div key={color} className="h-28" style={{ backgroundColor: color }} />
            ))}
          </div>
          <h1 className="max-w-xl text-4xl font-semibold leading-tight">
            Construis des devis fiables sans perdre le fil du chantier.
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-[#d8d9ee]">
            Clients, materiaux, calculs de pertes, PDF et signature dans un outil pense pour les
            artisans.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
          <div>
            <h2 className="text-2xl font-semibold">{mode === "signIn" ? "Connexion" : "Creation du compte"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signIn"
                ? "Connecte-toi a ton espace Boorise."
                : "Cree ton compte pour demarrer le MVP."}
            </p>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Email</span>
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                name="email"
                placeholder="toi@entreprise.fr"
                type="email"
                required
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Mot de passe</span>
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                name="password"
                placeholder="Minimum 8 caracteres"
                type="password"
                required
              />
            </label>

            {error ? (
              <div className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <Button className="w-full" disabled={pending} type="submit">
              {pending ? "Patiente..." : mode === "signIn" ? "Se connecter" : "Creer le compte"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <button
            className="mt-4 text-sm font-medium text-secondary underline-offset-4 hover:underline"
            type="button"
            onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
          >
            {mode === "signIn" ? "Creer un compte" : "J'ai deja un compte"}
          </button>
        </div>
      </section>
    </main>
  );
}
