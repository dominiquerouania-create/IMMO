import Anthropic from '@anthropic-ai/sdk';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiProvider, AiRequest, AiResponse } from '../ai.types';

/** Claude (API Anthropic) : rédaction, résumés, tri des emails, planification. */
@Injectable()
export class ClaudeProvider implements AiProvider {
  readonly id = 'claude' as const;
  private readonly client?: Anthropic;
  private readonly model: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('ANTHROPIC_API_KEY');
    this.model = config.get<string>('ANTHROPIC_MODEL') ?? 'claude-opus-5';
    if (apiKey) this.client = new Anthropic({ apiKey });
  }

  isAvailable(): boolean {
    return !!this.client;
  }

  async complete(req: AiRequest): Promise<AiResponse> {
    if (!this.client) throw new Error('ANTHROPIC_API_KEY manquante');
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: req.maxTokens ?? 16000,
      system: req.system,
      messages: [{ role: 'user', content: req.prompt }],
      output_config: {
        effort: req.effort ?? 'medium',
        ...(req.jsonSchema ? { format: { type: 'json_schema', schema: req.jsonSchema } } : {}),
      },
    });

    if (response.stop_reason === 'refusal') {
      throw new Error(`Requête refusée par le modèle (${response.stop_details?.category ?? 'inconnu'})`);
    }
    if (response.stop_reason === 'max_tokens' && req.jsonSchema) {
      throw new Error('Réponse tronquée (max_tokens) : augmenter maxTokens');
    }
    const text = response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim();

    return {
      provider: this.id,
      model: response.model,
      text,
      json: req.jsonSchema ? JSON.parse(text) : undefined,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }
}
