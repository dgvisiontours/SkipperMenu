-- PASZOWÓZ: uruchom cały plik w Supabase > SQL Editor.
create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('skipper', 'supplier', 'admin');
exception when duplicate_object then null;
end $$;

create table if not exists public.boats (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  crew_profile jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.boats add column if not exists crew_profile jsonb;

alter table public.boats drop constraint if exists boats_name_key;
create unique index if not exists boats_active_name_unique
  on public.boats (lower(name)) where active;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'skipper',
  boat_id uuid references public.boats(id),
  diet_preferences jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists diet_preferences jsonb;

create table if not exists public.privileged_user_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

insert into public.privileged_user_emails(email) values
  ('dextrim.0x@gmail.com'),
  ('balcerzakagata8@gmail.com'),
  ('mciporski@gmail.com'),
  ('olgaziuz@gmail.com'),
  ('gabriela.malyszko@gmail.com')
on conflict (email) do nothing;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null,
  unit text not null default 'szt.',
  sort_order integer not null,
  active boolean not null default true
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  boat_id uuid not null references public.boats(id),
  target_date date not null,
  diet_notes text not null default '',
  special_requests text not null default '',
  location text check (location in ('cruise', 'zofiowka')),
  breakfast_choices text[] not null default '{}',
  submitted_by uuid not null references public.profiles(id),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (boat_id, target_date)
);

alter table public.orders add column if not exists location text;
alter table public.orders drop constraint if exists orders_location_check;
alter table public.orders add constraint orders_location_check
  check (location is null or location in ('cruise', 'zofiowka'));

create table if not exists public.order_items (
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric(10,2) not null check (quantity > 0),
  item_note text not null default '',
  primary key (order_id, product_id)
);

alter table public.order_items add column if not exists item_note text not null default '';

insert into public.products (name, category, unit, sort_order) values
('Chleb pszenny','Pieczywo','szt.',1),('Chleb razowy','Pieczywo','szt.',2),
('Chleb tostowy','Pieczywo','opak.',3),('Chleb bezglutenowy','Pieczywo','szt.',4),
('Bułki kajzerki','Pieczywo','szt.',5),('Bułki grahamki','Pieczywo','szt.',6),
('Bagietki','Pieczywo','szt.',7),('Tortille','Pieczywo','opak.',8),
('Ser gouda w plastrach (lub inny)','Nabiał i zamienniki','opak.',9),
('Mozzarella tarta/kulka','Nabiał i zamienniki','opak.',10),
('Camembert','Nabiał i zamienniki','szt.',11),('Ser bez laktozy','Nabiał i zamienniki','opak.',12),
('Ser wegański','Nabiał i zamienniki','opak.',13),
('Twaróg chudy/tłusty/półtłusty','Nabiał i zamienniki','opak.',14),
('Twarożek kanapkowy śmietankowy','Nabiał i zamienniki','opak.',15),
('Twarożek Grani','Nabiał i zamienniki','opak.',16),
('Hummus','Nabiał i zamienniki','opak.',16),('Serek wiejski','Nabiał i zamienniki','szt.',17),
('Skyr Naturalny','Nabiał i zamienniki','szt.',18),('Skyr owocowy','Nabiał i zamienniki','szt.',19),
('Skyr waniliowy','Nabiał i zamienniki','szt.',20),('Passata pomidorowa','Dodatki','szt.',21),
('Suszone pomidory','Dodatki','słoik',22),('Sok do wody','Dodatki','butelka',23),('Szynka','Mięso i zamienniki','opak.',24),
('Schab w plastrach','Mięso i zamienniki','opak.',24),('Salami','Mięso i zamienniki','opak.',25),
('Kabanosy','Mięso i zamienniki','opak.',26),('Boczek','Mięso i zamienniki','opak.',27),
('Parówki','Mięso i zamienniki','paczka 12 szt.',28),('Pasztet','Mięso i zamienniki','opak.',29),
('Wege parówki','Mięso i zamienniki','opak.',31),
('Wege kabanosy','Mięso i zamienniki','opak.',32),('Wege szynka','Mięso i zamienniki','opak.',33),
('Jajka','Nabiał i zamienniki','paczka 10 szt.',34),('Pomidory','Warzywa','szt.',35),
('Ogórki','Warzywa','szt.',36),('Papryka','Warzywa','szt.',37),('Sałata','Warzywa','szt.',38),
('Rukola','Warzywa','opak.',39),('Rzodkiewki','Warzywa','pęczek',40),
('Szczypiorek','Warzywa','pęczek',41),('Cebula czerwona/żółta','Warzywa','szt.',42),
('Awokado','Warzywa','szt.',43),('Oliwki zielone/czarne','Warzywa','słoik',44),
('Ogórki kiszone','Warzywa','słoik',45),('Kukurydza','Warzywa','puszka',46),
('Mleko','Śniadaniowe','l',47),('Jogurt naturalny','Śniadaniowe','szt.',48),
('Śmietana 18/30','Śniadaniowe','szt.',49),('Płatki kukurydziane','Śniadaniowe','opak.',50),
('Płatki czekoladowe','Śniadaniowe','opak.',51),('Musli','Śniadaniowe','opak.',52),
('Granola','Śniadaniowe','opak.',53),('Owsianka','Śniadaniowe','opak.',54),
('Krem czekoladowy','Śniadaniowe','słoik',55),('Dżem','Śniadaniowe','słoik',56),('Pasta do smarowania','Śniadaniowe','szt.',57),
('Rodzynki','Śniadaniowe','opak.',57),('Masło','Śniadaniowe','szt.',58),
('Mąka','Śniadaniowe','kg',60),
('Cukier','Śniadaniowe','kg',61),('Cukier wanilinowy','Śniadaniowe','opak.',62),
('Banany','Owoce','szt.',64),('Jabłka','Owoce','szt.',65),
('Gruszki','Owoce','szt.',66),('Winogrona','Owoce','opak.',67),
('Borówki','Owoce','opak.',68),('Maliny','Owoce','opak.',69)
on conflict (name) do update set
  category = excluded.category, unit = excluded.unit, sort_order = excluded.sort_order;

