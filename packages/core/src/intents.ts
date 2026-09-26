import { CATEGORY_KEYWORDS, guessCategory } from './categories';
import { addZonedDays, getZonedParts, zonedToUtc } from './time';
import type { Priority } from './types';

/**
 * Parseur de langage naturel français, déterministe et hors ligne.
 * Couvre la saisie rapide (façon Todoist) et les commandes vocales courantes.
 * Ce qui n'est pas reconnu est délégué au LLM (intent UNKNOWN) côté API.
 */

export type IntentType =
  | 'CREATE_TASK'
  | 'CREATE_EVENT'
  | 'PLAN_DAY'
  | 'QUERY_PRIORITIES'
  | 'SHOW_URGENT'
  | 'EMAIL_TO_TASK'
  | 'RESCHEDULE'
  | 'SUMMARIZE_EMAILS'
  | 'UNKNOWN';

export interface ParsedEntities {
  title?: string;
  date?: string; // ISO UTC (heure incluse si précisée)
  hasTime?: boolean;
  durationMinutes?: number;
  priority?: Priority;
  categoryId?: string;
  tags?: string[];
}

export interface ParsedIntent {
  intent: IntentType;
  confidence: number;
  entities: ParsedEntities;
  raw: string;
}

const WEEKDAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();

/** `\b` natif ignore les lettres accentuées : on le remplace par une frontière Unicode. */
const UB = '(?:(?<=[\\p{L}\\d])(?![\\p{L}\\d])|(?<![\\p{L}\\d])(?=[\\p{L}\\d]))';
const R = (re: RegExp): RegExp =>
  new RegExp(re.source.replaceAll('\\b', UB), re.flags.includes('u') ? re.flags : `${re.flags}u`);

interface DateMatch {
  dayOffset?: number;
  absolute?: { year: number; month: number; day: number };
  hour?: number;
  minute?: number;
  consumed: string[];
}

