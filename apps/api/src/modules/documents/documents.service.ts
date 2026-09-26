import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DocumentType } from '@prisma/client';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../../common/prisma.service';
import { AiTasksService } from '../ai/ai-tasks.service';
import { DriveService } from '../drive/drive.service';
import { renderDocx, renderPdf } from './renderers';
import { AI_BRIEFS, COMPANIES, renderChecklist, renderQuoteOrInvoice, type QuoteLine } from './templates';

export interface GenerateInput {
  type: DocumentType;
  format: 'pdf' | 'docx';
  title: string;
  categoryId?: string;
  /** Consignes libres pour la rédaction IA (compte-rendu, courrier, rapport, synthèse). */
  brief?: string;
  /** Données structurées (devis, factures, checklists). */
  data?: { number?: string; companyKey?: string; client?: { name: string; address?: string }; lines?: QuoteLine[]; items?: string[]; notes?: string };
  saveToDrive?: boolean;
}

const MIME = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } as const;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiTasksService,
    private readonly drive: DriveService,
    private readonly config: ConfigService,
  ) {}

  list(userId: string) {
    return this.prisma.document.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100, include: { category: { select: { name: true, color: true } } } });
  }

  private async content(userId: string, input: GenerateInput): Promise<{ md: string; generatedBy?: string }> {
    const d = input.data ?? {};
    if (input.type === 'QUOTE' || input.type === 'INVOICE') {
      const md = renderQuoteOrInvoice(input.type, {
        number: d.number ?? `${input.type === 'QUOTE' ? 'D' : 'F'}-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
        company: COMPANIES[d.companyKey ?? 'iris-renov'] ?? COMPANIES['iris-renov'],
        client: d.client ?? { name: 'Client' },
        lines: d.lines ?? [],
        notes: d.notes,
      });
      return { md };
    }
    if (input.type === 'CHECKLIST' && d.items?.length) return { md: renderChecklist(input.title, d.items) };
    // Documents Word complexes → Copilot si configuré, sinon rédaction Claude.
    const capability = input.format === 'docx' ? 'documents-microsoft' : 'writing';
    const md = await this.ai.writeDocument(userId, input.type, `${AI_BRIEFS[input.type] ?? ''}\nTitre : ${input.title}\n\n${input.brief ?? ''}`, capability);
    return { md, generatedBy: capability };
  }

  async generate(userId: string, input: GenerateInput) {
    const { md, generatedBy } = await this.content(userId, input);
    const buffer = input.format === 'pdf' ? await renderPdf(input.title, md) : await renderDocx(input.title, md);
    const fileName = `${new Date().toISOString().slice(0, 10)} - ${input.title.replace(/[\\/:*?"<>|]/g, '-')}.${input.format}`;

    const dir = join(this.config.get('STORAGE_DIR') ?? './storage', userId);
    await mkdir(dir, { recursive: true });
    const storagePath = join(dir, `${Date.now()}-${fileName}`);
    await writeFile(storagePath, buffer);

    let drive: { id: string; url: string | null } | undefined;
    const category = input.categoryId ? await this.prisma.category.findFirst({ where: { userId, OR: [{ id: input.categoryId }, { slug: input.categoryId }] } }) : null;
    if (input.saveToDrive !== false && this.drive.configured) {
      const folderId = await this.drive.folderFor(userId, category?.name ?? 'Divers', input.type);
      drive = await this.drive.upload(userId, { name: fileName, mimeType: MIME[input.format], content: buffer, folderId, description: 'Généré par Kairos' });
    }

    const doc = await this.prisma.document.create({
      data: {
        userId,
        categoryId: category?.id,
        type: input.type,
        title: input.title,
        format: input.format,
        data: (input.data ?? {}) as object,
        storagePath,
        driveFileId: drive?.id,
        driveUrl: drive?.url,
        textContent: md,
        generatedBy,
      },
    });
    await this.prisma.automationLog.create({ data: { userId, type: 'DOCUMENT_GENERATED', summary: `Document « ${input.title} » généré`, entityType: 'document', entityId: doc.id } });
    return doc;
  }

  async file(userId: string, id: string) {
    const doc = await this.prisma.document.findFirst({ where: { id, userId } });
    if (!doc?.storagePath) throw new NotFoundException();
    return { doc, buffer: await readFile(doc.storagePath), mime: MIME[doc.format as 'pdf' | 'docx'] ?? 'application/octet-stream' };
  }

  /** Recherche IA : plein texte local + Drive, puis synthèse de la réponse. */
  async search(userId: string, query: string) {
    const local = await this.prisma.document.findMany({
      where: { userId, OR: [{ title: { contains: query, mode: 'insensitive' } }, { textContent: { contains: query, mode: 'insensitive' } }] },
      take: 10,
      select: { id: true, title: true, type: true, driveUrl: true, createdAt: true },
    });
    const drive = this.drive.configured ? await this.drive.search(userId, query).catch(() => []) : [];
    return { local, drive };
  }
}
