import { Injectable } from '@nestjs/common';
import { addMinutes, parseCommand, TASK_STATUS_LABELS, type ParsedIntent } from '@kairos/core';
import { PrismaService } from '../../common/prisma.service';
import { AiTasksService } from '../ai/ai-tasks.service';
import { CalendarService } from '../calendar/calendar.service';
import { MailService } from '../mail/mail.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { TasksService } from '../tasks/tasks.service';

export interface AssistantReply {
  intent: string;
  /** Texte lu à voix haute par le client (synthèse vocale). */
  speech: string;
  data?: unknown;
  /** Navigation suggérée côté client. */
  navigate?: string;
}

/**
 * Assistant vocal / conversationnel.
 * 1. Parseur local déterministe (rapide, hors ligne côté client aussi).
 * 2. Repli LLM si l'intention n'est pas reconnue avec assez de confiance.
 */
@Injectable()
export class AssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
    private readonly calendar: CalendarService,
    private readonly scheduler: SchedulerService,
    private readonly mail: MailService,
    private readonly ai: AiTasksService,
  ) {}

  async handle(userId: string, text: string, context: { emailId?: string } = {}): Promise<AssistantReply> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { timeZone: true } });
    let parsed: ParsedIntent = parseCommand(text, new Date(), user.timeZone);

    if (parsed.confidence < 0.8) {
      const llm = await this.ai.interpretCommand(userId, text, new Date().toISOString()).catch(() => null);
      if (llm?.intent === 'ANSWER') return { intent: 'ANSWER', speech: llm.answer ?? "Je n'ai pas de réponse." };
      if (llm) {
        parsed = {
          ...parsed,
          intent: llm.intent as ParsedIntent['intent'],
          entities: { ...parsed.entities, title: llm.title ?? parsed.entities.title, date: llm.date ?? parsed.entities.date, durationMinutes: llm.durationMinutes ?? parsed.entities.durationMinutes },
        };
      }
    }
    const e = parsed.entities;
    const fmt = (iso: string) => new Intl.DateTimeFormat('fr-FR', { timeZone: user.timeZone, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

    switch (parsed.intent) {
      case 'CREATE_EVENT': {
        if (!e.date) return { intent: parsed.intent, speech: 'Pour quand dois-je planifier ce rendez-vous ?' };
        const ev = await this.calendar.createEvent(userId, {
          title: e.title || 'Réunion',
          start: e.date,
          end: addMinutes(new Date(e.date), e.durationMinutes ?? 60).toISOString(),
        });
        this.scheduler.requestReplan(userId, 'rendez-vous vocal');
        return { intent: parsed.intent, speech: `C'est noté : « ${ev.title} » ${fmt(e.date)}.`, data: ev, navigate: '/calendar' };
      }
      case 'CREATE_TASK': {
        const task = await this.tasks.quickAdd(userId, text, user.timeZone);
        return { intent: parsed.intent, speech: `Tâche ajoutée : « ${task.title} »${task.dueAt ? `, pour ${fmt(task.dueAt)}` : ''}. Je la planifie.`, data: task };
      }
      case 'PLAN_DAY': {
        const plan = await this.scheduler.replan(userId, 'commande vocale');
        const day = (e.date ?? new Date().toISOString()).slice(0, 10);
        const blocks = plan?.blocks.filter((b) => b.start.slice(0, 10) === day) ?? [];
        const risk = plan?.atRisk.length ?? 0;
        return {
          intent: parsed.intent,
          speech: `Votre planning est prêt : ${blocks.filter((b) => b.kind === 'TASK_BLOCK').length} sessions de travail et ${blocks.filter((b) => b.kind === 'FOCUS').length} bloc(s) de concentration.${risk ? ` Attention, ${risk} tâche(s) à risque.` : ''}`,
          data: plan,
          navigate: '/calendar',
        };
      }
      case 'QUERY_PRIORITIES': {
        const top = await this.tasks.priorities(userId, 5);
        if (!top.length) return { intent: parsed.intent, speech: 'Aucune tâche ouverte. Belle journée !' };
        return { intent: parsed.intent, speech: `Vos priorités : ${top.map((t, i) => `${i + 1}. ${t.title}`).join(' ; ')}.`, data: top, navigate: '/tasks' };
      }
      case 'SHOW_URGENT': {
        const urgent = (await this.tasks.priorities(userId, 50)).filter((t) => t.urgent);
        const emails = await this.prisma.emailMessage.findMany({ where: { userId, importance: 'URGENT', archivedAt: null }, take: 10 });
        return {
          intent: parsed.intent,
          speech: `${urgent.length} tâche(s) urgente(s) et ${emails.length} email(s) urgent(s).${urgent[0] ? ` La plus pressante : ${urgent[0].title} (${TASK_STATUS_LABELS[urgent[0].status]}).` : ''}`,
          data: { tasks: urgent, emails },
          navigate: '/tasks?filter=urgent',
        };
      }
      case 'EMAIL_TO_TASK': {
        const emailId = context.emailId ?? (await this.prisma.emailMessage.findFirst({ where: { userId, linkedTaskId: null }, orderBy: { receivedAt: 'desc' } }))?.id;
        if (!emailId) return { intent: parsed.intent, speech: "Je n'ai pas trouvé d'email à transformer." };
        const task = await this.mail.toTask(userId, emailId);
        return { intent: parsed.intent, speech: `Email transformé en tâche : « ${task.title} ».`, data: task };
      }
      case 'SUMMARIZE_EMAILS': {
        const { summary } = await this.mail.digest(userId);
        return { intent: parsed.intent, speech: summary, navigate: '/inbox' };
      }
      case 'RESCHEDULE': {
        const plan = await this.scheduler.replan(userId, 'demande de report');
        return { intent: parsed.intent, speech: 'J’ai réorganisé votre agenda.', data: plan, navigate: '/calendar' };
      }
      default:
        return { intent: 'UNKNOWN', speech: "Je n'ai pas compris. Essayez : « Quelles sont mes priorités aujourd'hui ? »" };
    }
  }
}
