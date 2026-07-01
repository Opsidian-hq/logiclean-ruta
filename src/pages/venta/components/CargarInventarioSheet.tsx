import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonSearchbar,
  IonText,
} from '@ionic/react';
import { useState } from 'react';
import { StepperCantidad } from '../../../components/StepperCantidad';
import { Chip } from '../../../components/ui/Chip';
import type { InventarioRow } from '../../../hooks/useInventario';

interface CargarInventarioSheetProps {
  isOpen: boolean;
  rows: InventarioRow[];
  setCantidad: (presentacionId: string, cantidad: number) => Promise<void>;
  onClose: () => void;
}

export function CargarInventarioSheet({
  isOpen,
  rows,
  setCantidad,
  onClose,
}: CargarInventarioSheetProps) {
  const [search, setSearch] = useState('');

  const filtrados = rows.filter(
    (r) =>
      r.presentacion.nombre.toLowerCase().includes(search.toLowerCase()) ||
      r.productoNombre.toLowerCase().includes(search.toLowerCase())
  );

  const totalUnidades = rows.reduce((acc, r) => acc + r.cantidad, 0);

  const handleDismiss = () => {
    setSearch('');
    onClose();
  };

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={handleDismiss}
      breakpoints={[0, 0.9]}
      initialBreakpoint={0.9}
    >
      <IonHeader>
        <IonToolbar
          style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}
        >
          <IonTitle>Cargar inventario</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleDismiss} style={{ '--color': 'var(--color-on-dark)' }}>
              Cerrar
            </IonButton>
          </IonButtons>
        </IonToolbar>
        <IonToolbar>
          <IonSearchbar
            value={search}
            onIonInput={(e) => setSearch(e.detail.value ?? '')}
            placeholder="Buscar presentación..."
            style={{ '--background': 'var(--color-surface)' }}
          />
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <IonText color="medium">
              <p>
                No hay presentaciones en el catálogo local. Sincroniza con
                conexión para descargarlo.
              </p>
            </IonText>
          </div>
        ) : (
          <div style={{ padding: '0 var(--space-md) var(--space-lg)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 0 6px',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 800,
                  letterSpacing: '0.6px',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Cargado en el vehículo
              </span>
              <span
                className="numeric"
                style={{ fontSize: '12.5px', fontWeight: 700, color: '#8A94A6' }}
              >
                {totalUnidades} unidad{totalUnidades !== 1 ? 'es' : ''}
              </span>
            </div>

            {filtrados.map((row) => (
              <div
                key={row.presentacion.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '11px',
                  padding: '11px 0',
                  borderBottom: '1px solid var(--color-divider)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-navy)' }}>
                    {row.presentacion.nombre}
                    <span
                      style={{
                        background: 'var(--color-surface-muted)',
                        color: '#5B6678',
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: '5px',
                        marginLeft: '6px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row.presentacion.unidad_venta}
                    </span>
                  </div>
                  <div
                    style={{ fontSize: '12.5px', fontWeight: 600, color: '#8A94A6', marginTop: '3px' }}
                  >
                    {row.productoNombre}
                  </div>
                </div>
                {row.cantidad === 0 && <Chip tone="neutral">Sin carga</Chip>}
                <StepperCantidad
                  value={row.cantidad}
                  onChange={(v) => setCantidad(row.presentacion.id, v)}
                  min={0}
                />
              </div>
            ))}
          </div>
        )}
        <div style={{ height: '24px' }} />
      </IonContent>
    </IonModal>
  );
}
