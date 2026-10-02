import { getSupabase } from '../lib/supabase';
import type { EmployeeInput } from '../types/database';
import { addDays } from '../utils/date';

export async function listEmployees(userId: string) {
  const { data, error } = await getSupabase()
    .from('employees')
    .select('*')
    .eq('user_id', userId)
    .order('name');
  if (error) throw error;
  return data;
}
export async function saveEmployee(userId: string, input: EmployeeInput, id?: string) {
  const table = getSupabase().from('employees');
  const { error } = id
    ? await table.update(input).eq('id', id).eq('user_id', userId)
    : await table.insert({ ...input, user_id: userId });
  if (error) throw error;
}
export async function setEmployeeActive(userId: string, id: string, active: boolean) {
  const { error } = await getSupabase()
    .from('employees')
    .update({ active })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}
export async function loadWeek(userId: string, start: string) {
  // O filtro reduz os dados transferidos. A RLS continua sendo a proteção
  // efetiva mesmo se alguém alterar esta consulta no navegador.
  const [weeks, days] = await Promise.all([
    getSupabase().from('employee_weeks').select('*').eq('user_id', userId).eq('week_start', start),
    getSupabase()
      .from('work_days')
      .select('*')
      .eq('user_id', userId)
      .gte('work_date', start)
      .lt('work_date', addDays(start, 7)),
  ]);
  if (weeks.error) throw weeks.error;
  if (days.error) throw days.error;
  return { weeks: weeks.data, days: days.data };
}
export async function addEmployeeWeek(userId: string, employeeId: string, start: string) {
  const { error } = await getSupabase()
    .from('employee_weeks')
    .insert({ user_id: userId, employee_id: employeeId, week_start: start });
  if (error) throw error;
}
export async function setWorkDay(userId: string, weekId: string, date: string, marked: boolean) {
  const table = getSupabase().from('work_days');
  const { error } = marked
    ? await table.insert({ user_id: userId, employee_week_id: weekId, work_date: date })
    : await table
        .delete()
        .eq('user_id', userId)
        .eq('employee_week_id', weekId)
        .eq('work_date', date);
  if (error) throw error;
}
export async function removeEmployeeWeek(userId: string, id: string) {
  const { error } = await getSupabase()
    .from('employee_weeks')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}
export async function setPaymentStatus(userId: string, id: string, status: 'paid' | 'pending') {
  const { error } = await getSupabase()
    .from('employee_weeks')
    .update({ status })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}