update public.products set active = false where name = 'Ryba wędzona';
update public.products set active = false where name = 'Olej';
update public.products set active = false where name = 'Truskawki';
update public.products set active = false where name = 'Wege masło';
update public.products set unit = 'paczka 10 szt.' where name = 'Jajka';
update public.products set unit = 'paczka 12 szt.' where name = 'Parówki';

create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer
set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.current_boat_id()
returns uuid
language sql stable security definer
set search_path = public
as $$ select boat_id from public.profiles where id = auth.uid() $$;

create or replace function public.current_user_has_extra_access()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    join public.privileged_user_emails e on lower(e.email) = lower(u.email)
    where u.id = auth.uid()
  )
$$;

create or replace function public.can_view_supplier_report()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('supplier','admin'), false)
    or public.current_user_has_extra_access()
$$;

create or replace function public.can_manage_user_accounts()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'admin', false)
    or public.current_user_has_extra_access()
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  new_boat_id uuid;
  requested_boat text;
begin
  requested_boat := nullif(trim(new.raw_user_meta_data->>'boat_name'), '');
  if requested_boat is null then
    raise exception 'Podaj nazwę jachtu.';
  end if;

  insert into public.boats(name) values (requested_boat)
  returning id into new_boat_id;

  insert into public.profiles(id, full_name, role, boat_id)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)),
    'skipper',
    new_boat_id
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

update public.profiles p
set role = 'skipper'
from auth.users u
where u.id = p.id
  and lower(u.email) in (
    'dextrim.0x@gmail.com',
    'balcerzakagata8@gmail.com',
    'mciporski@gmail.com',
    'olgaziuz@gmail.com',
    'gabriela.malyszko@gmail.com'
  );

alter table public.boats enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "authenticated read boats" on public.boats;
create policy "authenticated read boats" on public.boats for select to authenticated using (true);

drop policy if exists "read products" on public.products;
create policy "read products" on public.products for select to authenticated using (true);

drop policy if exists "read profiles" on public.profiles;
create policy "read profiles" on public.profiles for select to authenticated
using (id = auth.uid() or public.can_view_supplier_report());

drop policy if exists "read orders" on public.orders;
create policy "read orders" on public.orders for select to authenticated
using (boat_id = public.current_boat_id() or public.can_view_supplier_report());

drop policy if exists "read order items" on public.order_items;
create policy "read order items" on public.order_items for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and (o.boat_id = public.current_boat_id() or public.can_view_supplier_report())
  )
);

create or replace function public.diet_preferences_to_text(p_preferences jsonb)
returns text
language sql immutable
as $$
  select case
    when p_preferences is null then ''
    when coalesce((p_preferences->>'no_diets')::boolean, false) then 'Brak diet i alergii'
    else concat_ws(', ',
      case when coalesce((p_preferences->'vegetarian'->>'enabled')::boolean, false)
        then (p_preferences->'vegetarian'->>'count') || ' wege' end,
      case when coalesce((p_preferences->'lactose_free'->>'enabled')::boolean, false)
        then (p_preferences->'lactose_free'->>'count') || ' bez laktozy' end,
      case when coalesce((p_preferences->'gluten_free'->>'enabled')::boolean, false)
        then (p_preferences->'gluten_free'->>'count') || ' bez glutenu' end,
      case when coalesce((p_preferences->'other'->>'enabled')::boolean, false)
        then (p_preferences->'other'->>'count') || ' inne: ' || trim(p_preferences->'other'->>'description') end
    )
  end
