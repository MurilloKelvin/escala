import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, X, CircleAlert } from 'lucide-react';

type Notify = (message: string, kind?: 'success' | 'error') => void;
const Context = createContext<Notify>(() => {});
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);
  useEffect(() => {
    if (!notice || notice.kind === 'error') return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  return (
    <Context.Provider value={(message, kind = 'success') => setNotice({ message, kind })}>
      {children}
      {notice && (
        <div
          className={`notice ${notice.kind}`}
          role={notice.kind === 'error' ? 'alert' : 'status'}
        >
          {notice.kind === 'error' ? <CircleAlert size={20} /> : <CheckCircle2 size={20} />}
          <span>{notice.message}</span>
          <button className="icon-button" aria-label="Fechar aviso" onClick={() => setNotice(null)}>
            <X size={18} />
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export function useNotify() {
  return useContext(Context);
}
