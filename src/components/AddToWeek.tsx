import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Employee } from '../types/database';
import { useUserId } from '../hooks/Auth';
import { addEmployeeWeek } from '../services/data';
import { currency } from '../utils/currency';
import { Modal } from './Modal';
import { useNotify } from './Feedback';

export function AddToWeek({
  employees,
  start,
  onClose,
}: {
  employees: Employee[];
  start: string;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const userId = useUserId();
  const client = useQueryClient();
  const notify = useNotify();
  const add = useMutation({
    mutationFn: (id: string) => addEmployeeWeek(userId, id, start),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['week', userId, start] });
      notify('Funcionário adicionado à escala.');
      onClose();
    },
    onError: () => setError('Não foi possível adicionar. Atualize a escala e tente novamente.'),
  });
  const filtered = employees.filter((employee) =>
    employee.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')),
  );
  return (
    <Modal title="Adicionar à escala" onClose={onClose} busy={add.isPending}>
      <p className="muted">Escolha um funcionário. Depois, marque os dias.</p>
      {employees.length ? (
        <>
          <input
            className="picker-search"
            aria-label="Buscar funcionário para adicionar"
            placeholder="Buscar pelo nome"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={add.isPending}
          />
          <div className="employee-picker">
            {filtered.map((employee) => (
              <button
                className="picker-row"
                key={employee.id}
                disabled={add.isPending}
                onClick={() => add.mutate(employee.id)}
              >
                <span>
                  <strong>{employee.name}</strong>
                  <small>{currency(employee.daily_rate_cents)} / diária</small>
                </span>
                <Plus size={20} />
              </button>
            ))}
            {!filtered.length && <p className="muted">Nenhum funcionário encontrado.</p>}
          </div>
        </>
      ) : (
        <div className="empty compact">
          <p>
            Todos os funcionários ativos já foram adicionados, ou ainda não há funcionários
            cadastrados.
          </p>
          <Link className="button secondary" to="/funcionarios?novo=1">
            Cadastrar funcionário
          </Link>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
