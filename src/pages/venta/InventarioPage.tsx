/**
 * Logiclean Ruta — InventarioPage (vendedor)
 *
 * Resumen del inventario cargado en el vehículo. Los productos se agregan o
 * ajustan en bulk desde el sheet (FAB) o individualmente tocando una fila.
 * Ruta: /inventario
 */

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonSpinner,
  IonText,
  IonRefresher,
  IonRefresherContent,
  IonFab,
  IonFabButton,
  IonModal,
  IonButton,
  IonIcon,
  IonToast,
} from '@ionic/react';
import { addOutline, chevronForwardOutline } from 'ionicons/icons';
import { useState, useCallback } from 'react';
import { useInventario } from '../../hooks/useInventario';
import type { InventarioRow } from '../../hooks/useInventario';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { StepperCantidad } from '../../components/StepperCantidad';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { CuentaButton } from '../../components/CuentaButton';
import { PrimaryCTA } from '../../components/ui/PrimaryCTA';
import { CargarInventarioSheet } from './components/CargarInventarioSheet';
import { redondear } from '../../lib/precios';
import { money } from '../../lib/money';

export function InventarioPage() {
  const { rows, loading, error, setCantidad, refresh } = useInventario();

  const { handleRefresh } = usePullToRefresh(
    useCallback(async () => { await refresh(); }, [refresh])
  );

  const [cargarOpen, setCargarOpen] = useState(false);
  const [ajusteRow, setAjusteRow] = useState<InventarioRow | null>(null);
  const [ajusteVal, setAjusteVal] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const cargados = rows.filter((r) => r.cantidad > 0);
  const totalUnidades = cargados.reduce((acc, r) => acc + r.cantidad, 0);
  const valorTotal = redondear(
    cargados.reduce((acc, r) => acc + r.cantidad * r.presentacion.precio_mayoreo, 0)
  );

  const abrirAjuste = (row: InventarioRow) => {
    setAjusteRow(row);
    setAjusteVal(row.cantidad);
  };

  const confirmarAjuste = async () => {
    if (!ajusteRow) return;
    await setCantidad(ajusteRow.presentacion.id, ajusteVal);
    setAjusteRow(null);
    setToast('Cantidad actualizada');
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonTitle>Inventario del vehículo</IonTitle>
          <IonButtons slot="end" style={{ marginRight: 'var(--space-sm)' }}>
            <SyncStatusBadge />
            <CuentaButton />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

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

        {!loading && !error && cargados.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <IonText color="medium">
              <p>Sin productos cargados. Toca + para cargar inventario.</p>
            </IonText>
          </div>
        )}

        {!loading && !error && cargados.length > 0 && (
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
              <div style={{ textAlign: 'right' }}>
                <div className="numeric" style={{ fontSize: '12.5px', fontWeight: 700, color: '#8A94A6' }}>
                  {totalUnidades} unidad{totalUnidades !== 1 ? 'es' : ''}
                </div>
                <div className="numeric" style={{ fontSize: '12.5px', fontWeight: 700, color: '#8A94A6' }}>
                  {money(valorTotal)}
                </div>
              </div>
            </div>

            {cargados.map((row) => (
              <div
                key={row.presentacion.id}
                role="button"
                tabIndex={0}
                onClick={() => abrirAjuste(row)}
                onKeyDown={(e) => e.key === 'Enter' && abrirAjuste(row)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '11px',
                  padding: '11px 0',
                  minHeight: '48px',
                  borderBottom: '1px solid var(--color-divider)',
                  cursor: 'pointer',
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

                <div
                  style={{
                    background: 'var(--color-primary)',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: '20px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {row.cantidad} uds
                </div>

                <IonIcon
                  icon={chevronForwardOutline}
                  style={{ color: 'var(--color-text-secondary)', fontSize: '18px', flexShrink: 0 }}
                />
              </div>
            ))}
          </div>
        )}

        <div style={{ height: '96px' }} />
      </IonContent>

      <IonFab vertical="bottom" horizontal="end" slot="fixed">
        <IonFabButton
          style={{ '--background': 'var(--color-primary)' }}
          onClick={() => setCargarOpen(true)}
        >
          <IonIcon icon={addOutline} />
        </IonFabButton>
      </IonFab>

      <CargarInventarioSheet
        isOpen={cargarOpen}
        rows={rows}
        setCantidad={setCantidad}
        onClose={() => setCargarOpen(false)}
      />

      {/* Ajuste individual */}
      <IonModal
        isOpen={ajusteRow !== null}
        onDidDismiss={() => setAjusteRow(null)}
        breakpoints={[0, 0.5]}
        initialBreakpoint={0.5}
      >
        <IonHeader>
          <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
            <IonTitle>Ajustar cantidad</IonTitle>
            <IonButtons slot="end">
              <IonButton
                onClick={() => setAjusteRow(null)}
                style={{ '--color': 'var(--color-on-dark)' }}
              >
                Cancelar
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ padding: 'var(--space-lg) var(--space-md)' }}>
            <div
              style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-navy)', marginBottom: '4px' }}
            >
              {ajusteRow?.presentacion.nombre}
              <span
                style={{
                  background: 'var(--color-surface-muted)',
                  color: '#5B6678',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: '5px',
                  marginLeft: '8px',
                }}
              >
                {ajusteRow?.presentacion.unidad_venta}
              </span>
            </div>
            <div
              style={{
                fontSize: '13px',
                color: 'var(--color-text-secondary)',
                marginBottom: 'var(--space-xl)',
              }}
            >
              {ajusteRow?.productoNombre}
            </div>

            <div
              style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-xl)' }}
            >
              <StepperCantidad value={ajusteVal} onChange={setAjusteVal} min={0} />
            </div>

            <PrimaryCTA onClick={confirmarAjuste}>Confirmar ajuste</PrimaryCTA>
          </div>
        </IonContent>
      </IonModal>

      <IonToast
        isOpen={toast !== null}
        message={toast ?? ''}
        duration={2000}
        onDidDismiss={() => setToast(null)}
        position="bottom"
      />
    </IonPage>
  );
}
