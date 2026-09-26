/**
 * Données de démonstration : `pnpm db:seed` (après `pnpm db:migrate`).
 * Crée l'utilisateur OWNER_EMAIL, ses catégories et un jeu de tâches réaliste.
 */
import { PrismaClient, type Priority } from '@prisma/client';
import { DEFAULT_AI_ROUTING, DEFAULT_CATEGORIES, DEFAULT_SCHEDULER_SETTINGS } from '@kairos/core';

const prisma = new PrismaClient();
const inDays = (d: number, h = 18) => {
  const x = new Date();
  x.setDate(x.getDate() + d);
  x.setHours(h, 0, 0, 0);
  return x;
};

async function main() {
  const email = (process.env.OWNER_EMAIL ?? 'demo@kairos.local').toLowerCase();
  const user = await prisma.user.upsert({ where: { email }, update: {}, create: { email, name: 'Propriétaire' } });
  await prisma.userSettings.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id, workingHours: DEFAULT_SCHEDULER_SETTINGS.workingHours as object } });

  const cats: Record<string, string> = {};
  for (const [position, c] of DEFAULT_CATEGORIES.entries()) {
    const row = await prisma.category.upsert({
      where: { userId_slug: { userId: user.id, slug: c.id } },
      update: {},
      create: { userId: user.id, slug: c.id, name: c.name, color: c.color, icon: c.icon, weight: c.weight, subcategories: c.subcategories, isSystem: true, position },
    });
    cats[c.id] = row.id;
  }
  for (const r of DEFAULT_AI_ROUTING) {
    await prisma.aiRoutingRule.upsert({ where: { userId_capability: { userId: user.id, capability: r.capability } }, update: {}, create: { userId: user.id, ...r } });
  }

  const tasks: Array<[string, string, string, Priority, number, Date | null, string[]?]> = [
    ['douane', 'Contrôles', 'Rédiger le PV de contrôle entrepôt Lesquin', 'CRITICAL', 90, inDays(1, 12), ['Relire constatations', 'Joindre photos', 'Signature chef de service']],
    ['douane', 'Courriers', 'Réponse au courrier du service contentieux', 'HIGH', 45, inDays(2)],
    ['iris-renov', 'Devis', 'Devis rénovation salle de bain — M. Martin', 'HIGH', 60, inDays(1)],
    ['iris-renov', 'Relances', 'Relancer facture impayée chantier Roubaix', 'MEDIUM', 15, inDays(0, 17)],
    ['iris-renov', 'Fournisseurs', 'Commander carrelage chez Point P', 'MEDIUM', 20, inDays(3)],
    ['sci-cambraie', 'Financement', 'Envoyer les pièces du prêt à la banque', 'CRITICAL', 40, inDays(2, 10), ['Avis d’imposition', 'Bilan SCI', 'Plan de financement']],
    ['sci-cambraie', 'Permis', 'Vérifier l’affichage du permis de construire', 'LOW', 30, inDays(6)],
    ['personnel', 'Santé', 'Prendre rendez-vous chez le dentiste', 'LOW', 10, null],
    ['personnel', 'Investissements', 'Analyser les performances du PEA', 'MEDIUM', 60, inDays(5)],
  ];
  for (const [cat, sub, title, priority, minutes, dueAt, checklist] of tasks) {
    await prisma.task.create({
      data: {
        userId: user.id,
        categoryId: cats[cat],
        subcategory: sub,
        title,
        priority,
        estimatedMinutes: minutes,
        dueAt,
        deepWork: minutes >= 60,
        checklist: { create: (checklist ?? []).map((label, position) => ({ label, position })) },
        history: { create: { actor: 'SYSTEM', action: 'created', details: { seed: true } } },
      },
    });
  }
  await prisma.goal.createMany({
    data: [
      { userId: user.id, title: 'Tâches terminées cette semaine', period: 'WEEK', periodStart: inDays(-new Date().getDay() + 1, 0), target: 20, current: 7, unit: 'tâches' },
      { userId: user.id, title: 'Chiffre d’affaires Iris Renov', period: 'MONTH', periodStart: inDays(-new Date().getDate() + 1, 0), target: 45000, current: 28500, unit: '€', categoryId: cats['iris-renov'] },
    ],
  });
  console.log(`Seed terminé pour ${email}`);
}

main().finally(() => prisma.$disconnect());