$$;

create or replace function public.save_diet_preferences(p_preferences jsonb)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_no_diets boolean := coalesce((p_preferences->>'no_diets')::boolean, false);
  v_any_enabled boolean;
begin
  if auth.uid() is null then raise exception 'Brak aktywnej sesji.'; end if;

  v_any_enabled :=
    coalesce((p_preferences->'vegetarian'->>'enabled')::boolean, false)
    or coalesce((p_preferences->'lactose_free'->>'enabled')::boolean, false)
    or coalesce((p_preferences->'gluten_free'->>'enabled')::boolean, false)
    or coalesce((p_preferences->'other'->>'enabled')::boolean, false);

  if not v_no_diets and not v_any_enabled then
    raise exception 'Wybierz przynajmniej jedną dietę albo zaznacz brak diet.';
  end if;
  if v_no_diets and v_any_enabled then
    raise exception 'Nie można jednocześnie wybrać diet i braku diet.';
  end if;
  if coalesce((p_preferences->'other'->>'enabled')::boolean, false)
    and nullif(trim(p_preferences->'other'->>'description'), '') is null then
    raise exception 'Opisz inną dietę lub alergię.';
  end if;
  if exists (
    select 1 from (values
      (p_preferences->'vegetarian'), (p_preferences->'lactose_free'),
      (p_preferences->'gluten_free'), (p_preferences->'other')
    ) as d(item)
    where coalesce((item->>'enabled')::boolean, false)
      and coalesce((item->>'count')::integer, 0) < 1
  ) then
    raise exception 'Liczba osób musi wynosić co najmniej 1.';
  end if;

  update public.profiles set diet_preferences = p_preferences where id = auth.uid();
  return p_preferences;
end;
$$;

