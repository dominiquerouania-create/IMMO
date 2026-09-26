/**
 * Modèle de domaine partagé entre l'API (NestJS), le web (Next.js) et le mobile (Expo).
 * Les dates circulent en ISO-8601 (UTC) sur le réseau ; le moteur travaille en `Date`.
 */

export const TASK_STATUSES = [
  'TODO',
  'IN_PROGRESS',
  'WAITING',
  'DONE',
  'POSTPONED',
  'CANCELLED',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'À faire',
  IN_PROGRESS: 'En cours',
  WAITING: 'En attente',
  DONE: 'Terminée',
  POSTPONED: 'Reportée',
  CANCELLED: 'Annulée',
};

/** Statuts pour lesquels la tâche ne consomme plus de temps planifiable. */
export const CLOSED_STATUSES: readonly TaskStatus[] = ['DONE', 'CANCELLED'];

export const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  CRITICAL: 'Critique',
  HIGH: 'Haute',
  MEDIUM: 'Moyenne',
  LOW: 'Basse',
};

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  dueAt?: string | null;
}

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  driveFileId?: string | null;
  sizeBytes?: number;
}

export interface TaskHistoryEntry {
  id: string;
  at: string;
  actor: 'USER' | 'AI' | 'SYSTEM';
  action: string;
  details?: Record<string, unknown>;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  notes?: string | null;
  priority: Priority;
  status: TaskStatus;
  categoryId: string;
  subcategory?: string | null;
  parentId?: string | null;
  /** Échéance (date + heure) en ISO UTC. */
  dueAt?: string | null;
  /** Date au plus tôt pour commencer (ex. attendre un retour fournisseur). */
  startAfter?: string | null;
  estimatedMinutes: number;
  actualMinutes?: number;
  /** Laisse l'IA placer la tâche dans le calendrier. */
  autoSchedule: boolean;
  /** Peut être découpée en plusieurs sessions. */
  splittable: boolean;
  minChunkMinutes?: number;
  /** Travail profond → privilégie les créneaux de concentration. */
  deepWork?: boolean;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  checklist: ChecklistItem[];
  attachments: Attachment[];
  tags: string[];
  source?: 'MANUAL' | 'EMAIL' | 'VOICE' | 'AI' | 'CALENDAR';
  sourceRef?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  /** Poids métier utilisé par le scoring (1 = neutre). */
  weight: number;
  subcategories: string[];
  isSystem?: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay?: boolean;
  location?: string | null;
  /** Bloc créé par Kairos (tâche planifiée ou temps de concentration). */
  kind: 'EVENT' | 'TASK_BLOCK' | 'FOCUS';
  taskId?: string | null;
  googleEventId?: string | null;
  /** Un évènement "libre" (transparent) ne bloque pas la planification. */
  transparent?: boolean;
}

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = dimanche

export interface TimeRange {
  /** "HH:mm" heure locale */
  start: string;
  end: string;
}

export interface WorkingHours {
  timeZone: string;
  days: Partial<Record<Weekday, TimeRange[]>>;
}

export interface SchedulerSettings {
  workingHours: WorkingHours;
  /** Minutes de concentration à protéger par jour ouvré. */
  focusMinutesPerDay: number;
  /** Durée minimale d'un bloc de concentration. */
  minFocusBlockMinutes: number;
  /** Tampon entre deux blocs (transition, trajet). */
  bufferMinutes: number;
  /** Plafond de travail planifié par jour (hors réunions). */
  maxTaskMinutesPerDay: number;
  /** Horizon de planification. */
  horizonDays: number;
  /** Granularité d'arrondi des créneaux. */
  slotGranularityMinutes: number;
}

export interface Email {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  labels: string[];
  importance?: 'URGENT' | 'IMPORTANT' | 'NORMAL' | 'LOW';
  summary?: string | null;
  detectedActions?: string[];
  detectedDeadline?: string | null;
  linkedTaskId?: string | null;
}

export interface Goal {
  id: string;
  title: string;
  period: 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';
  periodStart: string;
  target: number;
  current: number;
  unit: string;
  categoryId?: string | null;
}

export type NotificationChannel = 'WHATSAPP' | 'PUSH' | 'EMAIL' | 'IN_APP';
