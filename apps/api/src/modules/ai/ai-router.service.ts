import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { resolveProviders, type AiProviderId, type AiRoutingRule, type AiCapability } from '@kairos/core';
import { PrismaService } from '../../common/prisma.service';
import { AI_PROVIDERS_TOKEN, type AiProvider, type AiRequest, type AiResponse } from './ai.types';

/**
 * Point d'entrée unique vers les IA : choisit le moteur selon la table de routage
 * de l'utilisateur (Paramètres → Moteurs IA), bascule sur le suivant en cas d'échec
 * et journalise chaque appel (AiRun) pour le suivi coûts/latence.
 */
@Injectable()
export class AiRouterService {
  private readonly logger = new Logger(AiRouterService.name);
  private readonly byId: Map<AiProviderId, AiProvider>;

  constructor(
    @Inject(AI_PROVIDERS_TOKEN) providers: AiProvider[],
    private readonly prisma: PrismaService,
  ) {
    this.byId = new Map(providers.map((p) => [p.id, p]));
  }

  available(): AiProviderId[] {
    return [...this.byId.values()].filter((p) => p.isAvailable()).map((p) => p.id);
  }

  async rules(userId: string): Promise<AiRoutingRule[]> {
    const rows = await this.prisma.aiRoutingRule.findMany({ where: { userId } });
    return rows.map((r) => ({ capability: r.capability as AiCapability, provider: r.provider as AiProviderId, fallbacks: r.fallbacks as AiProviderId[] }));
  }

  async run(userId: string, req: AiRequest): Promise<AiResponse> {
    const chain = resolveProviders(req.capability, new Set(this.available()), await this.rules(userId));
    if (!chain.length) throw new ServiceUnavailableException('Aucun moteur IA configuré pour cette capacité');

    let lastError: unknown;
    for (const id of chain) {
      const started = Date.now();
      try {
        const res = await this.byId.get(id)!.complete(req);
        await this.log(userId, req.capability, res.provider, true, Date.now() - started, res);
        return res;
      } catch (err) {
        lastError = err;
        this.logger.warn(`${id} a échoué pour ${req.capability} : ${String(err)}`);
        await this.log(userId, req.capability, id, false, Date.now() - started, undefined, String(err));
      }
    }
    throw new ServiceUnavailableException(`Tous les moteurs IA ont échoué : ${String(lastError)}`);
  }

  private log(userId: string, capability: string, provider: string, success: boolean, latencyMs: number, res?: AiResponse, error?: string) {
    return this.prisma.aiRun.create({
      data: { userId, capability, provider, success, latencyMs, error, model: res?.model, inputTokens: res?.inputTokens, outputTokens: res?.outputTokens },
    });
  }
}
