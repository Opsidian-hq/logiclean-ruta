/**
 * Logiclean Ruta — ProtectedRoute
 *
 * Guarda de ruta que verifica autenticación y rol.
 *
 * Uso:
 *   <ProtectedRoute>               // solo autenticado
 *   <ProtectedRoute requiredRol="gerente">  // solo gerente
 */

import { type ReactNode } from 'react';
import { Redirect } from 'react-router-dom';
import { IonPage, IonContent, IonSpinner } from '@ionic/react';
import { useAuthContext } from '../context/AuthContext';
import type { UserRole } from '../context/AuthContext';

// ── Tipos ─────────────────────────────────────────────────────

interface ProtectedRouteProps {
  children: ReactNode;
  /** Si se especifica, redirige si el usuario no tiene este rol */
  requiredRol?: UserRole;
}

// ── Componente ────────────────────────────────────────────────

export function ProtectedRoute({ children, requiredRol }: ProtectedRouteProps) {
  const { user, rol, loading } = useAuthContext();

  // Mientras carga la sesión inicial
  if (loading) {
    return (
      <IonPage>
        <IonContent>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
            }}
          >
            <IonSpinner name="crescent" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  // No autenticado → Login
  if (!user) {
    return <Redirect to="/login" />;
  }

  // Rol incorrecto → redirigir según rol actual
  if (requiredRol && rol !== requiredRol) {
    if (rol === 'gerente') {
      return <Redirect to="/admin" />;
    }
    return <Redirect to="/visitas" />;
  }

  return <>{children}</>;
}
