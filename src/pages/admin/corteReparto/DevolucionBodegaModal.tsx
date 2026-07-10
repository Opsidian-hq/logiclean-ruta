/**
 * Logiclean Ruta — Devolución a bodega desde el Paso 1 del corte (H-19)
 *
 * Solo movimiento de inventario (vehículo → bodega): no afecta venta ni
 * efectivo, así que no toca los insumos del motor de dominio. Reusa
 * `useCargaDevolucion` / `registrarDevolucion` (Inc 6.4) tal cual — esta
 * modal es únicamente el punto de entrada desde el stepper.
 */

import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonFooter,
  IonToast,
  IonIcon,
} from '@ionic/react';
import { timeOutline, cloudOfflineOutline } from 'ionicons/icons';
import { useState } from 'react';
import { useCargaDevolucion } from '../../../hooks/useCargaDevolucion';
import { StepperCantidad } from '../../../components/StepperCantidad';
import { Card } from '../../../components/ui/Card';
import { PrimaryCTA } from '../../../components/ui/PrimaryCTA';
import { useSyncContext } from '../../../context/SyncContext';

interface DevolucionBodegaModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendedorId: string;
  vendedorNombre: string;
  responsableId: string | null;
}

export function DevolucionBodegaModal({
  isOpen,
  onClose,
  vendedorId,
  vendedorNombre,
  responsableId,
}: DevolucionBodegaModalProps) {
  const { presentaciones, disponibleVehiculo, crearDevolucion } = useCargaDevolucion(responsableId);
  const { isOnline, syncStatus, pendingCount, syncNow } = useSyncContext();
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [mostrarEstadoSync, setMostrarEstadoSync] = useState(false);

  const presentacionesConStock = presentaciones.filter(
    (p) => disponibleVehiculo(vendedorId, p.id) > 0
  );

  const confirmar = async () => {
    const lineas = Object.entries(cantidades)
      .filter(([, cantidad]) => cantidad > 0)
      .map(([presentacionId, cantidad]) => ({ presentacionId, cantidad }));
    if (lineas.length === 0) {
      setToast('Agrega al menos una cantidad.');
      return;
    }
    setGuardando(true);
    try {
      await crearDevolucion(vendedorId, lineas);
      setCantidades({});
      setMostrarEstadoSync(true);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'No se pudo registrar la devolución.');
    } finally {
      setGuardando(false);
    }
  };

  const cerrar = () => {
    setMostrarEstadoSync(false);
    onClose();
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={cerrar}>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonButtons slot="start">
            <IonButton onClick={cerrar} style={{ '--color': 'var(--color-on-dark)' }}>
              Cerrar
            </IonButton>
          </IonButtons>
          <IonTitle>Devolver stock de {vendedorNombre}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {mostrarEstadoSync && (pendingCount > 0 || syncStatus === 'error' || !isOnline) && (
            <Card
              padding="15px"
              style={{
                border: syncStatus === 'error' ? '1.5px solid #F4B3AC' : '1.5px solid #F6C97C',
                background: syncStatus === 'error' ? '#FDECEA' : '#FEF3E2',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <IonIcon
                  icon={syncStatus === 'error' ? cloudOfflineOutline : timeOutline}
                  style={{ fontSize: '19px', color: syncStatus === 'error' ? '#D92D20' : '#F79009' }}
                />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: syncStatus === 'error' ? '#911A11' : '#7A3E06' }}>
                    {syncStatus === 'error' ? 'No se pudo sincronizar' : 'Devolución registrada'}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: syncStatus === 'error' ? '#B42318' : '#B54708' }}>
                    {syncStatus === 'error' ? 'Guardado en el equipo ✓ · Sin subir ✕' : 'Guardado ✓ · pendiente de sincronizar'}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', marginTop: '8px' }}>
                {syncStatus === 'error'
                  ? 'Sigue en el equipo; nada se pierde.'
                  : 'Se sincroniza sola al recuperar señal, o reintenta a mano.'}
              </div>
              {syncStatus === 'error' && (
                <button
                  onClick={() => syncNow()}
                  style={{
                    marginTop: '10px',
                    width: '100%',
                    height: '42px',
                    borderRadius: '12px',
                    border: '1.5px solid #D92D20',
                    background: 'transparent',
                    color: '#D92D20',
                    fontWeight: 800,
                    fontSize: '13px',
                  }}
                >
                  Reintentar ahora
                </button>
              )}
            </Card>
          )}
          <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            Solo movimiento de inventario — no afecta venta ni efectivo.
          </div>
          {presentacionesConStock.length === 0 && (
            <Card>
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-secondary)', textAlign: 'center', padding: '10px 0' }}>
                {vendedorNombre} no tiene inventario en el vehículo para devolver.
              </div>
            </Card>
          )}
          {presentacionesConStock.map((p) => (
            <Card key={p.id} padding="12px 14px">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-body)' }}>{p.nombre}</div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    {disponibleVehiculo(vendedorId, p.id)} en vehículo
                  </div>
                </div>
                <StepperCantidad
                  value={cantidades[p.id] ?? 0}
                  onChange={(v) => setCantidades((prev) => ({ ...prev, [p.id]: v }))}
                  max={disponibleVehiculo(vendedorId, p.id)}
                />
              </div>
            </Card>
          ))}
        </div>
      </IonContent>
      <IonFooter>
        <IonToolbar style={{ '--padding-top': '8px', '--padding-bottom': '14px', '--padding-start': '18px', '--padding-end': '18px' }}>
          <PrimaryCTA onClick={confirmar} loading={guardando} disabled={guardando || presentacionesConStock.length === 0}>
            Confirmar devolución
          </PrimaryCTA>
        </IonToolbar>
      </IonFooter>
      <IonToast isOpen={!!toast} message={toast ?? ''} duration={3000} onDidDismiss={() => setToast(null)} color="dark" />
    </IonModal>
  );
}
