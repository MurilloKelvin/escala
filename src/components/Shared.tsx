import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, weekLabel, weekStart, parseDate } from '../utils/date';
import { currency } from '../utils/currency';

export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {children}
    </header>
  );
}
export function WeekSelector({
  value,
  onChange,
  pastOnly = false,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  pastOnly?: boolean;
  disabled?: boolean;
}) {
  const current = weekStart();
  const latest = pastOnly ? addDays(current, -7) : undefined;
  return (
    <div className="week-selector">
      <button
        className="icon-button"
        disabled={disabled}
        aria-label="Semana anterior"
        onClick={() => onChange(addDays(value, -7))}
      >
        <ChevronLeft />
      </button>
      <div className="week-label">
        <strong>{weekLabel(value)}</strong>
        <label className="week-date">
          Escolher semana
          <input
            aria-label="Escolher semana"
            type="date"
            value={value}
            max={latest}
            disabled={disabled}
            onChange={(event) => {
              if (event.target.value) onChange(weekStart(parseDate(event.target.value)));
            }}
          />
        </label>
      </div>
      <button
        className="icon-button"
        disabled={disabled || Boolean(latest && value >= latest)}
        aria-label="Próxima semana"
        onClick={() => onChange(addDays(value, 7))}
      >
        <ChevronRight />
      </button>
      {!pastOnly && value !== current && (
        <button disabled={disabled} className="text-button" onClick={() => onChange(current)}>
          Semana atual
        </button>
      )}
    </div>
  );
}
export function Loading() {
  return (
    <div className="empty" role="status">
      Carregando…
    </div>
  );
}
export function LoadError({ retry }: { retry: () => void }) {
  return (
    <div className="empty" role="alert">
      <h2>Não foi possível carregar.</h2>
      <p className="muted">Verifique sua conexão e tente novamente.</p>
      <button className="button secondary" onClick={retry}>
        Tentar novamente
      </button>
    </div>
  );
}
export function Stats({
  employees,
  days,
  total,
}: {
  employees: number;
  days: number;
  total: number;
}) {
  return (
    <div className="stats">
      <div className="stat">
        <span>Funcionários escalados</span>
        <strong>{employees}</strong>
        <small>Com dias marcados na semana</small>
      </div>
      <div className="stat">
        <span>Diárias na semana</span>
        <strong>{days}</strong>
        <small>Somando todos os funcionários</small>
      </div>
      <div className="stat total">
        <span>Valor total da semana</span>
        <strong>{currency(total)}</strong>
        <small>Calculado a partir da escala</small>
      </div>
    </div>
  );
}
