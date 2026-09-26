import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { google, type gmail_v1 } from 'googleapis';
import { PrismaService } from '../../common/prisma.service';
import { AiTasksService } from '../ai/ai-tasks.service';
import { GoogleClientService } from '../google/google-client.service';
import { TasksService } from '../tasks/tasks.service';

const header = (m: gmail_v1.Schema$Message, name: string) =>
  m.payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';

function decodeBody(part?: gmail_v1.Schema$MessagePart): string {
  if (!part) return '';
  if (part.mimeType === 'text/plain' && part.body?.data) return Buffer.from(part.body.data, 'base64url').toString('utf8');
  for (const p of part.parts ?? []) {
    const text = decodeBody(p);
    if (text) return text;
  }
  if (part.mimeType === 'text/html' && part.body?.data) {
    return Buffer.from(part.body.data, 'base64url').toString('utf8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  }
  return '';
}

/**
 * Gmail : import des nouveaux messages, tri IA (importance, actions, échéance),
 * création automatique de tâches (autonomie ≥ 4), brouillons de réponse.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly google: GoogleClientService,
    private readonly ai: AiTasksService,
    private readonly tasks: TasksService,
  ) {}

  private async gmail(userId: string) {
    return google.gmail({ version: 'v1', auth: await this.google.forUser(userId) });
  }

  list(userId: string, importance?: string) {
    return this.prisma.emailMessage.findMany({
      where: { userId, archivedAt: null, importance: importance ? (importance as 'URGENT') : undefined },
      orderBy: [{ importance: 'asc' }, { receivedAt: 'desc' }],
      take: 100,
    });
  }

  /** Import des messages de la boîte de réception des 3 derniers jours non encore connus. */
  async ingest(userId: string): Promise<number> {
    if (!this.google.configured) return 0;
    const gmail = await this.gmail(userId);
    const { data } = await gmail.users.messages.list({ userId: 'me', q: 'in:inbox newer_than:3d -category:promotions -category:social', maxResults: 50 });
    let created = 0;
    for (const ref of data.messages ?? []) {
      if (!ref.id) continue;
      const known = await this.prisma.emailMessage.findUnique({ where: { userId_gmailId: { userId, gmailId: ref.id } } });
      if (known) continue;
      const { data: m } = await gmail.users.messages.get({ userId: 'me', id: ref.id, format: 'full' });
      const from = header(m, 'From');
      const email = await this.prisma.emailMessage.create({
        data: {
          userId,
          gmailId: ref.id,
          threadId: m.threadId ?? ref.id,
          fromAddress: from.match(/<(.+)>/)?.[1] ?? from,
          fromName: from.replace(/<.+>/, '').replace(/"/g, '').trim() || null,
          subject: header(m, 'Subject') || '(sans objet)',
          snippet: m.snippet ?? '',
          receivedAt: new Date(Number(m.internalDate ?? Date.now())),
          labels: m.labelIds ?? [],
          detectedActions: [],
        },
      });
      await this.triage(userId, email.id, decodeBody(m.payload)).catch((e) => this.logger.warn(`Tri IA : ${String(e)}`));
      created++;
    }
    return created;
  }

  async triage(userId: string, emailId: string, body?: string) {
    const email = await this.prisma.emailMessage.findFirst({ where: { id: emailId, userId } });
    if (!email) throw new NotFoundException();
    const t = await this.ai.triageEmail(userId, {
      from: `${email.fromName ?? ''} <${email.fromAddress}>`,
      subject: email.subject,
      body: body ?? email.snippet,
      receivedAt: email.receivedAt.toISOString(),
    });
    const updated = await this.prisma.emailMessage.update({
      where: { id: emailId },
      data: {
        importance: t.importance,
        summary: t.summary,
        detectedActions: t.actions,
        detectedDeadline: t.deadline ? new Date(t.deadline) : null,
        categoryId: t.categoryId,
        triagedAt: new Date(),
      },
    });
    await this.prisma.automationLog.create({ data: { userId, type: 'EMAIL_SUMMARIZED', summary: `Email « ${email.subject} » analysé`, entityType: 'email', entityId: emailId } });

    const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
    if (t.createTask && (settings?.autonomyLevel ?? 5) >= 4 && !email.linkedTaskId) {
      await this.toTask(userId, emailId, { title: t.taskTitle ?? t.summary, priority: t.priority, estimatedMinutes: t.estimatedMinutes, categoryId: t.categoryId });
    }
    return updated;
  }

  /** « Transforme cet email en tâche. » */
  async toTask(userId: string, emailId: string, override: Partial<{ title: string; priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'; estimatedMinutes: number; categoryId: string }> = {}) {
    const email = await this.prisma.emailMessage.findFirst({ where: { id: emailId, userId } });
    if (!email) throw new NotFoundException();
    if (email.linkedTaskId) return this.tasks.get(userId, email.linkedTaskId);
    const task = await this.tasks.create(
      userId,
      {
        title: override.title ?? `Traiter : ${email.subject}`,
        description: [email.summary, `De : ${email.fromName ?? ''} <${email.fromAddress}>`, `https://mail.google.com/mail/u/0/#inbox/${email.threadId}`].filter(Boolean).join('\n\n'),
        priority: override.priority ?? (email.importance === 'URGENT' ? 'CRITICAL' : email.importance === 'IMPORTANT' ? 'HIGH' : 'MEDIUM'),
        status: 'TODO',
        categoryId: override.categoryId ?? email.categoryId ?? 'personnel',
        dueAt: email.detectedDeadline?.toISOString() ?? null,
        estimatedMinutes: Math.max(5, override.estimatedMinutes ?? 15),
        autoSchedule: true,
        splittable: false,
        checklist: email.detectedActions.map((label, i) => ({ id: String(i), label, done: false })),
        tags: ['email'],
        source: 'EMAIL',
        sourceRef: email.gmailId,
      },
      'AI',
    );
    await this.prisma.emailMessage.update({ where: { id: emailId }, data: { linkedTaskId: task.id } });
    await this.prisma.automationLog.create({ data: { userId, type: 'TASK_CREATED_FROM_EMAIL', summary: `Tâche créée depuis « ${email.subject} »`, entityType: 'task', entityId: task.id, undoPayload: { deleteTaskId: task.id } } });
    return task;
  }

  /** Génère un brouillon et le dépose dans Gmail (jamais envoyé automatiquement). */
  async draft(userId: string, emailId: string, instructions?: string) {
    const email = await this.prisma.emailMessage.findFirst({ where: { id: emailId, userId } });
    if (!email) throw new NotFoundException();
    let body = email.snippet;
    let gmailDraftId: string | undefined;
    if (this.google.configured) {
      const gmail = await this.gmail(userId);
      const { data: m } = await gmail.users.messages.get({ userId: 'me', id: email.gmailId, format: 'full' });
      body = decodeBody(m.payload) || body;
      const text = await this.ai.draftReply(userId, { from: email.fromAddress, subject: email.subject, body }, instructions);
      const subject = /^re:/i.test(email.subject) ? email.subject : `Re: ${email.subject}`;
      const raw = Buffer.from(
        [`To: ${email.fromAddress}`, `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`, `In-Reply-To: ${header(m, 'Message-ID')}`, `References: ${header(m, 'Message-ID')}`, 'Content-Type: text/plain; charset=UTF-8', '', text].join('\r\n'),
      ).toString('base64url');
      const { data } = await gmail.users.drafts.create({ userId: 'me', requestBody: { message: { raw, threadId: email.threadId } } });
      gmailDraftId = data.id ?? undefined;
      await this.prisma.emailMessage.update({ where: { id: emailId }, data: { draftReply: text, gmailDraftId } });
      await this.prisma.automationLog.create({ data: { userId, type: 'DRAFT_GENERATED', summary: `Brouillon préparé pour « ${email.subject} »`, entityType: 'email', entityId: emailId } });
      return { draft: text, gmailDraftId };
    }
    const text = await this.ai.draftReply(userId, { from: email.fromAddress, subject: email.subject, body }, instructions);
    await this.prisma.emailMessage.update({ where: { id: emailId }, data: { draftReply: text } });
    return { draft: text, gmailDraftId };
  }

  async digest(userId: string) {
    const emails = await this.prisma.emailMessage.findMany({ where: { userId, archivedAt: null, receivedAt: { gte: new Date(Date.now() - 86_400_000) } }, orderBy: { receivedAt: 'desc' }, take: 40 });
    if (!emails.length) return { summary: 'Aucun nouvel email depuis 24 h.' };
    const summary = await this.ai.summarize(
      userId,
      emails.map((e) => `[${e.importance}] ${e.fromName ?? e.fromAddress} — ${e.subject} : ${e.summary ?? e.snippet}`).join('\n'),
      'Synthétise ces emails des dernières 24 h : urgences d’abord, puis actions attendues, puis informations.',
    );
    return { summary };
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async poll() {
    if (!this.google.configured) return;
    const users = await this.prisma.integration.findMany({ where: { provider: 'GOOGLE', status: 'ACTIVE' }, select: { userId: true } });
    for (const { userId } of users) {
      await this.ingest(userId).catch((e) => this.logger.warn(`Import Gmail : ${String(e)}`));
    }
  }
}
