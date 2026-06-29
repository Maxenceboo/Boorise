import type { ReactNode } from "react";
import {
  ArrowRight,
  Boxes,
  Calculator,
  CheckCircle2,
  FileText,
  Gauge,
  Hammer,
  ReceiptText,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { BooriseMark } from "@/components/brand/BooriseLogo";
import { Button } from "@/components/ui/app";
import { useSeo } from "@/lib/seo";

export type MarketingPageId =
  | "quote"
  | "invoice"
  | "erp"
  | "materials"
  | "menuisier"
  | "peintre"
  | "plaquiste"
  | "carreleur"
  | "macon"
  | "pricing"
  | "contact"
  | "legal"
  | "privacy"
  | "terms";

type MarketingPage = {
  id: MarketingPageId;
  path: string;
  title: string;
  seoTitle: string;
  description: string;
  noIndex?: boolean;
  eyebrow: string;
  hero: string;
  intro: string;
  primaryCta: string;
  primaryHref?: string;
  secondaryCta?: string;
  secondaryHref?: string;
  sections: Array<{
    icon: ReactNode;
    title: string;
    text: string;
  }>;
  proof: string[];
  finalTitle: string;
  finalText: string;
  details?: Array<{
    title: string;
    text?: string;
    items: string[];
  }>;
  references?: Array<{
    label: string;
    href: string;
  }>;
};

const pages: Record<MarketingPageId, MarketingPage> = {
  quote: {
    id: "quote",
    path: "/logiciel-devis-artisan",
    title: "Logiciel de devis artisan",
    seoTitle: "Logiciel devis artisan - Boorise",
    description:
      "Cree des devis artisan propres avec clients, materiaux, prestations, pertes, lots, marges et totaux HT/TTC calcules automatiquement.",
    eyebrow: "Devis artisan",
    hero: "Des devis clairs, chiffres avec les bonnes quantites.",
    intro:
      "Boorise aide les artisans a passer du besoin chantier au devis client sans tableur fragile. Les materiaux, les prestations et les calculs de pertes restent relies.",
    primaryCta: "Creer un devis",
    secondaryCta: "Voir les modules",
    secondaryHref: "/erp-artisan-batiment",
    sections: [
      { icon: <UsersRound />, title: "Client et chantier", text: "Adresse, informations de facturation et description du chantier restent attachees au devis." },
      { icon: <Boxes />, title: "Catalogue reutilisable", text: "Ajoute les materiaux et prestations depuis ton catalogue au lieu de repartir de zero." },
      { icon: <Calculator />, title: "Calcul achat reel", text: "Lots, pertes et conditionnements indiquent ce qu'il faut vraiment acheter." },
      { icon: <FileText />, title: "Document final", text: "Totaux HT/TTC, statut, PDF et suivi client restent dans le meme dossier." },
    ],
    proof: ["Brouillon modifiable", "Calcul des pertes", "Acceptation client", "Revision de devis"],
    finalTitle: "Un devis ne doit pas seulement etre joli. Il doit etre fiable.",
    finalText: "Boorise relie le chiffrage, le catalogue et le client pour reduire les oublis avant l'envoi.",
  },
  invoice: {
    id: "invoice",
    path: "/logiciel-facture-artisan",
    title: "Logiciel de facture artisan",
    seoTitle: "Logiciel facture artisan - Boorise",
    description:
      "Genere et suis tes factures artisan depuis les devis acceptes: statuts, echeances, encaissements, relances et exports comptables.",
    eyebrow: "Facturation",
    hero: "Factures, paiements et relances au meme endroit.",
    intro:
      "Boorise transforme les devis acceptes en factures suivies. Tu gardes les echeances, les encaissements et les documents dans un flux lisible.",
    primaryCta: "Suivre mes factures",
    secondaryCta: "Voir les devis",
    secondaryHref: "/logiciel-devis-artisan",
    sections: [
      { icon: <ReceiptText />, title: "Facture depuis devis", text: "Evite les ressaisies et garde le lien avec le chantier d'origine." },
      { icon: <Gauge />, title: "Suivi paiement", text: "Visualise ce qui est envoye, paye, en retard ou encore a encaisser." },
      { icon: <ShieldCheck />, title: "Historique encadre", text: "Les documents finalises gardent une trace claire des actions importantes." },
      { icon: <FileText />, title: "Export comptable", text: "Prepare les informations utiles pour la compta et les rapprochements." },
    ],
    proof: ["Echeances visibles", "Relances client", "Avoirs encadres", "PDF facture"],
    finalTitle: "Une facture doit etre simple a suivre apres l'envoi.",
    finalText: "Boorise garde le document, le statut et le paiement dans un seul parcours.",
  },
  erp: {
    id: "erp",
    path: "/erp-artisan-batiment",
    title: "ERP artisan batiment",
    seoTitle: "ERP artisan batiment - Boorise",
    description:
      "ERP SaaS pour artisans du batiment: clients, materiaux, devis, factures, equipe, stats et calculs de quantites.",
    eyebrow: "ERP batiment",
    hero: "Un ERP artisan fait pour les vrais chantiers.",
    intro:
      "Boorise centralise l'activite d'une entreprise artisanale: contacts, catalogue, chiffrage, documents, equipe et pilotage.",
    primaryCta: "Demarrer Boorise",
    secondaryCta: "Explorer les modules",
    secondaryHref: "/gestion-materiaux-artisan",
    sections: [
      { icon: <UsersRound />, title: "Clients", text: "Retrouve les coordonnees, l'historique et les documents de chaque client." },
      { icon: <Boxes />, title: "Ressources", text: "Gere les materiaux, prestations, fournisseurs et conditionnements." },
      { icon: <FileText />, title: "Documents", text: "Cree des devis, transforme-les en factures et suis leur cycle de vie." },
      { icon: <Gauge />, title: "Pilotage", text: "Priorites, marges, retards et statistiques restent visibles." },
    ],
    proof: ["Multi-utilisateur", "Acces comptable", "Stats configurables", "Responsive"],
    finalTitle: "Un seul espace pour travailler proprement.",
    finalText: "Boorise rassemble les operations quotidiennes sans imposer un outil lourd.",
  },
  materials: {
    id: "materials",
    path: "/gestion-materiaux-artisan",
    title: "Gestion des materiaux artisan",
    seoTitle: "Gestion materiaux artisan - Boorise",
    description:
      "Gere ton catalogue materiaux artisan avec prix d'achat HT, lots, dimensions, pertes, fournisseurs et calcul automatique des quantites.",
    eyebrow: "Catalogue chantier",
    hero: "Des materiaux classes, mesurables et utilisables dans les devis.",
    intro:
      "Le catalogue Boorise ne sert pas seulement a stocker des noms. Il porte les prix, unites, lots, dimensions et taux de perte utiles au chiffrage.",
    primaryCta: "Structurer mon catalogue",
    secondaryCta: "Voir le calcul devis",
    secondaryHref: "/logiciel-devis-artisan",
    sections: [
      { icon: <Boxes />, title: "Materiaux et prestations", text: "Separe les fournitures, la main-d'oeuvre et les forfaits reutilisables." },
      { icon: <Calculator />, title: "Lots et pertes", text: "Calcule automatiquement les quantites achetees selon le conditionnement." },
      { icon: <Hammer />, title: "Unites chantier", text: "Piece, metre, m2, m3, litre, kilogramme ou lot selon ton besoin." },
      { icon: <FileText />, title: "Devis plus fiables", text: "Chaque ligne de devis reprend la logique d'achat configuree." },
    ],
    proof: ["Prix HT", "Fournisseur", "Taux de perte", "Achat par lot"],
    finalTitle: "Le bon catalogue evite les mauvaises surprises.",
    finalText: "Boorise transforme les donnees materiaux en calculs utilisables dans les devis.",
  },
  menuisier: {
    id: "menuisier",
    path: "/logiciel-artisan-menuisier",
    title: "Logiciel menuisier",
    seoTitle: "Logiciel menuisier - devis, bois, lots et factures | Boorise",
    description:
      "Logiciel pour menuisier: devis de terrasse, agencement, pose, bois, panneaux, quincaillerie, pertes de coupe et facturation.",
    eyebrow: "Menuiserie",
    hero: "Chiffrer bois, quincaillerie et pose sans perdre le fil.",
    intro:
      "Boorise aide un menuisier a passer d'un besoin chantier a un devis exploitable: longueurs de poutres, panneaux, lots de visserie, pertes de coupe, main-d'oeuvre et marge restent lisibles.",
    primaryCta: "Creer mon espace",
    secondaryCta: "Voir le calcul devis",
    secondaryHref: "/logiciel-devis-artisan",
    sections: [
      { icon: <Boxes />, title: "Bois et panneaux", text: "Configure les dimensions, longueurs d'achat, conditionnements et prix HT de tes fournitures." },
      { icon: <Calculator />, title: "Pertes de coupe", text: "Les besoins en metres ou en pieces sont corriges avec les pertes avant le total du devis." },
      { icon: <Hammer />, title: "Pose et ajustements", text: "Ajoute les prestations de pose, depose, finition ou ajustement sans les melanger aux fournitures." },
      { icon: <ReceiptText />, title: "Devis puis facture", text: "Transforme un devis accepte en facture en gardant l'historique du chantier." },
    ],
    proof: ["Poutres", "Panneaux", "Quincaillerie", "Pertes"],
    finalTitle: "Un devis menuiserie depend autant du conditionnement que du prix.",
    finalText: "Boorise rend visibles les quantites achetees, les volumes livres et la perte generee avant l'envoi client.",
  },
  peintre: {
    id: "peintre",
    path: "/logiciel-artisan-peintre",
    title: "Logiciel peintre",
    seoTitle: "Logiciel peintre - devis surfaces, peinture et factures | Boorise",
    description:
      "Logiciel pour peintre: devis murs et plafonds, surfaces, litres, couches, fournitures, main-d'oeuvre et factures.",
    eyebrow: "Peinture",
    hero: "Des devis peinture bases sur les surfaces et les couches.",
    intro:
      "Boorise structure les chantiers de peinture avec les m2, les litres, les consommables, les reprises, les finitions et les temps de pose au meme endroit.",
    primaryCta: "Creer mon espace",
    secondaryCta: "Voir les materiaux",
    secondaryHref: "/gestion-materiaux-artisan",
    sections: [
      { icon: <Calculator />, title: "Surfaces et couches", text: "Chiffre les murs, plafonds et reprises avec une logique claire de quantite necessaire." },
      { icon: <Boxes />, title: "Pots et consommables", text: "Gere peinture, enduit, bandes, abrasifs, rouleaux et protections avec leurs prix HT." },
      { icon: <Hammer />, title: "Preparation", text: "Ajoute lessivage, rebouchage, poncage et finition comme prestations distinctes." },
      { icon: <Gauge />, title: "Marge lisible", text: "Controle le cout reel et la marge avant d'envoyer le devis." },
    ],
    proof: ["m2", "Litres", "Couches", "Finitions"],
    finalTitle: "Un bon devis peinture doit expliquer ce qui est compris.",
    finalText: "Boorise separe les fournitures, les prestations et les totaux pour garder un document clair.",
  },
  plaquiste: {
    id: "plaquiste",
    path: "/logiciel-artisan-plaquiste",
    title: "Logiciel plaquiste",
    seoTitle: "Logiciel plaquiste - devis cloisons, rails et factures | Boorise",
    description:
      "Logiciel pour plaquiste: devis cloisons, doublages, plafonds, plaques, rails, montants, vis, bandes, pertes et factures.",
    eyebrow: "Plaquiste",
    hero: "Plaques, rails, montants et bandes calcules proprement.",
    intro:
      "Boorise aide a chiffrer les cloisons, doublages, plafonds et reprises sans oublier les accessoires qui font varier le cout reel.",
    primaryCta: "Creer mon espace",
    secondaryCta: "Voir Boorise",
    secondaryHref: "/erp-artisan-batiment",
    sections: [
      { icon: <Boxes />, title: "Systeme complet", text: "Plaques, rails, montants, suspentes, vis, bandes et enduits restent dans le catalogue." },
      { icon: <Calculator />, title: "Quantites achetees", text: "Les plaques et lots non divisibles sont arrondis correctement avec la perte visible." },
      { icon: <FileText />, title: "Chiffrage detaille", text: "Le client voit un devis propre, et toi tu gardes le cout achat reel." },
      { icon: <ReceiptText />, title: "Suivi document", text: "Statut, acceptation, facture et paiement restent rattaches au chantier." },
    ],
    proof: ["Plaques", "Rails", "Vis", "Bandes"],
    finalTitle: "Le placo demande un catalogue rigoureux.",
    finalText: "Boorise aide a eviter les oublis de petites fournitures qui degradent la marge.",
  },
  carreleur: {
    id: "carreleur",
    path: "/logiciel-artisan-carreleur",
    title: "Logiciel carreleur",
    seoTitle: "Logiciel carreleur - devis carrelage, colle et factures | Boorise",
    description:
      "Logiciel pour carreleur: devis carrelage, faience, colle, joints, plinthes, m2, pertes de coupe et factures.",
    eyebrow: "Carrelage",
    hero: "Carrelage, colle et joints chiffres avec les bonnes pertes.",
    intro:
      "Boorise permet de construire un devis carrelage a partir des surfaces, des conditionnements, des pertes de coupe et des prestations de pose.",
    primaryCta: "Creer mon espace",
    secondaryCta: "Voir les devis",
    secondaryHref: "/logiciel-devis-artisan",
    sections: [
      { icon: <Calculator />, title: "Surfaces en m2", text: "Renseigne les surfaces utiles et applique le taux de perte adapte au chantier." },
      { icon: <Boxes />, title: "Conditionnements", text: "Boites de carreaux, sacs de colle, joints et plinthes sont arrondis selon l'achat reel." },
      { icon: <Hammer />, title: "Pose et preparation", text: "Separe ragrage, pose, decoupes, joints et finitions dans le chiffrage." },
      { icon: <Gauge />, title: "Rentabilite", text: "Visualise cout matiere, total HT et marge avant validation." },
    ],
    proof: ["m2", "Colle", "Joints", "Pertes de coupe"],
    finalTitle: "Le carrelage se joue souvent sur les pertes et les conditionnements.",
    finalText: "Boorise rend le calcul explicite pour eviter un devis trop court ou trop flou.",
  },
  macon: {
    id: "macon",
    path: "/logiciel-artisan-macon",
    title: "Logiciel macon",
    seoTitle: "Logiciel macon - devis beton, blocs et factures | Boorise",
    description:
      "Logiciel pour macon: devis beton, blocs, mortier, reprises, m3, fournitures, prestations, marges et factures.",
    eyebrow: "Maconnerie",
    hero: "Un chiffrage maconnerie clair, du materiau a la facture.",
    intro:
      "Boorise centralise les petits et moyens chantiers de maconnerie: beton, blocs, mortier, seuils, reprises, fournitures, main-d'oeuvre et documents.",
    primaryCta: "Creer mon espace",
    secondaryCta: "Voir l'ERP",
    secondaryHref: "/erp-artisan-batiment",
    sections: [
      { icon: <Boxes />, title: "Materiaux lourds", text: "Gere blocs, sacs, beton, mortier, ferraillage et fournitures avec leurs unites." },
      { icon: <Calculator />, title: "Volumes et lots", text: "Calcule les m3, quantites achetees et pertes selon les regles du catalogue." },
      { icon: <Hammer />, title: "Prestations chantier", text: "Ajoute terrassement, coffrage, reprise, seuil ou pose comme lignes de travail." },
      { icon: <ReceiptText />, title: "Facturation suivie", text: "Garde le lien entre devis accepte, facture, paiement et historique client." },
    ],
    proof: ["m3", "Blocs", "Beton", "Main-d'oeuvre"],
    finalTitle: "La maconnerie demande une vision fiable du cout reel.",
    finalText: "Boorise met les volumes, achats et prestations au meme endroit pour piloter la marge.",
  },
  pricing: {
    id: "pricing",
    path: "/tarifs",
    title: "Tarifs Boorise",
    seoTitle: "Tarifs Boorise - ERP artisan en acces anticipe",
    description:
      "Tarifs Boorise en construction: ERP artisan pour devis, factures, clients, materiaux, equipe et acces comptable.",
    noIndex: true,
    eyebrow: "Tarifs WIP",
    hero: "Une offre simple est en preparation.",
    intro:
      "La grille tarifaire publique Boorise est volontairement en chantier. L'objectif est de proposer une offre lisible pour les artisans, sans empiler des options incomprehensibles.",
    primaryCta: "Creer un espace",
    secondaryCta: "Nous contacter",
    secondaryHref: "/contact",
    sections: [
      { icon: <FileText />, title: "Documents", text: "Devis, factures, PDF, statuts, timeline et suivi client." },
      { icon: <Boxes />, title: "Catalogue", text: "Materiaux, prestations, prix HT, conditionnements, pertes et favoris." },
      { icon: <UsersRound />, title: "Equipe", text: "Collaborateurs, roles, invitations et acces comptable externe." },
      { icon: <Gauge />, title: "Pilotage", text: "Stats, marges, alertes, historique client et export comptable." },
    ],
    proof: ["Acces anticipe", "Offre a finaliser", "Modules inclus", "Pas de prix cache"],
    finalTitle: "Pourquoi la page tarifs reste en WIP ?",
    finalText:
      "Un tarif SaaS doit annoncer clairement le prix, les limites, les options, la facturation et les conditions de resiliation. Tant que ces points ne sont pas arretes, la page reste hors index.",
    details: [
      {
        title: "Ce qui doit etre fixe avant publication",
        items: [
          "Prix mensuel et annuel par entreprise.",
          "Nombre d'utilisateurs inclus et cout d'un utilisateur supplementaire.",
          "Limites eventuelles: stockage, documents, exports, emails et acces comptable.",
          "Periode d'essai, engagement, resiliation et modalites de paiement.",
        ],
      },
      {
        title: "Positionnement recommande",
        text: "Pour un ERP artisan, le plus lisible est une offre principale par entreprise, puis des options simples si besoin.",
        items: [
          "Une offre claire pour l'artisan seul ou petite equipe.",
          "Un acces comptable sans droit de modification.",
          "Des fonctions avancees facturables seulement si elles apportent une vraie valeur.",
        ],
      },
    ],
  },
  contact: {
    id: "contact",
    path: "/contact",
    title: "Contact Boorise",
    seoTitle: "Contact Boorise - ERP pour artisans",
    description:
      "Contacter Boorise pour une question sur les devis, factures, materiaux, equipe, compte ou acces comptable.",
    eyebrow: "Contact",
    hero: "Une demande produit, compte ou partenariat ?",
    intro:
      "Boorise centralise les demandes utiles au lancement: support produit, acces entreprise, questions de facturation, invitations equipe et comptables.",
    primaryCta: "Ecrire a l'equipe",
    primaryHref: "mailto:equipe@boorise.fr",
    secondaryCta: "Creer un espace",
    secondaryHref: "/?auth=signup",
    sections: [
      { icon: <FileText />, title: "Produit", text: "Questions sur les devis, factures, PDF, statuts et mentions documentaires." },
      { icon: <Boxes />, title: "Catalogue", text: "Aide sur les materiaux, prestations, imports CSV, pertes et conditionnements." },
      { icon: <UsersRound />, title: "Equipe", text: "Invitations, roles, proprietaire, admin, lecture seule et acces comptable." },
      { icon: <ShieldCheck />, title: "Compte", text: "Connexion, OAuth, mot de passe, securite et emails transactionnels." },
    ],
    proof: ["equipe@boorise.fr", "Support produit", "Acces entreprise", "Comptables"],
    finalTitle: "Le bon canal evite les allers-retours.",
    finalText:
      "Pour une demande liee a un compte existant, indique l'email du compte, le nom de l'entreprise et la page concernee.",
    details: [
      {
        title: "Informations utiles dans ton message",
        items: [
          "Nom de l'entreprise Boorise concernee.",
          "Type de demande: produit, compte, facturation, equipe, comptable ou bug.",
          "URL de la page ou numero du document si la demande concerne un devis ou une facture.",
          "Capture d'ecran si le probleme est visuel ou bloque une action.",
        ],
      },
    ],
  },
  legal: {
    id: "legal",
    path: "/mentions-legales",
    title: "Mentions legales",
    seoTitle: "Mentions legales - Boorise",
    description:
      "Mentions legales du site Boorise: editeur, hebergement, contact, propriete intellectuelle et donnees personnelles.",
    eyebrow: "Cadre legal",
    hero: "Mentions legales Boorise.",
    intro:
      "Cette page regroupe les informations d'identification du service Boorise et les points a completer avant une exploitation commerciale definitive.",
    primaryCta: "Contacter Boorise",
    primaryHref: "mailto:equipe@boorise.fr",
    secondaryCta: "Retour accueil",
    secondaryHref: "/",
    sections: [
      { icon: <ShieldCheck />, title: "Editeur", text: "Identite legale, adresse, immatriculation, responsable de publication et contact." },
      { icon: <FileText />, title: "Hebergement", text: "Nom, raison sociale, adresse et telephone de l'hebergeur doivent rester accessibles." },
      { icon: <UsersRound />, title: "Utilisateurs", text: "Le service s'adresse aux artisans, collaborateurs et comptables autorises." },
      { icon: <Gauge />, title: "Mise a jour", text: "Les mentions doivent suivre les evolutions de l'editeur et du service." },
    ],
    proof: ["Site professionnel", "Facilement accessible", "A completer", "Sources officielles"],
    finalTitle: "Informations editeur a verrouiller avant publication.",
    finalText:
      "Je n'invente pas la raison sociale, le SIREN, le SIRET, la TVA, l'adresse ou le directeur de publication. Ces champs doivent etre renseignes avec les informations juridiques exactes de l'editeur.",
    details: [
      {
        title: "Editeur du site",
        items: [
          "Nom commercial: Boorise.",
          "Raison sociale: a completer.",
          "Forme juridique: a completer.",
          "Adresse du siege social: a completer.",
          "SIREN / SIRET / RCS ou RM: a completer.",
          "Numero de TVA intracommunautaire si applicable: a completer.",
          "Directeur de la publication: a completer.",
          "Contact: equipe@boorise.fr.",
        ],
      },
      {
        title: "Hebergement",
        items: [
          "Frontend: Vercel, a confirmer dans le contrat d'hebergement du projet.",
          "Backend applicatif: Convex, a confirmer dans le contrat d'hebergement du projet.",
          "Les mentions legales doivent indiquer le nom, la raison sociale, l'adresse et le telephone de chaque hebergeur retenu.",
        ],
      },
      {
        title: "Propriete intellectuelle",
        items: [
          "La marque Boorise, les textes, interfaces, graphismes, logos et elements applicatifs sont proteges.",
          "Toute reproduction ou reutilisation non autorisee des elements du site ou de l'application est interdite.",
        ],
      },
    ],
    references: [
      { label: "Service Public - mentions legales", href: "https://entreprendre.service-public.gouv.fr/vosdroits/F37351" },
      { label: "economie.gouv - mentions d'un site internet", href: "https://www.economie.gouv.fr/entreprises/developper-son-entreprise/innover-et-numeriser-son-entreprise/mentions-sur-votre-site-internet-les-obligations-respecter" },
    ],
  },
  privacy: {
    id: "privacy",
    path: "/confidentialite",
    title: "Politique de confidentialite",
    seoTitle: "Politique de confidentialite - Boorise",
    description:
      "Politique de confidentialite Boorise: donnees collectees, finalites, base legale, durees de conservation, droits RGPD et contact.",
    eyebrow: "Confidentialite",
    hero: "Donnees claires, usage limite, droits respectes.",
    intro:
      "Boorise traite des donnees necessaires au fonctionnement d'un ERP artisan: compte utilisateur, entreprise, clients, materiaux, devis, factures, equipe et journaux d'activite.",
    primaryCta: "Exercer un droit",
    primaryHref: "mailto:equipe@boorise.fr",
    secondaryCta: "Mentions legales",
    secondaryHref: "/mentions-legales",
    sections: [
      { icon: <UsersRound />, title: "Compte", text: "Email, identite, authentification, organisation et role dans l'equipe." },
      { icon: <FileText />, title: "Documents", text: "Donnees clients, devis, factures, signatures, statuts et historiques metier." },
      { icon: <ShieldCheck />, title: "Securite", text: "Journal d'activite, preuves d'acceptation, emails transactionnels et controles d'acces." },
      { icon: <Gauge />, title: "Mesure", text: "Mesure d'audience et performance via les outils actives sur le frontend." },
    ],
    proof: ["RGPD", "Droits utilisateurs", "Finalites limitees", "Contact dedie"],
    finalTitle: "La confidentialite doit rester comprehensible.",
    finalText:
      "Les utilisateurs doivent savoir quelles donnees sont traitees, pourquoi, par qui, combien de temps et comment exercer leurs droits.",
    details: [
      {
        title: "Donnees traitees",
        items: [
          "Compte: email, nom affiche, methode de connexion, informations d'equipe et role.",
          "Entreprise: informations legales, adresse, taux, mentions, logo et preferences documentaires.",
          "Clients et documents: coordonnees clients, devis, factures, signatures, statuts, paiements et exports.",
          "Technique: journaux applicatifs, traces de securite, informations de navigation necessaires au service.",
        ],
      },
      {
        title: "Finalites et bases legales",
        items: [
          "Fournir l'application Boorise et ses fonctions de gestion.",
          "Executer le contrat de service et securiser les comptes.",
          "Respecter les obligations comptables, fiscales et legales applicables aux documents.",
          "Ameliorer le produit lorsque les mesures d'usage sont activees.",
        ],
      },
      {
        title: "Droits des personnes",
        items: [
          "Acces, rectification, effacement, limitation, opposition et portabilite selon les cas prevus par le RGPD.",
          "Demande a envoyer a equipe@boorise.fr avec l'email du compte concerne.",
          "Droit d'introduire une reclamation aupres de la CNIL.",
        ],
      },
    ],
    references: [
      { label: "CNIL - information des personnes", href: "https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence" },
      { label: "Service Public - obligations RGPD", href: "https://entreprendre.service-public.gouv.fr/vosdroits/F24270" },
    ],
  },
  terms: {
    id: "terms",
    path: "/conditions-utilisation",
    title: "Conditions d'utilisation",
    seoTitle: "Conditions d'utilisation - Boorise",
    description:
      "Conditions d'utilisation Boorise: acces au service, compte, equipe, documents, responsabilites, disponibilite et resiliation.",
    eyebrow: "CGU",
    hero: "Un cadre simple pour utiliser Boorise proprement.",
    intro:
      "Les conditions d'utilisation definissent les regles d'acces a l'application, les responsabilites de l'entreprise utilisatrice et les limites du service.",
    primaryCta: "Creer un espace",
    secondaryCta: "Confidentialite",
    secondaryHref: "/confidentialite",
    sections: [
      { icon: <UsersRound />, title: "Compte et equipe", text: "Une personne rejoint une seule entreprise et agit selon son role." },
      { icon: <FileText />, title: "Documents", text: "L'utilisateur reste responsable des informations presentes dans ses devis et factures." },
      { icon: <ShieldCheck />, title: "Securite", text: "Chaque utilisateur doit proteger ses acces et signaler tout usage anormal." },
      { icon: <Gauge />, title: "Service", text: "Boorise vise une disponibilite serieuse mais peut evoluer pendant l'acces anticipe." },
    ],
    proof: ["Compte utilisateur", "Roles", "Documents", "Acces anticipe"],
    finalTitle: "Les CGU doivent etre separees des CGV.",
    finalText:
      "Cette page encadre l'utilisation de l'application. Les conditions commerciales finales devront etre ajoutees aux tarifs ou a des CGV dediees si l'offre devient payante.",
    details: [
      {
        title: "Acces au service",
        items: [
          "Boorise est destine aux entreprises artisanales, a leurs collaborateurs et a leurs comptables autorises.",
          "Le proprietaire de l'entreprise gere les membres, les roles et les invitations.",
          "L'acces comptable est limite a la consultation et au telechargement lorsque ce role est attribue.",
        ],
      },
      {
        title: "Responsabilite des donnees",
        items: [
          "L'entreprise utilisatrice reste responsable des informations saisies dans ses clients, materiaux, devis et factures.",
          "Boorise aide a structurer les documents, mais ne remplace pas un conseil juridique, fiscal ou comptable.",
          "Les documents finalises doivent etre verifies avant envoi au client.",
        ],
      },
      {
        title: "Conditions commerciales a ajouter",
        items: [
          "Prix, modalites de paiement, renouvellement et resiliation.",
          "Niveaux de service, support, sauvegarde et disponibilite.",
          "Regles de restitution ou suppression des donnees en fin de contrat.",
        ],
      },
    ],
    references: [
      { label: "economie.gouv - CGV", href: "https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/conditions-generales-de-vente-quelles-mentions-sont-obligatoires" },
      { label: "Service Public - CGV", href: "https://entreprendre.service-public.gouv.fr/vosdroits/F33527" },
    ],
  },
};

export function MarketingSeoPage({ pageId }: { pageId: MarketingPageId }) {
  const page = pages[pageId];
  useSeo({
    title: page.seoTitle,
    description: page.description,
    canonicalPath: page.path,
    noIndex: page.noIndex,
  });

  return (
    <main className="seo-page">
      <MarketingNav />
      <section className="seo-hero">
        <div>
          <span className="seo-eyebrow">{page.eyebrow}</span>
          <h1>{page.hero}</h1>
          <p>{page.intro}</p>
          <div className="landing-cta-row">
            <Button onClick={() => { window.location.href = page.primaryHref ?? "/?auth=signup"; }}>
              {page.primaryCta}
              <ArrowRight className="h-4 w-4" />
            </Button>
            {page.secondaryCta ? (
              <Button variant="outline" onClick={() => { window.location.href = page.secondaryHref ?? "/?auth=signin"; }}>
                {page.secondaryCta}
              </Button>
            ) : null}
          </div>
        </div>
        <aside className="seo-hero-card">
          <strong>{page.title}</strong>
          <p>{page.description}</p>
          <div>
            {page.proof.map((item) => (
              <span key={item}>
                <CheckCircle2 className="h-4 w-4" />
                {item}
              </span>
            ))}
          </div>
        </aside>
      </section>

      <section className="seo-grid">
        {page.sections.map((section) => (
          <article className="seo-card" key={section.title}>
            <div>{section.icon}</div>
            <h2>{section.title}</h2>
            <p>{section.text}</p>
          </article>
        ))}
      </section>

      {page.details?.length ? (
        <section className="seo-detail-grid">
          {page.details.map((detail) => (
            <article className="seo-detail-card" key={detail.title}>
              <h2>{detail.title}</h2>
              {detail.text ? <p>{detail.text}</p> : null}
              <ul>
                {detail.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      ) : null}

      <section className="seo-content">
        <div>
          <h2>{page.finalTitle}</h2>
          <p>{page.finalText}</p>
        </div>
        {page.references?.length ? (
          <div className="seo-links">
            {page.references.map((reference) => (
              <a href={reference.href} key={reference.href} rel="noreferrer" target="_blank">
                {reference.label}
              </a>
            ))}
          </div>
        ) : (
          <div className="seo-links">
            <a href="/logiciel-devis-artisan">Logiciel devis artisan</a>
            <a href="/logiciel-facture-artisan">Logiciel facture artisan</a>
            <a href="/erp-artisan-batiment">ERP artisan batiment</a>
            <a href="/gestion-materiaux-artisan">Gestion materiaux</a>
          </div>
        )}
      </section>
    </main>
  );
}

function MarketingNav() {
  return (
    <header className="landing-nav seo-nav">
      <a className="landing-brand" href="/">
        <BooriseMark />
        <div>
          <strong>Boorise</strong>
          <span>ERP artisans</span>
        </div>
      </a>
      <nav>
        <a href="/logiciel-devis-artisan">Devis</a>
        <a href="/logiciel-facture-artisan">Factures</a>
        <a href="/erp-artisan-batiment">ERP</a>
        <a href="/gestion-materiaux-artisan">Materiaux</a>
        <a href="/tarifs">Tarifs</a>
        <a href="/contact">Contact</a>
      </nav>
      <div className="landing-nav-actions">
        <Button variant="ghost" onClick={() => { window.location.href = "/?auth=signin"; }}>
          Connexion
        </Button>
        <Button onClick={() => { window.location.href = "/?auth=signup"; }}>
          Creer un espace
        </Button>
      </div>
    </header>
  );
}
