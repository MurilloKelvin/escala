import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';

// PostgreSQL real em WASM. Somente auth.users/auth.uid são simulados; a
// migração, os privilégios, as constraints, as políticas e os triggers são reais.
const db = new PGlite();
const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
let employeeId: string;
let weekId: string;
async function asUser(id: string) {
  await db.exec(
    `reset role; set role authenticated; select set_config('request.jwt.claim.sub', '${id}', false);`,
  );
}
async function scalar(sql: string) {
  const result = await db.query<Record<string, unknown>>(sql);
  return Object.values(result.rows[0])[0];
}
beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    insert into auth.users values ('${alice}'), ('${bob}');
  `);
  await db.exec(
    readFileSync(
      new URL('../supabase/migrations/202610010001_initial.sql', import.meta.url),
      'utf8',
    ),
  );
});
afterAll(async () => {
  await db.close();
});

describe.sequential('segurança e regras no banco', () => {
  it('cria funcionário e semana sem depender de um dia marcado', async () => {
    await asUser(alice);
    employeeId = String(
      await scalar(
        `insert into public.employees (user_id, name, daily_rate_cents) values ('${alice}', 'João', 15000) returning id`,
      ),
    );
    weekId = String(
      await scalar(
        `insert into public.employee_weeks(user_id, employee_id, week_start) values ('${alice}', '${employeeId}', '2026-09-28') returning id`,
      ),
    );
    expect(
      await scalar(`select daily_rate_cents from public.employee_weeks where id='${weekId}'`),
    ).toBe(15000);
    expect(await scalar('select count(*) from public.work_days')).toBe(0);
  });
  it('mantém valores históricos e impede duplicatas e datas fora da semana', async () => {
    await db.exec(`update public.employees set daily_rate_cents=20000 where id='${employeeId}'`);
    expect(
      await scalar(`select daily_rate_cents from public.employee_weeks where id='${weekId}'`),
    ).toBe(15000);
    expect(
      await scalar(
        `insert into public.employee_weeks(user_id, employee_id, week_start, daily_rate_cents) values ('${alice}', '${employeeId}', '2026-10-05', 1) returning daily_rate_cents`,
      ),
    ).toBe(20000);
    await expect(
      db.exec(
        `insert into public.employee_weeks(user_id,employee_id,week_start) values ('${alice}','${employeeId}','2026-09-28')`,
      ),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `insert into public.employee_weeks(user_id,employee_id,week_start) values ('${alice}','${employeeId}','2026-09-29')`,
      ),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `insert into public.work_days(user_id,employee_week_id,work_date) values ('${alice}','${weekId}','2026-10-05')`,
      ),
    ).rejects.toThrow();
    await db.exec(
      `insert into public.work_days(user_id,employee_week_id,work_date) values ('${alice}','${weekId}','2026-09-28')`,
    );
    await expect(
      db.exec(
        `insert into public.work_days(user_id,employee_week_id,work_date) values ('${alice}','${weekId}','2026-09-28')`,
      ),
    ).rejects.toThrow();
  });
  it('bloqueia alteração ou remoção paga e libera após reabrir', async () => {
    await db.exec(`update public.employee_weeks set status='paid' where id='${weekId}'`);
    expect(
      await scalar(`select paid_at is not null from public.employee_weeks where id='${weekId}'`),
    ).toBe(true);
    await expect(
      db.exec(`delete from public.work_days where employee_week_id='${weekId}'`),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `insert into public.work_days(user_id,employee_week_id,work_date) values ('${alice}','${weekId}','2026-09-29')`,
      ),
    ).rejects.toThrow();
    await expect(
      db.exec(`delete from public.employee_weeks where id='${weekId}'`),
    ).rejects.toThrow();
    await expect(
      db.exec(`update public.employee_weeks set daily_rate_cents=1 where id='${weekId}'`),
    ).rejects.toThrow();
    await db.exec(
      `update public.employee_weeks set status='pending' where id='${weekId}'; delete from public.work_days where employee_week_id='${weekId}'`,
    );
    expect(
      await scalar(`select paid_at from public.employee_weeks where id='${weekId}'`),
    ).toBeNull();
    await expect(
      db.exec(`update public.employee_weeks set status='paid' where id='${weekId}'`),
    ).rejects.toThrow();
  });
  it('isola duas contas inclusive nas referências e alterações diretas', async () => {
    await db.exec(
      `insert into public.work_days(user_id,employee_week_id,work_date) values ('${alice}','${weekId}','2026-09-30')`,
    );
    await asUser(bob);
    expect(await scalar('select count(*) from public.employees')).toBe(0);
    expect(await scalar('select count(*) from public.employee_weeks')).toBe(0);
    expect(await scalar('select count(*) from public.work_days')).toBe(0);
    await expect(
      db.exec(
        `insert into public.employees(user_id,name,daily_rate_cents) values ('${alice}', 'Intruso', 100)`,
      ),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `insert into public.employee_weeks(user_id,employee_id,week_start) values ('${bob}','${employeeId}','2026-10-12')`,
      ),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `insert into public.work_days(user_id,employee_week_id,work_date) values ('${bob}','${weekId}','2026-09-29')`,
      ),
    ).rejects.toThrow();
    await db.exec(
      `update public.employees set name='Intruso' where id='${employeeId}'; delete from public.employee_weeks where id='${weekId}'`,
    );
    await asUser(alice);
    expect(await scalar(`select name from public.employees where id='${employeeId}'`)).toBe('João');
    expect(await scalar(`select count(*) from public.employee_weeks where id='${weekId}'`)).toBe(1);
    expect(await scalar('select count(*) from public.work_days')).toBe(1);
  });
  it('desativação mantém histórico, recusa novas semanas e remoção pendente apaga apenas seus dias', async () => {
    await db.exec(`update public.employees set active=false where id='${employeeId}'`);
    await expect(
      db.exec(
        `insert into public.employee_weeks(user_id,employee_id,week_start) values ('${alice}','${employeeId}','2026-10-12')`,
      ),
    ).rejects.toThrow();
    await db.exec(
      `insert into public.work_days(user_id,employee_week_id,work_date) values ('${alice}','${weekId}','2026-10-01')`,
    );
    expect(await scalar(`select count(*) from public.work_days`)).toBe(2);
    await db.exec(`delete from public.employee_weeks where id='${weekId}'`);
    expect(await scalar('select count(*) from public.work_days')).toBe(0);
    expect(await scalar('select count(*) from public.employee_weeks')).toBe(1);
    expect(await scalar('select count(*) from public.employees')).toBe(1);
  });
  it('não permite acesso anônimo nem exclusão permanente de funcionários', async () => {
    await expect(db.exec('delete from public.employees')).rejects.toThrow();
    await db.exec('reset role; set role anon');
    for (const table of ['employees', 'employee_weeks', 'work_days'])
      await expect(db.exec(`select * from public.${table}`)).rejects.toThrow();
  });
});
