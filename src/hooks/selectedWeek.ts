import { useSearchParams } from 'react-router-dom';
import { addDays, dateKey, parseDate, weekStart } from '../utils/date';

export function useSelectedWeek(pastOnly = false): [string, (value: string) => void] {
  const [params, setParams] = useSearchParams();
  const current = weekStart();
  const latest = pastOnly ? addDays(current, -7) : current;
  const raw = params.get('semana');
  const valid = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && dateKey(parseDate(raw)) === raw;
  let selected = valid ? weekStart(parseDate(raw)) : latest;
  if (pastOnly && selected > latest) selected = latest;
  return [selected, (value) => setParams({ semana: value })];
}