create or replace function public.save_crew_profile(
  p_preferences jsonb,
  p_crew_profile jsonb
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_boat_id uuid;
  v_boat_type text := p_crew_profile->>'boat_type';
  v_total integer := coalesce((p_crew_profile->>'total')::integer, 0);
  v_women integer := coalesce((p_crew_profile->>'women')::integer, 0);
  v_men integer := coalesce((p_crew_profile->>'men')::integer, 0);
begin
  select boat_id into v_boat_id from public.profiles where id = auth.uid();
  if v_boat_id is null then raise exception 'Konto nie jest przypisane do jachtu.'; end if;
  if v_boat_type not in ('recreational', 'training', 'expedition') then
    raise exception 'Wybierz typ jachtu.';
  end if;
  if v_total < 1 or v_women < 0 or v_men < 0 or v_women + v_men <> v_total then
    raise exception 'Liczba kobiet i mężczyzn musi być równa liczbie wszystkich osób.';
  end if;
  if exists (
    select 1 from (values
      (p_preferences->'vegetarian'), (p_preferences->'lactose_free'),
      (p_preferences->'gluten_free'), (p_preferences->'other')
    ) as d(item)
    where coalesce((item->>'enabled')::boolean, false)
      and coalesce((item->>'count')::integer, 0) > v_total
  ) then
    raise exception 'Liczba osób na diecie nie może przekraczać liczby osób w załodze.';
  end if;

  perform public.save_diet_preferences(p_preferences);
  update public.boats set crew_profile = p_crew_profile where id = v_boat_id;

  return jsonb_build_object(
    'diet_preferences', p_preferences,
    'crew_profile', p_crew_profile
  );
end;
$$;

drop function if exists public.start_new_turnus(text,jsonb);

create or replace function public.start_new_turnus(
  p_boat_name text,
  p_preferences jsonb,
  p_crew_profile jsonb
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_role public.app_role;
  v_old_boat_id uuid;
  v_new_boat_id uuid;
  v_boat_name text := trim(p_boat_name);
  v_no_diets boolean := coalesce((p_preferences->>'no_diets')::boolean, false);
  v_any_enabled boolean;
  v_boat_type text := p_crew_profile->>'boat_type';
  v_total integer := coalesce((p_crew_profile->>'total')::integer, 0);
  v_women integer := coalesce((p_crew_profile->>'women')::integer, 0);
  v_men integer := coalesce((p_crew_profile->>'men')::integer, 0);
begin
  select role, boat_id into v_role, v_old_boat_id
  from public.profiles where id = auth.uid();

  if v_role not in ('skipper', 'admin') then
    raise exception 'Tylko sternik przypisany do jachtu może rozpocząć nowy turnus.';
  end if;
  if v_boat_name is null or length(v_boat_name) < 2 then
    raise exception 'Podaj nazwę jachtu.';
  end if;
  if v_boat_type not in ('recreational', 'training', 'expedition') then
    raise exception 'Wybierz typ jachtu.';
  end if;
  if v_total < 1 or v_women < 0 or v_men < 0 or v_women + v_men <> v_total then
    raise exception 'Liczba kobiet i mężczyzn musi być równa liczbie wszystkich osób.';
  end if;

  v_any_enabled :=
    coalesce((p_preferences->'vegetarian'->>'enabled')::boolean, false)
    or coalesce((p_preferences->'lactose_free'->>'enabled')::boolean, false)
    or coalesce((p_preferences->'gluten_free'->>'enabled')::boolean, false)
    or coalesce((p_preferences->'other'->>'enabled')::boolean, false);

  if not v_no_diets and not v_any_enabled then
    raise exception 'Wybierz przynajmniej jedną dietę albo zaznacz brak diet.';
  end if;
  if v_no_diets and v_any_enabled then
    raise exception 'Nie można jednocześnie wybrać diet i braku diet.';
  end if;
  if coalesce((p_preferences->'other'->>'enabled')::boolean, false)
    and nullif(trim(p_preferences->'other'->>'description'), '') is null then
    raise exception 'Opisz inną dietę lub alergię.';
  end if;
  if exists (
    select 1 from (values
      (p_preferences->'vegetarian'), (p_preferences->'lactose_free'),
      (p_preferences->'gluten_free'), (p_preferences->'other')
    ) as d(item)
    where coalesce((item->>'enabled')::boolean, false)
      and coalesce((item->>'count')::integer, 0) < 1
  ) then
    raise exception 'Liczba osób musi wynosić co najmniej 1.';
  end if;
  if exists (
    select 1 from (values
      (p_preferences->'vegetarian'), (p_preferences->'lactose_free'),
      (p_preferences->'gluten_free'), (p_preferences->'other')
    ) as d(item)
    where coalesce((item->>'enabled')::boolean, false)
      and coalesce((item->>'count')::integer, 0) > v_total
  ) then
    raise exception 'Liczba osób na diecie nie może przekraczać liczby osób w załodze.';
  end if;

  if v_old_boat_id is not null then
    update public.boats set active = false where id = v_old_boat_id;
  end if;

  begin
    insert into public.boats(name, crew_profile, active) values (v_boat_name, p_crew_profile, true)
    returning id into v_new_boat_id;
  exception when unique_violation then
    raise exception 'Aktywny jacht o tej nazwie już istnieje.';
  end;

  update public.profiles
  set boat_id = v_new_boat_id, diet_preferences = p_preferences
  where id = auth.uid();

  return jsonb_build_object(
    'boat_id', v_new_boat_id,
    'boat_name', v_boat_name,
    'diet_preferences', p_preferences,
    'crew_profile', p_crew_profile
  );
end;
$$;

create or replace function public.finish_current_turnus()
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_role public.app_role;
  v_boat_id uuid;
  v_boat_name text;
begin
  select p.role, p.boat_id, b.name
  into v_role, v_boat_id, v_boat_name
  from public.profiles p
  left join public.boats b on b.id = p.boat_id
  where p.id = auth.uid();

  if v_role not in ('skipper', 'admin') then
    raise exception 'Tylko sternik może zakończyć turnus.';
  end if;
  if v_boat_id is null then
    raise exception 'Konto nie ma aktywnego turnusu.';
  end if;

  update public.boats
  set active = false
  where id = v_boat_id;

  update public.profiles
  set boat_id = null, diet_preferences = null
  where id = auth.uid();

  return jsonb_build_object(
    'boat_id', v_boat_id,
    'boat_name', v_boat_name
  );
end;
$$;

-- Zapisy odbywają się wyłącznie przez tę funkcję. Deadline jest sprawdzany po stronie serwera.
drop function if exists public.submit_order(date,text,text,text[],jsonb);

create or replace function public.submit_order(
  p_target_date date,
  p_diet_notes text,
  p_special_requests text,
  p_breakfast_choices text[],
  p_items jsonb,
  p_location text
) returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_role public.app_role;
  v_boat_id uuid;
  v_order_id uuid;
  v_local_now timestamp;
  v_minutes integer;
  v_expected_target date;
  v_diet_preferences jsonb;
  v_crew_profile jsonb;
begin
  select p.role, p.boat_id, p.diet_preferences, b.crew_profile
  into v_role, v_boat_id, v_diet_preferences, v_crew_profile
  from public.profiles p
  left join public.boats b on b.id = p.boat_id
  where p.id = auth.uid();
  if v_role is null or v_boat_id is null then raise exception 'Konto nie jest przypisane do jachtu.'; end if;
  if v_diet_preferences is null or v_crew_profile is null then
    raise exception 'Najpierw uzupełnij profil jachtu i załogi.';
  end if;
  if p_location not in ('cruise', 'zofiowka') then
    raise exception 'Wybierz, czy jacht jest W Rejsie, czy W Zofiówce.';
  end if;

  v_local_now := now() at time zone 'Europe/Warsaw';
  if v_role = 'skipper' then
    v_minutes := extract(hour from v_local_now)::integer * 60 + extract(minute from v_local_now)::integer;
    if v_minutes >= 18 * 60 then
      v_expected_target := v_local_now::date + 2;
    elsif v_minutes < 9 * 60 + 30 then
      v_expected_target := v_local_now::date + 1;
    else
      raise exception 'Zamówienia można składać od 18:00 do 09:30.';
    end if;
    if p_target_date <> v_expected_target then
      raise exception 'Sternik może zamówić wyłącznie na najbliższy termin dostawy.';
    end if;
  end if;

  insert into public.orders (
    boat_id, target_date, diet_notes, special_requests, location, breakfast_choices,
    submitted_by, submitted_at, updated_at
  ) values (
    v_boat_id, p_target_date, public.diet_preferences_to_text(v_diet_preferences), coalesce(p_special_requests,''),
    p_location,
    coalesce(p_breakfast_choices,'{}'), auth.uid(), now(), now()
  )
  on conflict (boat_id, target_date) do update set
    diet_notes = excluded.diet_notes,
    special_requests = excluded.special_requests,
    location = excluded.location,
    breakfast_choices = excluded.breakfast_choices,
    submitted_by = excluded.submitted_by,
    submitted_at = now(),
    updated_at = now()
  returning id into v_order_id;

  delete from public.order_items where order_id = v_order_id;
  insert into public.order_items(order_id, product_id, quantity, item_note)
  select v_order_id, x.product_id, x.quantity, left(coalesce(trim(x.item_note), ''), 160)
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb))
    as x(product_id uuid, quantity numeric, item_note text)
  join public.products p on p.id = x.product_id and p.active
  where x.quantity > 0;

  return v_order_id;
