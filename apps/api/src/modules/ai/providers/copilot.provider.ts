import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiProvider, AiRequest, AiResponse } from '../ai.types';
import { extractJson } from './skywork.provider';

/**
 * Microsoft Copilot : documents Microsoft (Word/Excel/Outlook/SharePoint).
 * Authentification Entra ID (client credentials) puis appel de l'API Copilot
 * de Microsoft Graph. L'URL est configurable (COPILOT_ENDPOINT) car les API
 * Copilot de Graph évoluent (préversion) : vérifier la licence M365 Copilot.
 */
@Injectable()
export class CopilotProvider implements AiProvider {
  readonly id = 'copilot' as const;
  private token?: { value: string; exp: number };

  constructor(private readonly config: ConfigService) {}

  isAvailable(): boolean {
    return !!(this.config.get('COPILOT_TENANT_ID') && this.config.get('COPILOT_CLIENT_ID') && this.config.get('COPILOT_CLIENT_SECRET'));
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.exp > Date.now() + 60_000) return this.token.value;
    const tenant = this.config.getOrThrow<string>('COPILOT_TENANT_ID');
    const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.getOrThrow('COPILOT_CLIENT_ID'),
        client_secret: this.config.getOrThrow('COPILOT_CLIENT_SECRET'),
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    });
    if (!res.ok) throw new Error(`Entra ID : HTTP ${res.status}`);
    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: data.access_token, exp: Date.now() + data.expires_in * 1000 };
    return data.access_token;
  }

  async complete(req: AiRequest): Promise<AiResponse> {
    const endpoint = this.config.get<string>('COPILOT_ENDPOINT') ?? 'https://graph.microsoft.com/beta/copilot/conversations';
    const headers = { authorization: `Bearer ${await this.accessToken()}`, 'content-type': 'application/json' };
    const conv = await fetch(endpoint, { method: 'POST', headers, body: '{}' });
    if (!conv.ok) throw new Error(`Copilot : HTTP ${conv.status}`);
    const { id } = (await conv.json()) as { id: string };
    const res = await fetch(`${endpoint}/${id}/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: { text: [req.system, req.prompt].filter(Boolean).join('\n\n') } }),
    });
    if (!res.ok) throw new Error(`Copilot : HTTP ${res.status}`);
    const data = (await res.json()) as { messages?: Array<{ text: string }> };
    const text = data.messages?.at(-1)?.text ?? '';
    return { provider: this.id, model: 'm365-copilot', text, json: req.jsonSchema ? extractJson(text) : undefined };
  }
}
