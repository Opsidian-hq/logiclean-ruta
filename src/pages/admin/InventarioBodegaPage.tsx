/**
 * Logiclean Ruta — InventarioBodegaPage (gerente)
 *
 * Resumen del inventario de bodega, en dos pestañas (mismo patrón de
 * `.segment-on-navy` que VisitasPage/CargaDevolucionPage): "Vendible"
 * (producto ya envasado, `inventario_bodega_presentacion`) y "Materia prima"
 * (bidones sellados / granel abierto, `inventario_bodega_base`). De solo
 * lectura — ambos contadores se materializan del lado servidor por trigger
 * (ADR-0007); el cliente nunca empuja un valor absoluto de bodega. Las
 * acciones que sí afectan bodega cuelgan del FAB, pero varían según la
 * pestaña activa: Envasado solo en Materia prima, Carga y devolución solo
 * en Vendible; Recepción de La Moderna aparece en ambas.
 * Ruta: /admin/inventario
 */

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonSegment,
  IonSegmentButton,
  IonLabel,
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
import { useCallback, useMemo, useState } from 'react';
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
  const { rows, bodegaBaseRows, loading, error, refresh } = useInventarioBodega();
  const [segmento, setSegmento] = useState<'vendible' | 'materia_prima'>('vendible');

  const { handleRefresh } = usePullToRefresh(
    useCallback(async () => { await refresh(); }, [refresh])
  );

  const totalUnidades = rows.reduce((acc, r) => acc + r.cantidad, 0);
  const valorTotal = redondear(
    rows.reduce((acc, r) => acc + r.cantidad * r.presentacion.precio_mayoreo, 0)
  );

  const totalBidones = bodegaBaseRows.reduce((acc, r) => acc + r.bidonesDisponibles, 0);
  const totalLitrosGranel = bodegaBaseRows.reduce((acc, r) => acc + r.litrosGranelEstimado, 0);

  const rowsDisponibles = useMemo(
    () => rows.filter((r) => r.cantidad >= 1).sort((a, b) => a.cantidad - b.cantidad),
    [rows]
  );
  const rowsAgotados = useMemo(() => rows.filter((r) => r.cantidad === 0), [rows]);

  // Ruido de punto flotante en contadores DECIMAL acumulados por trigger
  // (mismo criterio que EPSILON_STOCK en useEnvasado.ts / EPSILON_IDENTIDAD en corte.ts).
  const EPSILON_STOCK = 0.001;

  const baseDisponibles = useMemo(
    () =>
      bodegaBaseRows
        .filter((r) => r.litrosDisponibles > EPSILON_STOCK)
        .sort((a, b) => a.litrosDisponibles - b.litrosDisponibles),
    [bodegaBaseRows]
  );
  const baseAgotados = useMemo(
    () => bodegaBaseRows.filter((r) => r.litrosDisponibles <= EPSILON_STOCK),
    [bodegaBaseRows]
  );

  const cantidadBadge = (n: number): { background: string; color: string } => {
    if (n === 0) return { background: 'var(--color-surface-muted)', color: '#5B6678' };
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
        <IonToolbar>
          <IonSegment
            className="segment-on-navy"
            value={segmento}
            onIonChange={(e) => setSegmento((e.detail.value as 'vendible' | 'materia_prima') ?? 'vendible')}
          >
            <IonSegmentButton value="vendible">
              <IonLabel>Vendible</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="materia_prima">
              <IonLabel>Materia prima</IonLabel>
            </IonSegmentButton>
          </IonSegment>
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

        {!loading && !error && segmento === 'vendible' && (
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

            {rows.length === 0 && (
              <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                <IonText color="medium">
                  <p>Sin presentaciones activas en el catálogo.</p>
                </IonText>
              </div>
            )}

            {rowsDisponibles.length > 0 && (
              <>
                <span style={sectionLabelStyle}>Disponibles</span>
                <div style={{ padding: '0 var(--space-md) var(--space-lg)' }}>
                  {rowsDisponibles.map((row) => (
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
              </>
            )}

            {rowsAgotados.length > 0 && (
              <>
                <span style={sectionLabelStyle}>Agotados</span>
                <div style={{ padding: '0 var(--space-md) var(--space-lg)' }}>
                  {rowsAgotados.map((row) => (
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
              </>
            )}
          </>
        )}

        {!loading && !error && segmento === 'materia_prima' && (
          <>
            <span style={sectionLabelStyle}>Sin envasar</span>
            <div style={{ padding: '0 var(--space-md)' }}>
              <Card padding="13px 14px">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                    Productos
                  </span>
                  <span className="numeric" style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-navy)' }}>
                    {bodegaBaseRows.length}
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
                    Bidones disponibles
                  </span>
                  <span className="numeric" style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-navy)' }}>
                    {totalBidones}
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
                    Litros a granel
                  </span>
                  <span className="numeric" style={{ fontSize: '17px', fontWeight: 800, color: 'var(--color-navy)' }}>
                    {totalLitrosGranel}
                  </span>
                </div>
              </Card>
            </div>

            {bodegaBaseRows.length === 0 && (
              <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                <IonText color="medium">
                  <p>Sin materia prima pendiente de envasar.</p>
                </IonText>
              </div>
            )}

            {baseDisponibles.length > 0 && (
              <>
                <span style={sectionLabelStyle}>Disponibles</span>
                <div style={{ padding: '0 var(--space-md) var(--space-lg)' }}>
                  {baseDisponibles.map((row) => (
                    <div
                      key={row.productoBase.id}
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
                          {row.productoBase.nombre}
                        </div>
                      </div>

                      <div
                        style={{
                          background: 'var(--color-surface-muted)',
                          color: 'var(--color-navy)',
                          fontSize: '13px',
                          fontWeight: 800,
                          padding: '4px 10px',
                          borderRadius: '20px',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          textAlign: 'right',
                        }}
                      >
                        {row.bidonesDisponibles} bidones · {row.litrosGranelEstimado} L granel
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {baseAgotados.length > 0 && (
              <>
                <span style={sectionLabelStyle}>Agotados</span>
                <div style={{ padding: '0 var(--space-md) var(--space-lg)' }}>
                  {baseAgotados.map((row) => (
                    <div
                      key={row.productoBase.id}
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
                          {row.productoBase.nombre}
                        </div>
                      </div>

                      <div
                        style={{
                          background: 'var(--color-surface-muted)',
                          color: 'var(--color-disabled)',
                          fontSize: '13px',
                          fontWeight: 800,
                          padding: '4px 10px',
                          borderRadius: '20px',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          textAlign: 'right',
                        }}
                      >
                        {row.bidonesDisponibles} bidones · {row.litrosGranelEstimado} L granel
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        <div style={{ height: '96px' }} />
      </IonContent>

      <IonFab vertical="bottom" horizontal="end" slot="fixed">
        <IonFabButton style={{ '--background': 'var(--color-primary)' }}>
          <IonIcon icon={addOutline} />
        </IonFabButton>
        <IonFabList side="top">
          {segmento === 'materia_prima' && (
            <IonFabButton aria-label="Envasado" onClick={() => history.push('/admin/envasado')}>
              <IonIcon icon={flaskOutline} />
            </IonFabButton>
          )}
          {segmento === 'vendible' && (
            <IonFabButton aria-label="Carga y devolución" onClick={() => history.push('/admin/carga-devolucion')}>
              <IonIcon icon={swapVerticalOutline} />
            </IonFabButton>
          )}
          <IonFabButton aria-label="Recepción La Moderna" onClick={() => history.push('/admin/recepcion-moderna')}>
            <IonIcon icon={archiveOutline} />
          </IonFabButton>
        </IonFabList>
      </IonFab>
    </IonPage>
  );
}
