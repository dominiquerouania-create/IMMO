import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * WhatsApp Business Cloud API (Meta).
 * Hors fenêtre de 24 h, Meta impose un modèle de message pré-approuvé :
 * `kairos_reminder` avec un paramètre {{1}} = texte du rappel.
 */
@Injectable()
export class WhatsAppProvider {
  private readonly logger = new Logger(WhatsAppProvider.name);

  constructor(private readonly config: ConfigService) {}

  get configured(): boolean {
    return !!(this.config.get('WHATSAPP_TOKEN') && this.config.get('WHATSAPP_PHONE_NUMBER_ID'));
  }

  async send(to: string, text: string): Promise<string> {
    if (!this.configured) {
      this.logger.log(`[WhatsApp simulé] → ${to} : ${text}`);
      return 'simulated';
    }
    const url = `https://graph.facebook.com/v21.0/${this.config.get('WHATSAPP_PHONE_NUMBER_ID')}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.config.get('WHATSAPP_TOKEN')}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: this.config.get('WHATSAPP_TEMPLATE_REMINDER'),
          language: { code: 'fr' },
          components: [{ type: 'body', parameters: [{ type: 'text', text: text.slice(0, 1000) }] }],
        },
      }),
    });
    const data = (await res.json()) as { messages?: Array<{ id: string }>; error?: { message: string } };
    if (!res.ok) throw new Error(`WhatsApp : ${data.error?.message ?? res.status}`);
    return data.messages?.[0]?.id ?? '';
  }
}
