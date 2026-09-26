# 4. Architecture Frontend

Trois clients, une seule logique métier (`@kairos/core`).

| Client | Techno | Rôle | Emplacement |
|---|---|---|---|
| Web / PWA | Next.js 15 App Router, React 19, Tailwind 4, Zustand, IndexedDB | Application complète | `apps/web` |
| Desktop | Tauri 2 (WebView native) chargeant l'export statique du web | Windows `.msi/.exe`, macOS `.dmg` | `apps/desktop` |
| Mobile | Expo / React Native 0.81, Zustand + AsyncStorage | iPhone & Android : « Aujourd'hui », saisie rapide/vocale, hors ligne | `apps/mobile` |

## 4.1 Web — organisation

```
apps/web/src
├─ app/                      # routes (App Router), une page = un écran
│  ├─ layout.tsx             # <AppShell>, anti-flash thème, manifest PWA
│  ├─ page.tsx               # tableau de bord personnalisable
│  ├─ tasks/ calendar/ inbox/ documents/ analytics/ assistant/ settings/
│  └─ globals.css            # design tokens (clair/sombre) + @theme Tailwind
├─ components/
│  ├─ app-shell.tsx          # barre latérale, en-tête, nav mobile, ⌘K, synchro
│  ├─ command-bar.tsx        # saisie intelligente + dictée + aperçu NLP
│  ├─ theme.tsx              # thème système / clair / sombre
│  ├─ dashboard/widgets.tsx  # 12 widgets indépendants
│  ├─ tasks/                 # ligne de tâche, panneau de détail
│  ├─ charts/bar-charts.tsx  # graphiques HTML/CSS accessibles
│  └─ ui/primitives.tsx      # Card, Button, Badge, Progress…
└─ lib/
   ├─ store.ts               # état local-first (Zustand + persist IndexedDB)
   ├─ sync.ts                # outbox → /sync/push, /sync/pull, boucle 60 s
   ├─ api.ts                 # fetch + cookies + refresh automatique
   ├─ assistant.ts           # commandes : API en ligne, moteur local sinon
   ├─ voice.ts               # Web Speech API (reconnaissance + synthèse)
   ├─ demo-data.ts           # jeu de démonstration daté dynamiquement
   └─ format.ts              # dates fr-FR, durées
```

## 4.2 Gestion d'état : local-first

- **Source de vérité côté client : le store** (`useStore`), persisté dans **IndexedDB** (`idb-keyval`), réhydraté au démarrage.
- Chaque mutation (`addTask`, `updateTask`…) : met à jour l'état → ajoute une `SyncMutation` à l'**outbox** → relance le **planificateur local** (`planSchedule`) → l'UI se met à jour instantanément, en ligne ou non.
- `sync.ts` rejoue l'outbox, puis tire les changements depuis le curseur `lastSyncAt`. Déclenché au démarrage, sur l'évènement `online`, et toutes les 60 s.
- **Mode démo** : sans `NEXT_PUBLIC_API_URL`, l'app fonctionne entièrement en local (idéal pour évaluer l'UX).
- Sélecteurs Zustand stables (on sélectionne des tableaux bruts, on filtre dans le composant) pour éviter les re-rendus infinis.

## 4.3 Hors ligne & PWA

- `public/sw.js` : coquille applicative en *stale-while-revalidate* (pages, manifeste, icône) ; les appels `/api` ne sont jamais mis en cache.
- `manifest.webmanifest` : installable sur iPhone/Android/desktop, `display: standalone`.
- Indicateur d'état dans l'en-tête : *Hors ligne · n en attente*, *Synchronisation*, *Mode démo local*.
- Le contenu des pages est rendu après réhydratation du store (évite tout décalage d'hydratation SSR).

## 4.4 Navigation & interactions clés

| Interaction | Détail |
|---|---|
| **⌘K / Ctrl+K** | Barre de commande universelle : saisie rapide, commandes naturelles, dictée ; aperçu de l'analyse (intention, date, durée, priorité, catégorie). |
| Micro | Dictée fr-FR ; résultat final exécuté automatiquement ; réponse lue à voix haute. |
| Clic sur une tâche | Panneau latéral : édition complète, checklist, sous-tâches, pièces jointes, historique. `Échap` pour fermer. |
| Cercle d'une tâche | Terminer / rouvrir → replanification immédiate. |
| Personnaliser (accueil) | Afficher/masquer, monter/descendre chaque widget. |
| Mobile | Barre de navigation basse + bouton « + » central (zone du pouce), zones de toucher ≥ 44 px. |

## 4.5 Mobile (Expo)

- `src/store.ts` : même modèle que le web (outbox, `planSchedule`, `parseCommand`) persisté dans AsyncStorage.
- `src/App.tsx` : écran « Aujourd'hui » (tâches classées par score, créneau planifié), saisie rapide, synthèse vocale (`expo-speech`), thème clair/sombre natif.
- `metro.config.js` configuré pour le monorepo pnpm (résolution de `@kairos/core`).
- V2 : onglets Calendrier / Emails / Assistant, notifications locales (`expo-notifications`), widgets iOS/Android, Siri Shortcuts / Google Assistant.

## 4.6 Desktop (Tauri)

- `beforeBuildCommand` exporte le web en statique (`NEXT_OUTPUT=export`) dans `apps/web/out`, embarqué par Tauri.
- CSP stricte, capacités minimales (`core:default`, `notification:default`), plugin de notifications natives.
- V2 : raccourci global (⌥Espace) pour la saisie rapide, icône de barre des menus, lancement au démarrage.

## 4.7 Qualité

- TypeScript strict, `pnpm --filter @kairos/web typecheck`, build de production en CI.
- Accessibilité : rôles ARIA (dialog, tablist, progressbar, tooltip), `aria-live` pour les réponses de l'assistant, focus visible, `prefers-reduced-motion`.
- Maquettes générées automatiquement avec Playwright (horloge figée) : voir [09-maquettes-ui.md](09-maquettes-ui.md).
