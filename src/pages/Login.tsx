/**
 * Logiclean Ruta — Login Page
 *
 * Autenticación via Supabase Auth (email + password).
 * Al entrar:
 *  - rol=gerente → /admin
 *  - rol=vendedor → /catalogo
 */

import { useState, useEffect } from 'react';
import {
  IonPage,
  IonContent,
  IonInput,
  IonButton,
  IonSpinner,
  IonItem,
  IonLabel,
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';

// ── Estilos ────────────────────────────────────────────────────

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: 'var(--space-lg)',
    backgroundColor: 'var(--color-bg, #FAFAFA)',
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    backgroundColor: 'var(--color-surface, #FFFFFF)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-xl) var(--space-lg)',
    boxShadow: '0 4px 24px rgba(0, 29, 81, 0.10)',
  },
  brand: {
    fontFamily: 'var(--font-brand, cursive)',
    fontSize: '32px',
    color: 'var(--color-navy, #001D51)',
    textAlign: 'center' as const,
    marginBottom: 'var(--space-sm)',
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--color-text-secondary, #6B7280)',
    textAlign: 'center' as const,
    marginBottom: 'var(--space-xl)',
  },
  errorBox: {
    backgroundColor: 'var(--color-error-soft-bg, #FEF2F2)',
    border: '1px solid var(--color-error, #D92D20)',
    borderRadius: 'var(--radius-md)',
    padding: '12px var(--space-md)',
    marginBottom: 'var(--space-md)',
    color: 'var(--color-error-text, #B42318)',
    fontSize: '14px',
  },
  button: {
    '--background': 'var(--color-primary, #0606FE)',
    '--border-radius': '10px',
    '--padding-top': '14px',
    '--padding-bottom': '14px',
    marginTop: 'var(--space-lg)',
    width: '100%',
    minHeight: 'var(--touch-min, 48px)',
  },
};

// ── Componente ────────────────────────────────────────────────

export function LoginPage() {
  const { signIn, signOut, loading, error, user, rol } = useAuthContext();
  const history = useHistory();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessError, setAccessError] = useState<string | null>(null);

  // Redirigir según rol; si la sesión está autenticada pero SIN rol asignado,
  // se rechaza el acceso y se cierra la sesión (no es un usuario de la app).
  useEffect(() => {
    if (!user) return;
    if (rol === 'gerente') {
      history.replace('/admin');
    } else if (rol === 'vendedor') {
      history.replace('/visitas');
    } else {
      // Sesión válida pero sin rol de app: se persiste el aviso (sobrevive al
      // signOut, que vuelve user=null) y se cierra la sesión. El setState aquí
      // es intencional: reacciona a la carga asíncrona de la sesión.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAccessError(
        'Tu cuenta no tiene un rol asignado. Contacta al administrador.'
      );
      signOut();
    }
  }, [user, rol, history, signOut]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setAccessError(null);
    await signIn(email.trim(), password);
  };

  return (
    <IonPage>
      <IonContent>
        <div style={styles.container}>
          <div style={styles.card}>
            {/* Marca */}
            <div style={styles.brand}>Logiclean Ruta</div>
            <div style={styles.subtitle}>Inicia sesión para continuar</div>

            {/* Error */}
            {(accessError || error) && (
              <div style={styles.errorBox} role="alert">
                {accessError
                  ? accessError
                  : error === 'Invalid login credentials'
                    ? 'Correo o contraseña incorrectos.'
                    : error}
              </div>
            )}

            {/* Formulario */}
            <form onSubmit={handleSubmit} noValidate>
              <IonItem
                style={{
                  '--background': 'transparent',
                  '--border-color': 'var(--color-border)',
                  marginBottom: '12px',
                }}
              >
                <IonLabel position="stacked" style={{ color: 'var(--color-navy)' }}>
                  Correo electrónico
                </IonLabel>
                <IonInput
                  type="email"
                  value={email}
                  onIonInput={(e) => setEmail(e.detail.value ?? '')}
                  placeholder="correo@ejemplo.com"
                  required
                  autocomplete="email"
                  inputmode="email"
                  style={{ minHeight: 'var(--touch-min, 48px)' }}
                />
              </IonItem>

              <IonItem
                style={{
                  '--background': 'transparent',
                  '--border-color': 'var(--color-border)',
                }}
              >
                <IonLabel position="stacked" style={{ color: 'var(--color-navy)' }}>
                  Contraseña
                </IonLabel>
                <IonInput
                  type="password"
                  value={password}
                  onIonInput={(e) => setPassword(e.detail.value ?? '')}
                  placeholder="••••••••"
                  required
                  autocomplete="current-password"
                  style={{ minHeight: 'var(--touch-min, 48px)' }}
                />
              </IonItem>

              <IonButton
                type="submit"
                expand="block"
                style={styles.button}
                disabled={loading || !email.trim() || !password.trim()}
              >
                {loading ? (
                  <IonSpinner name="crescent" style={{ color: 'var(--color-on-dark)' }} />
                ) : (
                  'Entrar'
                )}
              </IonButton>
            </form>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
