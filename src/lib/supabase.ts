import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(
  url?.startsWith('https://') && key && !url.includes('SEU-PROJETO') && !key.includes('SUA-CHAVE'),
);
// A chave pública identifica o projeto. A autorização dos dados é feita
// pela sessão do usuário e pelas políticas RLS, nunca por esta chave.
export const supabase = configured ? createClient<Database>(url, key) : null;
export function getSupabase() {
  if (!supabase) throw new Error('Supabase não configurado');
  return supabase;
}
