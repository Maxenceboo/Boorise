# Reprise SaaS artisans

## Objectif

Refaire Boorise etape par etape a partir du cahier des charges "SaaS de devis intelligent pour artisans", sans reprendre l'architecture Lovable telle quelle.

Le produit V1 doit permettre a une entreprise artisanale de gerer ses clients, son profil entreprise, ses materiaux, ses prestations, ses devis et ses factures, avec des calculs fiables de quantites, pertes, lots, marges et main-d'oeuvre.

## Stack retenue

- Frontend : React + Vite + TypeScript.
- Backend et base de donnees : Convex.
- UI : Tailwind CSS + shadcn/ui.
- Routing : TanStack Router.
- Deploiement frontend : Vercel depuis `main`.
- Deploiement backend : Convex Cloud.
- Emails V1 : fournisseur transactionnel, par exemple Resend.

## Sources analysees

- `C:\Users\maxen\Downloads\Cahier_des_charges_SaaS_Artisans.pdf`
- `C:\Users\maxen\Downloads\ArtiQuote Pro.zip`
- Depot GitHub `Maxenceboo/Boorise`, branche `main`

## Constat

Le depot GitHub contenait surtout un squelette Angular + Spring Boot. Le zip Lovable contenait une implementation plus avancee, mais trop liee a Lovable, notamment pour les server functions et l'envoi Gmail.

La reprise garde les exigences metier, mais repart sur une base technique propre avec React et Convex.

## Exigences V1

- Authentification utilisateur.
- Organisation et profil entreprise.
- Catalogue de materiaux avec unite, prix d'achat HT, fournisseur, dimensions, divisible/non divisible, quantite par lot et taux de perte par defaut.
- Gestion clients.
- Catalogue de prestations reutilisables.
- Devis avec lignes, statut, totaux HT/TTC, TVA et signature publique par token.
- Calcul metier des achats :
  - produit divisible : achat de la quantite exacte apres pertes ;
  - produit non divisible : arrondi au superieur selon la quantite physique par unite ;
  - produit vendu par lot : arrondi au nombre de lots necessaires ;
  - pertes appliquees avant l'arrondi d'achat.
- Generation PDF professionnelle.
- Envoi du devis au client avec lien d'acceptation/refus.
- Transformation devis vers facture.

## A ne pas reprendre directement

- Dependances Lovable.
- Connecteur Gmail Lovable.
- URL publiques hardcodees Lovable.
- Code genere trop couple aux pages UI.

## Ordre de construction recommande

1. Auth + onboarding entreprise.
2. Clients.
3. Materiaux + moteur de calcul teste.
4. Creation de devis.
5. PDF.
6. Page publique de signature.
7. Transformation devis vers facture.
8. Envoi email.
9. Paiement SaaS Stripe.
10. IA V2 seulement apres stabilisation du moteur metier.

## Decision email

Pour la V1, l'approche recommandee est un domaine d'envoi verifie via Resend, Postmark, Brevo ou Mailgun.

OAuth Gmail/Microsoft peut devenir une option Pro plus tard si l'entreprise veut envoyer depuis sa vraie boite mail et voir les messages dans les envoyes.
