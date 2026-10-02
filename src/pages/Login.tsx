import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { CalendarDays, ArrowRight, LockKeyhole } from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../hooks/Auth';
import { useNotify } from '../components/Feedback';
import { Loading } from '../components/Shared';

export function Login({ reset = false }: { reset?: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { session, loading, recovery } = useAuth();
  if (loading) return <Loading />;
  if (session && !reset) return <Navigate to={recovery ? '/nova-senha' : '/'} replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrorMessage('');
    try {
      const { error } = reset
        ? await getSupabase().auth.resetPasswordForEmail(email.trim(), {
            redirectTo: `${window.location.origin}/nova-senha`,
          })
        : await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      if (reset) setSent(true);
    } catch {
      setErrorMessage(
        reset
          ? 'Não foi possível enviar o link. Tente novamente.'
          : 'Não foi possível entrar. Verifique seu email e senha e tente novamente.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame>
      <span className="eyebrow">BEM-VINDO AO SEU DIA A DIA</span>
      <h1>{reset ? 'Vamos recuperar seu acesso.' : 'Sua semana,\nno seu ritmo.'}</h1>
      <p className="muted">
        {reset
          ? 'Informe seu email para receber um link e criar uma nova senha.'
          : 'Organize a escala e acompanhe as diárias em um só lugar.'}
      </p>
      {sent ? (
        <div className="info-box" role="status">
          Se este email estiver cadastrado, você receberá um link para criar uma nova senha. Confira
          também a caixa de spam.
        </div>
      ) : (
        <form onSubmit={submit} className="form-stack">
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seu@email.com"
            />
          </label>
          {!reset && (
            <label>
              Senha
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Digite sua senha"
              />
            </label>
          )}
          {errorMessage && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}
          <button className="button" disabled={busy}>
            {busy ? 'Aguarde…' : reset ? 'Enviar link' : 'Entrar'}
            <ArrowRight size={18} />
          </button>
        </form>
      )}
      <Link className="auth-link" to={reset ? '/login' : '/recuperar-senha'}>
        {reset ? 'Voltar para entrar' : 'Esqueci minha senha'}
      </Link>
      <p className="auth-footnote">
        <LockKeyhole size={15} />
        Seu acesso é pessoal e protegido.
      </p>
    </AuthFrame>
  );
}
export function NewPassword() {
  const { session, loading, finishRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const notify = useNotify();
  const navigate = useNavigate();
  const invalidLink = Boolean(
    new URLSearchParams(window.location.hash.slice(1)).get('error') ||
    new URLSearchParams(window.location.search).get('error'),
  );
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (password !== repeat) {
      setErrorMessage('As senhas precisam ser iguais.');
      return;
    }
    setBusy(true);
    setErrorMessage('');
    try {
      const { error } = await getSupabase().auth.updateUser({ password });
      if (error) throw error;
      finishRecovery();
      notify('Senha atualizada com sucesso.');
      navigate('/', { replace: true });
    } catch {
      setErrorMessage(
        'Não foi possível atualizar sua senha. Tente novamente ou solicite um novo link.',
      );
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <Loading />;
  return (
    <AuthFrame>
      <h1>Crie sua nova senha.</h1>
      {!session || invalidLink ? (
        <>
          <p className="form-error" role="alert">
            Este link é inválido ou expirou.
          </p>
          <Link className="button" to="/recuperar-senha">
            Solicitar novo link
          </Link>
        </>
      ) : (
        <form onSubmit={submit} className="form-stack">
          <p className="muted">Use pelo menos 8 caracteres.</p>
          <label>
            Nova senha
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label>
            Repita a nova senha
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={repeat}
              onChange={(event) => setRepeat(event.target.value)}
            />
          </label>
          {errorMessage && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}
          <button className="button" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar nova senha'}
          </button>
        </form>
      )}
    </AuthFrame>
  );
}
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="brand">
          <span className="brand-icon">
            <CalendarDays size={24} />
          </span>
          <span>
            escala<span className="brand-subtitle">Sua semana organizada</span>
          </span>
        </div>
        {children}
      </div>
      <p className="muted auth-bottom">Menos complicação. Mais organização.</p>
    </main>
  );
}
