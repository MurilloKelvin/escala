import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Plus, ArrowRight } from 'lucide-react';
import { useEmployees, useWeek } from '../hooks/data';
import { useUserId } from '../hooks/Auth';
import { useSelectedWeek } from '../hooks/selectedWeek';
import { setWorkDay, removeEmployeeWeek } from '../services/data';
import { summarize } from '../utils/summary';
import { currency } from '../utils/currency';
import { ScheduleGrid } from '../components/ScheduleGrid';
import { AddToWeek } from '../components/AddToWeek';
import { Confirm } from '../components/Modal';
import { useNotify } from '../components/Feedback';
import { PageHeading, WeekSelector, Loading, LoadError } from '../components/Shared';

type Row = ReturnType<typeof summarize>['rows'][number];
export function Schedule({ history = false }: { history?: boolean }) {
  const [start, setStart] = useSelectedWeek(history);
  const employees = useEmployees();
  const week = useWeek(start);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Row>();
  const userId = useUserId();
  const client = useQueryClient();
  const notify = useNotify();
  const queryKey = ['week', userId, start];
  const toggle = useMutation({
    mutationFn: ({ row, date, marked }: { row: Row; date: string; marked: boolean }) =>
      setWorkDay(userId, row.id, date, marked),
    onMutate: async ({ row, date, marked }) => {
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData<NonNullable<typeof week.data>>(queryKey);
      // Atualizamos a marcação imediatamente, mas preservamos o estado anterior
      // para desfazer a mudança se o banco recusar a gravação.
      if (previous)
        client.setQueryData(queryKey, {
          ...previous,
          days: marked
            ? [
                ...previous.days,
                {
                  id: `optimistic-${row.id}-${date}`,
                  user_id: userId,
                  employee_week_id: row.id,
                  work_date: date,
                  created_at: new Date().toISOString(),
                },
              ]
            : previous.days.filter(
                (day) => !(day.employee_week_id === row.id && day.work_date === date),
              ),
        });
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) client.setQueryData(queryKey, context.previous);
      notify('Não foi possível salvar. A marcação foi desfeita. Tente novamente.', 'error');
    },
    onSuccess: () => notify('Escala atualizada.'),
    onSettled: () => client.invalidateQueries({ queryKey }),
  });
  const remove = useMutation({
    mutationFn: (row: Row) => removeEmployeeWeek(userId, row.id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey });
      setRemoving(undefined);
      notify('Funcionário removido da escala.');
    },
    onError: () => notify('Não foi possível remover. Tente novamente.', 'error'),
  });
  const busy = toggle.isPending || remove.isPending;
  const summary = summarize(week.data?.weeks ?? [], week.data?.days ?? [], employees.data ?? []);
  const available =
    employees.data?.filter(
      (employee) => employee.active && !summary.rows.some((row) => row.employee_id === employee.id),
    ) ?? [];
  return (
    <>
      <PageHeading
        title={history ? 'Histórico' : 'Escala'}
        description={
          history
            ? 'Consulte as escalas e os valores das semanas anteriores.'
            : 'Escolha a semana e marque os dias de cada funcionário.'
        }
      >
        {!history && (
          <button
            className="button"
            disabled={busy || !employees.data || !week.data || week.isError}
            onClick={() => setAdding(true)}
          >
            <Plus size={18} />
            Adicionar funcionário
          </button>
        )}
      </PageHeading>
      <WeekSelector value={start} onChange={setStart} pastOnly={history} disabled={busy} />
      {employees.isPending || week.isPending ? (
        <Loading />
      ) : employees.isError || week.isError ? (
        <LoadError
          retry={() => {
            void employees.refetch();
            void week.refetch();
          }}
        />
      ) : (
        <>
          {summary.rows.length ? (
            <>
              <div className="section-heading schedule-instruction">
                <p className="muted">
                  {history
                    ? 'Escala registrada nesta semana.'
                    : 'Clique em um dia para marcar ou desmarcar.'}
                </p>
                <span className="legend">
                  <span className="legend-check">✓</span>Dia marcado
                </span>
              </div>
              <ScheduleGrid
                start={start}
                rows={summary.rows}
                days={week.data?.days ?? []}
                readOnly={history}
                busy={busy}
                onToggle={(row, date, marked) => {
                  if (!busy) toggle.mutate({ row, date, marked });
                }}
                onRemove={setRemoving}
              />
              {summary.rows.some((row) => row.status === 'paid') && !history && (
                <p className="field-hint">
                  Para alterar uma escala paga, volte o pagamento para Pendente na página{' '}
                  <Link to={`/pagamentos?semana=${start}`}>Pagamentos</Link>.
                </p>
              )}
              <section className="weekly-summary">
                <div className="section-heading">
                  <h2>Resumo da semana</h2>
                  {history && (
                    <Link className="text-button" to={`/escala?semana=${start}`}>
                      Editar escala
                      <ArrowRight size={16} />
                    </Link>
                  )}
                </div>
                <div className="summary-list">
                  {summary.rows.map((row) => (
                    <div className="summary-row" key={row.id}>
                      <div>
                        <strong>{row.employee?.name}</strong>
                        <span>
                          {row.count} {row.count === 1 ? 'diária' : 'diárias'}
                        </span>
                      </div>
                      <strong>{currency(row.total)}</strong>
                    </div>
                  ))}
                </div>
                <div className="summary-final">
                  <span>
                    Total de diárias: <strong>{summary.days}</strong>
                  </span>
                  <div>
                    <span>Total da semana</span>
                    <strong>{currency(summary.total)}</strong>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <div className="empty">
              <CalendarDays size={36} />
              <h2>{history ? 'Nenhuma escala nesta semana.' : 'Vamos organizar esta semana?'}</h2>
              <p className="muted">
                {history
                  ? 'Escolha outra semana para consultar.'
                  : 'Adicione um funcionário e marque os dias de trabalho.'}
              </p>
              {!history && (
                <button className="button" onClick={() => setAdding(true)}>
                  <Plus size={18} />
                  Adicionar funcionário
                </button>
              )}
            </div>
          )}
        </>
      )}
      {adding && <AddToWeek employees={available} start={start} onClose={() => setAdding(false)} />}
      {removing && (
        <Confirm
          title={`Remover ${removing.employee?.name} da escala?`}
          description="Os dias marcados para este funcionário nesta semana serão removidos. O cadastro e as outras semanas serão mantidos."
          action="Remover da escala"
          busy={remove.isPending}
          onClose={() => setRemoving(undefined)}
          onConfirm={() => remove.mutate(removing)}
        />
      )}
    </>
  );
}
