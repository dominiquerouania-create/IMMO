-- ════════════════════════════════════════════════════════════════════
-- Kairos — défense en profondeur sur Supabase (à exécuter après les
-- migrations Prisma). L'API se connecte avec un rôle dédié `kairos_api`
-- qui n'a accès QU'AUX lignes de l'utilisateur fixé par la session :
--   SET LOCAL app.user_id = '<uuid>';
-- Les clés `anon` / `authenticated` de Supabase n'ont AUCUN accès.
--
-- ⚠ DURCISSEMENT V2 — ne pas appliquer tel quel en MVP : il suppose que
-- l'API ouvre chaque transaction avec `SET LOCAL app.user_id` (extension
-- Prisma `$extends` prévue en V2) et que les tâches planifiées (cron)
-- itèrent utilisateur par utilisateur. Sans cela, l'API ne voit plus rien.
-- ════════════════════════════════════════════════════════════════════

do $$
declare t text;
begin
  foreach t in array array[
    'Integration','Category','Task','CalendarEvent','EmailMessage','Document','Goal',
    'Notification','AiRoutingRule','AiRun','AutomationLog','SyncMutation','DashboardWidget','Note','Session'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('revoke all on %I from anon, authenticated', t);
    execute format($p$create policy owner_only on %I
      using ("userId" = current_setting('app.user_id', true))
      with check ("userId" = current_setting('app.user_id', true))$p$, t);
  end loop;
end $$;

-- Les tables enfants héritent de l'isolation via leur tâche parente.
alter table "ChecklistItem" enable row level security;
create policy owner_only on "ChecklistItem" using (exists (select 1 from "Task" t where t.id = "taskId" and t."userId" = current_setting('app.user_id', true)));
alter table "TaskEvent" enable row level security;
create policy owner_only on "TaskEvent" using (exists (select 1 from "Task" t where t.id = "taskId" and t."userId" = current_setting('app.user_id', true)));
alter table "TimeEntry" enable row level security;
create policy owner_only on "TimeEntry" using (exists (select 1 from "Task" t where t.id = "taskId" and t."userId" = current_setting('app.user_id', true)));
alter table "Attachment" enable row level security;
create policy owner_only on "Attachment" using (
  exists (select 1 from "Task" t where t.id = "taskId" and t."userId" = current_setting('app.user_id', true))
  or exists (select 1 from "Document" d where d.id = "documentId" and d."userId" = current_setting('app.user_id', true))
);

-- Journal d'audit immuable : pas de mise à jour ni de suppression.
revoke update, delete on "TaskEvent", "AutomationLog", "AiRun" from public;
