import { useQuery } from '@tanstack/react-query';
import { listEmployees, loadWeek } from '../services/data';
import { useUserId } from './Auth';

export function useEmployees() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['employees', userId],
    queryFn: () => listEmployees(userId),
    enabled: Boolean(userId),
  });
}
export function useWeek(start: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['week', userId, start],
    queryFn: () => loadWeek(userId, start),
    enabled: Boolean(userId),
  });
}
