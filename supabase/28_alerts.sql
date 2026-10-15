-- Zuri System · 28 · 📣 Alerts: messages to many customers at once, by area or by cabinet · 2026-10-16
--
-- What this adds:
--   customer_alert_prefs  which cabinet/tower really serves each home, the customer's language, and what they agreed to get
--   alert_codes           the ready-made messages (OUT, FIX, MAINT, POWER, SLOW, NOTICE, UPGRADE, RENEW), English + Swahili
--   alerts                every alert: who it's for, the words, how many people, who approved it, when it went out
--   v_alert_audience      one row per customer with only what messaging needs (no national ID, money or notes)
--   alerts_version()      lets the app know this file has been run
--
-- The rules it keeps:
--   * Office staff (admin, internal, call center) can write an alert. Only a partner (admin) can approve it.
--   * Nothing is "sent" unless it was approved first, and the words can't change after approval.
--   * Zuri itself still sends nothing: the app exports the list for the bulk-SMS service, or (later) the Daraja server sends it.
--   * Offers only go to customers who said yes to offers. Service alerts and reminders can be switched off per customer.
--
-- Run it on the TEST or TRAINING database first. It is safe to run twice.
-- If your last file was numbered higher than 27, rename this to the next number; nothing inside depends on the name.

create extension if not exists pgcrypto;

-- ---------- who is asking? ----------
create or replace function public.alerts_role() returns text
language sql stable security definer set search_path = public as $$
  select p.role from public.profiles p where p.id = auth.uid() and coalesce(p.active, true)
$$;
revoke all on function public.alerts_role() from public;
grant execute on function public.alerts_role() to authenticated;

create or replace function public.alerts_version() returns int language sql immutable as $$ select 1 $$;
grant execute on function public.alerts_version() to anon, authenticated;

