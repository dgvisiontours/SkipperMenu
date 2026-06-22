-- PROVIANT: uruchom cały plik w Supabase > SQL Editor.
create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('skipper', 'supplier', 'admin');
exception when duplicate_object then null;
end $$;

create table if not exists public.boats (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'skipper',
  boat_id uuid references public.boats(id),
  created_at timestamptz not null default now()
);

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
  breakfast_choices text[] not null default '{}',
  submitted_by uuid not null references public.profiles(id),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (boat_id, target_date)
);

create table if not exists public.order_items (
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric(10,2) not null check (quantity > 0),
  primary key (order_id, product_id)
);

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
('Hummus','Nabiał i zamienniki','opak.',16),('Serek wiejski','Nabiał i zamienniki','szt.',17),
('Skyr Naturalny','Nabiał i zamienniki','szt.',18),('Skyr owocowy','Nabiał i zamienniki','szt.',19),
('Skyr waniliowy','Nabiał i zamienniki','szt.',20),('Passata pomidorowa','Dodatki','szt.',21),
('Suszone pomidory','Dodatki','słoik',22),('Szynka','Mięso i zamienniki','opak.',23),
('Schab w plastrach','Mięso i zamienniki','opak.',24),('Salami','Mięso i zamienniki','opak.',25),
('Kabanosy','Mięso i zamienniki','opak.',26),('Boczek','Mięso i zamienniki','opak.',27),
('Parówki','Mięso i zamienniki','szt.',28),('Pasztet','Mięso i zamienniki','opak.',29),
('Ryba wędzona','Mięso i zamienniki','opak.',30),('Wege parówki','Mięso i zamienniki','opak.',31),
('Wege kabanosy','Mięso i zamienniki','opak.',32),('Wege szynka','Mięso i zamienniki','opak.',33),
('Jajka','Nabiał i zamienniki','szt.',34),('Pomidory','Warzywa','szt.',35),
('Ogórki','Warzywa','szt.',36),('Papryka','Warzywa','szt.',37),('Sałata','Warzywa','szt.',38),
('Rukola','Warzywa','opak.',39),('Rzodkiewki','Warzywa','pęczek',40),
('Szczypiorek','Warzywa','pęczek',41),('Cebula czerwona/żółta','Warzywa','szt.',42),
('Awokado','Warzywa','szt.',43),('Oliwki zielone/czarne','Warzywa','słoik',44),
('Ogórki kiszone','Warzywa','słoik',45),('Kukurydza','Warzywa','puszka',46),
('Mleko','Śniadaniowe','l',47),('Jogurt naturalny','Śniadaniowe','szt.',48),
('Śmietana 18/30','Śniadaniowe','szt.',49),('Płatki kukurydziane','Śniadaniowe','opak.',50),
('Płatki czekoladowe','Śniadaniowe','opak.',51),('Musli','Śniadaniowe','opak.',52),
('Granola','Śniadaniowe','opak.',53),('Owsianka','Śniadaniowe','opak.',54),
('Krem czekoladowy','Śniadaniowe','słoik',55),('Dżem','Śniadaniowe','słoik',56),
('Rodzynki','Śniadaniowe','opak.',57),('Masło','Śniadaniowe','szt.',58),
('Wege masło','Śniadaniowe','szt.',59),('Mąka','Śniadaniowe','kg',60),
('Cukier','Śniadaniowe','kg',61),('Cukier wanilinowy','Śniadaniowe','opak.',62),
('Olej','Śniadaniowe','l',63),('Banany','Owoce','szt.',64),('Jabłka','Owoce','szt.',65),
('Gruszki','Owoce','szt.',66),('Winogrona','Owoce','opak.',67),('Truskawki','Owoce','opak.',68)
on conflict (name) do update set
  category = excluded.category, unit = excluded.unit, sort_order = excluded.sort_order;

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
using (id = auth.uid() or public.current_app_role() in ('supplier','admin'));

drop policy if exists "read orders" on public.orders;
create policy "read orders" on public.orders for select to authenticated
using (boat_id = public.current_boat_id() or public.current_app_role() in ('supplier','admin'));

