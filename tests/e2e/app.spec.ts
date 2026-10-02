import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { weekStart, addDays } from '../../src/utils/date';

const userId = '11111111-1111-4111-8111-111111111111';
const start = weekStart();
async function mockSupabase(page: Page, authenticated = true) {
  const user = {
    id: userId,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'teste@example.com',
    email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const accessToken = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated', aud: 'authenticated' })).toString('base64url')}.test-signature`;
  const session = {
    access_token: accessToken,
    refresh_token: 'test-refresh',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: 'bearer',
    user,
  };
  if (authenticated)
    await page.addInitScript(
      (value) => localStorage.setItem('sb-escala-test-auth-token', JSON.stringify(value)),
      session,
    );
  const employees: Record<string, unknown>[] = [
    {
      id: 'employee-1',
      user_id: userId,
      name: 'João Silva',
      daily_rate_cents: 15000,
      phone: null,
      notes: null,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
  const weeks: Record<string, unknown>[] = [];
  const days: Record<string, unknown>[] = [];
  let failNextDay = false;
  await page.route('https://escala-test.supabase.co/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    function matches(row: Record<string, unknown>) {
      for (const [key, filter] of url.searchParams) {
        if (filter.startsWith('eq.') && String(row[key]) !== filter.slice(3)) return false;
        if (filter.startsWith('gte.') && String(row[key]) < filter.slice(4)) return false;
        if (filter.startsWith('lt.') && String(row[key]) >= filter.slice(3)) return false;
      }
      return true;
    }
    if (method === 'OPTIONS') {
      await route.fulfill({
        status: 200,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': '*',
        },
      });
      return;
    }
    if (url.pathname.startsWith('/auth/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(url.pathname.endsWith('/user') ? user : session),
      });
      return;
    }
    const table = url.pathname.split('/').pop();
    const records = table === 'employees' ? employees : table === 'employee_weeks' ? weeks : days;
    if (table === 'work_days' && method === 'POST' && failNextDay) {
      failNextDay = false;
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal failure', code: 'XX000' }),
      });
      return;
    }
    if (method === 'POST') {
      const input = request.postDataJSON();
      records.push({
        ...input,
        id: `${table}-${records.length + 1}`,
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...(table === 'employee_weeks'
          ? {
              status: 'pending',
              paid_at: null,
              daily_rate_cents: employees.find((employee) => employee.id === input.employee_id)
                ?.daily_rate_cents,
            }
          : {}),
      });
    }
    if (method === 'PATCH')
      for (const row of records.filter(matches)) {
        Object.assign(row, request.postDataJSON());
        if (table === 'employee_weeks')
          row.paid_at = row.status === 'paid' ? new Date().toISOString() : null;
      }
    if (method === 'DELETE')
      for (let i = records.length - 1; i >= 0; i--) if (matches(records[i])) records.splice(i, 1);
    await route.fulfill({
      status: method === 'GET' ? 200 : 201,
      contentType: 'application/json',
      body: JSON.stringify(method === 'GET' ? records.filter(matches) : []),
    });
  });
  return {
    failDay: () => {
      failNextDay = true;
    },
    employees,
    weeks,
    days,
  };
}

