import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, UserRound, Search } from 'lucide-react';
import type { Employee } from '../types/database';
import { useEmployees } from '../hooks/data';
import { useUserId } from '../hooks/Auth';
import { setEmployeeActive } from '../services/data';
import { currency } from '../utils/currency';
import { EmployeeForm } from '../components/EmployeeForm';
import { Confirm } from '../components/Modal';
import { PageHeading, Loading, LoadError } from '../components/Shared';
import { useNotify } from '../components/Feedback';

export function Employees() {
  const employees = useEmployees();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Employee>();
  const [confirming, setConfirming] = useState<Employee>();
  const [inactive, setInactive] = useState(false);
  const [search, setSearch] = useState('');
  const userId = useUserId();
  const client = useQueryClient();
  const notify = useNotify();
  const changeActive = useMutation({
    mutationFn: (employee: Employee) => setEmployeeActive(userId, employee.id, !employee.active),
    onSuccess: async (_, employee) => {
      await client.invalidateQueries({ queryKey: ['employees', userId] });
      notify(
        employee.active
          ? 'Funcionário desativado. O histórico foi mantido.'
          : 'Funcionário reativado.',
      );
      setConfirming(undefined);
    },
    onError: () => notify('Não foi possível salvar. Tente novamente.', 'error'),
  });
  function closeForm() {
    setEditing(undefined);
    setParams({}, { replace: true });
  }
  const rows =
    employees.data?.filter(
      (employee) =>
        employee.active !== inactive &&
        employee.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')),
    ) ?? [];
  return (
    <>
      <PageHeading title="Funcionários" description="As pessoas que fazem parte da sua semana.">
        <button className="button" onClick={() => setParams({ novo: '1' })}>
          <Plus size={18} />
          Adicionar funcionário
        </button>
      </PageHeading>
      <div className="list-toolbar">
        <label className="search">
          <Search size={19} />
          <input
            aria-label="Buscar funcionário"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar pelo nome"
          />
        </label>
        <button className="button secondary" onClick={() => setInactive(!inactive)}>
          {inactive ? 'Ver ativos' : 'Ver inativos'}
        </button>
      </div>
      {employees.isPending ? (
        <Loading />
      ) : employees.isError ? (
        <LoadError retry={() => void employees.refetch()} />
      ) : rows.length === 0 ? (
        <div className="empty">
          <UserRound size={36} />
          <h2>
            {search
              ? 'Nenhum funcionário encontrado.'
              : inactive
                ? 'Nenhum funcionário inativo.'
                : 'Vamos adicionar o primeiro funcionário?'}
          </h2>
          <p className="muted">
            {!inactive && !search
              ? 'Você só precisa do nome e do valor da diária para começar.'
              : 'Os funcionários aparecerão aqui.'}
          </p>
          {!inactive && !search && (
            <button className="button" onClick={() => setParams({ novo: '1' })}>
              <Plus size={18} />
              Adicionar funcionário
            </button>
          )}
        </div>
      ) : (
        <div className="employee-list">
          {rows.map((employee) => (
            <article className="employee-card" key={employee.id}>
              <span className="avatar">{employee.name.charAt(0).toLocaleUpperCase('pt-BR')}</span>
              <div className="employee-info">
                <h2>{employee.name}</h2>
                <p>{employee.phone || 'Sem telefone cadastrado'}</p>
                {employee.notes && <p className="employee-notes">{employee.notes}</p>}
              </div>
              <div className="employee-rate">
                <strong>{currency(employee.daily_rate_cents)}</strong>
                <span>por diária</span>
              </div>
              <div className="employee-actions">
                <button className="button secondary" onClick={() => setEditing(employee)}>
                  <Pencil size={16} />
                  Editar
                </button>
                <button
                  disabled={changeActive.isPending}
                  className="text-button"
                  onClick={() =>
                    employee.active ? setConfirming(employee) : changeActive.mutate(employee)
                  }
                >
                  {employee.active ? 'Desativar' : 'Reativar'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {(params.has('novo') || editing) && (
        <EmployeeForm key={editing?.id ?? 'new'} employee={editing} onClose={closeForm} />
      )}
      {confirming && (
        <Confirm
          title={`Desativar ${confirming.name}?`}
          description="Ele não poderá ser adicionado a novas semanas. As escalas existentes e o histórico serão mantidos."
          action="Desativar funcionário"
          busy={changeActive.isPending}
          onClose={() => setConfirming(undefined)}
          onConfirm={() => changeActive.mutate(confirming)}
        />
      )}
    </>
  );
}
