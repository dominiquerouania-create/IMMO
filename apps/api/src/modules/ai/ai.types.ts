import type { AiCapability, AiProviderId } from '@kairos/core';

export interface AiRequest {
  capability: AiCapability;
  system?: string;
  prompt: string;
  /** Schéma JSON attendu : la réponse est alors validée et renvoyée dans `json`. */
  jsonSchema?: Record<string, unknown>;
  maxTokens?: number;
  /** Effort de raisonnement (tâches simples → low). */
  effort?: 'low' | 'medium' | 'high';
}

export interface AiResponse {
  provider: AiProviderId;
  model: string;
  text: string;
  json?: unknown;
  inputTokens?: number;
  outputTokens?: number;
}

export interface AiProvider {
  readonly id: AiProviderId;
  isAvailable(): boolean;
  complete(req: AiRequest): Promise<AiResponse>;
}

export const AI_PROVIDERS_TOKEN = Symbol('AI_PROVIDERS');
