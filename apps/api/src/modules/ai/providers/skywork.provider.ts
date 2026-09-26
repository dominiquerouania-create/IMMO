import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiProvider, AiRequest, AiResponse } from '../ai.types';

/**
 * Skywork AI : automatisations et recherche.
 * Adaptateur HTTP (format chat/completions). Le chemin et le nom du modèle
 * sont paramétrables : à ajuster selon l'offre API Skywork souscrite.
 */
@Injectable()
export class SkyworkProvider implements AiProvider {
  readonly id = 'skywork' as const;

  constructor(private readonly config: ConfigService) {}

  isAvailable(): boolean {
    return !!this.config.get('SKYWORK_API_KEY');
  }

  async complete(req: AiRequest): Promise<AiResponse> {
    const res = await fetch(`${this.config.getOrThrow('SKYWORK_BASE_URL')}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.config.getOrThrow('SKYWORK_API_KEY')}` },
      body: JSON.stringify({
        model: this.config.get('SKYWORK_MODEL') ?? 'skywork-default',
        max_tokens: req.maxTokens ?? 4000,
        messages: [
          ...(req.system ? [{ role: 'system', content: req.system }] : []),
          { role: 'user', content: req.jsonSchema ? `${req.prompt}\n\nRéponds uniquement en JSON valide conforme à : ${JSON.stringify(req.jsonSchema)}` : req.prompt },
        ],
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(`Skywork : HTTP ${res.status}`);
    const data = (await res.json()) as { model?: string; choices: Array<{ message: { content: string } }> };
    const text = data.choices[0]?.message.content ?? '';
    return { provider: this.id, model: data.model ?? 'skywork', text, json: req.jsonSchema ? extractJson(text) : undefined };
  }
}

export function extractJson(text: string): unknown {
  const start = text.search(/[[{]/);
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  return JSON.parse(text.slice(start, end + 1));
}
