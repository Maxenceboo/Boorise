# Boorise

Boorise est un SaaS de devis, factures et gestion commerciale pour artisans et petites entreprises.

## Stack

- Frontend : React + Vite + TypeScript.
- UI : Tailwind CSS + composants shadcn/ui.
- Routing : TanStack Router.
- Backend et base de donnees : Convex.
- Emails : Resend en V1.
- Deploiement : Vercel pour le frontend, Convex Cloud pour le backend.

## Structure

- `frontend/` : application web React.
- `convex/` : schema et fonctions backend Convex.
- `docs/` : documentation produit et technique.

## Developpement

Installer et lancer le frontend :

```bash
cd frontend
npm install
npm run dev
```

Lancer Convex depuis la racine du repo :

```bash
npm run convex:dev
```

## Authentification OAuth

L'application conserve l'email/mot de passe et ajoute Google OAuth via Convex Auth.

En dev local, le frontend Vite pointe vers le backend Convex local :

```env
VITE_CONVEX_URL=http://127.0.0.1:3210
```

Variables Convex locales a configurer :

```bash
npx convex env set SITE_URL http://localhost:5173
npx convex env set AUTH_GOOGLE_ID your-google-client-id
npx convex env set AUTH_GOOGLE_SECRET your-google-client-secret
npx convex env set RESEND_API_KEY re_xxxxxxxxx
npx convex env set AUTH_EMAIL_FROM "Boorise <onboarding@resend.dev>"
```

Dans Google Cloud Console, ajouter l'URI de redirection autorisee :

```text
http://127.0.0.1:3211/api/auth/callback/google
```

Ajouter aussi les origins autorisees :

```text
http://localhost:5173
http://127.0.0.1:5173
```

En production, `SITE_URL` doit pointer vers le domaine frontend public, par exemple `https://boorise.fr`, et l'URI de redirection devient `https://your-deployment.convex.site/api/auth/callback/google`.

Pour les emails de reinitialisation de mot de passe, `AUTH_EMAIL_FROM` doit utiliser un domaine verifie chez Resend en production, par exemple `Boorise <security@boorise.fr>`.

## Build

```bash
cd frontend
npm run build
```

## Deploiement

Vercel doit etre connecte au depot GitHub et deployer automatiquement depuis `main`.

Configuration Vercel :

- Framework : Vite.
- Build command : `cd frontend && npm ci && npm run build`.
- Output directory : `frontend/dist`.
- Variable : `VITE_CONVEX_URL`.

Convex se deploie avec :

```bash
npm run convex:deploy
```

## Documentation

- [00-introduction.md](./docs/00-introduction.md)
- [01-description.md](./docs/01-description.md)
- [05-architecture-technique.md](./docs/05-architecture-technique.md)
- [08-roadmap.md](./docs/08-roadmap.md)
- [11-reprise-saas-artisans.md](./docs/11-reprise-saas-artisans.md)
- [12-convex-docs-actuelles.md](./docs/12-convex-docs-actuelles.md)
