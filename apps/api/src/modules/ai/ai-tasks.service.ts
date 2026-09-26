import { Injectable } from '@nestjs/common';
import { PRIORITIES } from '@kairos/core';
import { AiRouterService } from './ai-router.service';

export interface EmailTriage {
  importance: 'URGENT' | 'IMPORTANT' | 'NORMAL' | 'LOW';
  summary: string;
  actions: string[];
  deadline: string | null;
  categoryId: string;
  createTask: boolean;
  taskTitle: string | null;
  priority: (typeof PRIORITIES)[number];
  estimatedMinutes: number;
}

const ASSISTANT_PERSONA = `Tu es Kairos, l'assistant exécutif personnel d'un utilisateur unique qui gère :
- DOUANE (activité d'agent des douanes : contrôles, enquêtes, courriers, dossiers juridiques — confidentialité stricte),
- IRIS RENOV (entreprise de rénovation : chantiers, devis, factures, fournisseurs, sous-traitants),
- SCI CAMBRAIE (société civile immobilière : construction, financement, banque, permis),
- PERSONNEL (santé, famille, loisirs, administratif, investissements).
Tu es précis, factuel, concis, en français. Tu n'inventes jamais de faits ni de dates.`;

const triageSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['importance', 'summary', 'actions', 'deadline', 'categoryId', 'createTask', 'taskTitle', 'priority', 'estimatedMinutes'],
  properties: {
    importance: { type: 'string', enum: ['URGENT', 'IMPORTANT', 'NORMAL', 'LOW'] },
    summary: { type: 'string', description: 'Résumé en 1 à 2 phrases' },
    actions: { type: 'array', items: { type: 'string' }, description: 'Actions demandées à l’utilisateur' },
    deadline: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Échéance ISO-8601 si explicitement mentionnée' },
    categoryId: { type: 'string', enum: ['douane', 'iris-renov', 'sci-cambraie', 'personnel'] },
    createTask: { type: 'boolean' },
    taskTitle: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    priority: { type: 'string', enum: [...PRIORITIES] },
    estimatedMinutes: { type: 'integer' },
  },
};

/** Cas d'usage IA métier, chacun routé vers le moteur configuré pour sa capacité. */
@Injectable()
export class AiTasksService {
  constructor(private readonly router: AiRouterService) {}

  async triageEmail(userId: string, email: { from: string; subject: string; body: string; receivedAt: string }): Promise<EmailTriage> {
    const res = await this.router.run(userId, {
      capability: 'email-triage',
      effort: 'low',
      maxTokens: 2000,
      system: `${ASSISTANT_PERSONA}\nTu tries les emails entrants et détectes les actions et échéances.`,
      prompt: `Date de réception : ${email.receivedAt}\nDe : ${email.from}\nObjet : ${email.subject}\n\n<email>\n${email.body.slice(0, 20_000)}\n</email>\n\nAnalyse cet email.`,
      jsonSchema: triageSchema,
    });
    return res.json as EmailTriage;
  }

  async draftReply(userId: string, email: { from: string; subject: string; body: string }, instructions?: string): Promise<string> {
    const res = await this.router.run(userId, {
      capability: 'email-draft',
      system: `${ASSISTANT_PERSONA}\nTu rédiges des brouillons de réponse professionnels, courtois et prêts à envoyer. Pas d'objet, seulement le corps.`,
      prompt: `Email reçu de ${email.from} — « ${email.subject} » :\n<email>\n${email.body.slice(0, 20_000)}\n</email>\n\n${instructions ? `Consignes : ${instructions}` : 'Propose une réponse adaptée.'}`,
    });
    return res.text;
  }

  async summarize(userId: string, content: string, instruction = 'Fais une synthèse structurée en puces.'): Promise<string> {
    const res = await this.router.run(userId, {
      capability: 'summarization',
      effort: 'low',
      system: ASSISTANT_PERSONA,
      prompt: `${instruction}\n\n<contenu>\n${content.slice(0, 100_000)}\n</contenu>`,
    });
    return res.text;
  }

  async dailyBriefing(userId: string, context: unknown): Promise<string> {
    const res = await this.router.run(userId, {
      capability: 'planning',
      system: `${ASSISTANT_PERSONA}\nTu prépares le briefing du jour : priorités, points de vigilance, conseils d'organisation concrets. 10 lignes maximum.`,
      prompt: `Données du jour (JSON) :\n${JSON.stringify(context)}`,
    });
    return res.text;
  }

  async recommendations(userId: string, context: unknown): Promise<Array<{ title: string; detail: string; action?: string }>> {
    const res = await this.router.run(userId, {
      capability: 'planning',
      effort: 'low',
      system: `${ASSISTANT_PERSONA}\nTu proposes 3 recommandations actionnables pour optimiser la journée.`,
      prompt: `Contexte (JSON) :\n${JSON.stringify(context)}`,
      jsonSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'detail', 'action'],
              properties: { title: { type: 'string' }, detail: { type: 'string' }, action: { anyOf: [{ type: 'string' }, { type: 'null' }] } },
            },
          },
        },
      },
    });
    return (res.json as { items: Array<{ title: string; detail: string; action?: string }> }).items;
  }

  async writeDocument(userId: string, kind: string, brief: string, capability: 'writing' | 'documents-microsoft' = 'writing'): Promise<string> {
    const res = await this.router.run(userId, {
      capability,
      system: `${ASSISTANT_PERSONA}\nTu rédiges des documents professionnels (${kind}) en Markdown simple : titres #, listes -, tableaux |.`,
      prompt: brief,
    });
    return res.text;
  }

  /** Repli LLM pour les commandes vocales non reconnues par le parseur local. */
  async interpretCommand(userId: string, text: string, nowIso: string) {
    const res = await this.router.run(userId, {
      capability: 'planning',
      effort: 'low',
      maxTokens: 1000,
      system: `${ASSISTANT_PERSONA}\nTu convertis une commande en intention structurée. Maintenant : ${nowIso} (Europe/Paris).`,
      prompt: text,
      jsonSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['intent', 'title', 'date', 'durationMinutes', 'answer'],
        properties: {
          intent: { type: 'string', enum: ['CREATE_TASK', 'CREATE_EVENT', 'PLAN_DAY', 'QUERY_PRIORITIES', 'SHOW_URGENT', 'RESCHEDULE', 'SUMMARIZE_EMAILS', 'ANSWER'] },
          title: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          date: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          durationMinutes: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
          answer: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Réponse directe si intent = ANSWER' },
        },
      },
    });
    return res.json as { intent: string; title: string | null; date: string | null; durationMinutes: number | null; answer: string | null };
  }
}
