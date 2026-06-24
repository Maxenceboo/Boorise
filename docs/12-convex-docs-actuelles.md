# Convex - notes de documentation actuelles

Sources consultees le 2026-06-24 :

- Convex MCP Server : https://docs.convex.dev/ai/convex-mcp-server
- Using Codex with Convex : https://docs.convex.dev/ai/using-codex
- React Quickstart : https://docs.convex.dev/quickstart/react
- Convex React : https://docs.convex.dev/client/react/overview
- Schemas : https://docs.convex.dev/database/schemas
- Indexes : https://docs.convex.dev/database/reading-data/indexes/
- Functions overview : https://docs.convex.dev/functions/overview
- Actions : https://docs.convex.dev/functions/actions
- Authentication overview : https://docs.convex.dev/auth/overview
- Vercel hosting : https://docs.convex.dev/production/hosting/vercel
- Context7 library lookup : `/llmstxt/convex_dev_llms-full_txt`

## Configuration Codex

Convex recommande deux choses pour Codex :

1. Installer les fichiers IA Convex dans le projet :

```bash
npx convex ai-files install
```

2. Ajouter le serveur MCP Convex dans `~/.codex/config.toml` :

```toml
[mcp_servers.convex]
command = "npx"
args = ["-y", "convex@latest", "mcp", "start"]
```

Dans Boorise, le serveur est configure avec `--project-dir` pour limiter le MCP au repo courant.

## Points importants pour Boorise

- `npx convex dev` cree ou connecte un deployment et genere `convex/_generated`.
- Le client React utilise `ConvexReactClient` et `ConvexProvider`.
- Avec Vite, l'URL client doit etre exposee sous `VITE_CONVEX_URL`.
- Les fonctions frontend consomment Convex via les hooks React : `useQuery`, `useMutation`, `useAction`.
- Les schemas sont declares dans `convex/schema.ts` avec `defineSchema`, `defineTable` et `v`.
- Les index doivent etre ajoutes pour toutes les lectures frequentes par organisation, client, numero de devis ou statut. Les champs doivent etre interroges dans l'ordre de declaration de l'index.
- Les filtres non indexes parcourent la table et doivent etre evites sur les tables qui grossissent.
- Les queries lisent et sont reactives.
- Les mutations ecrivent dans une transaction.
- Les actions servent aux effets externes : emails, PDF, Stripe, OpenAI, webhooks.
- Pour l'auth, Convex Auth est possible directement dans Convex. Les integrations Clerk, Auth0 et WorkOS sont aussi supportees.
- Pour Vercel, l'app frontend doit recevoir `VITE_CONVEX_URL`.

## Context7

Recherche effectuee :

```bash
npx ctx7 library convex "React client schema functions auth"
```

Librairie retenue :

```text
/llmstxt/convex_dev_llms-full_txt
```

Commandes utiles :

```bash
npx ctx7 docs /llmstxt/convex_dev_llms-full_txt "React Vite ConvexProvider ConvexReactClient useQuery useMutation setup"
npx ctx7 docs /llmstxt/convex_dev_llms-full_txt "schema defineSchema defineTable indexes query mutation action best practices"
npx ctx7 docs /llmstxt/convex_dev_llms-full_txt "authentication Convex Auth React beta Clerk Auth0 WorkOS overview"
```

## Decision projet

Pour Boorise V1 :

- garder Convex a la racine du repo ;
- garder le frontend dans `frontend/` pour Vercel ;
- utiliser les actions Convex pour les emails et integrations externes ;
- modeliser toutes les donnees metier avec `organizationId` ;
- indexer les lectures par `organizationId` des le depart ;
- eviter tout acces production via MCP tant que la V1 n'est pas stabilisee.
