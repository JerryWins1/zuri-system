-- Zuri System · 📣 Alerts by email (free, from the office email account) · v1 · 2026-10-27 (app v2.55)
-- Run AFTER 28_alerts.sql. Safe to run twice.
--   customer_alert_prefs.ok_email   the customer said yes to emails from Zuri (off until they do)
--   alerts.sent_how 'email'         an alert that went out by email
--   v_alert_audience                + email, ok_email
--   alerts_version() = 2            tells the app email is ready
-- Nothing here sends an email. The app makes BCC batches the office pastes into its own email account.

alter table public.customer_alert_prefs add column if not exists ok_email boolean not null default false;

-- sent_how may now say 'email' (the check from 28_alerts.sql is replaced, whatever its name)
do $$
declare c record;
begin
  for c in select conname from pg_constraint where conrelid = 'public.alerts'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%sent_how%' loop
    execute format('alter table public.alerts drop constraint %I', c.conname);
  end loop;
  alter table public.alerts add constraint alerts_sent_how_check check (sent_how in ('export', 'copied', 'server', 'email'));
end $$;

-- Field techs still set only the cabinet: they can't change a customer's yes to emails either.
create or replace function public.cap_field_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.alerts_role() = 'field' then
    if tg_op = 'INSERT' then
      new.lang := 'sw'; new.ok_service := true; new.ok_reminders := true; new.ok_offers := false; new.ok_email := false; new.consent_note := null;
    else
      new.lang := old.lang; new.ok_service := old.ok_service; new.ok_reminders := old.ok_reminders; new.ok_offers := old.ok_offers; new.ok_email := old.ok_email; new.consent_note := old.consent_note;
    end if;
  end if;
  return new;
end $$;

-- The messaging view gains the email and the yes (new columns go at the end, so "create or replace" keeps the old ones).
do $$
declare em text;
begin
  if to_regclass('public.customers') is not null then
    -- the customer's email column (the app saves it as "email"); a database without one gets an empty column
    em := case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'customers' and column_name = 'email') then 'c.email' else 'null::text' end;
    execute format($v$
      create or replace view public.v_alert_audience with (security_invoker = true) as
      select c.id, c.full_name, c.phone, c.phone2, c.area, c.status, c.plan, c.paid_until, c.account_no, c.lat, c.lng,
             p.served_by_hub, coalesce(p.lang, 'sw') as lang,
             coalesce(p.ok_service, true) as ok_service, coalesce(p.ok_reminders, true) as ok_reminders, coalesce(p.ok_offers, false) as ok_offers,
             %s as email, coalesce(p.ok_email, false) as ok_email
        from public.customers c
        left join public.customer_alert_prefs p on p.customer_id = c.id
    $v$, em);
    execute 'revoke all on public.v_alert_audience from anon';
    execute 'grant select on public.v_alert_audience to authenticated';
  end if;
end $$;

create or replace function public.alerts_version() returns int language sql immutable as $$ select 2 $$;
grant execute on function public.alerts_version() to anon, authenticated;
