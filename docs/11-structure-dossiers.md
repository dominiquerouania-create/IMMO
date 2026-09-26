# 11. Structure des dossiers

```
kairos/
├─ package.json                 # scripts racine (dev, build, test, db:*), Turborepo
├─ pnpm-workspace.yaml          # espaces de travail + overrides
├─ turbo.json                   # pipeline build → typecheck/test
├─ tsconfig.base.json           # TypeScript strict partagé
├─ docker-compose.yml           # PostgreSQL 16, Redis 7 (+ api/web en profil "full")
├─ .env.example                 # toutes les variables documentées
├─ .github/workflows/ci.yml     # tests moteur, migrations, typecheck, build
│
├─ packages/
│  └─ core/                     # ★ domaine partagé (aucune dépendance framework)
│     ├─ src/
│     │  ├─ types.ts            # Task, Category, CalendarEvent, Email, Goal…
│     │  ├─ schemas.ts          # Zod : création/màj de tâche, catégorie, synchro
│     │  ├─ time.ts             # fuseaux horaires & intervalles (Intl, DST)
│     │  ├─ categories.ts       # Douane, Iris Renov, SCI Cambraie, Personnel + mots-clés
│     │  ├─ scoring.ts          # score dynamique de priorité, urgence, retard
│     │  ├─ scheduler.ts        # ★ planificateur, conflits, créneaux libres, sessions manquées
│     │  ├─ reminders.ts        # politique de rappels WhatsApp (veille, 1 h, escalade)
│     │  ├─ metrics.ts          # indicateurs de productivité, temps gagné par l'IA
│     │  ├─ intents.ts          # NLP français : saisie rapide & commandes vocales
│     │  ├─ ai-routing.ts       # capacités, moteurs, table de routage par défaut
│     │  └─ index.ts
│     └─ test/                  # 27 tests Vitest
│
├─ apps/
│  ├─ api/                      # NestJS 11
│  │  ├─ prisma/                # schema.prisma, migrations/, seed.ts
│  │  ├─ src/
│  │  │  ├─ main.ts             # bootstrap (helmet, CORS, cookies, rawBody)
│  │  │  ├─ app.module.ts       # modules, gardes globales (JWT, throttling)
│  │  │  ├─ config/env.ts       # validation des variables d'environnement
│  │  │  ├─ common/             # prisma, crypto, auth guard, zod pipe, mappers
│  │  │  └─ modules/
│  │  │     ├─ auth/  google/  tasks/  categories/
│  │  │     ├─ scheduler/  calendar/          # planification & Google Calendar
│  │  │     ├─ mail/                          # Gmail + tri IA
│  │  │     ├─ ai/ (providers/)               # Claude, Claude Code, Skywork, Copilot + routeur
│  │  │     ├─ assistant/                     # commandes vocales / chat
│  │  │     ├─ notifications/                 # WhatsApp
│  │  │     ├─ documents/ (templates/) drive/ # PDF, DOCX, Google Drive
│  │  │     ├─ analytics/  dashboard/  sync/  health/
│  │  ├─ test/                  # crypto, documents
│  │  └─ Dockerfile
│  │
│  ├─ web/                      # Next.js 15 — web, PWA, base du desktop
│  │  ├─ public/                # manifest, service worker, icône
│  │  ├─ src/app/               # pages : /, tasks, calendar, inbox, documents, analytics, assistant, settings
│  │  ├─ src/components/        # app-shell, command-bar, dashboard/, tasks/, charts/, ui/
│  │  ├─ src/lib/               # store local-first, sync, api, voice, assistant, format, demo-data
│  │  └─ Dockerfile
│  │
│  ├─ mobile/                   # Expo (iOS / Android)
│  │  ├─ app.json  metro.config.js  index.ts
│  │  └─ src/ (App.tsx, store.ts)
│  │
│  └─ desktop/                  # Tauri 2 (Windows / macOS)
│     └─ src-tauri/ (tauri.conf.json, Cargo.toml, src/, capabilities/)
│
├─ infra/
│  └─ supabase-rls.sql          # durcissement RLS (V2)
├─ scripts/
│  └─ screenshots.mjs           # génération des maquettes (Playwright)
└─ docs/                        # les 15 livrables + maquettes/
```

**Conventions**
- Un module NestJS = un dossier ; les petits modules regroupent contrôleur et `@Module` dans le même fichier.
- Toute règle métier réutilisable va dans `packages/core` avec son test ; les apps n'orchestrent que l'I/O.
- Noms de fichiers en `kebab-case`, composants React en `PascalCase`, textes d'interface en français.