-- ---------- the tables (id types follow Zuri's own customers and hubs tables) ----------
do $$
declare
  cust_t text := 'text'; hub_t text := 'text'; out_t text := 'text';
  cust_fk text := ''; hub_fk text := ''; out_fk text := '';
begin
  select format_type(a.atttypid, a.atttypmod) into cust_t from pg_attribute a
   where a.attrelid = to_regclass('public.customers') and a.attname = 'id' and not a.attisdropped;
  if cust_t is null then cust_t := 'text'; else cust_fk := ' references public.customers(id) on delete cascade'; end if;

  select format_type(a.atttypid, a.atttypmod) into hub_t from pg_attribute a
   where a.attrelid = to_regclass('public.hubs') and a.attname = 'id' and not a.attisdropped;
  if hub_t is null then hub_t := 'text'; else hub_fk := ' references public.hubs(id) on delete set null'; end if;

  select format_type(a.atttypid, a.atttypmod) into out_t from pg_attribute a
   where a.attrelid = to_regclass('public.outages') and a.attname = 'id' and not a.attisdropped;
  if out_t is null then out_t := 'text'; else out_fk := ' references public.outages(id) on delete set null'; end if;

  execute format($t$
    create table if not exists public.customer_alert_prefs (
      customer_id   %1$s primary key%2$s,
      served_by_hub %3$s%4$s,                    -- the cabinet / tower this home is wired to (null = use the nearest hub)
      lang          text not null default 'sw' check (lang in ('sw', 'en')),
      ok_service    boolean not null default true,  -- outages, repairs, planned work
      ok_reminders  boolean not null default true,  -- payment reminders
      ok_offers     boolean not null default false, -- offers and upgrades: only with the customer's yes
      consent_note  text,                           -- how/when they said yes or no, e.g. "Said yes to offers at install, 3 Oct"
      updated_at    timestamptz not null default now(),
      updated_by    uuid default auth.uid()
    )$t$, cust_t, cust_fk, hub_t, hub_fk);

  execute format($t$
    create table if not exists public.alerts (
      id            uuid primary key default gen_random_uuid(),
      code          text not null,
      purpose       text not null check (purpose in ('service', 'reminder', 'offer')),
      areas         text[] not null default '{}',
      hubs          text[] not null default '{}',
      filters       jsonb not null default '{}'::jsonb,   -- statuses, plans, "package ends within N days", second phones
      blanks        jsonb not null default '{}'::jsonb,   -- what the person filled in: {"eta": "4pm"}
      message_en    text not null,
      message_sw    text not null,
      recipients    int  not null default 0,
      recipient_ids text[] not null default '{}',       -- kept so FIX goes to exactly the people who got OUT
      est_cost_kes  numeric,
      outage_id     %1$s%2$s,
      parent_id     uuid references public.alerts(id) on delete set null,  -- FIX → the OUT it follows
      status        text not null default 'draft' check (status in ('draft', 'approved', 'sent', 'cancelled')),
      channel       text not null default 'sms' check (channel in ('sms', 'whatsapp', 'both')),
      sent_how      text check (sent_how in ('export', 'copied', 'server')),
      delivered     int,
      failed        int,
      note          text,
      created_by    uuid default auth.uid(),
      created_at    timestamptz not null default now(),
      approved_by   uuid,
      approved_at   timestamptz,
      sent_by       uuid,
      sent_at       timestamptz,
      updated_at    timestamptz not null default now()
    )$t$, out_t, out_fk);
end $$;

create index if not exists alerts_status_idx  on public.alerts (status, created_at desc);
create index if not exists alerts_outage_idx  on public.alerts (outage_id);
create index if not exists cap_hub_idx        on public.customer_alert_prefs (served_by_hub);

create table if not exists public.alert_codes (
  code        text primary key check (code ~ '^[A-Z][A-Z0-9_]{1,15}$'),
  name        text not null,
  purpose     text not null check (purpose in ('service', 'reminder', 'offer')),
  urgent      boolean not null default false,       -- urgent ones may go out during quiet hours
  msg_en      text not null,
  msg_sw      text not null,
  follow_up   text references public.alert_codes(code) on delete set null,  -- OUT → FIX
  hint        text,
  active      boolean not null default true,
  sort        int not null default 100,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid()
);

-- ---------- the ready-made messages ----------
-- {company} {zone} {name} {account_no} {paid_until} {plan} {pay} {support} fill themselves in.
-- {eta} {date} {time} {duration} {offer} {message} are typed by the person sending.
-- The Swahili is a first draft: have a Swahili-speaking partner read every line before real customers get it.
insert into public.alert_codes (code, name, purpose, urgent, msg_en, msg_sw, hint, sort, active) values
 ('OUT', 'Outage', 'service', true,
  '{company}: Internet is down in {zone}. Technicians are on it. Expected back by {eta}. No need to call, we will text you when it is fixed.',
  '{company}: Mtandao umekatika {zone}. Mafundi wanashughulikia. Utarudi kufikia {eta}. Usipige simu, tutakutumia ujumbe ukirudi.',
  'Send when a cabinet, tower or the backhaul is down. Then send FIX to the same people.', 10, true),
 ('FIX', 'Service is back', 'service', true,
  '{company}: Internet is back in {zone}. Thanks for your patience. Still offline? Restart your router, then call or WhatsApp {support}.',
  '{company}: Mtandao umerudi {zone}. Asante kwa uvumilivu. Bado hauna mtandao? Zima na uwashe router, kisha tupigie au WhatsApp {support}.',
  'Goes to exactly the people who got the outage message.', 20, true),
 ('MAINT', 'Planned work', 'service', false,
  '{company}: Planned work in {zone} on {date} from {time}. Internet may be off for about {duration}. Sorry for the trouble.',
  '{company}: Kazi iliyopangwa {zone} tarehe {date} kuanzia {time}. Mtandao unaweza kukatika kwa {duration}. Samahani kwa usumbufu.',
  'Send the day before.', 30, true),
 ('POWER', 'Power cut (not us)', 'service', true,
  '{company}: Electricity is off in {zone}. Your internet will come back when the power returns. Our network is working.',
  '{company}: Umeme umekatika {zone}. Mtandao wako utarudi umeme ukirudi. Mtandao wetu unafanya kazi.',
  'Saves a flood of fault calls when KPLC power is out.', 40, true),
 ('SLOW', 'Slow internet', 'service', false,
  '{company}: Internet may be slow in {zone} until {eta} while we fix a fault. Sorry for the trouble.',
  '{company}: Mtandao unaweza kuwa wa polepole {zone} hadi {eta} tunaporekebisha hitilafu. Samahani kwa usumbufu.',
  null, 50, true),
 ('NOTICE', 'General notice', 'service', false,
  '{company}: {message}',
  '{company}: {message}',
  'Type the whole message yourself, in both languages if you can.', 60, true),
 ('UPGRADE', 'Upgrade offer', 'offer', false,
  'Hi {name}, faster {company} packages are now available in {zone}: {offer}. Call or WhatsApp {support} to upgrade.',
  'Habari {name}, vifurushi vya kasi zaidi vya {company} sasa vipo {zone}: {offer}. Tupigie au WhatsApp {support} kuboresha.',
  'Only goes to customers who said yes to offers.', 70, true),
 ('RENEW', 'Package ending', 'reminder', false,
  'Hi {name}, your {company} package ends on {paid_until}.{pay}',
  'Habari {name}, kifurushi chako cha {company} kinaisha tarehe {paid_until}.{pay}',
  'OFF by default: Billnasi already texts customers 3 days before their package ends. Switch on only if Billnasi stops.', 80, false)
on conflict (code) do nothing;
update public.alert_codes set follow_up = 'FIX' where code = 'OUT' and follow_up is null;

insert into public.settings (key, value) values
  ('alerts_setup', '{"sms_price_kes": null, "sender_id": null, "quiet_from": "20:00", "quiet_to": "07:00", "approve_over": 0, "server_on": false}'::jsonb)
on conflict (key) do nothing;

-- ---------- the guard: approve before send, no edits after approval ----------
create or replace function public.alerts_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text := public.alerts_role();
begin
  new.updated_at := now();
  if auth.uid() is null then return new; end if;            -- the Daraja server (service key) records sends and delivery counts
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then raise exception 'A new alert starts as a draft. A partner approves it.'; end if;
    new.created_by := auth.uid(); new.approved_by := null; new.approved_at := null; new.sent_by := null; new.sent_at := null;
    return new;
  end if;
  -- the only moves allowed: draft → approved (partner) · draft → cancelled · approved → sent · approved → cancelled (partner)
  if new.status <> old.status and not (
       (old.status = 'draft' and new.status in ('approved', 'cancelled'))
    or (old.status = 'approved' and new.status in ('sent', 'cancelled'))) then
    raise exception 'An alert can''t go from % to %.', old.status, new.status;
  end if;
  if old.status in ('sent', 'cancelled') and (new.message_en <> old.message_en or new.message_sw <> old.message_sw) then
    raise exception 'This alert is finished and can''t be changed.';
  end if;
  if old.status <> 'draft' and (new.message_en <> old.message_en or new.message_sw <> old.message_sw or new.recipient_ids <> old.recipient_ids
      or new.areas <> old.areas or new.hubs <> old.hubs or new.code <> old.code or new.purpose <> old.purpose) then
    raise exception 'The words and the people can''t change after approval. Cancel it and make a new one.';
  end if;
  new.created_by := old.created_by; new.created_at := old.created_at;
  if new.status = 'approved' and old.status = 'draft' then
    if r is distinct from 'admin' then raise exception 'Only a partner can approve an alert.'; end if;
    new.approved_by := auth.uid(); new.approved_at := now();
  else
    new.approved_by := old.approved_by; new.approved_at := old.approved_at;
  end if;
  if new.status = 'sent' and old.status = 'approved' then
    new.sent_by := auth.uid(); new.sent_at := now();
  else
    new.sent_by := old.sent_by; new.sent_at := old.sent_at;
  end if;
  if new.status = 'cancelled' and old.status = 'approved' and r is distinct from 'admin' then
    raise exception 'Only a partner can cancel an approved alert.';
  end if;
  return new;
end $$;
drop trigger if exists alerts_guard on public.alerts;
create trigger alerts_guard before insert or update on public.alerts for each row execute function public.alerts_guard();

create or replace function public.alert_codes_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end $$;
drop trigger if exists alert_codes_touch on public.alert_codes;
create trigger alert_codes_touch before update on public.alert_codes for each row execute function public.alert_codes_touch();

create or replace function public.cap_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end $$;
drop trigger if exists cap_touch on public.customer_alert_prefs;
create trigger cap_touch before insert or update on public.customer_alert_prefs for each row execute function public.cap_touch();

-- ---------- who may see and change what ----------
alter table public.alerts               enable row level security;
alter table public.alert_codes          enable row level security;
alter table public.customer_alert_prefs enable row level security;

drop policy if exists alerts_read   on public.alerts;
drop policy if exists alerts_add    on public.alerts;
drop policy if exists alerts_change on public.alerts;
create policy alerts_read   on public.alerts for select to authenticated using (public.alerts_role() in ('admin', 'internal', 'callcenter'));
create policy alerts_add    on public.alerts for insert to authenticated with check (public.alerts_role() in ('admin', 'internal', 'callcenter'));
create policy alerts_change on public.alerts for update to authenticated using (public.alerts_role() in ('admin', 'internal', 'callcenter'))
  with check (public.alerts_role() in ('admin', 'internal', 'callcenter'));
-- no delete: cancelled alerts stay in the history

drop policy if exists codes_read  on public.alert_codes;
drop policy if exists codes_admin on public.alert_codes;
create policy codes_read  on public.alert_codes for select to authenticated using (public.alerts_role() in ('admin', 'internal', 'callcenter', 'field'));
create policy codes_admin on public.alert_codes for all to authenticated using (public.alerts_role() = 'admin') with check (public.alerts_role() = 'admin');

-- Field techs set the cabinet at install; only the office changes language and the yes/no answers (checked by the trigger below).
drop policy if exists cap_read   on public.customer_alert_prefs;
drop policy if exists cap_add    on public.customer_alert_prefs;
drop policy if exists cap_change on public.customer_alert_prefs;
create policy cap_read   on public.customer_alert_prefs for select to authenticated using (public.alerts_role() in ('admin', 'internal', 'callcenter', 'field'));
create policy cap_add    on public.customer_alert_prefs for insert to authenticated with check (public.alerts_role() in ('admin', 'internal', 'callcenter', 'field'));
create policy cap_change on public.customer_alert_prefs for update to authenticated using (public.alerts_role() in ('admin', 'internal', 'callcenter', 'field'))
  with check (public.alerts_role() in ('admin', 'internal', 'callcenter', 'field'));

create or replace function public.cap_field_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.alerts_role() = 'field' then
    if tg_op = 'INSERT' then
      new.lang := 'sw'; new.ok_service := true; new.ok_reminders := true; new.ok_offers := false; new.consent_note := null;
    else
      new.lang := old.lang; new.ok_service := old.ok_service; new.ok_reminders := old.ok_reminders; new.ok_offers := old.ok_offers; new.consent_note := old.consent_note;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists cap_field_guard on public.customer_alert_prefs;
create trigger cap_field_guard before insert or update on public.customer_alert_prefs for each row execute function public.cap_field_guard();

grant select, insert, update on public.alerts, public.customer_alert_prefs to authenticated;
grant select, insert, update, delete on public.alert_codes to authenticated;

-- ---------- what the messaging server reads ----------
-- Runs with the reader's own rights (security_invoker), so it never shows more than customers already does.
do $$
begin
  if to_regclass('public.customers') is not null then
    execute $v$
      create or replace view public.v_alert_audience with (security_invoker = true) as
      select c.id, c.full_name, c.phone, c.phone2, c.area, c.status, c.plan, c.paid_until, c.account_no, c.lat, c.lng,
             p.served_by_hub, coalesce(p.lang, 'sw') as lang,
             coalesce(p.ok_service, true) as ok_service, coalesce(p.ok_reminders, true) as ok_reminders, coalesce(p.ok_offers, false) as ok_offers
        from public.customers c
        left join public.customer_alert_prefs p on p.customer_id = c.id
    $v$;
    execute 'revoke all on public.v_alert_audience from anon';
    execute 'grant select on public.v_alert_audience to authenticated';
  end if;
end $$;