drop policy if exists "read order items" on public.order_items;
create policy "read order items" on public.order_items for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and (o.boat_id = public.current_boat_id() or public.current_app_role() in ('supplier','admin'))
  )
);

-- Zapisy odbywają się wyłącznie przez tę funkcję. Deadline jest sprawdzany po stronie serwera.
create or replace function public.submit_order(
  p_target_date date,
  p_diet_notes text,
  p_special_requests text,
  p_breakfast_choices text[],
  p_items jsonb
) returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_role public.app_role;
  v_boat_id uuid;
  v_order_id uuid;
  v_local_now timestamp;
begin
  select role, boat_id into v_role, v_boat_id from public.profiles where id = auth.uid();
  if v_role is null or v_boat_id is null then raise exception 'Konto nie jest przypisane do jachtu.'; end if;

  v_local_now := now() at time zone 'Europe/Warsaw';
  if v_role = 'skipper' then
    if p_target_date <> v_local_now::date + 1 then
      raise exception 'Sternik może zamówić wyłącznie na następny dzień.';
    end if;
    if v_local_now::time >= time '18:00' then
      raise exception 'Termin składania zamówień minął o 18:00.';
    end if;
  end if;

  insert into public.orders (
    boat_id, target_date, diet_notes, special_requests, breakfast_choices,
    submitted_by, submitted_at, updated_at
  ) values (
    v_boat_id, p_target_date, coalesce(p_diet_notes,''), coalesce(p_special_requests,''),
    coalesce(p_breakfast_choices,'{}'), auth.uid(), now(), now()
  )
  on conflict (boat_id, target_date) do update set
    diet_notes = excluded.diet_notes,
    special_requests = excluded.special_requests,
    breakfast_choices = excluded.breakfast_choices,
    submitted_by = excluded.submitted_by,
    submitted_at = now(),
    updated_at = now()
  returning id into v_order_id;

  delete from public.order_items where order_id = v_order_id;
  insert into public.order_items(order_id, product_id, quantity)
  select v_order_id, x.product_id, x.quantity
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb))
    as x(product_id uuid, quantity numeric)
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
  if public.current_app_role() not in ('supplier','admin') then
    raise exception 'Brak uprawnień do raportu.';
  end if;

  select jsonb_build_object(
    'target_date', p_target_date,
    'total_boats', (select count(*) from public.boats where active),
    'submitted_boats', (select count(*) from public.orders where target_date = p_target_date),
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
          'unit', p.unit,
          'total_quantity', sum(oi.quantity),
          'boats', jsonb_agg(b.name || ': ' || trim(to_char(oi.quantity, 'FM999999990.##')) order by b.name)
        ) as row_data
        from public.order_items oi
        join public.orders o on o.id = oi.order_id and o.target_date = p_target_date
        join public.products p on p.id = oi.product_id
        join public.boats b on b.id = o.boat_id
        group by p.id, p.name, p.unit, p.sort_order
      ) q
    ), '[]'::jsonb),
    'boats', coalesce((
      select jsonb_agg(boat_data order by boat_name)
      from (
        select b.name as boat_name, jsonb_build_object(
          'boat_name', b.name,
          'skipper_name', pr.full_name,
          'submitted_at', o.submitted_at,
          'diet_notes', o.diet_notes,
          'special_requests', o.special_requests,
          'breakfast_choices', o.breakfast_choices,
          'items', coalesce((
            select jsonb_agg(jsonb_build_array(p.name, oi.quantity, p.unit) order by p.sort_order)
            from public.order_items oi
            join public.products p on p.id = oi.product_id
            where oi.order_id = o.id
          ), '[]'::jsonb)
        ) as boat_data
        from public.orders o
        join public.boats b on b.id = o.boat_id
        left join public.profiles pr on pr.id = o.submitted_by
        where o.target_date = p_target_date
      ) q
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

grant execute on function public.submit_order(date,text,text,text[],jsonb) to authenticated;
grant execute on function public.get_supplier_report(date) to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_boat_id() to authenticated;

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
