# 16. Stratégie de sécurité

Kairos concentre des données sensibles : agenda, emails, documents d'entreprise, **dossiers douaniers** (secret professionnel), finances de la SCI, santé. La sécurité est pensée pour un **propriétaire unique** et un principe de **moindre privilège**.

## 16.1 Modèle de menaces (résumé)

| Menace | Mesure |
|---|---|
| Accès par un tiers à l'application | Allowlist stricte `OWNER_EMAIL` + email Google vérifié ; aucune inscription possible. |
| Vol de session | JWT d'accès 15 min en cookie **httpOnly / Secure / SameSite=Lax** ; refresh token opaque 30 j, stocké **haché** (SHA-256), **rotation** à chaque usage ; réutilisation détectée → révocation de toutes les sessions. |
| CSRF sur OAuth | Paramètre `state` aléatoire vérifié contre un cookie httpOnly. |
| Fuite de la base | Jetons OAuth **chiffrés AES-256-GCM** (clé `ENCRYPTION_KEY` hors base) ; corps des emails non stockés ; secrets uniquement en variables d'environnement. |
| Webhooks forgés | WhatsApp : signature **HMAC-SHA256** (`X-Hub-Signature-256`) comparée en temps constant sur le corps brut. Google Calendar : jeton de canal aléatoire secret. |
| Injection / entrées malveillantes | Validation **Zod** de toutes les entrées ; Prisma (requêtes paramétrées) ; rendu React (échappement). |
| **Injection de prompt** via emails/documents | Contenus externes encadrés (`<email>…</email>`) et traités comme des données ; sorties IA **structurées** (JSON Schema) ; l'IA ne peut déclencher que des actions bornées (créer une tâche, un brouillon) ; **aucun envoi d'email, aucune suppression, aucun paiement** sans validation humaine. |
| Exécution de code (Claude Code) | Jamais dans le processus API : runner séparé, conteneur éphémère sans secrets métier ni accès base, réseau restreint, jeton dédié. |
| Abus / force brute | Limitation 300 req/min (Throttler), `helmet` (en-têtes de sécurité), CORS limité à `APP_URL`. |
| Accès transversal (futur multi-compte) | Toutes les requêtes filtrées par `userId` ; RLS PostgreSQL prête (`infra/supabase-rls.sql`, activation V2). |
| Poste perdu / mobile volé | Déconnexion à distance (révocation des sessions), données locales limitées à la copie de travail ; V2 : verrouillage biométrique de l'app mobile. |

## 16.2 Portées OAuth (moindre privilège)

| Portée | Pourquoi |
|---|---|
| `calendar` | Lecture/écriture de l'agenda (blocs planifiés). |
| `gmail.modify` | Lecture + libellés ; **pas** de suppression définitive. |
| `gmail.compose` | Création de **brouillons** (jamais d'envoi automatique par le code). |
| `drive.file` | Uniquement les fichiers **créés par Kairos** (pas d'accès au reste du Drive). |

## 16.3 Données & RGPD

- **Minimisation** : emails = métadonnées + résumé ; le contenu complet est relu à la demande et non persisté.
- **Hébergement UE** (Supabase région UE, API en France) ; chiffrement au repos (Supabase) et en transit (TLS 1.2+).
- **Sous-traitants IA** : utiliser des offres API sans entraînement sur les données ; possibilité de **désactiver l'IA par catégorie** (recommandé pour DOUANE si la politique de l'administration l'exige — le tri se fait alors par règles locales `guessCategory`) — réglage prévu en V2.
- **Droits** : export complet (JSON) et suppression définitive du compte (cascade `onDelete`), prévus en V2 (`/me/export`, `/me`).
- **Journalisation** : `TaskEvent`, `AutomationLog`, `AiRun` tracent qui (utilisateur, IA, système) a fait quoi ; les journaux applicatifs ne contiennent ni jetons ni contenus.

## 16.4 Sécurité applicative (checklist)

- [x] Garde d'authentification **globale** (toute route est privée sauf `@Public()` explicite).
- [x] Configuration validée au démarrage ; `ENCRYPTION_KEY` obligatoire en production.
- [x] `dev-login` impossible en production.
- [x] En-têtes `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (micro autorisé pour soi seulement).
- [x] CSP stricte côté desktop (Tauri).
- [x] Conteneurs non-root, image minimale Alpine, health check.
- [ ] (MVP S5) Analyse des dépendances (Dependabot / `pnpm audit`), SAST (CodeQL).
- [ ] (V2) Activation RLS, 2FA locale (clé d'accès / passkey) en plus de Google, rotation automatique de `ENCRYPTION_KEY`.

## 16.5 Réponse à incident

1. Révoquer toutes les sessions (table `Session`) et l'accès de Kairos dans le compte Google (myaccount.google.com → Sécurité → Applications tierces).
2. Faire tourner `JWT_SECRET`, `ENCRYPTION_KEY` (re-chiffrement des jetons), clés IA et jeton WhatsApp.
3. Analyser `AutomationLog` / `AiRun` / journaux d'accès ; restaurer via PITR si nécessaire.