end;
$$;

create or replace function public.get_supplier_report(p_target_date date)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.can_view_supplier_report() then
    raise exception 'Brak uprawnień do raportu.';
  end if;

  select jsonb_build_object(
    'target_date', p_target_date,
    'total_boats', (select count(*) from public.boats where active),
    'total_people', coalesce((
      select sum(coalesce((crew_profile->>'total')::integer, 0))
      from public.boats where active
    ), 0),
    'diet_totals', coalesce((
      select jsonb_agg(
        jsonb_build_object('label', diet_label, 'count', diet_count)
        order by sort_order, diet_label
      )
      from (
        select 1 as sort_order, 'Wegetariańska'::text as diet_label,
          sum(coalesce((p.diet_preferences->'vegetarian'->>'count')::integer, 0)) as diet_count
        from public.profiles p join public.boats b on b.id = p.boat_id
        where b.active and coalesce((p.diet_preferences->'vegetarian'->>'enabled')::boolean, false)
        union all
        select 2, 'Bez laktozy',
          sum(coalesce((p.diet_preferences->'lactose_free'->>'count')::integer, 0))
        from public.profiles p join public.boats b on b.id = p.boat_id
        where b.active and coalesce((p.diet_preferences->'lactose_free'->>'enabled')::boolean, false)
        union all
        select 3, 'Bez glutenu',
          sum(coalesce((p.diet_preferences->'gluten_free'->>'count')::integer, 0))
        from public.profiles p join public.boats b on b.id = p.boat_id
        where b.active and coalesce((p.diet_preferences->'gluten_free'->>'enabled')::boolean, false)
        union all
        select 4, trim(p.diet_preferences->'other'->>'description'),
          sum(coalesce((p.diet_preferences->'other'->>'count')::integer, 0))
        from public.profiles p join public.boats b on b.id = p.boat_id
        where b.active
          and coalesce((p.diet_preferences->'other'->>'enabled')::boolean, false)
          and nullif(trim(p.diet_preferences->'other'->>'description'), '') is not null
        group by lower(trim(p.diet_preferences->'other'->>'description')),
          trim(p.diet_preferences->'other'->>'description')
      ) diets
      where coalesce(diet_count, 0) > 0
    ), '[]'::jsonb),
    'submitted_boats', (
      select count(*)
      from public.orders o
      join public.boats b on b.id = o.boat_id and b.active
      where o.target_date = p_target_date
    ),
    'missing_boats', coalesce((
      select jsonb_agg(b.name order by b.name)
      from public.boats b
      where b.active and not exists (
        select 1 from public.orders o where o.boat_id = b.id and o.target_date = p_target_date
      )
    ), '[]'::jsonb),
    'consolidated', coalesce((
      select jsonb_agg(row_data order by sort_order)
      from (
        select p.sort_order, jsonb_build_object(
          'product_name', p.name,
          'category', p.category,
          'item_note', oi.item_note,
          'unit', p.unit,
          'total_quantity', sum(oi.quantity),
          'boats', jsonb_agg(b.name || ': ' || trim(to_char(oi.quantity, 'FM999999990.##')) order by b.name)
        ) as row_data
        from public.order_items oi
        join public.products p on p.id = oi.product_id and p.active
        join public.orders o on o.id = oi.order_id and o.target_date = p_target_date
        join public.boats b on b.id = o.boat_id and b.active
        group by p.id, p.name, p.category, p.unit, p.sort_order, oi.item_note
      ) q
    ), '[]'::jsonb),
    'boats', coalesce((
      select jsonb_agg(boat_data order by boat_name)
      from (
        select b.name as boat_name, jsonb_build_object(
          'boat_name', b.name,
          'skipper_name', pr.full_name,
          'submitted_at', o_current.submitted_at,
          'location', o_current.location,
          'crew_profile', b.crew_profile,
          'diet_notes', o_current.diet_notes,
          'special_requests', o_current.special_requests,
          'breakfast_choices', coalesce(o_current.breakfast_choices, '{}'),
          'items', coalesce((
            select jsonb_agg(jsonb_build_array(p.name, oi.quantity, p.unit, p.category, p.sort_order, oi.item_note) order by p.sort_order)
            from public.order_items oi
            join public.products p on p.id = oi.product_id and p.active
            join public.orders o_items on o_items.id = oi.order_id
            where o_items.boat_id = b.id
              and o_items.target_date = p_target_date
          ), '[]'::jsonb)
        ) as boat_data
        from public.boats b
        left join public.orders o_current on o_current.boat_id = b.id and o_current.target_date = p_target_date
        left join public.profiles pr on pr.id = o_current.submitted_by
        where b.active and exists (
          select 1
          from public.order_items oi
          join public.products p on p.id = oi.product_id and p.active
          join public.orders o_items on o_items.id = oi.order_id
          where o_items.boat_id = b.id
            and o_items.target_date = p_target_date
        )
      ) q
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.get_admin_statistics(p_days integer default 7)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_days integer := greatest(3, least(coalesce(p_days, 7), 60));
  v_today date := (now() at time zone 'Europe/Warsaw')::date;
  v_start date;
  result jsonb;
begin
  if not public.can_manage_user_accounts() then
    raise exception 'Brak uprawnień do statystyk administratora.';
  end if;

  v_start := v_today - (v_days - 1);

  select jsonb_build_object(
    'days', v_days,
    'summary', jsonb_build_object(
      'orders', (select count(*) from public.orders where target_date between v_start and v_today),
      'active_boats', (select count(*) from public.boats where active),
      'total_people', coalesce((select sum(coalesce((crew_profile->>'total')::integer, 0)) from public.boats where active), 0),
      'total_quantity', coalesce((
        select sum(oi.quantity)
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
        join public.products p on p.id = oi.product_id and p.active
        where o.target_date between v_start and v_today
      ), 0)
    ),
    'product_totals', coalesce((
      select jsonb_agg(row_data order by order_count desc, total_quantity desc, product_name)
      from (
        select p.name as product_name, p.category, p.unit,
          sum(oi.quantity) as total_quantity,
          count(distinct o.id) as order_count,
          count(distinct o.boat_id) as boat_count,
          jsonb_build_object(
            'product_name', p.name,
            'category', p.category,
            'unit', p.unit,
            'total_quantity', sum(oi.quantity),
            'order_count', count(distinct o.id),
            'boat_count', count(distinct o.boat_id),
            'boats', coalesce((
              select jsonb_agg(jsonb_build_object(
                'boat_name', boat_name,
                'skipper_name', skipper_name,
                'quantity', quantity
              ) order by quantity desc, boat_name)
              from (
                select b2.name as boat_name, pr2.full_name as skipper_name, sum(oi2.quantity) as quantity
                from public.order_items oi2
                join public.orders o2 on o2.id = oi2.order_id and o2.target_date between v_start and v_today
                join public.boats b2 on b2.id = o2.boat_id
                left join public.profiles pr2 on pr2.id = o2.submitted_by
                where oi2.product_id = p.id
                group by b2.name, pr2.full_name
                order by quantity desc, b2.name
                limit 8
              ) boats_q
            ), '[]'::jsonb)
          ) as row_data
        from public.order_items oi
        join public.orders o on o.id = oi.order_id and o.target_date between v_start and v_today
        join public.products p on p.id = oi.product_id and p.active
        group by p.id, p.name, p.category, p.unit
        order by order_count desc, total_quantity desc
        limit 20
      ) q
    ), '[]'::jsonb),
    'least_products', coalesce((
      select jsonb_agg(row_data order by order_count, total_quantity, product_name)
      from (
        select p.name as product_name, coalesce(t.order_count, 0) as order_count, coalesce(t.total_quantity, 0) as total_quantity,
          jsonb_build_object(
            'product_name', p.name,
            'category', p.category,
            'unit', p.unit,
            'total_quantity', coalesce(t.total_quantity, 0),
            'order_count', coalesce(t.order_count, 0),
            'boat_count', coalesce(t.boat_count, 0),
            'boats', coalesce((
              select jsonb_agg(jsonb_build_object(
                'boat_name', boat_name,
                'skipper_name', skipper_name,
                'quantity', quantity
              ) order by quantity desc, boat_name)
              from (
                select b2.name as boat_name, pr2.full_name as skipper_name, sum(oi2.quantity) as quantity
                from public.order_items oi2
                join public.orders o2 on o2.id = oi2.order_id and o2.target_date between v_start and v_today
                join public.boats b2 on b2.id = o2.boat_id
                left join public.profiles pr2 on pr2.id = o2.submitted_by
                where oi2.product_id = p.id
                group by b2.name, pr2.full_name
                order by quantity desc, b2.name
                limit 8
              ) boats_q
            ), '[]'::jsonb)
          ) as row_data
        from public.products p
        left join (
          select oi.product_id, sum(oi.quantity) as total_quantity,
            count(distinct o.id) as order_count,
            count(distinct o.boat_id) as boat_count
          from public.order_items oi
          join public.orders o on o.id = oi.order_id and o.target_date between v_start and v_today
          group by oi.product_id
        ) t on t.product_id = p.id
        where p.active
        order by coalesce(t.order_count, 0), coalesce(t.total_quantity, 0), p.name
        limit 12
      ) q
    ), '[]'::jsonb),
    'category_totals', coalesce((
      select jsonb_agg(jsonb_build_object('label', category, 'value', total_quantity) order by total_quantity desc)
      from (
        select p.category, sum(oi.quantity) as total_quantity
        from public.order_items oi
        join public.orders o on o.id = oi.order_id and o.target_date between v_start and v_today
        join public.products p on p.id = oi.product_id and p.active
        group by p.category
      ) q
    ), '[]'::jsonb),
    'diet_totals', coalesce((
      select jsonb_agg(jsonb_build_object('label', diet_label, 'count', diet_count) order by sort_order, diet_label)
      from (
        select 1 as sort_order, 'Wegetariańska'::text as diet_label,
          sum(coalesce((p.diet_preferences->'vegetarian'->>'count')::integer, 0)) as diet_count
        from public.profiles p join public.boats b on b.id = p.boat_id
        where b.active and coalesce((p.diet_preferences->'vegetarian'->>'enabled')::boolean, false)
        union all
        select 2, 'Bez laktozy',
          sum(coalesce((p.diet_preferences->'lactose_free'->>'count')::integer, 0))
        from public.profiles p join public.boats b on b.id = p.boat_id
        where b.active and coalesce((p.diet_preferences->'lactose_free'->>'enabled')::boolean, false)
        union all
        select 3, 'Bez glutenu',
          sum(coalesce((p.diet_preferences->'gluten_free'->>'count')::integer, 0))
        from public.profiles p join public.boats b on b.id = p.boat_id
        where b.active and coalesce((p.diet_preferences->'gluten_free'->>'enabled')::boolean, false)
        union all
        select 4, trim(p.diet_preferences->'other'->>'description'),
          sum(coalesce((p.diet_preferences->'other'->>'count')::integer, 0))
        from public.profiles p join public.boats b on b.id = p.boat_id
        where b.active
          and coalesce((p.diet_preferences->'other'->>'enabled')::boolean, false)
          and nullif(trim(p.diet_preferences->'other'->>'description'), '') is not null
        group by lower(trim(p.diet_preferences->'other'->>'description')),
          trim(p.diet_preferences->'other'->>'description')
      ) diets
      where coalesce(diet_count, 0) > 0
    ), '[]'::jsonb),
    'boat_type_totals', coalesce((
      select jsonb_agg(jsonb_build_object('label', label, 'value', count) order by label)
      from (
        select case crew_profile->>'boat_type'
          when 'training' then 'Szkoleniowe'
          when 'expedition' then 'Wyprawowe'
          else 'Rekreacyjne'
        end as label, count(*) as count
        from public.boats
        where active
        group by 1
      ) q
    ), '[]'::jsonb),
    'crew_gender', jsonb_build_array(
      jsonb_build_object('label', 'Kobiety', 'value', coalesce((select sum(coalesce((crew_profile->>'women')::integer, 0)) from public.boats where active), 0)),
      jsonb_build_object('label', 'Mężczyźni', 'value', coalesce((select sum(coalesce((crew_profile->>'men')::integer, 0)) from public.boats where active), 0))
    )
  ) into result;

  return result;
end;
$$;

create or replace function public.list_user_accounts()
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.can_manage_user_accounts() then
    raise exception 'Brak uprawnień do zarządzania kontami.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'full_name', p.full_name,
    'role', p.role,
    'boat_name', b.name,
    'created_at', u.created_at
  ) order by lower(u.email)), '[]'::jsonb)
  into result
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.boats b on b.id = p.boat_id;

  return result;
