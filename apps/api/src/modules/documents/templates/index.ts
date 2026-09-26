/**
 * Modèles de documents. Chaque modèle produit un contenu Markdown simple
 * (titres, listes, tableaux) rendu ensuite en PDF ou DOCX par les moteurs de rendu.
 */

export interface QuoteLine {
  label: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  vatRate?: number;
}

export interface CompanyInfo {
  name: string;
  address?: string;
  siret?: string;
  email?: string;
  phone?: string;
}

export const COMPANIES: Record<string, CompanyInfo> = {
  'iris-renov': { name: 'IRIS RENOV', address: 'Adresse à compléter', siret: 'SIRET à compléter' },
  'sci-cambraie': { name: 'SCI CAMBRAIE', address: 'Adresse à compléter' },
};

const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
const today = () => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date());

export function renderQuoteOrInvoice(kind: 'QUOTE' | 'INVOICE', data: { number: string; company: CompanyInfo; client: CompanyInfo; lines: QuoteLine[]; notes?: string; validityDays?: number; dueDays?: number }): string {
  const rows = data.lines.map((l) => {
    const ht = l.quantity * l.unitPrice;
    return { ...l, ht, vat: ht * (l.vatRate ?? 0.2) };
  });
  const totalHt = rows.reduce((s, r) => s + r.ht, 0);
  const totalVat = rows.reduce((s, r) => s + r.vat, 0);
  const title = kind === 'QUOTE' ? 'DEVIS' : 'FACTURE';
  return [
    `# ${title} N° ${data.number}`,
    `**${data.company.name}**${data.company.address ? ` — ${data.company.address}` : ''}${data.company.siret ? ` — SIRET ${data.company.siret}` : ''}`,
    `Date : ${today()}`,
    `## Client`,
    `${data.client.name}${data.client.address ? `\n${data.client.address}` : ''}`,
    `## Détail`,
    [
      `| Désignation | Qté | Unité | PU HT | TVA | Total HT |`,
      `|---|---|---|---|---|---|`,
      ...rows.map((r) => `| ${r.label} | ${r.quantity} | ${r.unit ?? 'u'} | ${eur(r.unitPrice)} | ${Math.round((r.vatRate ?? 0.2) * 100)} % | ${eur(r.ht)} |`),
    ].join('\n'),
    `## Totaux`,
    `- Total HT : **${eur(totalHt)}**`,
    `- TVA : **${eur(totalVat)}**`,
    `- Total TTC : **${eur(totalHt + totalVat)}**`,
    kind === 'QUOTE'
      ? `Devis valable ${data.validityDays ?? 30} jours. Bon pour accord (date, signature) :`
      : `Paiement à ${data.dueDays ?? 30} jours. Pénalités de retard : 3 fois le taux d'intérêt légal ; indemnité forfaitaire de recouvrement : 40 €.`,
    data.notes ? `## Notes\n${data.notes}` : '',
  ].filter(Boolean).join('\n\n');
}

export function renderChecklist(title: string, items: string[]): string {
  return [`# ${title}`, `Date : ${today()}`, ...items.map((i) => `- ☐ ${i}`)].join('\n\n');
}

/** Consignes de rédaction IA par type de document. */
export const AI_BRIEFS: Record<string, string> = {
  MINUTES: 'Rédige un compte-rendu de réunion : participants, ordre du jour, décisions, actions (responsable, échéance).',
  REPORT: 'Rédige un rapport structuré : contexte, constats, analyse, recommandations, conclusion.',
  LETTER: 'Rédige un courrier formel français (lieu/date, objet, formule d’appel, corps, formule de politesse, signature).',
  SUMMARY: 'Rédige une synthèse d’une page : points clés, chiffres, décisions attendues.',
  CHECKLIST: 'Produis une checklist opérationnelle exhaustive sous forme de liste à puces.',
};
