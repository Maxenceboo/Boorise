import { useQuery } from "convex/react";
import { Check, Download, FileSignature, X } from "lucide-react";
import { useState } from "react";
import { api } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import { Button, EmptyState, Field, Notice, TextInput } from "@/components/ui/app";
import { convexSiteUrl } from "@/lib/convexHttp";
import { downloadQuotePdf } from "@/lib/documentPdf";
import { formatCurrency, formatDate } from "@/lib/format";
import { useSeo } from "@/lib/seo";

export function PublicQuotePage({ token }: { token: string }) {
  const bundle = useQuery(api.publicQuotes.getByToken, { token });
  const [signature, setSignature] = useState("");
  const [pending, setPending] = useState<"accepted" | "refused" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useSeo({
    title: bundle?.quote ? `Devis ${bundle.quote.number} - Boorise` : "Devis client - Boorise",
    description: "Apercu securise d'un devis Boorise avec acceptation ou refus en ligne.",
    canonicalPath: "/",
    noIndex: true,
  });

  async function decide(decision: "accepted" | "refused") {
    setPending(decision);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${convexSiteUrl()}/public/quotes/respond`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, decision, signature }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Decision impossible.");
      }
      setMessage(decision === "accepted" ? "Devis accepte. La preuve de signature a ete enregistree." : "Devis refuse. La preuve de decision a ete enregistree.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setPending(null);
    }
  }

  if (bundle === undefined) {
    return <main className="public-document-page"><EmptyState title="Chargement du devis..." /></main>;
  }
  if (!bundle) {
    return <main className="public-document-page"><EmptyState title="Lien invalide" description="Ce devis n'est pas disponible ou le lien a expire." /></main>;
  }

  const decided = !!bundle.quote.clientDecision;
  const decisionOpen = bundle.quote.status === "sent" && !decided;
  return (
    <main className="public-document-page">
      <section className="public-document-shell">
        <header className="public-document-header">
          <div>
            <span>{bundle.organization.name}</span>
            <h1>{bundle.quote.number}</h1>
            <p>{bundle.quote.title}</p>
          </div>
          <Button variant="outline" onClick={() => void downloadQuotePdf(bundle, bundle.organization)}>
            <Download className="h-4 w-4" />
            PDF
          </Button>
        </header>

        <section className="public-document-meta">
          <div><span>Client</span><strong>{clientName(bundle.client)}</strong></div>
          <div><span>Date</span><strong>{formatDate(bundle.quote.issueDate)}</strong></div>
          <div><span>Total TTC</span><strong>{formatCurrency(bundle.quote.totalTtc)}</strong></div>
        </section>

        <div className="public-document-lines">
          <div className="public-document-line public-document-line-head">
            <span>Designation</span>
            <span>Quantite</span>
            <span>Total HT</span>
          </div>
          {bundle.items.map((item) => (
            <div className="public-document-line" key={item._id}>
              <strong>{item.description}</strong>
              <span>{item.quantity.toLocaleString("fr-FR")} {item.unit}</span>
              <span>{formatCurrency(item.totalHt)}</span>
            </div>
          ))}
        </div>

        <section className="public-signature-panel">
          <div>
            <FileSignature className="h-5 w-5" />
            <div>
              <h2>Decision client</h2>
              <p>La signature, la date, l'adresse IP et le navigateur seront conserves comme preuve.</p>
            </div>
          </div>
          {bundle.quote.clientDecision ? (
            <Notice kind={bundle.quote.clientDecision === "accepted" ? "success" : "warning"}>
              Decision deja enregistree: {bundle.quote.clientDecision === "accepted" ? "accepte" : "refuse"} le {formatDate(bundle.quote.clientDecisionAt)} par {bundle.quote.clientSignature}.
            </Notice>
          ) : !decisionOpen ? (
            <Notice kind="warning">
              Ce devis n'est plus ouvert a une decision en ligne. Contacte l'entreprise si une modification est necessaire.
            </Notice>
          ) : (
            <>
              {message ? <Notice kind="success">{message}</Notice> : null}
              {error ? <Notice kind="error">{error}</Notice> : null}
              <Field label="Signature" required hint="Nom et prenom du signataire.">
                <TextInput value={signature} onChange={(event) => setSignature(event.target.value)} placeholder="Ex: Alex Durand" />
              </Field>
              <div className="public-decision-actions">
                <Button variant="danger" disabled={pending !== null || signature.trim().length < 2 || decided} onClick={() => void decide("refused")}>
                  <X className="h-4 w-4" />
                  Refuser
                </Button>
                <Button disabled={pending !== null || signature.trim().length < 2 || decided} onClick={() => void decide("accepted")}>
                  <Check className="h-4 w-4" />
                  Accepter
                </Button>
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  );
}

function clientName(client: Doc<"clients"> | null) {
  if (!client) {
    return "Client non defini";
  }
  return client.companyName || [client.firstName, client.name].filter(Boolean).join(" ") || client.name;
}
