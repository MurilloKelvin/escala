import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check, Wallet } from 'lucide-react';
import { useEmployees, useWeek } from '../hooks/data';
import { useSelectedWeek } from '../hooks/selectedWeek';
import { useUserId } from '../hooks/Auth';
import { setPaymentStatus } from '../services/data';
import { summarize } from '../utils/summary';
import { currency } from '../utils/currency';
import { Confirm } from '../components/Modal';
import { PageHeading, WeekSelector, Loading, LoadError } from '../components/Shared';
import { useNotify } from '../components/Feedback';

type Row = ReturnType<typeof summarize>['rows'][number];
export function Payments() {
  const [start, setStart] = useSelectedWeek();
  const employees = useEmployees();
  const week = useWeek(start);
  const [reopening, setReopening] = useState<Row>();
  const userId = useUserId();
  const client = useQueryClient();
  const notify = useNotify();
  const mutation = useMutation({
    mutationFn: ({ row, status }: { row: Row; status: 'paid' | 'pending' }) =>
      setPaymentStatus(userId, row.id, status),
    onSuccess: async (_, { status }) => {
      await client.invalidateQueries({ queryKey: ['week', userId, start] });
      notify(
        status === 'paid'
          ? 'Pagamento marcado como pago.'
          : 'Pagamento voltou para pendente. A escala pode ser alterada.',
      );
      setReopening(undefined);
    },
    onError: () => notify('Não foi possível salvar. Tente novamente.', 'error'),
  });
  const summary = summarize(week.data?.weeks ?? [], week.data?.days ?? [], employees.data ?? []);
  const rows = summary.rows.filter((row) => row.count > 0);
  const paid = rows.filter((row) => row.status === 'paid').reduce((sum, row) => sum + row.total, 0);
  return (
    <>
      <PageHeading
        title="Pagamentos"
        description="Acompanhe as diárias e marque os pagamentos realizados."
      />
      <WeekSelector value={start} onChange={setStart} disabled={mutation.isPending} />
      {employees.isPending || week.isPending ? (
        <Loading />
      ) : employees.isError || week.isError ? (
        <LoadError
          retry={() => {
            void employees.refetch();
            void week.refetch();
          }}
        />
      ) : rows.length ? (
        <>
          <div className="payment-totals">
            <div>
              <span>Pendente</span>
              <strong>{currency(summary.total - paid)}</strong>
            </div>
            <div>
              <span>Pago</span>
              <strong>{currency(paid)}</strong>
            </div>
            <div>
              <span>Total da semana</span>
              <strong>{currency(summary.total)}</strong>
            </div>
          </div>
          <div className="payment-list">
            {rows.map((row) => (
              <article className="payment-card" key={row.id}>
                <div>
                  <h2>{row.employee?.name}</h2>
                  <p className="muted">
                    {row.count} {row.count === 1 ? 'diária' : 'diárias'} ×{' '}
                    {currency(row.daily_rate_cents)}
                  </p>
                </div>
                <div className="payment-amount">
                  <span>Total</span>
                  <strong>{currency(row.total)}</strong>
                </div>
                <div className="payment-state">
                  <span className={`badge ${row.status === 'paid' ? 'paid' : 'pending'}`}>
                    {row.status === 'paid' && <Check size={14} />}
                    {row.status === 'paid' ? 'Pago' : 'Pendente'}
                  </span>
                  {row.paid_at && (
                    <small>Pago em {new Date(row.paid_at).toLocaleDateString('pt-BR')}</small>
                  )}
                </div>
                <button
                  className={`button ${row.status === 'paid' ? 'secondary' : ''}`}
                  disabled={mutation.isPending}
                  onClick={() =>
                    row.status === 'paid'
                      ? setReopening(row)
                      : mutation.mutate({ row, status: 'paid' })
                  }
                >
                  {row.status === 'paid' ? 'Voltar para pendente' : 'Marcar como pago'}
                </button>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="empty">
          <Wallet size={36} />
          <h2>Nenhuma diária para pagar nesta semana.</h2>
          <p className="muted">Marque os dias na escala e os valores aparecerão aqui.</p>
          <Link className="button secondary" to={`/escala?semana=${start}`}>
            Ver escala
          </Link>
        </div>
      )}
      {reopening && (
        <Confirm
          title={`Reabrir pagamento de ${reopening.employee?.name}?`}
          description="O pagamento voltará para Pendente. Depois disso, você poderá alterar os dias desta semana e marcar como pago novamente."
          action="Voltar para pendente"
          busy={mutation.isPending}
          onClose={() => setReopening(undefined)}
          onConfirm={() => mutation.mutate({ row: reopening, status: 'pending' })}
        />
      )}
    </>
  );
}
