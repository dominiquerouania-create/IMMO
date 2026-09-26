# 2. Cahier des charges détaillé

## 2.1 Contexte et objectifs

**Utilisateur unique** menant de front quatre domaines : une activité d'agent des **Douanes**, l'entreprise de rénovation **Iris Renov**, la société civile immobilière **SCI Cambraie** et sa vie **personnelle**.

**Objectifs mesurables**

| # | Objectif | Indicateur | Cible à 3 mois |
|---|---|---|---|
| O1 | Ne plus oublier aucune tâche | Tâches en retard non signalées | 0 |
| O2 | Planifier automatiquement | Part des tâches datées placées par l'IA | ≥ 90 % |
| O3 | Gagner du temps | « Temps gagné grâce à l'IA » (journal des automatisations) | ≥ 4 h / semaine |
| O4 | Réduire la charge mentale | Emails importants transformés en tâche sans intervention | ≥ 80 % |
| O5 | Clarté des priorités | Temps pour connaître ses 3 priorités à l'ouverture | < 5 s |
| O6 | Tenir les échéances | Taux de ponctualité (tâches finies avant échéance) | ≥ 90 % |

## 2.2 Périmètre fonctionnel

### F1 — Tableau de bord (écran d'accueil)
Affiche, en une requête (`GET /dashboard`), et **personnalisable** (afficher/masquer/réordonner, persistant) :
planning du jour · tâches prioritaires · rendez-vous · emails importants · charge de travail (7 j) · temps disponible restant · retards et tâches à risque · objectifs de la semaine · objectifs du mois · tâches critiques · notifications importantes · recommandations de l'IA · score de productivité.

**Critères d'acceptation**
- Ouverture < 1,5 s sur 4G (données locales affichées immédiatement, rafraîchies ensuite).
- Le résumé d'en-tête indique rendez-vous à venir, sessions planifiées, temps libre et retards.
- Personnalisation conservée entre sessions et appareils (`PUT /dashboard/layout`).

### F2 — Gestion des tâches
Champs : titre, description, priorité (Critique/Haute/Moyenne/Basse), catégorie + sous-catégorie, date et heure limites, durée estimée, pièces jointes, statut, notes, historique (immuable), checklist, sous-tâches avec échéances propres, documents associés, tags, source (manuel/email/voix/IA).
Statuts : **À faire · En cours · En attente · Terminée · Reportée · Annulée**.
Affichages : **Liste** (groupée par statut, triée par score), **Calendrier** (mois, par échéance), **Chronologie** (Gantt 14 j : session planifiée → échéance, alerte si dépassement).

