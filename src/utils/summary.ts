import type { Employee, EmployeeWeek, WorkDay } from '../types/database';

export function summarize(weeks: EmployeeWeek[], days: WorkDay[], employees: Employee[]) {
  const byEmployee = new Map(employees.map((employee) => [employee.id, employee]));
  const counts = new Map<string, number>();
  for (const day of days)
    counts.set(day.employee_week_id, (counts.get(day.employee_week_id) ?? 0) + 1);
  const rows = weeks
    .map((week) => ({
      ...week,
      employee: byEmployee.get(week.employee_id),
      count: counts.get(week.id) ?? 0,
      total: (counts.get(week.id) ?? 0) * week.daily_rate_cents,
    }))
    .sort((a, b) => (a.employee?.name ?? '').localeCompare(b.employee?.name ?? '', 'pt-BR'));
  return {
    rows,
    employees: rows.filter((row) => row.count > 0).length,
    days: rows.reduce((sum, row) => sum + row.count, 0),
    total: rows.reduce((sum, row) => sum + row.total, 0),
  };
}
