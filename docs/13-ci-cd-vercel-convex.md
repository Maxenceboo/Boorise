# Mise en production Vercel + Convex

Boorise est decoupe en deux parties :

- Vercel sert le frontend Vite/React.
- Convex sert la base, les fonctions, l'auth, les routes HTTP publiques et l'envoi email.

## 1. Checks locaux avant release

Depuis la racine du repo :

```bash
npm ci
npm --prefix frontend ci
npm run check
```

Le script `npm run check` lance :

- generation des types Convex ;
- verification TypeScript Convex ;
- lint frontend ;
- build frontend ;
- tests metier.

## 2. Variables Vercel

Dans le projet Vercel, configurer :

| Environnement | Variable | Valeur |
| --- | --- | --- |
| Preview | `VITE_CONVEX_URL` | URL Convex de preview/dev cloud |
| Production | `VITE_CONVEX_URL` | `https://<deployment>.convex.cloud` |

Pour `boorise.fr`, le domaine public de production doit pointer vers le projet Vercel.

## 3. Variables Convex production

Dans Convex production :

```bash
npx convex env set SITE_URL https://boorise.fr --prod
npx convex env set CONVEX_SITE_URL https://<deployment>.convex.site --prod
npx convex env set AUTH_GOOGLE_ID <google-client-id> --prod
npx convex env set AUTH_GOOGLE_SECRET <google-client-secret> --prod
npx convex env set RESEND_API_KEY <resend-api-key> --prod
npx convex env set AUTH_EMAIL_FROM "Boorise <security@boorise.fr>" --prod
npx convex env set DOCUMENT_EMAIL_DOMAIN boorise.fr --prod
```

Optionnel si tu veux forcer un expediteur unique au lieu de `nomentreprise.entreprise@boorise.fr` :

```bash
npx convex env set DOCUMENT_EMAIL_FROM "Boorise <documents@boorise.fr>" --prod
```

Convex Auth peut aussi demander `JWT_PRIVATE_KEY` et `JWKS` selon la configuration active. Generer des cles propres pour la production et ne pas reutiliser les valeurs locales.

## 4. Google OAuth

Dans Google Cloud Console :

- domaine autorise : `boorise.fr` ;
- redirect URI autorisee : `https://<deployment>.convex.site/api/auth/callback/google`.

Le callback OAuth pointe vers Convex, pas vers Vercel.

## 5. Resend et DNS email

Dans Resend :

- verifier `boorise.fr` ;
- ajouter les DNS demandes par Resend ;
- attendre que DKIM/SPF soient valides ;
- ajouter un DMARC minimal si absent.

Exemple DMARC :

```txt
_dmarc.boorise.fr TXT "v=DMARC1; p=none; rua=mailto:postmaster@boorise.fr"
```

Les emails de securite utilisent `AUTH_EMAIL_FROM`.
Les devis, factures, relances et avoirs utilisent `DOCUMENT_EMAIL_FROM` si renseigne, sinon un expediteur derive du nom de l'entreprise sur `DOCUMENT_EMAIL_DOMAIN`.

## 6. Deploiement

Backend :

```bash
npm run convex:deploy
```

Frontend :

- Vercel build command : `cd frontend && npm run build`
- Output directory : `frontend/dist`
- Install command : `npm ci && cd frontend && npm ci`

## 7. Smoke tests production

Apres deploiement :

- creer un compte et se connecter ;
- completer l'onboarding obligatoire entreprise ;
- verifier OAuth Google ;
- lancer une reinitialisation de mot de passe ;
- creer un client avec email ;
- creer un devis, l'envoyer, ouvrir l'aperçu public, accepter avec signature ;
- generer une facture, enregistrer un paiement partiel puis total ;
- creer un avoir ;
- envoyer une relance facture ;
- telecharger PDF devis/facture ;
- exporter le CSV comptable ;
- verifier que les pages principales scrollent et restent lisibles mobile/desktop.

## 8. Secrets GitHub Actions

Si le workflow CI/CD est active, ajouter :

- `CONVEX_DEPLOY_KEY`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Variables conseillees :

- `VITE_CONVEX_URL_DEV`
- `VITE_CONVEX_URL_PROD`