**Critères d'acceptation**
- Saisie rapide en langage naturel : « Appeler la banque vendredi 10h30 #sci !urgent 30min » → titre, date/heure, catégorie, priorité, durée détectés, aperçu avant validation.
- Toute modification est historisée (acteur USER / AI / SYSTEM).
- Déplacer manuellement une tâche dans le calendrier la « verrouille » (l'IA ne la déplace plus).

### F3 — Catégories
Catégories système (non supprimables, archivables) et leurs sous-catégories :

| Catégorie | Sous-catégories |
|---|---|
| DOUANE | Contrôles · Enquêtes · Réunions · Courriers · Dossiers juridiques · Notes administratives |
| IRIS RENOV | Chantiers · Devis · Factures · Relances · Fournisseurs · Sous-traitants · Commandes · Réunions clients |
| SCI CAMBRAIE | Construction · Administratif · Financement · Banque · Permis · Travaux |
| PERSONNEL | Santé · Famille · Loisirs · Administratif · Investissements · Objectifs personnels |

Catégories personnalisées : nom, couleur, icône, poids de priorité (0,5–2), sous-catégories.

### F4 — Planification automatique IA (niveau 5)
L'IA : crée des tâches (emails, voix), réorganise le calendrier, identifie les priorités (score dynamique), détecte les urgences, déplace les tâches non réalisées, réserve du temps de concentration, répartit la charge (plafond quotidien), évite les conflits, optimise en continu (boucle 10 min + évènements).

Niveaux d'autonomie réglables : 1 suggestions · 2 propose/valide · 3 agit sur l'agenda · 4 + emails → tâches · **5 autonome, rend compte, annulable** (défaut).

**Critères d'acceptation**
- Aucune tâche planifiée hors heures de travail ni sur une réunion (tampon 10 min).
- Tâche impossible à tenir → marquée « à risque » avec minutes manquantes, recommandation, rappels renforcés.
- Replanification < 3 s après modification.

### F5 — Calendrier (Google Calendar)
Synchronisation bidirectionnelle (pull incrémental `syncToken` + notifications push ; push des blocs Kairos marqués d'une propriété privée), détection des créneaux libres, réservation automatique de plages, fusion tâches/évènements, reprogrammation intelligente, **vues Jour / Semaine / Mois**, détection des conflits.

### F6 — Emails (Gmail)
Lecture (boîte de réception, 3 derniers jours, hors promotions/réseaux sociaux), classification d'importance (Urgent/Important/Normal/Faible), détection des actions demandées et des échéances, transformation en tâche (checklist = actions), résumés, **brouillons de réponse déposés dans Gmail — jamais envoyés automatiquement**, synthèse quotidienne.

### F7 — Intégrations IA
Architecture à fournisseurs interchangeables (`AiProvider`), table de routage **capacité → moteur principal + repli** éditable dans Paramètres :

| Capacité | Défaut | Repli |
|---|---|---|
| Rédaction, résumés, tri des emails, brouillons, planification, extraction de tâches | Claude | Copilot / Skywork |
| Documents Microsoft (Word/Excel) | Microsoft Copilot | Claude |
| Automatisations | Skywork AI | Claude |
| Développement & scripts | Claude Code (runner isolé) | Claude |

Chaque appel est journalisé (moteur, modèle, jetons, latence, succès).

### F8 — Commandes vocales
Web Speech API (web/desktop), reconnaissance native (mobile). Parseur français local (hors ligne) + repli LLM. Commandes minimales : « Ajoute une réunion demain à 14h. » · « Prépare mon planning de demain. » · « Quelles sont mes priorités aujourd'hui ? » · « Transforme cet email en tâche. » · « Montre-moi tout ce qui est urgent. » Réponse vocale (synthèse fr-FR).

### F9 — Notifications WhatsApp
Délais : **la veille (19 h)** et **1 heure avant**. Missions critiques ou à risque : **J-3, matin même, 15 min avant, relance 2 h après** (« FAIT / REPORTER »). Heures calmes 22 h–7 h (sauf critique à 15 min). Reprise sur erreur (3 tentatives).

### F10 — Documents
Génération PDF et DOCX : comptes-rendus, rapports, courriers, devis, factures (TVA, totaux, mentions légales), checklists, synthèses. Données structurées pour devis/factures ; rédaction IA pour les autres.

### F11 — Stockage cloud (Google Drive)
Sauvegarde automatique des documents générés, classement `Kairos / Catégorie / Année / Type`, archivage, recherche (plein texte Drive + index local), portée `drive.file` (Kairos ne voit que ses fichiers).

### F12 — Mode hors ligne
Consultation des tâches, du calendrier (évènements et blocs), des documents récents ; création et modification de tâches ; planification locale. Synchronisation automatique au retour du réseau, indicateur « Hors ligne · n en attente ».

### F13 — Tableau de bord productivité
Tâches terminées · en retard · charge hebdomadaire · charge mensuelle · temps planifié · temps réellement utilisé · taux de productivité · temps gagné grâce à l'IA · objectifs atteints ; séries sur 8 semaines ; journal des automatisations.

## 2.3 Exigences non fonctionnelles

| Domaine | Exigence |
|---|---|
| Performance | API p95 < 300 ms (hors IA) ; planification de 500 tâches sur 14 j < 200 ms ; LCP web < 2 s. |
| Disponibilité | 99,5 % (usage personnel) ; le client reste utilisable hors ligne. |
| Sécurité | Voir [14-securite.md](14-securite.md) : allowlist, chiffrement, RGPD, confidentialité des dossiers douaniers. |
| Accessibilité | WCAG 2.1 AA : contraste, focus visible, navigation clavier (⌘K), `prefers-reduced-motion`, couleur jamais seule porteuse de sens. |
| Internationalisation | Français, fuseau Europe/Paris par défaut (paramétrable), formats fr-FR. |
| Compatibilité | iOS 16+, Android 10+, Windows 10+, macOS 12+, navigateurs evergreen. |
| Maintenabilité | TypeScript strict partout, moteur métier testé unitairement, CI obligatoire. |
| Coûts | Fonctionne sur offres gratuites/peu coûteuses (Supabase, Vercel/Fly) ; coût IA maîtrisé (effort bas pour le tri). |

## 2.4 Hors périmètre (MVP)
Multi-utilisateur/partage, facturation électronique (Chorus Pro), signature électronique, comptabilité, envoi automatique d'emails.
