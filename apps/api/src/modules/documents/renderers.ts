import { AlignmentType, Document as DocxDocument, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import PDFDocument from 'pdfkit';

/** Mini-parseur Markdown → blocs (titres, puces, tableaux, paragraphes, **gras**). */
type Block =
  | { type: 'h'; level: number; text: string }
  | { type: 'li'; text: string }
  | { type: 'table'; rows: string[][] }
  | { type: 'p'; text: string };

export function parseMarkdown(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    if (!line.trim()) continue;
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      blocks.push({ type: 'h', level: h[1].length, text: h[2] });
    } else if (/^\s*[-*]\s+/.test(line)) {
      blocks.push({ type: 'li', text: line.replace(/^\s*[-*]\s+/, '') });
    } else if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      i--;
      blocks.push({ type: 'table', rows });
    } else {
      blocks.push({ type: 'p', text: line });
    }
  }
  return blocks;
}

const runs = (text: string) =>
  text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part) =>
    part.startsWith('**') ? new TextRun({ text: part.slice(2, -2), bold: true }) : new TextRun(part),
  );

export async function renderDocx(title: string, md: string): Promise<Buffer> {
  const children: Array<Paragraph | Table> = [];
  for (const b of parseMarkdown(md)) {
    if (b.type === 'h') {
      const heading = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][b.level - 1];
      children.push(new Paragraph({ heading, children: runs(b.text) }));
    } else if (b.type === 'li') {
      children.push(new Paragraph({ bullet: { level: 0 }, children: runs(b.text) }));
    } else if (b.type === 'table') {
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: b.rows.map((r, ri) => new TableRow({
            tableHeader: ri === 0,
            children: r.map((c) => new TableCell({ children: [new Paragraph({ children: ri === 0 ? [new TextRun({ text: c, bold: true })] : runs(c), alignment: AlignmentType.LEFT })] })),
          })),
        }),
      );
    } else {
      children.push(new Paragraph({ children: runs(b.text), spacing: { after: 120 } }));
    }
  }
  const doc = new DocxDocument({
    creator: 'Kairos',
    title,
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}

export function renderPdf(title: string, md: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: title, Author: 'Kairos' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const blue = '#1D4ED8';
    const strip = (s: string) => s.replace(/\*\*/g, '');
    for (const b of parseMarkdown(md)) {
      if (b.type === 'h') {
        doc.moveDown(b.level === 1 ? 0 : 0.6).font('Helvetica-Bold').fontSize([20, 14, 12][b.level - 1]).fillColor(b.level === 1 ? blue : '#0F172A').text(strip(b.text));
        doc.moveDown(0.3);
      } else if (b.type === 'li') {
        doc.font('Helvetica').fontSize(10.5).fillColor('#0F172A').text(`•  ${strip(b.text)}`, { indent: 10 });
      } else if (b.type === 'table') {
        const cols = b.rows[0]?.length ?? 1;
        const width = (doc.page.width - 112) / cols;
        for (const [ri, row] of b.rows.entries()) {
          const y = doc.y;
          row.forEach((cell, ci) => {
            doc.font(ri === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor('#0F172A').text(strip(cell), 56 + ci * width, y, { width: width - 6 });
          });
          doc.moveTo(56, doc.y + 2).lineTo(doc.page.width - 56, doc.y + 2).strokeColor('#E2E8F0').stroke();
          doc.x = 56;
          doc.moveDown(0.4);
        }
        doc.moveDown(0.5);
      } else {
        doc.font('Helvetica').fontSize(10.5).fillColor('#0F172A').text(strip(b.text), { align: 'justify' });
        doc.moveDown(0.4);
      }
    }
    doc.end();
  });
}
