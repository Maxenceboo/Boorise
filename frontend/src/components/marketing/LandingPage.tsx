import type { ReactNode } from "react";
import {
  ArrowRight,
  Boxes,
  Calculator,
  CheckCircle2,
  ChevronDown,
  FileText,
  Gauge,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { BooriseMark } from "@/components/brand/BooriseLogo";
import { Button } from "@/components/ui/app";

export function LandingPage({
  onSignIn,
  onSignUp,
}: {
  onSignIn: () => void;
  onSignUp: () => void;
}) {
  return (
    <main className="landing-page">
      <div className="landing-bg-shapes" aria-hidden="true">
        <span className="landing-bg-shape landing-bg-shape-1" />
        <span className="landing-bg-shape landing-bg-shape-2" />
        <span className="landing-bg-shape landing-bg-shape-3" />
        <span className="landing-bg-shape landing-bg-shape-4" />
        <span className="landing-bg-shape landing-bg-shape-5" />
      </div>

      <header className="landing-nav">
        <div className="landing-brand">
          <BooriseMark />
          <div>
            <strong>Boorise</strong>
            <span>ERP artisans</span>
          </div>
        </div>
        <nav>
          <a href="#produit">Produit</a>
          <a href="#modules">Modules</a>
          <a href="#pilotage">Pilotage</a>
        </nav>
        <div className="landing-nav-actions">
          <Button variant="ghost" onClick={onSignIn}>
            Connexion
          </Button>
          <Button onClick={onSignUp}>Creer un espace</Button>
        </div>
      </header>

      <section className="landing-hero" id="produit">
        <div className="landing-hero-copy">
          <div className="eyebrow">ERP terrain pour artisans</div>
          <h1>Boorise pour artisans</h1>
          <p>
            Boorise centralise tes clients, ton catalogue, tes devis et tes
            factures avec un moteur de calcul pense pour les vrais chantiers:
            pertes, lots, conditionnements et marges.
          </p>
          <div className="landing-cta-row">
            <Button onClick={onSignUp}>
              Creer mon espace
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={onSignIn}>
              J'ai deja un compte
            </Button>
          </div>
          <div className="landing-proof-row">
            <span>
              <CheckCircle2 className="h-4 w-4" /> Client et chantier
            </span>
            <span>
              <CheckCircle2 className="h-4 w-4" /> Achats reels calcules
            </span>
            <span>
              <CheckCircle2 className="h-4 w-4" /> Devis pret a envoyer
            </span>
          </div>
          <div
            className="landing-workflow"
            aria-label="Flux de creation d'un devis"
          >
            <WorkflowStep
              index="01"
              title="Choisir le client"
              text="Adresse et infos legales reprises automatiquement."
            />
            <WorkflowStep
              index="02"
              title="Ajouter le besoin"
              text="Materiaux, prestation ou ligne libre."
            />
            <WorkflowStep
              index="03"
              title="Verifier le calcul"
              text="Lots, pertes et cout reel avant envoi."
            />
          </div>
        </div>

        <div className="landing-hero-visual">
          <ProductPreview />
        </div>
      </section>

      <div className="landing-scroll-cue" aria-hidden="true">
        <ChevronDown className="landing-scroll-arrow" />
      </div>

      <section className="landing-band" id="modules">
        <div className="landing-section-heading">
          <span>Modules essentiels</span>
          <h2>
            Tout ce qu'il faut pour passer du chantier au document client.
          </h2>
        </div>
        <div className="landing-feature-grid">
          <Feature
            icon={<UsersRound />}
            title="Clients"
            text="Particuliers, pros, adresses, SIRET et historique devis/factures."
          />
          <Feature
            icon={<Boxes />}
            title="Catalogue"
            text="Materiaux, prestations, lots, dimensions, fournisseurs et taux de perte."
          />
          <Feature
            icon={<Calculator />}
            title="Calcul achat reel"
            text="Besoin chantier, pertes, arrondis par lot et cout reel automatiquement calcules."
          />
          <Feature
            icon={<FileText />}
            title="Documents"
            text="Devis, factures, statuts, totaux HT/TTC et mentions legales reutilisees."
          />
        </div>
      </section>

      <section className="landing-split" id="pilotage">
        <div>
          <span className="landing-kicker">Pilotage</span>
          <h2>Tu vois vite ce qui demande une action.</h2>
          <p>
            Relances, factures en retard, devis expires, marge estimee et
            hygiene catalogue restent visibles sans fouiller dans les menus.
          </p>
          <div className="landing-checks">
            <span>
              <ShieldCheck className="h-4 w-4" /> Acces equipe et invitations
            </span>
            <span>
              <Gauge className="h-4 w-4" /> Stats configurables
            </span>
            <span>
              <Sparkles className="h-4 w-4" /> Interface rapide et lisible
            </span>
          </div>
        </div>
        <div className="landing-panel-preview">
          <div className="panel-preview-header">
            <strong>Priorites du jour</strong>
            <span>3 actions</span>
          </div>
          <PreviewRow label="Factures en retard" value="2" tone="danger" />
          <PreviewRow label="Devis a relancer" value="1" tone="info" />
          <PreviewRow label="Catalogue a completer" value="4" tone="muted" />
        </div>
      </section>

      <section className="landing-final">
        <h2>
          Construis tes devis avec les bonnes quantites, pas avec des
          approximations.
        </h2>
        <p>
          Configure ton entreprise, invite ton equipe, ajoute ton catalogue et
          commence a chiffrer proprement.
        </p>
        <Button onClick={onSignUp}>
          Ouvrir Boorise
          <ArrowRight className="h-4 w-4" />
        </Button>
      </section>
    </main>
  );
}

function ProductPreview() {
  return (
    <div className="landing-product-preview" aria-label="Apercu Boorise">
      <div className="preview-topbar">
        <div>
          <span />
          <span />
          <span />
        </div>
        <strong>Creation de devis</strong>
      </div>
      <div className="preview-layout">
        <section className="preview-main">
          <div className="preview-context">
            <div>
              <span>Client</span>
              <strong>Martin</strong>
            </div>
            <div>
              <span>Chantier</span>
              <strong>Terrasse bois</strong>
            </div>
          </div>
          <div className="preview-line">
            <div>
              <span>Materiau</span>
              <strong>Poutre autoclave 2 m</strong>
            </div>
            <b>Besoin 5 pieces</b>
          </div>
          <div className="preview-calc-grid">
            <CalculationCell label="Vendu par" value="Lot de 2" />
            <CalculationCell label="Quantite achetee" value="3 lots" />
            <CalculationCell label="Perte generee" value="1 piece" />
          </div>
        </section>
        <aside className="preview-summary">
          <span>Devis D-2026-014</span>
          <strong>36,00 EUR HT</strong>
          <p>
            Le devis reprend le besoin client, le cout reel achete et la perte
            calculee.
          </p>
          <div>
            <span>Pret a envoyer</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function WorkflowStep({
  index,
  title,
  text,
}: {
  index: string;
  title: string;
  text: string;
}) {
  return (
    <div className="workflow-step">
      <span>{index}</span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}

function CalculationCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <article className="landing-feature">
      <div>{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function PreviewRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "danger" | "info" | "muted";
}) {
  return (
    <div className={`landing-preview-row landing-preview-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
