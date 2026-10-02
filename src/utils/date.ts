export const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

// Datas de trabalho são datas civis. Não usamos toISOString, que pode mudar
// o dia quando o horário local é convertido para UTC.
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}
export function addDays(value: string, days: number): string {
  const date = parseDate(value);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}
// Segunda-feira é a referência única para consultas, histórico e pagamentos.
export function weekStart(date = new Date()): string {
  const monday = new Date(date);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return dateKey(monday);
}
export function weekDays(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
export function shortDate(value: string): string {
  return parseDate(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
export function fullDate(value: string): string {
  return parseDate(value).toLocaleDateString('pt-BR');
}
export function weekLabel(start: string): string {
  return `${fullDate(start)} – ${fullDate(addDays(start, 6))}`;
}
