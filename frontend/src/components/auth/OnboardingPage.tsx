import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import type { FormEvent } from "react";
import { useState } from "react";
import { ArrowRight, LogOut } from "lucide-react";
import { api } from "#convex/_generated/api";
import { Button, Field, Notice, TextInput } from "@/components/ui/app";
import { useToast } from "@/components/ui/toast-context";
import { friendlyError } from "@/lib/errors";

export function OnboardingPage() {
  const { signOut } = useAuthActions();
  const toast = useToast();
  const createOrganization = useMutation(api.app.createOrganization);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const data = new FormData(event.currentTarget);

    try {
      await createOrganization({ name: String(data.get("name") ?? "") });
    } catch (err) {
      const message = friendlyError(err, "Creation impossible.");
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="onboarding-screen">
      <form className="onboarding-card" onSubmit={handleSubmit}>
        <div className="flex items-start justify-between gap-4">
          <div className="brand-row px-0">
            <div className="brand-mark">B</div>
            <div>
              <div className="text-sm font-bold text-slate-950">Boorise</div>
              <div className="text-xs text-slate-500">Initialisation</div>
            </div>
          </div>
          <Button type="button" variant="ghost" onClick={() => void signOut()}>
            <LogOut className="h-4 w-4" />
            Sortir
          </Button>
        </div>

        <div className="mt-8">
          <div className="eyebrow">Entreprise</div>
          <h1>Configure ton espace de travail</h1>
          <p>Cette entreprise isolera tes clients, materiaux, devis et factures.</p>
        </div>

        <Field className="mt-6" label="Nom de l'entreprise" required>
          <TextInput name="name" placeholder="Atelier Martin" required />
        </Field>

        {error ? <Notice kind="error">{error}</Notice> : null}

        <Button className="mt-6 w-full" disabled={pending} type="submit">
          {pending ? "Creation..." : "Creer mon espace"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
    </main>
  );
}
