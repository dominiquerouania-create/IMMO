import type { Category } from './types';

/** Catégories système créées au premier démarrage (modifiables, non supprimables). */
export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'douane',
    name: 'Douane',
    color: '#1D4ED8',
    icon: 'shield',
    weight: 1.2,
    isSystem: true,
    subcategories: [
      'Contrôles',
      'Enquêtes',
      'Réunions',
      'Courriers',
      'Dossiers juridiques',
      'Notes administratives',
    ],
  },
  {
    id: 'iris-renov',
    name: 'Iris Renov',
    color: '#0891B2',
    icon: 'hammer',
    weight: 1.15,
    isSystem: true,
    subcategories: [
      'Chantiers',
      'Devis',
      'Factures',
      'Relances',
      'Fournisseurs',
      'Sous-traitants',
      'Commandes',
      'Réunions clients',
    ],
  },
  {
    id: 'sci-cambraie',
    name: 'SCI Cambraie',
    color: '#7C3AED',
    icon: 'building',
    weight: 1.1,
    isSystem: true,
    subcategories: ['Construction', 'Administratif', 'Financement', 'Banque', 'Permis', 'Travaux'],
  },
  {
    id: 'personnel',
    name: 'Personnel',
    color: '#059669',
    icon: 'user',
    weight: 1,
    isSystem: true,
    subcategories: [
      'Santé',
      'Famille',
      'Loisirs',
      'Administratif',
      'Investissements',
      'Objectifs personnels',
    ],
  },
];

/** Mots-clés servant au classement automatique (emails, saisie rapide, documents Drive). */
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  douane: ['douane', 'dgddi', 'contrôle', 'enquête', 'procès-verbal', 'pv', 'dédouanement', 'contentieux'],
  'iris-renov': ['iris', 'renov', 'chantier', 'devis', 'facture', 'fournisseur', 'sous-traitant', 'commande', 'client'],
  'sci-cambraie': ['sci', 'cambraie', 'permis', 'construction', 'prêt', 'banque', 'notaire', 'financement', 'travaux'],
  personnel: ['médecin', 'santé', 'famille', 'anniversaire', 'sport', 'vacances', 'impôts', 'investissement'],
};

/** Devine la catégorie la plus probable d'un texte libre (fallback avant l'IA). */
export function guessCategory(text: string, fallback = 'personnel'): string {
  const normalized = text.toLowerCase();
  let best = fallback;
  let bestScore = 0;
  for (const [id, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.reduce((s, k) => (normalized.includes(k) ? s + 1 : s), 0);
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  }
  return best;
}
