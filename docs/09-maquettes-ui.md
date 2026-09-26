# 9. Maquettes UI

Captures **de l'application réelle** (`apps/web`, mode démo), générées automatiquement avec Playwright (1440 × 900, horloge figée au lundi 28 septembre 2026 à 10:20, fuseau Europe/Paris). Elles se régénèrent à l'identique après chaque évolution de l'UI.

## Tableau de bord — mode clair
Score de productivité, recommandations de l'IA, planning du jour (réunions ✦ blocs de tâches placés par l'IA), priorités, rendez-vous, emails importants, charge de travail par jour, objectifs, notifications.

![Tableau de bord clair](maquettes/01-dashboard-clair.png)

## Tableau de bord — mode sombre
Même écran : les couleurs sombres sont des valeurs choisies (et non une inversion).

![Tableau de bord sombre](maquettes/02-dashboard-sombre.png)

## Tâches — liste
Groupées par statut, triées par score dynamique ; catégorie, échéance (rouge si retard), durée, checklist, origine email, priorité.

![Tâches liste](maquettes/03-taches-liste.png)

## Tâches — chronologie
Gantt 14 jours : de la session planifiée par l'IA jusqu'à l'échéance (trait rouge si la planification dépasse).

![Chronologie](maquettes/04-taches-chronologie.png)

## Détail d'une tâche
Tous les champs du cahier des charges, checklist, sous-tâches avec échéances, pièces jointes, historique.

![Détail tâche](maquettes/10-detail-tache.png)

## Calendrier — semaine
Rendez-vous Google (gris), sessions de tâches placées par l'IA (bleu), concentration protégée (vert), ligne « maintenant », créneaux libres, plan de l'IA.

![Calendrier](maquettes/05-calendrier-semaine.png)

## Emails
Tri par importance, résumé IA, actions demandées, échéance détectée, « Transformer en tâche », « Générer un brouillon ».

![Emails](maquettes/06-emails.png)

## Productivité
Indicateurs avancés, tâches créées vs terminées sur 8 semaines, répartition par espace, journal des automatisations.

![Productivité](maquettes/07-productivite.png)

## Assistant IA (chat + voix)

![Assistant](maquettes/08-assistant.png)

## Barre de commande ⌘K — saisie intelligente
Aperçu en direct de l'analyse : intention, titre, date, durée, priorité, catégorie.

![Barre de commande](maquettes/11-barre-commande.png)

## Paramètres
Intégrations, planification (autonomie 1–5, heures de travail, concentration, tampons), routage des moteurs IA, WhatsApp, catégories personnalisées.

![Paramètres](maquettes/09-parametres.png)

## Mobile (390 px)

<img src="maquettes/12-mobile-dashboard.png" alt="Mobile" width="320" />

---

Régénérer : lancer `pnpm --filter @kairos/web build && pnpm --filter @kairos/web start`, puis le script Playwright décrit dans [15-documentation-technique.md](15-documentation-technique.md#captures-décran).
