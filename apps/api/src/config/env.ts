import { z } from 'zod';

/** Validation stricte des variables d'environnement au démarrage (fail fast). */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  APP_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().default('http://localhost:4000'),
  TZ_DEFAULT: z.string().default('Europe/Paris'),
  DATABASE_URL: z.string().min(1),
  OWNER_EMAIL: z.string().email(),
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-opus-5'),
  SKYWORK_API_KEY: z.string().optional(),
  SKYWORK_BASE_URL: z.string().url().default('https://api.skywork.ai/v1'),
  COPILOT_TENANT_ID: z.string().optional(),
  COPILOT_CLIENT_ID: z.string().optional(),
  COPILOT_CLIENT_SECRET: z.string().optional(),
  CLAUDE_CODE_RUNNER_URL: z.string().url().optional(),
  CLAUDE_CODE_RUNNER_TOKEN: z.string().optional(),
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_RECIPIENT: z.string().optional(),
  WHATSAPP_TEMPLATE_REMINDER: z.string().default('kairos_reminder'),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  SKYWORK_MODEL: z.string().optional(),
  COPILOT_ENDPOINT: z.string().url().optional(),
  /** Connexion sans Google pour le développement local (jamais en production). */
  ALLOW_DEV_LOGIN: z.enum(['true', 'false']).default('false'),
  STORAGE_DIR: z.string().default('./storage'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(
    Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v === '' ? undefined : v])),
  );
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuration invalide :\n${issues}`);
  }
  return parsed.data;
}