function extractDate(text: string, now: Date, tz: string): DateMatch {
  const lower = text.toLowerCase();
  const m: DateMatch = { consumed: [] };
  const today = getZonedParts(now, tz);

  const rel: Array<[RegExp, number]> = [
    [R(/\baujourd'hui\b/), 0],
    [R(/\bce (?:matin|soir|midi)\b|\bcet après-midi\b/), 0],
    [R(/\baprès-demain\b|\bapres-demain\b/), 2],
    [R(/\bdemain\b/), 1],
  ];
  for (const [re, off] of rel) {
    const r = lower.match(re);
    if (r) {
      m.dayOffset = off;
      m.consumed.push(r[0]);
      break;
    }
  }

  const inDays = lower.match(R(/\bdans (\d+) jours?\b/));
  if (inDays && m.dayOffset === undefined) {
    m.dayOffset = Number(inDays[1]);
    m.consumed.push(inDays[0]);
  }

  const wd = lower.match(R(/\b(?:(ce|le|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche) )?(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(?: prochain)?\b/));
  if (wd && m.dayOffset === undefined) {
    const target = WEEKDAYS_FR.indexOf(wd[2]!);
    let diff = (target - today.weekday + 7) % 7;
    if (diff === 0 || wd[0].includes('prochain')) diff = diff === 0 ? 7 : diff;
    m.dayOffset = diff;
    m.consumed.push(wd[0]);
  }

  const numeric = lower.match(R(/\b(?:le )?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/));
  const literal = lower.match(R(new RegExp(`\\b(?:le )?(\\d{1,2}|1er) (${MONTHS_FR.join('|')})(?: (\\d{4}))?\\b`)));
  if (numeric) {
    const year = numeric[3] ? Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]) : today.year;
    m.absolute = { year, month: Number(numeric[2]), day: Number(numeric[1]) };
    m.consumed.push(numeric[0]);
  } else if (literal) {
    const day = literal[1] === '1er' ? 1 : Number(literal[1]);
    const month = MONTHS_FR.indexOf(literal[2]!) + 1;
    let year = literal[3] ? Number(literal[3]) : today.year;
    if (!literal[3] && (month < today.month || (month === today.month && day < today.day))) year += 1;
    m.absolute = { year, month, day };
    m.consumed.push(literal[0]);
  }

  const time = lower.match(R(/\b(?:à |a |vers )?(\d{1,2})(?:h|:)(\d{2})?\b(?! ?min)/));
  if (time && Number(time[1]) < 24) {
    m.hour = Number(time[1]);
    m.minute = time[2] ? Number(time[2]) : 0;
    m.consumed.push(time[0]);
  } else if (R(/\bce matin\b/).test(lower)) {
    m.hour = 9;
    m.minute = 0;
  } else if (R(/\bcet après-midi\b/).test(lower)) {
    m.hour = 14;
    m.minute = 0;
  } else if (R(/\bce soir\b/).test(lower)) {
    m.hour = 19;
    m.minute = 0;
  } else if (R(/\bmidi\b/).test(lower)) {
    m.hour = 12;
    m.minute = 0;
  }
  return m;
}

function extractDuration(text: string): { minutes?: number; consumed?: string } {
  const lower = text.toLowerCase();
  const hm = lower.match(R(/\b(?:pendant|durée|pour|~)\s?(\d+)\s?h(?:eures?)?\s?(\d{1,2})?\b/));
  if (hm) return { minutes: Number(hm[1]) * 60 + Number(hm[2] ?? 0), consumed: hm[0] };
  const min = lower.match(R(/\b(?:pendant |durée |pour |~)?(\d+)\s?(?:min|minutes|mn)\b/));
  if (min) return { minutes: Number(min[1]), consumed: min[0] };
  return {};
}

function extractPriority(text: string): { priority?: Priority; consumed: string[] } {
  const lower = text.toLowerCase();
  const consumed: string[] = [];
  const pick = (re: RegExp) => {
    const r = lower.match(re);
    if (r) consumed.push(r[0]);
    return !!r;
  };
  if (pick(R(/!!!|\bp1\b|!critique|\bcritique\b|\btrès urgent\b/))) return { priority: 'CRITICAL', consumed };
  if (pick(R(/!!|\bp2\b|!urgent|\burgent\b|\burgente\b|\bimportant\b/))) return { priority: 'HIGH', consumed };
  if (pick(R(/\bp3\b/))) return { priority: 'MEDIUM', consumed };
  if (pick(R(/\bp4\b|\bpas urgent\b|\bquand j'ai le temps\b/))) return { priority: 'LOW', consumed };
  return { consumed };
}

function extractCategory(text: string): { categoryId?: string; tags: string[]; consumed: string[] } {
  const tags = [...text.matchAll(/#([\p{L}\d_-]+)/gu)].map((m) => m[1]!.toLowerCase());
  const consumed = tags.map((t) => `#${t}`);
  const aliases: Record<string, string> = { sci: 'sci-cambraie', cambraie: 'sci-cambraie', iris: 'iris-renov', perso: 'personnel' };
  for (const t of tags) {
    const id = aliases[t] ?? (t in CATEGORY_KEYWORDS ? t : undefined);
    if (id) return { categoryId: id, tags: tags.filter((x) => x !== t), consumed };
  }
  return { tags, consumed };
}

const INTENT_RULES: Array<[IntentType, RegExp]> = [
  ['EMAIL_TO_TASK', R(/\b(transforme|convertis|change)\b.*\b(e-?mail|mail|courriel|message)\b.*\btâche\b/i)],
  ['PLAN_DAY', R(/\b(prépare|organise|planifie|optimise)\b.*\b(planning|journée|agenda|programme|semaine)\b/i)],
  ['QUERY_PRIORITIES', R(/\bpriorités?\b|\bpar quoi (je )?commence/i)],
  ['SHOW_URGENT', R(/\b(montre|affiche|liste|quoi|qu'est-ce)\b.*\burgen(t|ce)s?\b|^urgences?\b/i)],
  ['SUMMARIZE_EMAILS', R(/\b(résume|résumé|synthèse)\b.*\b(e-?mails?|mails?|courriers?|boîte)\b/i)],
  ['RESCHEDULE', R(/\b(décale|reporte|déplace|repousse)\b/i)],
  ['CREATE_EVENT', R(/\b(réunion|rendez-vous|rdv|visio|point|appel|call|déjeuner)\b.*\bà?\s?\d{1,2}(h|:)/i)],
  ['CREATE_TASK', R(/^(ajoute|crée|créer|note|rappelle-moi|rappelle moi|n'oublie pas|il faut|je dois|penser à)\b/i)],
];

const LEADING_VERBS = R(/^(ajoute|crée|créer|note|rappelle[- ]moi de|rappelle[- ]moi|n'oublie pas de|il faut|je dois|penser à|planifie|programme|mets)\s+(une?\s+|la\s+|le\s+)?(tâche\s+|:)?/i);

export function parseCommand(input: string, now: Date, timeZone = 'Europe/Paris'): ParsedIntent {
  const raw = normalize(input);
  const matched = INTENT_RULES.find(([, re]) => re.test(raw));
  const intent: IntentType = matched?.[0] ?? (raw.length > 0 ? 'CREATE_TASK' : 'UNKNOWN');
  const confidence = matched ? 0.9 : raw.length > 3 ? 0.55 : 0.1;

  const date = extractDate(raw, now, timeZone);
  const duration = extractDuration(raw);
  const prio = extractPriority(raw);
  const cat = extractCategory(raw);

  const entities: ParsedEntities = {};
  if (date.dayOffset !== undefined || date.absolute || date.hour !== undefined) {
    const base = date.absolute
      ? date.absolute
      : (() => {
          const p = getZonedParts(addZonedDays(now, date.dayOffset ?? 0, timeZone), timeZone);
          return { year: p.year, month: p.month, day: p.day };
        })();
    entities.hasTime = date.hour !== undefined;
    entities.date = zonedToUtc(base.year, base.month, base.day, date.hour ?? 18, date.minute ?? 0, timeZone).toISOString();
    // Une heure seule déjà passée aujourd'hui → demain.
    if (!date.absolute && date.dayOffset === undefined && new Date(entities.date) < now) {
      const t = getZonedParts(addZonedDays(now, 1, timeZone), timeZone);
      entities.date = zonedToUtc(t.year, t.month, t.day, date.hour ?? 18, date.minute ?? 0, timeZone).toISOString();
    }
  }
  if (duration.minutes) entities.durationMinutes = duration.minutes;
  if (prio.priority) entities.priority = prio.priority;
  entities.categoryId = cat.categoryId ?? guessCategory(raw);
  if (cat.tags.length) entities.tags = cat.tags;

  if (intent === 'CREATE_TASK' || intent === 'CREATE_EVENT') {
    let title = raw;
    for (const c of [...date.consumed, ...prio.consumed, ...cat.consumed, duration.consumed ?? '']) {
      if (!c) continue;
      title = title.replace(new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ');
    }
    title = normalize(title.replace(LEADING_VERBS, '')).replace(/^(de |d')/i, '').replace(/[,.;:!?]+$/, '').trim();
    entities.title = title.charAt(0).toUpperCase() + title.slice(1);
    if (intent === 'CREATE_EVENT' && !entities.durationMinutes) entities.durationMinutes = 60;
  }

  return { intent, confidence, entities, raw };
}
