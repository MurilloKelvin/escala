-- Migração inicial. Aplicar uma vez pelo SQL Editor ou Supabase CLI.
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  name text not null check (length(btrim(name)) between 1 and 120),
  daily_rate_cents integer not null check (daily_rate_cents between 1 and 100000000),
  phone text check (length(phone) <= 40),
  notes text check (length(notes) <= 1000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create table public.employee_weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  employee_id uuid not null,
  week_start date not null check (extract(isodow from week_start) = 1),
  daily_rate_cents integer not null check (daily_rate_cents between 1 and 100000000),
  status text not null default 'pending' check (status in ('pending', 'paid')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, employee_id, week_start),
  unique (user_id, id),
  foreign key (user_id, employee_id) references public.employees(user_id, id),
  check ((status = 'paid') = (paid_at is not null))
);

create table public.work_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  employee_week_id uuid not null,
  work_date date not null,
  created_at timestamptz not null default now(),
  unique (employee_week_id, work_date),
  foreign key (user_id, employee_week_id) references public.employee_weeks(user_id, id) on delete cascade
);
create index employee_weeks_user_week on public.employee_weeks(user_id, week_start);
create index work_days_user_date on public.work_days(user_id, work_date);

alter table public.employees enable row level security;
alter table public.employee_weeks enable row level security;
alter table public.work_days enable row level security;

-- USING protege linhas existentes; WITH CHECK protege inserções e alterações.
create policy own_employees on public.employees for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_weeks on public.employee_weeks for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_days on public.work_days for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Restringimos colunas de alteração: identidade, proprietário e valores
-- históricos não podem ser reescritos pelo cliente.
revoke all on public.employees, public.employee_weeks, public.work_days from anon, authenticated;
grant select, insert on public.employees to authenticated;
grant update (name, daily_rate_cents, phone, notes, active) on public.employees to authenticated;
grant select, insert, delete on public.employee_weeks to authenticated;
grant update (status) on public.employee_weeks to authenticated;
grant select, insert, delete on public.work_days to authenticated;

create function public.touch_employee() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger touch_employee before update on public.employees for each row execute function public.touch_employee();

create function public.guard_employee_week() returns trigger language plpgsql security invoker set search_path = '' as $$
declare employee public.employees; day_count integer;
begin
  if TG_OP = 'INSERT' then
    -- O banco copia a diária; não confiamos em um valor enviado pelo navegador.
    select * into employee from public.employees
      where id = new.employee_id and user_id = new.user_id for share;
    if not found or not employee.active then
      raise exception 'Employee unavailable' using errcode = '23514';
    end if;
    new.daily_rate_cents := employee.daily_rate_cents;
    new.status := 'pending';
    new.paid_at := null;
    return new;
  end if;
  if TG_OP = 'DELETE' then
    if old.status = 'paid' then
      raise exception 'Reopen payment before removing schedule' using errcode = '23514';
    end if;
    return old;
  end if;
  if (new.id, new.user_id, new.employee_id, new.week_start, new.daily_rate_cents, new.created_at)
      is distinct from (old.id, old.user_id, old.employee_id, old.week_start, old.daily_rate_cents, old.created_at) then
    raise exception 'Historical fields are immutable' using errcode = '23514';
  end if;
  if new.status = 'paid' then
    select count(*) into day_count from public.work_days where employee_week_id = old.id;
    if day_count = 0 then raise exception 'Cannot pay an empty week' using errcode = '23514'; end if;
    new.paid_at := case when old.status = 'paid' then old.paid_at else now() end;
  else
    new.paid_at := null;
  end if;
  return new;
end;
$$;
create trigger guard_employee_week before insert or update or delete on public.employee_weeks
  for each row execute function public.guard_employee_week();

create function public.guard_work_day() returns trigger language plpgsql security invoker set search_path = '' as $$
declare target public.employee_weeks; target_id uuid; target_user uuid;
begin
  target_id := case when TG_OP = 'DELETE' then old.employee_week_id else new.employee_week_id end;
  target_user := case when TG_OP = 'DELETE' then old.user_id else new.user_id end;
  -- O mesmo bloqueio é usado pela atualização do pagamento. Um pagamento
  -- não pode ser confirmado enquanto seus dias estão sendo modificados.
  select * into target from public.employee_weeks
    where id = target_id and user_id = target_user for update;
  if not found then
    -- Na exclusão em cascata o vínculo já foi removido; o trigger acima
    -- verificou que o pagamento estava pendente antes de permitir a remoção.
    if TG_OP = 'DELETE' then return old; end if;
    raise exception 'Week unavailable' using errcode = '23514';
  end if;
  if target.status = 'paid' then
    raise exception 'Reopen payment before changing work days' using errcode = '23514';
  end if;
  if TG_OP = 'INSERT' and (new.work_date < target.week_start or new.work_date > target.week_start + 6) then
    raise exception 'Date outside week' using errcode = '23514';
  end if;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger guard_work_day before insert or delete on public.work_days for each row execute function public.guard_work_day();

revoke execute on function public.touch_employee(), public.guard_employee_week(), public.guard_work_day() from public;
-- Triggers continuam executando sem expor funções de negócio pela Data API.
