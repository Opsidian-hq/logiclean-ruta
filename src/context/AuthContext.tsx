/**
 * Logiclean Ruta — AuthContext
 *
 * Envuelve la sesión de Supabase Auth y el rol del usuario.
 * El rol vive en auth.users.raw_user_meta_data->>'rol'.
 *
 * Expone:
 *  - user: User | null
 *  - rol: 'vendedor' | 'gerente' | null
 *  - session: Session | null
 *  - loading: boolean
 *  - signIn(email, password): Promise<void>
 *  - signOut(): Promise<void>
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// ── Tipos ─────────────────────────────────────────────────────

export type UserRole = 'vendedor' | 'gerente';

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  rol: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
}

// ── Contexto ──────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Proveedor ─────────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Extrae el rol del metadata del usuario */
  const extractRol = (u: User | null): UserRole | null => {
    if (!u) return null;
    const rol = u.user_metadata?.rol as string | undefined;
    if (rol === 'gerente') return 'gerente';
    if (rol === 'vendedor') return 'vendedor';
    return null;
  };

  const rol = extractRol(user);

  // ── Inicializar sesión al montar ────────────────────────────

  useEffect(() => {
    let mounted = true;

    // Obtener sesión actual
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (mounted) {
        setSession(s);
        setUser(s?.user ?? null);
        setLoading(false);
      }
    });

    // Escuchar cambios de sesión (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        if (mounted) {
          setSession(s);
          setUser(s?.user ?? null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ── Acciones ────────────────────────────────────────────────

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
    }

    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    await supabase.auth.signOut();
  }, []);

  // ── Valor del contexto ──────────────────────────────────────

  const value: AuthContextValue = {
    user,
    session,
    rol,
    loading,
    signIn,
    signOut,
    error,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook de consumo ───────────────────────────────────────────

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext debe usarse dentro de <AuthProvider>');
  }
  return ctx;
}