end;
$$;

create or replace function public.delete_user_account(p_email text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_target_user uuid;
  v_target_boat uuid;
  v_boat_name text;
begin
  if not public.can_manage_user_accounts() then
    raise exception 'Brak uprawnień do usuwania kont.';
  end if;
  if v_email is null or v_email = '' then
    raise exception 'Podaj e-mail konta do usunięcia.';
  end if;

  select u.id, p.boat_id, b.name
    into v_target_user, v_target_boat, v_boat_name
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.boats b on b.id = p.boat_id
  where lower(u.email) = v_email;

  if v_target_user is null then
    raise exception 'Nie znaleziono konta o adresie %.', v_email;
  end if;
  if v_target_user = auth.uid() then
    raise exception 'Nie możesz usunąć aktualnie zalogowanego konta.';
  end if;

  delete from public.order_items oi
  using public.orders o
  where oi.order_id = o.id
    and (o.submitted_by = v_target_user or o.boat_id = v_target_boat);

  delete from public.orders
  where submitted_by = v_target_user or boat_id = v_target_boat;

  delete from public.profiles where id = v_target_user;

  if v_target_boat is not null and not exists (
    select 1 from public.profiles where boat_id = v_target_boat
  ) then
    delete from public.boats where id = v_target_boat;
  end if;

  delete from auth.users where id = v_target_user;

  return jsonb_build_object(
    'deleted_email', v_email,
    'deleted_user_id', v_target_user,
    'deleted_boat_name', v_boat_name
  );
end;
$$;

grant execute on function public.submit_order(date,text,text,text[],jsonb,text) to authenticated;
grant execute on function public.get_supplier_report(date) to authenticated;
grant execute on function public.get_admin_statistics(integer) to authenticated;
grant execute on function public.list_user_accounts() to authenticated;
grant execute on function public.delete_user_account(text) to authenticated;
grant execute on function public.save_diet_preferences(jsonb) to authenticated;
grant execute on function public.save_crew_profile(jsonb,jsonb) to authenticated;
grant execute on function public.start_new_turnus(text,jsonb,jsonb) to authenticated;
grant execute on function public.finish_current_turnus() to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_boat_id() to authenticated;
grant execute on function public.current_user_has_extra_access() to authenticated;
grant execute on function public.can_view_supplier_report() to authenticated;
grant execute on function public.can_manage_user_accounts() to authenticated;

-- Po utworzeniu konta zaopatrzeniowca wykonaj, podmieniając adres.
-- Dezaktywujemy techniczny jacht utworzony podczas rejestracji:
-- do $$
-- declare v_user uuid; v_boat uuid;
-- begin
--   select p.id, p.boat_id into v_user, v_boat
--   from public.profiles p join auth.users u on u.id = p.id
--   where u.email = 'zaopatrzenie@example.com';
--   update public.boats set active = false where id = v_boat;
--   update public.profiles set role = 'supplier', boat_id = null where id = v_user;
-- end $$;
--
-- Administrator (widzi oba panele):
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'admin@example.com');
