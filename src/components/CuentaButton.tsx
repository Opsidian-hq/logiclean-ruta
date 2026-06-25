/**
 * Logiclean Ruta — CuentaButton
 *
 * Botón de cuenta para el encabezado: muestra quién está en sesión (nombre,
 * correo, rol) y permite cerrar sesión. Va en `IonButtons slot="end"` junto al
 * `SyncStatusBadge`, tanto en el vendedor como en el gerente. Antes el único
 * `signOut` estaba escondido en Catálogo.
 */

import {
  IonButton,
  IonIcon,
  IonPopover,
  IonContent,
} from '@ionic/react';
import { personCircleOutline, logOutOutline } from 'ionicons/icons';
import { useState } from 'react';
import { useAuthContext } from '../context/AuthContext';
import { useVendedorActual } from '../hooks/useVendedorActual';
import { Chip } from './ui/Chip';

export function CuentaButton() {
  const { signOut } = useAuthContext();
  const { nombre, email, rol } = useVendedorActual();
  const [open, setOpen] = useState(false);
  const [event, setEvent] = useState<MouseEvent | undefined>(undefined);

  const abrir = (e: React.MouseEvent) => {
    setEvent(e.nativeEvent);
    setOpen(true);
  };

  return (
    <>
      <IonButton onClick={abrir} aria-label="Cuenta" style={{ '--color': 'var(--color-on-dark)' }}>
        <IonIcon icon={personCircleOutline} slot="icon-only" />
      </IonButton>

      <IonPopover
        isOpen={open}
        event={event}
        onDidDismiss={() => setOpen(false)}
        showBackdrop
      >
        <IonContent>
          <div style={{ padding: 'var(--space-md)', minWidth: '230px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px', color: '#8A94A6' }}>
                Sesión
              </div>
              <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--color-navy)', marginTop: '3px', lineHeight: 1.15 }}>
                {nombre ?? email ?? 'Mi cuenta'}
              </div>
              {email && (
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: '2px', wordBreak: 'break-all' }}>
                  {email}
                </div>
              )}
              {rol && (
                <div style={{ marginTop: '8px' }}>
                  <Chip tone="primarySoft">{rol === 'gerente' ? 'Gerente' : 'Vendedor'}</Chip>
                </div>
              )}
            </div>

            <IonButton
              expand="block"
              fill="outline"
              color="danger"
              onClick={() => {
                setOpen(false);
                signOut();
              }}
            >
              <IonIcon icon={logOutOutline} slot="start" />
              Cerrar sesión
            </IonButton>
          </div>
        </IonContent>
      </IonPopover>
    </>
  );
}
