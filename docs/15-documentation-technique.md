# 17. Documentation technique

## 17.1 Prérequis

- Node.js **22** (`.nvmrc`), pnpm **10** (`corepack enable`)
- Docker (PostgreSQL local) — ou un PostgreSQL 16 existant
- Optionnel : Rust (desktop), Expo Go / Xcode / Android Studio (mobile)

## 17.2 Démarrage rapide

### A. Interface seule, en 1 minute (mode démo, sans backend)

```bash
pnpm install
pnpm --filter @kairos/core build
pnpm --filter @kairos/web dev        # http://localhost:3000
```
Données de démonstration locales (IndexedDB), planification IA, voix et hors ligne fonctionnels.

### B. Pile complète

```bash
cp .env.example .env                  # renseigner OWNER_EMAIL, JWT_SECRET, puis Google/IA/WhatsApp
pnpm install
pnpm db:up                            # PostgreSQL + Redis (Docker)
pnpm --filter @kairos/core build
pnpm db:migrate                       # crée le schéma
pnpm db:seed                          # données réalistes pour OWNER_EMAIL
pnpm --filter @kairos/api dev         # http://localhost:4000/api (tsc-watch)
NEXT_PUBLIC_API_URL=http://localhost:4000/api pnpm --filter @kairos/web dev
```

Sans identifiants Google, activer `ALLOW_DEV_LOGIN=true` puis :

```bash
curl -X POST localhost:4000/api/auth/dev-login -c cookies.txt
curl -b cookies.txt localhost:4000/api/tasks/priorities
curl -b cookies.txt -X POST localhost:4000/api/assistant/command \
     -H 'content-type: application/json' -d '{"text":"Prépare mon planning de demain"}'
```

### C. Mobile & desktop

```bash
EXPO_PUBLIC_API_URL=http://<ip-locale>:4000/api pnpm --filter @kairos/mobile dev   # QR code Expo Go
pnpm --filter @kairos/desktop dev                                                   # fenêtre native (Rust requis)
```

## 17.3 Commandes

| Commande | Effet |
|---|---|
| `pnpm dev` | Tous les services en parallèle (Turborepo) |
| `pnpm build` / `pnpm typecheck` / `pnpm test` | Sur tout le monorepo, dans l'ordre des dépendances |
| `pnpm --filter @kairos/core test` | 27 tests du moteur |
| `pnpm --filter @kairos/api test` | Tests API (crypto, documents) |
| `pnpm db:migrate` / `pnpm db:seed` | Migrations Prisma / données de démo |
| `node scripts/screenshots.mjs` | Régénère `docs/maquettes` (web lancé sur :3000) |

## 17.4 Variables d'environnement

Toutes documentées dans [`.env.example`](../.env.example) et validées au démarrage par [`apps/api/src/config/env.ts`](../apps/api/src/config/env.ts). Essentielles : `DATABASE_URL`, `OWNER_EMAIL`, `JWT_SECRET` (≥ 32 car.), `ENCRYPTION_KEY` (production), `GOOGLE_*`, `ANTHROPIC_API_KEY`, `WHATSAPP_*`, `NEXT_PUBLIC_API_URL` (web).

## 17.5 Concepts clés du code

### Le moteur `@kairos/core`
Fonctions pures, testées, utilisées partout :

```ts
import { planSchedule, parseCommand, rankTasks, planReminders, computeMetrics } from '@kairos/core';

const plan = planSchedule({ tasks, events, categories, settings, now: new Date() });
// → plan.blocks (TASK_BLOCK/FOCUS), plan.atRisk, plan.unscheduled, plan.dayLoads

parseCommand('Ajoute une réunion demain à 14h', new Date(), 'Europe/Paris');
// → { intent: 'CREATE_EVENT', entities: { title: 'Réunion', date: '…T12:00:00.000Z', durationMinutes: 60 } }
```

