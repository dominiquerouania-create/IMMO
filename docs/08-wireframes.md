# 8. Wireframes

Basse fidélité, structure et hiérarchie uniquement. Les maquettes haute fidélité (captures de l'application réelle) sont dans [09-maquettes-ui.md](09-maquettes-ui.md).

## 8.1 Tableau de bord — desktop (≥ 1280 px)

```
┌────────────┬──────────────────────────────────────────────────────────────────────┐
│ ◆ Kairos   │ [🔍 Rechercher, ajouter, demander à Kairos…  ⌘K]        ◌sync  🔔2  ◐ │
│            ├──────────────────────────────────────────────────────────────────────┤
│[+ Nouvelle]│ Lundi 28 septembre                                                   │
│            │ Bonjour 👋                                           [⚙ Personnaliser]│
│ ▣ Accueil  │ ✨ 2 rendez-vous · 6 sessions planifiées · 50 min libres · 1 en retard │
│ ☑ Tâches   │                                                                      │
│ ▦ Calendr. │ ┌ Score de productivité ┐ ┌ Recommandations IA  [Optimiser]┐ ┌ Retards ┐│
│ ✉ Emails   │ │  71 /100  ▰▰▰▰▰▰▰▱▱▱  │ │ ⚠ « Relancer facture » en retard │ │ ○ …     ││
│ ▤ Documents│ │ [Term. 2] [Retard 1]   │ │ ✉ Email urgent sans tâche        │ └─────────┘│
│ ▥ Productiv│ │ [Libre 50m][IA 0m]     │ │ 💡 2 h de concentration protégées │ ┌Critiques┐│
│ ◎ Assistant│ └────────────────────────┘ └──────────────────────────────────┘ │ ○ PV …  ││
│            │ ┌ Planning du jour ──────┐ ┌ Rendez-vous ─────────────────────┐ └─────────┘│
│ ESPACES    │ │ ● 09:00 Réunion service │ │ [AUJ 14:00] Visio client        │ ┌Objectifs┐│
│ ● Douane 4 │ │ ● 10:30 ✨ PV contrôle  │ │ [AUJ 16:30] Appel banque        │ │ ▰▰▰▱ 12/20││
│ ● Iris   5 │ │ ● 13:30 ✨ Relance      │ └──────────────────────────────────┘ └─────────┘│
│ ● SCI    3 │ │ ● 14:00 Visio client    │ ┌ Emails importants ─────────────┐ ┌ Notifs ─┐│
│ ● Perso  4 │ └────────────────────────┘ │ [Urgent] Banque — pièces prêt   │ │ ● …     ││
│            │ ┌ Tâches prioritaires ───┐ │  Résumé IA… [Transformer en tâche]│ └─────────┘│
│ ⚙ Paramètr.│ │ ○ Titre      [Critique] │ └──────────────────────────────────┘            │
│            │ │   ● Douane · Demain 12h │ ┌ Charge de travail ■réunions ■tâches┐          │
│            │ └────────────────────────┘ │ Auj.  ■■■■■■■■■░░  88 %            │          │
└────────────┴────────────────────────────┴──────────────────────────────────────────────┘
```

Disposition en colonnes « maçonnerie » (1 → 2 → 3 colonnes) ; ordre et visibilité des widgets personnalisables.

## 8.2 Tableau de bord — mobile (390 px)

```
┌──────────────────────────────┐
│ ◆ [🔍 Rechercher…]    🔔 ◐   │
├──────────────────────────────┤
│ Lundi 28 septembre           │
│ Bonjour 👋                   │
│ ✨ 2 RDV · 6 sessions · 50 min│
│ [⚙ Personnaliser]            │
│ ┌ Score  71/100 ───────────┐ │
│ │ ▰▰▰▰▰▰▰▱▱▱               │ │
│ │ [Term 2]   [Retard 1]    │ │
│ └──────────────────────────┘ │
│ ┌ Planning du jour ────────┐ │
│ │ 09:00 Réunion de service │ │
│ │ 10:30 ✨ PV de contrôle   │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│  ▣     ☑     (＋)    ▦    ◎  │
│Accueil Tâches      Cal. Assist│
└──────────────────────────────┘
```

## 8.3 Tâches (liste / calendrier / chronologie)

```
┌────────────────────────────────────────────────────────────────────────┐
│ ● Iris Renov  5                     [☰ Liste][▦ Calendrier][▬ Chrono]  │
│ [🔍 Rechercher] [Catégorie ▾] [Statut ▾] [☐ Urgent uniquement]          │
│ ┌──────────────────────────────────────────────────────────────────┐   │
│ │ ＋ Ajouter une tâche… (⌘K pour la saisie intelligente)  [Ajouter] │   │
│ └──────────────────────────────────────────────────────────────────┘   │
│ EN COURS · 1                                                            │
│  ○ Point chantier Villeneuve            ⚠   [Haute]                     │
│    ● Iris Renov · Chantiers  📅 mer. 11:00  ⏱ 45 min                   │
│ À FAIRE · 4                                                             │
│  ○ Devis salle de bain — M. Martin          [Haute]                     │
│    ● Iris Renov · Devis  📅 Demain 18:00  ⏱ 1 h  ☑ 1/3                  │
│ CHRONOLOGIE :  titre │ lun │ mar │ mer │ jeu │ … (14 j)                  │
│  Devis SDB          │ ████████│                                          │
│  Pièces prêt        │      ██████|   (| = échéance, rouge si dépassée)   │
└────────────────────────────────────────────────────────────────────────┘
```

## 8.4 Panneau de détail d'une tâche (tiroir droit)

```
                              ┌───────────────────────────────────┐
                              │ Rédiger le PV de contrôle       ✕ │
                              ├───────────────────────────────────┤
                              │ Statut [À faire ▾] Priorité [Crit▾]│
                              │ Catégorie [Douane▾] Sous-c. [Ctrl▾]│
                              │ Échéance [29/09 12:00] Durée [120] │
                              │ ☑ Planif. IA ☑ Découpable ☑ Focus  │
                              │ 📅 Planifiée lun. 10:30 → 12:30     │
                              │ DESCRIPTION  [……………………………]        │
                              │ NOTES        [……………………………]        │
                              │ CHECKLIST 1/3  ☑ … ☐ … ☐ …  [+ …]  │
                              │ SOUS-TÂCHES  …                [+ …]│
                              │ PIÈCES JOINTES  📎 …               │
                              │ HISTORIQUE  créée… IA · replanifiée│
                              │ [🗑 Supprimer]           [Fermer]  │
                              └───────────────────────────────────┘
```

## 8.5 Calendrier (semaine)

```
┌ Semaine du lun. 28 sept.   [‹][Aujourd'hui][›] [Jour|Semaine|Mois] [+RDV] [✨ Planifier] ┐
│      LUN 28 │ MAR 29 │ MER 30 │ JEU 1 │ VEN 2 │ SAM 3 │ DIM 4 │  ┌ Légende ────────┐ │
│ 09:00 ▒Réun.│ ░Devis │ ▒Notaire│       │       │ ▓Focus│       │  │ ▒ RDV Google    │ │
│ 10:00 ─now──│ ▒Ctrl  │ ░Décl. │       │       │       │       │  │ ░ Tâche IA      │ │
│ 10:30 ░PV   │        │        │       │ ▒Hebdo│       │       │  │ ▓ Concentration │ │
│ 14:00 ▒Visio│ ░Vérif │ ░Synth.│ ▓Focus│ ▓Focus│       │       │  ├ Conflits ───────┤ │
│ 16:30 ▒Appel│ ░Comp. │        │       │       │       │       │  ├ Créneaux libres ┤ │
│             │        │        │       │       │       │       │  │ lun 10:30–11:30 │ │
└─────────────┴────────┴────────┴───────┴───────┴───────┴───────┴──┴─────────────────┘ ┘
```

## 8.6 Emails

```
┌ Emails                                 [Tous][Urgent][Important] ┐
│ ✨ Gmail analysé en continu…                                      │
│ ┌ Liste ───────────────────┐ ┌ Détail ─────────────────────────┐ │
│ │ Banque        08:12       │ │ credit@banque.fr                 │ │
│ │ Dossier de prêt SCI…      │ │ Dossier de prêt — pièces manq.   │ │
│ │ [Urgent][📅 mer 10:00]    │ │ ┌ ✨ Résumé IA ─────────────────┐ │ │
│ ├───────────────────────────┤ │ │ … Actions demandées : • • •   │ │ │
│ │ M. Martin    07:40        │ │ │ Échéance détectée : mer 10:00 │ │ │
│ │ Devis salle de bain       │ │ └───────────────────────────────┘ │ │
│ │ [Important]               │ │ [☑ Transformer en tâche] [✎ Brouillon]│
│ └───────────────────────────┘ └──────────────────────────────────┘ │
```

## 8.7 Assistant (chat + voix)

```
┌ Assistant IA                         ☑ Réponses vocales ┐
│ (◎) Bonjour ! Je suis Kairos…                            │
│                    Quelles sont mes priorités ? (👤)      │
│ (◎) Vos priorités : 1. … 2. … 3. …  [Ouvrir →]           │
│ [Ajoute une réunion demain à 14h.] [Prépare mon planning]│
│ ┌──────────────────────────────────────────────────────┐ │
│ │ (🎤)  Demandez à Kairos…                       [➤]   │ │
│ └──────────────────────────────────────────────────────┘ │
```

## 8.8 Barre de commande (⌘K)

```
┌──────────────────────────────────────────────────────┐
│ ✨ Appeler la banque vendredi 10h #sci !urgent 30min 🎤│
├──────────────────────────────────────────────────────┤
│ Nouvelle tâche « Appeler la banque » 📅 vendredi 10:00│
│ ⏱ 30 min  Haute  🏷 SCI Cambraie                       │
├──────────────────────────────────────────────────────┤
│ Exemples : Ajoute une réunion demain à 14h         ↵ │
│            Prépare mon planning de demain           ↵ │
└──────────────────────────────────────────────────────┘
```
