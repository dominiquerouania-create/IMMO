/**
 * Routage multi-IA : chaque capacité est confiée à un moteur, avec repli ordonné.
 * La table est éditable dans Paramètres → Moteurs IA et stockée en base (AiRoutingRule).
 */

export const AI_PROVIDERS = ['claude', 'claude-code', 'skywork', 'copilot'] as const;
export type AiProviderId = (typeof AI_PROVIDERS)[number];

export const AI_CAPABILITIES = [
  'writing',
  'summarization',
  'email-triage',
  'email-draft',
  'planning',
  'task-extraction',
  'documents-microsoft',
  'automation',
  'code',
  'search',
] as const;
export type AiCapability = (typeof AI_CAPABILITIES)[number];

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  claude: 'Claude',
  'claude-code': 'Claude Code',
  skywork: 'Skywork AI',
  copilot: 'Microsoft Copilot',
};

export const AI_CAPABILITY_LABELS: Record<AiCapability, string> = {
  writing: 'Rédaction',
  summarization: 'Résumés',
  'email-triage': 'Tri des emails',
  'email-draft': 'Brouillons de réponse',
  planning: 'Planification',
  'task-extraction': 'Extraction de tâches',
  'documents-microsoft': 'Documents Microsoft (Word/Excel)',
  automation: 'Automatisations',
  code: 'Développement & scripts',
  search: 'Recherche documentaire',
};

export interface AiRoutingRule {
  capability: AiCapability;
  provider: AiProviderId;
  fallbacks: AiProviderId[];
}

export const DEFAULT_AI_ROUTING: AiRoutingRule[] = [
  { capability: 'writing', provider: 'claude', fallbacks: ['copilot'] },
  { capability: 'summarization', provider: 'claude', fallbacks: ['skywork'] },
  { capability: 'email-triage', provider: 'claude', fallbacks: ['skywork'] },
  { capability: 'email-draft', provider: 'claude', fallbacks: ['copilot'] },
  { capability: 'planning', provider: 'claude', fallbacks: [] },
  { capability: 'task-extraction', provider: 'claude', fallbacks: ['skywork'] },
  { capability: 'documents-microsoft', provider: 'copilot', fallbacks: ['claude'] },
  { capability: 'automation', provider: 'skywork', fallbacks: ['claude'] },
  { capability: 'code', provider: 'claude-code', fallbacks: ['claude'] },
  { capability: 'search', provider: 'claude', fallbacks: ['skywork'] },
];

/**
 * Résout l'ordre des moteurs à essayer pour une capacité, en ne gardant
 * que ceux qui sont configurés (clé API présente / service joignable).
 */
export function resolveProviders(
  capability: AiCapability,
  available: ReadonlySet<AiProviderId>,
  rules: AiRoutingRule[] = DEFAULT_AI_ROUTING,
): AiProviderId[] {
  const rule = rules.find((r) => r.capability === capability) ??
    DEFAULT_AI_ROUTING.find((r) => r.capability === capability)!;
  const chain = [rule.provider, ...rule.fallbacks, 'claude' as const];
  return [...new Set(chain)].filter((p) => available.has(p));
}
