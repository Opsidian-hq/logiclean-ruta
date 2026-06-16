/**
 * Logiclean Ruta — InventarioPage (vendedor)
 *
 * Carga/ajuste del inventario del vehículo del día. El vendedor fija cuántas
 * unidades de cada presentación trae cargadas. Escritura local + cola de sync.
 * Ruta: /inventario
 */

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonSearchbar,
  IonSpinner,
  IonText,
} from '@ionic/react';
import { useState } from 'react';
import { useInventario } from '../../hooks/useInventario';
import { StepperCantidad } from '../../components/StepperCantidad';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { ConnectivityStrip } from '../../components/ui/ConnectivityStrip';
import { Chip } from '../../components/ui/Chip';

export function InventarioPage() {
  const { rows, loading, error, setCantidad } = useInventario();
  const [search, setSearch] = useState('');

  const filtrados = rows.filter(
    (r) =>
      r.presentacion.nombre.toLowerCase().includes(search.toLowerCase()) ||
      r.productoNombre.toLowerCase().includes(search.toLowerCase())
  );

  const totalUnidades = rows.reduce((acc, r) => acc + r.cantidad, 0);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonTitle>Inventario del vehículo</IonTitle>
          <IonButtons slot="end" style={{ marginRight: 'var(--space-sm)' }}>
            <SyncStatusBadge />
          </IonButtons>
        </IonToolbar>
        <ConnectivityStrip text="El inventario se guarda en el equipo al instante" />
      </IonHeader>

      <IonContent>
        <IonSearchbar
          value={search}
          onIonInput={(e) => setSearch(e.detail.value ?? '')}
          placeholder="Buscar presentación..."
          style={{ '--background': 'var(--color-surface)' }}
        />

        {loading && (
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: 'var(--space-lg)' }}>
            <IonText color="danger">
              <p>Error al cargar el inventario: {error}</p>
            </IonText>
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <IonText color="medium">
              <p>
                No hay presentaciones en el catálogo local. Sincroniza con
                conexión para descargarlo.
              </p>
            </IonText>
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
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
              <span className="numeric" style={{ fontSize: '12.5px', fontWeight: 700, color: '#8A94A6' }}>
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
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#8A94A6', marginTop: '3px' }}>
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
      </IonContent>
    </IonPage>
  );
}
