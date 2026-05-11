-- Layer 6: Audit-Log Tabelle fuer kassensystem
-- In Supabase SQL-Editor ausfuehren.
--
-- Idempotent: kann mehrfach ausgefuehrt werden.

create table if not exists pos_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,                       -- staff_id wenn vorhanden
  user_name text null,
  user_role text null,
  action text not null,                    -- z.B. 'LOGIN_FAILED', 'ORDER_CANCEL'
  target text null,                        -- z.B. 'Order#abc123'
  severity text not null default 'info',   -- info | warn | security
  ip text null,
  user_agent text null,
  details jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists idx_pos_audit_log_severity_created
  on pos_audit_log (severity, created_at desc);

create index if not exists idx_pos_audit_log_action_created
  on pos_audit_log (action, created_at desc);

create index if not exists idx_pos_audit_log_user_created
  on pos_audit_log (user_id, created_at desc);

-- RLS: Nur chef-Rolle darf lesen (ueber staff-table).
-- API-Routen verwenden supabaseAdmin (service role) und bypassen RLS,
-- aber wir aktivieren RLS trotzdem als Defense-in-Depth.
alter table pos_audit_log enable row level security;

-- Policy: niemand darf direkt lesen (nur Service-Role via Admin-API)
drop policy if exists "audit log read denied for anon" on pos_audit_log;
create policy "audit log read denied for anon" on pos_audit_log
  for select using (false);

drop policy if exists "audit log insert denied for anon" on pos_audit_log;
create policy "audit log insert denied for anon" on pos_audit_log
  for insert with check (false);
