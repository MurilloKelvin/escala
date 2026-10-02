import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  loading: boolean;
  recovery: boolean;
  finishRecovery: () => void;
}
const Context = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);
  const client = useQueryClient();
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    // A assinatura também recebe INITIAL_SESSION. Usar uma única fonte evita
    // que uma leitura antiga de getSession sobrescreva um logout recente.
    let previousUser: string | undefined;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, current) => {
      if (previousUser !== current?.user.id) client.clear();
      previousUser = current?.user.id;
      setSession(current);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') setRecovery(false);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [client]);
  return (
    <Context.Provider
      value={{ session, loading, recovery, finishRecovery: () => setRecovery(false) }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider ausente');
  return value;
}
export function useUserId() {
  return useAuth().session?.user.id ?? '';
}
