import { describe, expect, it } from 'vitest';
import { addDays, dateKey, parseDate, weekDays, weekStart } from '../src/utils/date';
import { currency, parseMoney } from '../src/utils/currency';
import { summarize } from '../src/utils/summary';
import type { Employee, EmployeeWeek, WorkDay } from '../src/types/database';

describe('datas civis e semanas', () => {
  it('usa segunda-feira inclusive ao selecionar domingo', () => {
    expect(weekStart(parseDate('2026-10-04'))).toBe('2026-09-28');
    expect(weekStart(parseDate('2026-09-28'))).toBe('2026-09-28');
  });
  it('atravessa meses, anos e fevereiro bissexto', () => {
    expect(weekDays('2026-09-28')).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
  it('mantém a data local mesmo perto da meia-noite', () => {
    expect(dateKey(new Date(2026, 9, 1, 23, 59))).toBe('2026-10-01');
    expect(dateKey(parseDate('2026-10-01'))).toBe('2026-10-01');
  });
});
describe('diárias', () => {
  it('interpreta moeda brasileira sem perder centavos', () => {
    expect(parseMoney('150,25')).toBe(15025);
    expect(parseMoney('150.2')).toBe(15020);
    expect(parseMoney('150')).toBe(15000);
    expect(currency(60000).replace(/\s/g, ' ')).toBe('R$ 600,00');
  });
  it('recusa valores inválidos, negativos, zerados ou com precisão excessiva', () => {
    for (const value of ['0', '-2', 'abc', '1,234', '', '1000001', '1e3'])
      expect(parseMoney(value)).toBeNull();
  });
  it('calcula com a diária preservada, conta pessoas com dias e ignora dias de outras semanas', () => {
    const employee = { id: 'employee', name: 'João', daily_rate_cents: 20000 } as Employee;
    const week = { id: 'week', employee_id: 'employee', daily_rate_cents: 15000 } as EmployeeWeek;
    const days = Array.from(
      { length: 4 },
      (_, i) => ({ id: String(i), employee_week_id: 'week' }) as WorkDay,
    );
    days.push({ employee_week_id: 'other-week' } as WorkDay);
    const result = summarize([week], days, [employee]);
    expect(result.total).toBe(60000);
    expect(result.days).toBe(4);
    expect(result.employees).toBe(1);
    expect(result.rows[0].employee?.daily_rate_cents).toBe(20000);
    expect(summarize([week], [], [employee])).toMatchObject({ total: 0, days: 0, employees: 0 });
  });
});
