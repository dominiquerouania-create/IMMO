import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiProvider, AiRequest, AiResponse } from '../ai.types';

/**
 * Claude Code : développement, scripts, automatisations techniques.
 * L'agent tourne dans un service séparé et isolé (« runner ») basé sur le
 * Claude Agent SDK, jamais dans le processus API (accès fichiers/bash).
 * Contrat : POST {CLAUDE_CODE_RUNNER_URL}/run { prompt, system } → { output, model }.
 */
@Injectable()
export class ClaudeCodeProvider implements AiProvider {
  readonly id = 'claude-code' as const;

  constructor(private readonly config: ConfigService) {}

  isAvailable(): boolean {
    return !!this.config.get('CLAUDE_CODE_RUNNER_URL');
  }

  async complete(req: AiRequest): Promise<AiResponse> {
    const res = await fetch(`${this.config.getOrThrow('CLAUDE_CODE_RUNNER_URL')}/run`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.config.get('CLAUDE_CODE_RUNNER_TOKEN') ?? ''}`,
      },
      body: JSON.stringify({ prompt: req.prompt, system: req.system }),
      signal: AbortSignal.timeout(10 * 60_000),
    });
    if (!res.ok) throw new Error(`Runner Claude Code : HTTP ${res.status}`);
    const data = (await res.json()) as { output: string; model?: string };
    return {
      provider: this.id,
      model: data.model ?? 'claude-code',
      text: data.output,
      json: req.jsonSchema ? JSON.parse(data.output) : undefined,
    };
  }
}
