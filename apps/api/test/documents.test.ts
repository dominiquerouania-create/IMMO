import { describe, expect, it } from 'vitest';
import { parseMarkdown, renderDocx, renderPdf } from '../src/modules/documents/renderers';
import { renderQuoteOrInvoice } from '../src/modules/documents/templates';

const quote = renderQuoteOrInvoice('QUOTE', {
  number: 'D-2026-001',
  company: { name: 'IRIS RENOV' },
  client: { name: 'M. Martin' },
  lines: [
    { label: 'Dépose ancienne salle de bain', quantity: 1, unitPrice: 800 },
    { label: 'Carrelage', quantity: 12, unit: 'm²', unitPrice: 55, vatRate: 0.1 },
  ],
});

describe('documents', () => {
  it('calcule les totaux du devis', () => {
    expect(quote).toContain('D-2026-001');
    expect(quote).toMatch(/Total HT : \*\*1\s?460,00\s€\*\*/);
    expect(quote).toMatch(/Total TTC : \*\*1\s?686,00\s€\*\*/); // 800×1,2 + 660×1,1 = 960 + 726
  });

  it('parse titres, listes et tableaux', () => {
    const blocks = parseMarkdown(quote);
    expect(blocks[0]).toMatchObject({ type: 'h', level: 1 });
    const table = blocks.find((b) => b.type === 'table');
    expect(table && table.type === 'table' && table.rows.length).toBe(3);
  });

  it('génère un PDF et un DOCX valides', async () => {
    const pdf = await renderPdf('Devis', quote);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    const docx = await renderDocx('Devis', quote);
    expect(docx.subarray(0, 2).toString()).toBe('PK');
  });
});
