/**
 * Logiclean Ruta — Cliente Supabase
 *
 * Usa únicamente la anon key (clave pública).
 * La service_role key NUNCA en el cliente ni en el repo.
 *
 * Las credenciales vienen de variables de entorno inyectadas
 * por Vite en build time (VITE_* son públicas por diseño).
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] Variables de entorno no configuradas. ' +
    'Copia .env.example → .env.local y completa los valores.'
  );
}

export const supabase = createClient(
  supabaseUrl ?? 'http://localhost:54321',
  supabaseAnonKey ?? 'anon-key-placeholder',
  {
    auth: {
      // Persistir sesión en localStorage (compatible con PWA)
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export type SupabaseClient = typeof supabase;
