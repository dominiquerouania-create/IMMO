# 6. Design System — « Kairos »

Style : **moderne, professionnel, minimaliste, fluide, élégant**. Palette : **blanc, bleu professionnel, gris clair**. Modes **clair** et **sombre** (sombre = valeurs choisies, pas une inversion automatique).

Implémentation : tokens CSS dans [`apps/web/src/app/globals.css`](../apps/web/src/app/globals.css), exposés à Tailwind 4 via `@theme` (`bg-surface`, `text-ink-2`, `bg-primary-soft`…). Les composants n'utilisent **jamais** de couleur en dur.

## 6.1 Couleurs (rôles)

| Rôle | Token | Clair | Sombre | Usage |
|---|---|---|---|---|
| Fond d'app | `--bg` | `#F6F8FB` | `#0B1120` | Arrière-plan général |
| Surface | `--surface` | `#FFFFFF` | `#111827` | Cartes, panneaux |
| Surface 2 | `--surface-2` | `#F1F5F9` | `#172033` | Survols, KPI, champs |
| Surface 3 | `--surface-3` | `#E8EDF4` | `#1E293B` | Pistes de progression |
| Bordure | `--border` | `#E2E8F0` | `#1F2A3D` | Séparateurs |
| Texte | `--text` | `#0F172A` | `#F1F5F9` | Titres, contenu |
| Texte 2 | `--text-2` | `#475569` | `#CBD5E1` | Secondaire |
| Texte 3 | `--text-3` | `#64748B` | `#94A3B8` | Métadonnées |
| **Primaire** | `--primary` | `#1D4ED8` | `#3B82F6` | Actions, sélection, liens |
| Primaire doux | `--primary-soft` | `#EFF4FF` | `#172554` | Fonds actifs, blocs IA |
| Succès | `--good` | `#15803D` | `#4ADE80` | Terminé, concentration |
| Alerte | `--warning` | `#B45309` | `#FBBF24` | À risque, en attente, priorité haute |
| Critique | `--critical` | `#B91C1C` | `#F87171` | Retard, critique, suppression |

Les couleurs d'état sont **réservées** et toujours accompagnées d'une icône ou d'un libellé (jamais la couleur seule).

**Catégories** : Douane `#1D4ED8` · Iris Renov `#0891B2` · SCI Cambraie `#7C3AED` · Personnel `#059669` (pastille + nom, jamais la couleur seule).

**Graphiques** — palette catégorielle validée pour le daltonisme (ordre fixe, jamais cyclée) : série 1 bleu `#2A78D6` / `#3987E5` (sombre), série 2 orange `#EB6834` / `#D95926`, série 3 aqua `#1BAF7A` / `#199E70`.

## 6.2 Typographie

Police système Inter / SF / Segoe (aucun téléchargement, rendu natif sur chaque OS). Chiffres tabulaires (`.tabular`) pour les heures et KPI.

| Style | Taille / graisse | Usage |
|---|---|---|
| Display | 48 px / 600 | Score de productivité |
| H1 | 24 px / 600, interlettrage −0,01 em | Titre de page |
| H2 carte | 14 px / 600 | Titre de widget |
| Corps | 14 px / 400 | Texte courant |
| Petit | 12 px / 400 | Métadonnées |
| Micro | 11 px / 500 | Badges, étiquettes de section (MAJUSCULES) |

## 6.3 Espacements, rayons, ombres

- Grille de **4 px** : 4 · 8 · 12 · 16 · 20 · 24 · 32.
- Rayons : 6 px (badges), 8 px (boutons, champs), 12 px (tuiles), **16 px (cartes)**, 9999 px (pastilles).
- Ombres : `card` (subtile), `pop` (infobulles, menus), `modal` (tiroirs, dialogues).
- Largeur de contenu max 1400 px ; barre latérale 240 px ; tiroir de tâche 512 px.

## 6.4 Composants

| Composant | Variantes | Règles |
|---|---|---|
| `Button` | primary · secondary · ghost · danger ; md (36 px) · sm (32 px) | Un seul bouton primaire par zone. |
| `Card` | titre + icône + action | Conteneur de tous les widgets. |
| `Badge` | neutral · primary · good · warning · critical | Texte court, icône optionnelle. |
| `PriorityBadge` | Critique 🔥 · Haute ↑ · Moyenne – · Basse ↓ | Icône + libellé. |
| `StatusBadge` | 6 statuts | Couleur + libellé. |
| `Progress` | primary · good · warning · critical | `role=progressbar`, valeur ARIA. |
| `TaskRow` | complète · compacte | Case ronde, titre, catégorie, échéance (rouge si retard), durée, checklist, source, badges. |
| `CommandBar` | — | Dialogue modal, aperçu d'analyse en direct, exemples. |
| `TaskDrawer` | — | Panneau latéral droit, `Échap` ferme. |
| Graphiques | barres groupées, barres empilées | Légende dès 2 séries, infobulle au survol/focus, un seul axe, grille discrète. |

## 6.5 Mouvement

Animations **discrètes et professionnelles** : apparition des cartes (fondu + translation 4 px, 250 ms), tiroir (glissement 16 px, 220 ms), barres de progression (500 ms). Aucun rebond. `prefers-reduced-motion` coupe toutes les animations.

## 6.6 Iconographie

[Lucide](https://lucide.dev) 16–20 px, trait 2 px, couleur héritée. Icônes sémantiques constantes : ✨ `Sparkles` = action IA, 🎯 `Focus` = concentration, ⚠ `AlertTriangle` = risque, 🔥 `Flame` = critique.

## 6.7 Accessibilité

Contraste AA sur tous les couples texte/fond ; focus visible 2 px primaire ; navigation 100 % clavier ; libellés ARIA sur les boutons-icônes ; zones tactiles ≥ 44 px sur mobile ; `lang="fr"`.
