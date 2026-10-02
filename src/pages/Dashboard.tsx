import { Link } from 'react-router-dom';
import { ArrowRight, Plus, CalendarDays } from 'lucide-react';
import { useEmployees, useWeek } from '../hooks/data';
import { weekLabel, weekStart } from '../utils/date';
import { summarize } from '../utils/summary';
import { currency } from '../utils/currency';
import { PageHeading, Stats, Loading, LoadError } from '../components/Shared';

export function Dashboard() {
  const start = weekStart();
  const employees = useEmployees();
  const week = useWeek(start);
  const summary = summarize(week.data?.weeks ?? [], week.data?.days ?? [], employees.data ?? []);
  return (
    <>
      <PageHeading
        title="Uma boa semana começa aqui."
        description="Sua escala e suas diárias, sem complicação."
      />
      <div className="section-heading">
        <div>
          <span className="eyebrow">RESUMO DA SEMANA</span>
          <p className="muted">{weekLabel(start)}</p>
        </div>
        <Link className="text-button" to="/escala">
          Ver escala
          <ArrowRight size={17} />
        </Link>
      </div>
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
          <Stats {...summary} />
          <section className="dashboard-week">
            <div className="section-heading">
              <h2>Quem está na escala</h2>
              <span className="muted">Esta semana</span>
            </div>
            {summary.rows.length ? (
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
            ) : (
              <div className="empty compact">
                <CalendarDays size={34} />
                <h2>A semana está pronta para começar.</h2>
                <p className="muted">Adicione seus funcionários e marque os dias de trabalho.</p>
                <Link className="button" to="/escala">
                  Organizar a escala
                  <ArrowRight size={18} />
                </Link>
              </div>
            )}
          </section>
        </>
      )}
      <div className="dashboard-actions">
        <div>
          <h2>Uma nova pessoa na equipe?</h2>
          <p className="muted">Cadastre o nome e a diária. É rápido.</p>
        </div>
        <Link className="button secondary" to="/funcionarios?novo=1">
          <Plus size={18} />
          Adicionar funcionário
        </Link>
      </div>
    </>
  );
}
