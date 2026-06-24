# Architecture Technique

## Stack cible

- Frontend : React + Vite + TypeScript.
- Backend applicatif : Convex, avec fonctions TypeScript.
- Base de donnees : Convex.
- UI : Tailwind CSS + composants shadcn/ui.
- Routing : TanStack Router.
- Formulaires : React Hook Form + Zod.
- Emails : Resend en V1, puis OAuth Gmail/Microsoft en option avancee.
- Deploiement : Vercel pour le frontend, Convex Cloud pour le backend.

## Organisation du repo

- `frontend/` : application React.
- `convex/` : schema et fonctions backend Convex.
- `docs/` : cadrage produit, architecture et roadmap.

## Deploiement

Vercel doit etre connecte au depot GitHub et deployer automatiquement depuis `main`.

Configuration attendue :

- Framework : Vite.
- Build command : `cd frontend && npm ci && npm run build`.
- Output directory : `frontend/dist`.
- Variable d'environnement : `VITE_CONVEX_URL`.

Convex est deploye via la CLI Convex depuis la racine du depot :

```bash
npm run convex:deploy
```

## Modules V1

1. Authentification et organisations.
2. Profil entreprise.
3. Clients.
4. Materiaux et moteur de calcul.
5. Devis.
6. Generation PDF.
7. Signature publique.
8. Factures.
9. Emails.
