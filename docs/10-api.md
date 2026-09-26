# 10. Structure des API

REST JSON, préfixe **`/api`**, HTTPS. Authentification : cookie httpOnly `kairos_at` (web) ou `Authorization: Bearer <jwt>` (mobile/desktop). Toutes les routes sont protégées sauf celles marquées 🌐. Validation Zod : une entrée invalide renvoie `400 { message, issues[] }`. Limitation : 300 requêtes/min.

## 10.1 Authentification

| Méthode | Route | Description |
|---|---|---|
| GET 🌐 | `/auth/google` | Redirige vers le consentement Google (Calendar, Gmail, Drive) avec `state` anti-CSRF |
| GET 🌐 | `/auth/google/callback` | Échange du code, vérification `OWNER_EMAIL`, création de session, redirection vers l'app |
| POST 🌐 | `/auth/refresh` | Rotation du refresh token (cookie `kairos_rt`) → nouveau JWT |
| POST 🌐 | `/auth/dev-login` | **Développement uniquement** (`ALLOW_DEV_LOGIN=true`, jamais en production) |
| POST | `/auth/logout` | Révoque la session |
| GET | `/auth/me` | Profil, réglages, intégrations connectées |

## 10.2 Tâches & catégories

| Méthode | Route | Description |
|---|---|---|
| GET | `/tasks?status=TODO,IN_PROGRESS&categoryId=&from=&to=&q=` | Liste filtrée (tri par score puis échéance) |
| GET | `/tasks/priorities?limit=10` | Classement dynamique avec `score`, `urgent`, `overdue` |
| GET | `/tasks/:id` | Détail + sous-tâches + historique |
| POST | `/tasks` | Création (schéma `createTaskSchema`) |
| POST | `/tasks/quick-add` | `{ text }` en langage naturel → tâche |
| POST | `/tasks/:id/subtasks` | Sous-tâche |
| PATCH | `/tasks/:id` | Mise à jour partielle ; `version` optionnelle (verrou optimiste → `409`) |
| POST | `/tasks/:id/checklist/:itemId/toggle` | Cocher/décocher |
| DELETE | `/tasks/:id` | Suppression logique |
| GET/POST | `/categories` | Liste / création de catégorie personnalisée |
| PATCH/DELETE | `/categories/:id` | Modification / archivage (refusé s'il reste des tâches ouvertes) |

Exemple :

```http
POST /api/tasks/quick-add
{ "text": "Appeler la banque vendredi 10h30 #sci !urgent 30min" }

201 → { "id": "…", "title": "Appeler la banque", "priority": "HIGH",
        "categoryId": "…sci-cambraie…", "dueAt": "2026-10-02T08:30:00.000Z",
        "estimatedMinutes": 30, "autoSchedule": true, … }
```

## 10.3 Planification & calendrier

| Méthode | Route | Description |
|---|---|---|
| POST | `/schedule/replan` | Replanifie et applique (blocs, Google Calendar) → `ScheduleResult` |
| GET | `/schedule/preview` | Calcule sans appliquer |
| GET | `/calendar/events?from=&to=` | Évènements + blocs (avec tâche liée) |
| POST | `/calendar/events` | `{ title, start, end, location?, description? }` → créé aussi dans Google |
| GET | `/calendar/free-slots?duration=60` | 10 prochains créneaux libres |
| POST | `/calendar/sync` | Import incrémental immédiat |
| POST | `/calendar/watch` | Active les notifications push Google |
| POST 🌐 | `/webhooks/google/calendar` | Réception Google (jeton de canal secret) |

`ScheduleResult` :

```json
{
  "generatedAt": "…",
  "blocks": [{ "taskId": "…", "kind": "TASK_BLOCK", "title": "…", "start": "…", "end": "…" }],
  "atRisk": [{ "taskId": "…", "dueAt": "…", "projectedEnd": "…", "missingMinutes": 30, "reason": "DEADLINE_MISSED" }],
  "unscheduled": [{ "taskId": "…", "reason": "…" }],
  "dayLoads": [{ "day": "2026-09-28", "capacityMinutes": 540, "meetingMinutes": 135, "taskMinutes": 340, "focusMinutes": 120, "freeMinutes": 65, "loadRatio": 0.88 }]
}
```

## 10.4 Emails

| Méthode | Route | Description |
|---|---|---|
| GET | `/mail?importance=URGENT` | Emails triés |
| GET | `/mail/digest` | Synthèse IA des dernières 24 h |
| POST | `/mail/sync` | Import immédiat |
| POST | `/mail/:id/triage` | (Re)analyse IA |
| POST | `/mail/:id/to-task` | Transformer en tâche |
| POST | `/mail/:id/draft` | `{ instructions? }` → brouillon déposé dans Gmail |

## 10.5 Assistant, IA, documents

| Méthode | Route | Description |
|---|---|---|
| POST | `/assistant/command` | `{ text, emailId? }` → `{ intent, speech, data?, navigate? }` |
| GET | `/ai/providers` | Moteurs et disponibilité |
| GET / PUT | `/ai/routing` | Table capacité → moteur + replis |
| GET | `/ai/runs` | Journal des 100 derniers appels |
| GET | `/documents` | Documents générés |
| POST | `/documents/generate` | `{ type, format: pdf|docx, title, categoryId?, brief?, data?, saveToDrive? }` |
| GET | `/documents/:id/download` | Fichier |
| GET | `/documents/search?q=` | Recherche locale + Drive |

## 10.6 Tableau de bord, analytique, notifications, synchro

| Méthode | Route | Description |
|---|---|---|
| GET | `/dashboard` | Agrégat d'accueil (planning, priorités, critiques, retards, rendez-vous, emails, charge, temps libre, risques, objectifs, notifications, métriques, disposition) |
| GET | `/dashboard/recommendations` | 3 recommandations IA structurées |
| PUT | `/dashboard/layout` | `[{ key, position, visible, size }]` |
| GET | `/analytics/metrics?from=&to=` | `ProductivityMetrics` + minutes planifiées |
| GET | `/analytics/weekly` | Séries 8 semaines |
| GET / POST / PATCH | `/goals`, `/goals/:id` | Objectifs |
| GET | `/automations` | Journal des actions autonomes |
| GET | `/notifications` | Boîte de notifications |
| POST | `/notifications/replan` | Recalcul des rappels |
| GET / POST 🌐 | `/webhooks/whatsapp` | Vérification Meta / réponses (signature HMAC `X-Hub-Signature-256`) |
| POST | `/sync/push` | `{ deviceId, mutations[] }` → statut par mutation (APPLIED, DUPLICATE, CONFLICT, REJECTED) |
| GET | `/sync/pull?since=` | Changements depuis le curseur (+ suppressions) |
| GET 🌐 | `/health` | Santé (base incluse) |

## 10.7 Codes d'erreur

| Code | Signification |
|---|---|
| 400 | Validation échouée (`issues[]`) |
| 401 | Non authentifié / jeton expiré (le client appelle `/auth/refresh` puis rejoue) |
| 403 | Compte Google non autorisé, webhook non signé |
| 404 | Ressource absente (ou appartenant à un autre utilisateur) |
| 409 | Conflit de version (renvoie la version serveur) |
| 412 | Google non connecté |
| 429 | Limite de débit |
| 503 | Aucun moteur IA disponible pour la capacité |
