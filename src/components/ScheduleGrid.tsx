import { Check, LockKeyhole, Trash2 } from 'lucide-react';
import { currency } from '../utils/currency';
import { dayNames, shortDate, weekDays, fullDate } from '../utils/date';
import type { summarize } from '../utils/summary';
import type { WorkDay } from '../types/database';

type Row = ReturnType<typeof summarize>['rows'][number];
export function ScheduleGrid({
  start,
  rows,
  days,
  readOnly,
  busy,
  onToggle,
  onRemove,
}: {
  start: string;
  rows: Row[];
  days: WorkDay[];
  readOnly: boolean;
  busy: boolean;
  onToggle?: (row: Row, date: string, marked: boolean) => void;
  onRemove?: (row: Row) => void;
}) {
  const dates = weekDays(start);
  const marked = new Set(days.map((day) => `${day.employee_week_id}:${day.work_date}`));
  function dayButton(row: Row, date: string, index: number) {
    const checked = marked.has(`${row.id}:${date}`);
    return (
      <button
        key={date}
        className={`day-button ${checked ? 'marked' : ''}`}
        aria-label={`${row.employee?.name}, ${dayNames[index]} ${fullDate(date)}`}
        aria-pressed={checked}
        disabled={busy || readOnly || row.status === 'paid'}
        onClick={() => onToggle?.(row, date, !checked)}
      >
        <span className="mobile-day">
          {dayNames[index]}
          <small>{shortDate(date)}</small>
        </span>
        <span className="day-symbol">{checked ? <Check size={20} strokeWidth={3} /> : '–'}</span>
      </button>
    );
  }
  return (
    <div className="schedule-grid">
      <div className="schedule-grid-header">
        <span>Funcionário</span>
        {dates.map((date, index) => (
          <span key={date}>
            {dayNames[index]}
            <small>{shortDate(date)}</small>
          </span>
        ))}
        <span>Total</span>
        <span />
      </div>
      {rows.map((row) => (
        <div className="schedule-grid-row" key={row.id}>
          <div className="schedule-person">
            <strong>{row.employee?.name ?? 'Funcionário'}</strong>
            <span>
              {currency(row.daily_rate_cents)} / diária
              {row.employee?.active === false && ' · Inativo'}
            </span>
            {row.status === 'paid' && (
              <span className="paid-label">
                <LockKeyhole size={12} />
                Pago · escala protegida
              </span>
            )}
          </div>
          <div className="day-buttons">
            {dates.map((date, index) => dayButton(row, date, index))}
          </div>
          <div className="schedule-total">
            <strong>{currency(row.total)}</strong>
            <span>
              {row.count} {row.count === 1 ? 'diária' : 'diárias'}
            </span>
          </div>
          {!readOnly && (
            <button
              className="icon-button remove-week"
              aria-label={`Remover ${row.employee?.name} da escala`}
              disabled={busy || row.status === 'paid'}
              onClick={() => onRemove?.(row)}
            >
              <Trash2 size={17} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
