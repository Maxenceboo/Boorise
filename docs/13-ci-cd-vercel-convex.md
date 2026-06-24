# CI/CD Vercel + Convex

Le workflow `.github/workflows/ci-cd.yml` separe deux usages :

- Pull request vers `main` : installation, lint frontend, build frontend.
- Push sur `main` : deploy Convex production, puis deploy Vercel production.

## GitHub secrets requis

Dans `Settings > Secrets and variables > Actions > Secrets` :

- `CONVEX_DEPLOY_KEY` : cle de deploiement Convex pour la production.
- `VERCEL_TOKEN` : token Vercel.
- `VERCEL_ORG_ID` : identifiant de l'organisation ou du compte Vercel.
- `VERCEL_PROJECT_ID` : identifiant du projet Vercel.

## GitHub variables conseillees

Dans `Settings > Secrets and variables > Actions > Variables` :

- `VITE_CONVEX_URL_DEV` : URL du deploiement Convex dev cloud.
- `VITE_CONVEX_URL_PROD` : URL du deploiement Convex production.

Ces variables servent au build de verification. Le build production Vercel utilise les variables configurees dans Vercel.

## Vercel env vars

Dans le projet Vercel :

- Preview : `VITE_CONVEX_URL` doit pointer vers Convex dev cloud.
- Production : `VITE_CONVEX_URL` doit pointer vers Convex prod cloud.

## Convex prod env vars

Dans Convex production :

- `JWT_PRIVATE_KEY`
- `JWKS`

Ces valeurs doivent etre generees proprement pour la production. Ne pas reutiliser les cles locales.
