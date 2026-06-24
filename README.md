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
