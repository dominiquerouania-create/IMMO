import { DEFAULT_CATEGORIES, type CalendarEvent, type Email, type Goal, type Priority, type Task, type TaskStatus } from '@kairos/core';
import { addDays, startOfDay, uid } from './format';

/** Jeu de données de démonstration, daté relativement à « maintenant ». */
export function buildDemoData(now = new Date()) {
  const at = (dayOffset: number, h: number, m = 0) => {
    const d = addDays(startOfDay(now), dayOffset);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  const created = addDays(now, -4).toISOString();

  const t = (
    categoryId: string,
    subcategory: string,
    title: string,
    priority: Priority,
    estimatedMinutes: number,
    dueAt: string | null,
    extra: Partial<Task> = {},
  ): Task => ({
    id: uid(),
    title,
    categoryId,
    subcategory,
    priority,
    status: 'TODO' as TaskStatus,
    estimatedMinutes,
    dueAt,
    autoSchedule: true,
    splittable: estimatedMinutes > 60,
    minChunkMinutes: 45,
    deepWork: estimatedMinutes >= 60,
    checklist: [],
    attachments: [],
    tags: [],
    source: 'MANUAL',
    createdAt: created,
    updatedAt: created,
    ...extra,
  });

  const cl = (...labels: string[]) => labels.map((label, i) => ({ id: uid(), label, done: i === 0 }));

  const tasks: Task[] = [
    t('douane', 'Contrôles', 'Rédiger le PV de contrôle — entrepôt Lesquin', 'CRITICAL', 120, at(1, 12), {
      description: 'PV suite au contrôle du 12 : marchandises non déclarées (lot 4). Joindre photos et inventaire.',
      checklist: cl('Relire les constatations', 'Joindre photos et inventaire', 'Faire signer le chef de service'),
    }),
    t('douane', 'Courriers', 'Réponse au service contentieux (dossier 2026/118)', 'HIGH', 45, at(2, 17)),
    t('douane', 'Réunions', 'Préparer la réunion de brigade', 'MEDIUM', 30, at(3, 9)),
    t('douane', 'Dossiers juridiques', 'Synthèse jurisprudence retenue douanière', 'LOW', 90, at(9, 18)),
    t('iris-renov', 'Devis', 'Devis rénovation salle de bain — M. Martin', 'HIGH', 60, at(1, 18), {
      checklist: cl('Métré sur place', 'Chiffrage carrelage et plomberie', 'Envoyer le devis'),
    }),
    t('iris-renov', 'Relances', 'Relancer facture impayée — chantier Roubaix', 'MEDIUM', 15, at(-1, 17), { source: 'EMAIL' }),
    t('iris-renov', 'Fournisseurs', 'Commander carrelage chez le fournisseur', 'MEDIUM', 20, at(3, 12)),
    t('iris-renov', 'Chantiers', 'Point chantier Villeneuve — photos et avancement', 'HIGH', 45, at(2, 11), { status: 'IN_PROGRESS' }),
    t('iris-renov', 'Sous-traitants', 'Attestation URSSAF du sous-traitant électricité', 'MEDIUM', 10, at(4, 12), { status: 'WAITING' }),
    t('sci-cambraie', 'Financement', 'Envoyer les pièces du prêt à la banque', 'CRITICAL', 40, at(2, 10), {
      checklist: cl('Avis d’imposition', 'Bilan SCI 2025', 'Plan de financement signé'),
    }),
    t('sci-cambraie', 'Permis', 'Vérifier l’affichage du permis de construire', 'LOW', 30, at(6, 18)),
    t('sci-cambraie', 'Travaux', 'Comparer les 3 devis gros œuvre', 'HIGH', 90, at(5, 18)),
    t('personnel', 'Santé', 'Prendre rendez-vous chez le dentiste', 'LOW', 10, null),
    t('personnel', 'Investissements', 'Analyser les performances du PEA', 'MEDIUM', 60, at(5, 20)),
    t('personnel', 'Famille', 'Réserver le restaurant pour l’anniversaire', 'MEDIUM', 15, at(4, 19)),
    t('personnel', 'Administratif', 'Déclaration de revenus — pièces justificatives', 'HIGH', 60, at(8, 18)),
    t('iris-renov', 'Factures', 'Émettre la facture — chantier Lambersart', 'HIGH', 20, at(-2, 12), {
      status: 'DONE',
      completedAt: at(-2, 11),
      actualMinutes: 25,
    }),
    t('douane', 'Notes administratives', 'Note de service — planning des congés', 'MEDIUM', 30, at(-1, 12), {
      status: 'DONE',
      completedAt: at(-1, 10),
      actualMinutes: 30,
    }),
  ];

  const ev = (dayOffset: number, h: number, m: number, durationMin: number, title: string, location?: string): CalendarEvent => {
    const start = at(dayOffset, h, m);
    return { id: uid(), title, start, end: new Date(new Date(start).getTime() + durationMin * 60_000).toISOString(), kind: 'EVENT', location };
  };

  const events: CalendarEvent[] = [
    ev(0, 9, 0, 60, 'Réunion de service — Douane', 'Bureau de Lille'),
    ev(0, 14, 0, 45, 'Visio client — M. Martin', 'Google Meet'),
    ev(0, 16, 30, 30, 'Appel conseiller bancaire (SCI)'),
    ev(1, 10, 0, 90, 'Contrôle terrain — zone logistique'),
    ev(1, 15, 0, 60, 'Réunion chantier Villeneuve', 'Villeneuve-d’Ascq'),
    ev(2, 8, 30, 60, 'Rendez-vous notaire — SCI Cambraie', 'Étude Maître Leroy'),
    ev(3, 12, 30, 90, 'Déjeuner famille'),
    ev(4, 11, 0, 60, 'Point hebdo Iris Renov'),
  ];

  const emails: Email[] = [
    { id: uid(), threadId: 't1', from: 'Banque Populaire <credit@banque.fr>', subject: 'Dossier de prêt SCI Cambraie — pièces manquantes', snippet: 'Merci de nous transmettre avant jeudi…', receivedAt: at(0, 8, 12), labels: ['INBOX'], importance: 'URGENT', summary: 'La banque réclame 3 pièces pour le prêt de la SCI avant jeudi 10 h.', detectedActions: ['Envoyer avis d’imposition', 'Envoyer bilan 2025', 'Envoyer plan de financement'], detectedDeadline: at(2, 10) },
    { id: uid(), threadId: 't2', from: 'M. Martin <martin.p@gmail.com>', subject: 'Devis salle de bain', snippet: 'Bonjour, suite à votre visite…', receivedAt: at(0, 7, 40), labels: ['INBOX'], importance: 'IMPORTANT', summary: 'Le client attend le devis de la salle de bain et demande une date de démarrage.', detectedActions: ['Envoyer le devis', 'Proposer une date de démarrage'] },
    { id: uid(), threadId: 't3', from: 'Service contentieux <contentieux@douane.finances.gouv.fr>', subject: 'Dossier 2026/118 — demande d’éléments', snippet: 'Veuillez nous faire parvenir…', receivedAt: at(-1, 16, 5), labels: ['INBOX'], importance: 'IMPORTANT', summary: 'Demande d’éléments complémentaires sur le dossier 2026/118.', detectedActions: ['Rassembler les pièces', 'Répondre au service'] },
    { id: uid(), threadId: 't4', from: 'Fournisseur Carrelage <commandes@carrelage.fr>', subject: 'Confirmation de disponibilité', snippet: 'Le modèle est disponible…', receivedAt: at(-1, 11, 30), labels: ['INBOX'], importance: 'NORMAL', summary: 'Le carrelage choisi est disponible, livraison sous 5 jours.', detectedActions: [] },
    { id: uid(), threadId: 't5', from: 'Mairie <urbanisme@mairie.fr>', subject: 'Permis de construire — rappel affichage', snippet: 'Nous vous rappelons…', receivedAt: at(-2, 9, 0), labels: ['INBOX'], importance: 'NORMAL', summary: 'Rappel : le panneau de permis doit rester visible pendant toute la durée des travaux.', detectedActions: ['Vérifier le panneau'] },
    { id: uid(), threadId: 't6', from: 'Newsletter Immo <news@immo.fr>', subject: 'Les taux du mois', snippet: 'Cette semaine…', receivedAt: at(-2, 7, 0), labels: ['INBOX'], importance: 'LOW', summary: 'Newsletter : évolution des taux immobiliers.', detectedActions: [] },
  ];

  const goals: Goal[] = [
    { id: uid(), title: 'Tâches terminées', period: 'WEEK', periodStart: at(-((now.getDay() + 6) % 7), 0), target: 20, current: 12, unit: 'tâches' },
    { id: uid(), title: 'Heures de concentration', period: 'WEEK', periodStart: at(-((now.getDay() + 6) % 7), 0), target: 10, current: 6.5, unit: 'h' },
    { id: uid(), title: 'CA Iris Renov', period: 'MONTH', periodStart: at(-now.getDate() + 1, 0), target: 45000, current: 28500, unit: '€', categoryId: 'iris-renov' },
    { id: uid(), title: 'Dossier prêt SCI bouclé', period: 'MONTH', periodStart: at(-now.getDate() + 1, 0), target: 1, current: 0, unit: 'jalon', categoryId: 'sci-cambraie' },
  ];

  // Historique d'actions autonomes (alimente « Temps gagné grâce à l'IA » et le journal).
  const auto = (dayOffset: number, h: number, type: string, summary: string) => ({ id: uid(), at: at(dayOffset, h), type, summary });
  const automations = [
    auto(0, 8, 'EMAIL_SUMMARIZED', 'Email « Dossier de prêt SCI Cambraie — pièces manquantes » analysé : urgent, 3 actions'),
    auto(0, 7, 'AUTO_SCHEDULED', 'Planning de la semaine recalculé — 15 sessions, 9 blocs de concentration'),
    auto(-1, 16, 'TASK_CREATED_FROM_EMAIL', 'Tâche créée depuis « Dossier 2026/118 — demande d’éléments »'),
    auto(-1, 16, 'DRAFT_GENERATED', 'Brouillon de réponse préparé pour le service contentieux'),
    auto(-2, 11, 'DOCUMENT_GENERATED', 'Facture « Chantier Lambersart » générée et classée dans Drive'),
    auto(-2, 9, 'RESCHEDULED', '« Commander carrelage » replanifiée (session manquée)'),
    auto(-3, 18, 'DOCUMENT_GENERATED', 'Compte-rendu « Réunion de brigade » rédigé'),
    auto(-3, 10, 'TASK_CREATED_FROM_EMAIL', 'Tâche créée depuis « Relance facture chantier Roubaix »'),
  ];

  return { tasks, events, emails, goals, automations, categories: DEFAULT_CATEGORIES };
}
