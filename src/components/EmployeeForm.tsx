import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Employee } from '../types/database';
import { saveEmployee } from '../services/data';
import { useUserId } from '../hooks/Auth';
import { moneyInput, parseMoney } from '../utils/currency';
import { useNotify } from './Feedback';
import { Modal } from './Modal';

export function EmployeeForm({ employee, onClose }: { employee?: Employee; onClose: () => void }) {
  const [name, setName] = useState(employee?.name ?? '');
  const [rate, setRate] = useState(employee ? moneyInput(employee.daily_rate_cents) : '');
  const [phone, setPhone] = useState(employee?.phone ?? '');
  const [notes, setNotes] = useState(employee?.notes ?? '');
  const [error, setError] = useState('');
  const userId = useUserId();
  const client = useQueryClient();
  const notify = useNotify();
  const save = useMutation({
    mutationFn: (cents: number) =>
      saveEmployee(
        userId,
        {
          name: name.trim(),
          daily_rate_cents: cents,
          phone: phone.trim() || null,
          notes: notes.trim() || null,
        },
        employee?.id,
      ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['employees', userId] });
      notify(
        employee ? 'Funcionário atualizado com sucesso.' : 'Funcionário cadastrado com sucesso.',
      );
      onClose();
    },
    onError: () => setError('Não foi possível salvar. Tente novamente.'),
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (save.isPending) return;
    const cents = parseMoney(rate);
    if (!name.trim()) {
      setError('Informe o nome do funcionário.');
      return;
    }
    if (cents === null) {
      setError('Informe uma diária maior que zero, com até duas casas decimais (exemplo: 150,00).');
      return;
    }
    setError('');
    save.mutate(cents);
  }
  return (
    <Modal
      title={employee ? 'Editar funcionário' : 'Adicionar funcionário'}
      onClose={onClose}
      busy={save.isPending}
    >
      <form onSubmit={submit} className="form-stack">
        <fieldset disabled={save.isPending}>
          <label>
            Nome
            <input
              autoFocus
              required
              maxLength={120}
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nome do funcionário"
            />
          </label>
          <label>
            Valor da diária (R$)
            <input
              required
              inputMode="decimal"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
              placeholder="150,00"
            />
          </label>
          {employee && (
            <p className="field-hint">
              O novo valor vale ao adicionar o funcionário a outra semana. Escalas existentes mantêm
              o valor anterior.
            </p>
          )}
          <label>
            Telefone <span className="optional">opcional</span>
            <input
              type="tel"
              autoComplete="tel"
              maxLength={40}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="(00) 00000-0000"
            />
          </label>
          <details open={Boolean(employee?.notes)}>
            <summary>
              Adicionar observação <span className="optional">opcional</span>
            </summary>
            <label className="sr-only" htmlFor="employee-notes">
              Observação
            </label>
            <textarea
              id="employee-notes"
              maxLength={1000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </details>
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            disabled={save.isPending}
            className="button secondary"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button className="button" disabled={save.isPending}>
            {save.isPending ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