Après toute modification de `packages/core`, relancer `pnpm --filter @kairos/core build` (les apps consomment `dist/`).

### Ajouter un moteur IA
1. Créer `apps/api/src/modules/ai/providers/mon-moteur.provider.ts` implémentant `AiProvider` (`id`, `isAvailable()`, `complete()`).
2. Ajouter l'identifiant dans `AI_PROVIDERS` (`packages/core/src/ai-routing.ts`) et son libellé.
3. L'enregistrer dans `ai.module.ts` (liste `providers` et `inject`).
4. Il apparaît dans Paramètres → Moteurs IA et peut être choisi par capacité.

### Ajouter une capacité IA (cas d'usage)
Ajouter la capacité à `AI_CAPABILITIES` + règle par défaut, puis une méthode dans `AiTasksService` appelant `router.run(userId, { capability, system, prompt, jsonSchema? })`. Pour une sortie structurée, fournir un JSON Schema avec `additionalProperties: false` et tous les champs `required` (champs facultatifs : `anyOf: [{type}, {type:'null'}]`).

### Ajouter un widget au tableau de bord
1. Composant dans `apps/web/src/components/dashboard/widgets.tsx`.
2. Entrée dans `WIDGET_COMPONENTS` et dans `WIDGETS` (`lib/store.ts`) avec son libellé.
3. Côté API, compléter l'agrégat `GET /dashboard` si des données serveur sont nécessaires.

### Ajouter une commande vocale
Ajouter une règle dans `INTENT_RULES` (`packages/core/src/intents.ts`) + test dans `intents.test.ts`, puis le `case` correspondant dans `AssistantService.handle` (API) et `runCommand` (web, hors ligne).

### Synchronisation hors ligne
Toute mutation locale doit passer par le store (qui alimente l'outbox). Côté serveur, une nouvelle entité synchronisable s'ajoute dans `SyncController.apply` et dans la réponse de `pull` (avec `updatedAt` indexé et suppression logique).

## 17.6 Conventions

- TypeScript **strict**, pas de `any` implicite ; dates ISO UTC sur le réseau.
- Validation des entrées avec les schémas Zod partagés ; mêmes schémas côté formulaire.
- Toute action autonome écrit une ligne `AutomationLog` (résumé lisible, `undoPayload` si annulable).
- Textes d'interface en français ; libellés centralisés dans `@kairos/core` (`TASK_STATUS_LABELS`, `PRIORITY_LABELS`…).
- Couleurs uniquement via les tokens du design system.
- Commits : impératif, en français ou anglais, une intention par commit ; CI verte obligatoire.

## 17.7 Dépannage

| Symptôme | Cause probable / solution |
|---|---|
| `Configuration invalide : • JWT_SECRET…` au démarrage | Variable manquante ou trop courte (≥ 32 caractères). |
| `Cannot read properties of undefined (reading 'get')` en dev API | Lancé avec un outil qui n'émet pas les métadonnées de décorateurs : utiliser `pnpm --filter @kairos/api dev` (tsc-watch). |
| 412 « Compte Google non connecté » | Se connecter via `/api/auth/google` (ou fonctionnalité Google non disponible en dev-login). |
| Aucun rappel WhatsApp reçu | Modèle non approuvé, `WHATSAPP_RECIPIENT`/téléphone absent ; sans `WHATSAPP_TOKEN` les envois sont **simulés** dans les logs. |
| L'IA ne répond pas (503) | Aucun moteur configuré pour la capacité : renseigner `ANTHROPIC_API_KEY` ou ajuster le routage. |
| Le web affiche d'anciennes données de démo | Paramètres → « Réinitialiser les données de démonstration » (ou vider IndexedDB). |

## Captures d'écran

```bash
pnpm --filter @kairos/web build && pnpm --filter @kairos/web start &
npx playwright install chromium   # une fois
node scripts/screenshots.mjs      # écrit docs/maquettes/*.png
```