test('login, proteção de rotas, recuperação e link expirado', async ({ page }) => {
  await mockSupabase(page, false);
  await page.goto('/escala');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('link', { name: 'Esqueci minha senha' }).click();
  await page.getByLabel('Email', { exact: true }).fill('teste@example.com');
  await page.getByRole('button', { name: 'Enviar link' }).click();
  await expect(page.getByRole('status')).toContainText('Se este email estiver cadastrado');
  await page.goto('/nova-senha#error=access_denied&error_code=otp_expired');
  await expect(page.getByRole('alert')).toContainText('inválido ou expirou');
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('teste@example.com');
  await page.getByLabel('Senha', { exact: true }).fill('minhasenha123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Uma boa semana começa aqui.' })).toBeVisible();
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('escala, cálculo, falha com reversão, pagamento protegido e reabertura', async ({ page }) => {
  const mock = await mockSupabase(page);
  await page.goto('/escala');
  await page.getByRole('button', { name: 'Adicionar funcionário', exact: true }).first().click();
  await page.getByRole('button', { name: /João Silva.*diária/ }).click();
  const day = (index: number) =>
    page.getByRole('button', {
      name: new RegExp(`João Silva, ${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'][index]}`),
    });
  for (const index of [0, 1, 3, 4]) {
    await day(index).click();
    await expect(day(index)).toHaveAttribute('aria-pressed', 'true');
    await expect(day(index)).toBeEnabled();
  }
  await expect(page.locator('.summary-final')).toContainText('600,00');
  expect(mock.days.length).toBe(4);
  mock.failDay();
  await day(2).click();
  await expect(page.getByRole('alert')).toContainText('marcação foi desfeita');
  await expect(day(2)).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('link', { name: 'Pagamentos', exact: true }).click();
  await page.getByRole('button', { name: 'Marcar como pago' }).click();
  await expect(page.locator('.badge')).toHaveText('Pago');
  await page.getByRole('link', { name: 'Escala', exact: true }).click();
  await expect(day(0)).toBeDisabled();
  await page.getByRole('link', { name: 'Pagamentos', exact: true }).first().click();
  await page.getByRole('button', { name: 'Voltar para pendente' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Voltar para pendente' }).click();
  await expect(page.locator('.badge')).toHaveText('Pendente');
  await page.getByRole('link', { name: 'Escala', exact: true }).click();
  await expect(day(0)).toBeEnabled();
  await day(0).click();
  await expect(day(0)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.summary-final')).toContainText('450,00');
  await page.screenshot({ path: 'test-results/escala-desktop.png', fullPage: true });
});

test('cadastro, edição, desativação e navegação móvel sem rolagem horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const mock = await mockSupabase(page);
  await page.goto('/funcionarios?novo=1');
  await page.getByLabel('Nome', { exact: true }).fill('Maria Souza');
  await page.getByLabel('Valor da diária (R$)').fill('180,50');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Maria Souza' })).toBeVisible();
  const card = page.locator('.employee-card').filter({ hasText: 'Maria Souza' });
  await card.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByLabel('Valor da diária (R$)').fill('190,00');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(card).toContainText('190,00');
  await card.getByRole('button', { name: 'Desativar', exact: true }).click();
  await page.getByRole('button', { name: 'Desativar funcionário', exact: true }).click();
  await expect(card).toHaveCount(0);
  await page.getByRole('button', { name: 'Ver inativos' }).click();
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Reativar' }).click();
  await page.getByRole('button', { name: 'Ver ativos' }).click();
  await expect(card).toBeVisible();
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page.getByRole('link', { name: 'Escala', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar funcionário', exact: true }).first().click();
  await page.getByRole('button', { name: /João Silva.*diária/ }).click();
  const monday = page.getByRole('button', { name: /João Silva, Seg/ });
  await monday.click();
  await expect(monday).toBeEnabled();
  expect(mock.days).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/escala-mobile.png', fullPage: true });
});

test('histórico é de leitura e permite abrir a semana para edição', async ({ page }) => {
  const mock = await mockSupabase(page);
  const previous = addDays(start, -7);
  mock.weeks.push({
    id: 'previous-week',
    user_id: userId,
    employee_id: 'employee-1',
    week_start: previous,
    daily_rate_cents: 15000,
    status: 'pending',
    paid_at: null,
    created_at: new Date().toISOString(),
  });
  mock.days.push({
    id: 'previous-day',
    user_id: userId,
    employee_week_id: 'previous-week',
    work_date: previous,
    created_at: new Date().toISOString(),
  });
  await page.goto('/historico');
  await expect(page.getByRole('button', { name: /João Silva, Seg/ })).toBeDisabled();
  await expect(page.locator('.summary-final')).toContainText('150,00');
  await page.getByRole('link', { name: 'Editar escala' }).click();
  await expect(page).toHaveURL(new RegExp(`/escala\\?semana=${previous}`));
  await expect(page.getByRole('button', { name: /João Silva, Seg/ })).toBeEnabled();
});

test('nova senha valida confirmação, salva e volta ao Dashboard', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('/nova-senha');
  await page.getByLabel('Nova senha', { exact: true }).fill('nova-senha-123');
  await page.getByLabel('Repita a nova senha').fill('outra-senha-123');
  await page.getByRole('button', { name: 'Salvar nova senha' }).click();
  await expect(page.getByRole('alert')).toContainText('As senhas precisam ser iguais');
  await page.getByLabel('Repita a nova senha').fill('nova-senha-123');
  await page.getByRole('button', { name: 'Salvar nova senha' }).click();
  await expect(page.getByRole('heading', { name: 'Uma boa semana começa aqui.' })).toBeVisible();
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
});
