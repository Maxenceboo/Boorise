import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { api } from "#convex/_generated/api";
import { Button } from "@/components/ui/button";

export function OnboardingPage() {
  const { signOut } = useAuthActions();
  const createOrganization = useMutation(api.app.createOrganization);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();

    try {
      await createOrganization({ name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Creation impossible");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-5">
      <form className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-sm" onSubmit={handleSubmit}>
        <div className="flex items-start justify-between gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-md bg-primary font-black text-white">B</div>
          <button
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-secondary hover:underline"
            type="button"
            onClick={() => void signOut()}
          >
            Se deconnecter
          </button>
        </div>
        <h1 className="mt-5 text-2xl font-semibold">Configure ton entreprise</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Cette organisation servira a isoler les clients, materiaux, devis et factures.
        </p>

        <label className="mt-6 block space-y-1.5">
          <span className="text-sm font-medium">Nom commercial</span>
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            name="name"
            placeholder="Atelier Bourrague"
            required
          />
        </label>

        {error ? (
          <div className="mt-4 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <Button className="mt-6 w-full" disabled={pending} type="submit">
          {pending ? "Creation..." : "Creer mon espace"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
    </main>
  );
}
