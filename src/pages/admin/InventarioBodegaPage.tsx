/**
 * Logiclean Ruta — InventarioBodegaPage (gerente)
 *
 * Resumen del inventario de bodega: mismo diseño que InventarioPage del
 * vendedor, pero de solo lectura (el contador `inventario_bodega_presentacion`
 * se materializa del lado servidor por trigger, ADR-0007 — el cliente nunca
 * empuja un valor absoluto de bodega). Las 3 acciones que sí lo afectan
 * (envasado, carga/devolución y recepción de La Moderna) cuelgan del FAB.
 * Ruta: /admin/inventario
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
  IonFabList,
  IonIcon,
} from '@ionic/react';
import { addOutline, flaskOutline, swapVerticalOutline, archiveOutline } from 'ionicons/icons';
import { useCallback } from 'react';
import type { CSSProperties } from 'react';
import { useHistory } from 'react-router-dom';
import { useInventarioBodega } from '../../hooks/useInventarioBodega';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { CuentaButton } from '../../components/CuentaButton';
import { Card } from '../../components/ui/Card';
import { redondear } from '../../lib/precios';
import { money } from '../../lib/money';

const sectionLabelStyle: CSSProperties = {
  display: 'block',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 800,
  letterSpacing: '0.6px',
  textTransform: 'uppercase',
  color: 'var(--color-text-secondary)',
  padding: '14px var(--space-md) 6px',
};

export function InventarioBodegaPage() {
  const history = useHistory();
  const { rows, loading, error, refresh } = useInventarioBodega();

  const { handleRefresh } = usePullToRefresh(
    useCallback(async () => { await refresh(); }, [refresh])
  );

  const totalUnidades = rows.reduce((acc, r) => acc + r.cantidad, 0);
  const valorTotal = redondear(
    rows.reduce((acc, r) => acc + r.cantidad * r.presentacion.precio_mayoreo, 0)
  );

  const cantidadBadge = (n: number): { background: string; color: string } => {
    if (n >= 5) return { background: '#12B76A', color: '#fff' };
    if (n >= 3) return { background: 'var(--color-amber)', color: '#231A05' };
    return { background: 'var(--color-error)', color: '#fff' };
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonTitle>Inventario de bodega</IonTitle>
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

        {/* Tarjeta resumen — siempre visible cuando hay datos */}
        {!loading && !error && (
          <>
            <span style={sectionLabelStyle}>En bodega</span>
            <div style={{ padding: '0 var(--space-md)' }}>
              <Card padding="13px 14px">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                    Productos
                  </span>
                  <span className="numeric" style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-navy)' }}>
                    {rows.length}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--color-divider)',
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                    Unidades
                  </span>
                  <span className="numeric" style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-navy)' }}>
                    {totalUnidades}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--color-divider)',
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-navy)' }}>
                    Valor
                  </span>
                  <span className="numeric" style={{ fontSize: '17px', fontWeight: 800, color: 'var(--color-navy)' }}>
                    {money(valorTotal)}
                  </span>
                </div>
              </Card>
            </div>
          </>
        )}

        {/* Lista de presentaciones en bodega */}
        {!loading && !error && rows.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <IonText color="medium">
              <p>Sin presentaciones activas en el catálogo.</p>
            </IonText>
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div style={{ padding: '0 var(--space-md) var(--space-lg)', marginTop: 'var(--space-md)' }}>
            {rows.map((row) => (
              <div
                key={row.presentacion.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '11px',
                  padding: '11px 0',
                  minHeight: '48px',
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

                <div
                  style={{
                    ...cantidadBadge(row.cantidad),
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
              </div>
            ))}
          </div>
        )}

        <div style={{ height: '96px' }} />
      </IonContent>

      <IonFab vertical="bottom" horizontal="end" slot="fixed">
        <IonFabButton style={{ '--background': 'var(--color-primary)' }}>
          <IonIcon icon={addOutline} />
        </IonFabButton>
        <IonFabList side="top">
          <IonFabButton aria-label="Envasado" onClick={() => history.push('/admin/envasado')}>
            <IonIcon icon={flaskOutline} />
          </IonFabButton>
          <IonFabButton aria-label="Carga y devolución" onClick={() => history.push('/admin/carga-devolucion')}>
            <IonIcon icon={swapVerticalOutline} />
          </IonFabButton>
          <IonFabButton aria-label="Recepción La Moderna" onClick={() => history.push('/admin/recepcion-moderna')}>
            <IonIcon icon={archiveOutline} />
          </IonFabButton>
        </IonFabList>
      </IonFab>
    </IonPage>
  );
}
