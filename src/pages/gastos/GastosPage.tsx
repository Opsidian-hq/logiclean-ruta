/**
 * Logiclean Ruta — GastosPage (vendedor) · H-12 Gastos de ruta
 *
 * Registro de baja fricción de gastos de ruta + lista del periodo activo
 * (desde el último corte) con totales por bolsa (efectivo / transferencia).
 * Offline-first. El efecto en el corte (descuento de la bolsa) se calcula
 * en Inc 3.
 * Ruta: /gastos
 */

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonSegment,
  IonSegmentButton,
  IonText,
  IonSpinner,
  IonToast,
  IonRefresher,
  IonRefresherContent,
  IonFab,
  IonFabButton,
  IonModal,
  IonIcon,
} from '@ionic/react';
import { addOutline, closeOutline } from 'ionicons/icons';
import { useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { useGastos } from '../../hooks/useGastos';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { CATEGORIAS_RUTA } from '../../lib/gastos';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { CuentaButton } from '../../components/CuentaButton';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { PrimaryCTA } from '../../components/ui/PrimaryCTA';

const money = (n: number) => `$${n.toFixed(2)}`;

const sectionLabel: CSSProperties = {
  display: 'block',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 800,
  letterSpacing: '0.6px',
  textTransform: 'uppercase',
  color: 'var(--color-text-secondary)',
  padding: '14px var(--space-md) 6px',
};
const OTRO = '__otro__';

export function GastosPage() {
  const { gastosPeriodo, totales, loading, registrarGasto, refresh } = useGastos();

  const { handleRefresh } = usePullToRefresh(
    useCallback(async () => { await refresh(); }, [refresh])
  );

  const [formOpen, setFormOpen] = useState(false);

  const [categoria, setCategoria] = useState<string>('');
  const [categoriaLibre, setCategoriaLibre] = useState('');
  const [montoStr, setMontoStr] = useState('');
  const [formaPago, setFormaPago] = useState<'efectivo' | 'transferencia'>('efectivo');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [descripcion, setDescripcion] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const categoriaFinal = categoria === OTRO ? categoriaLibre.trim() : categoria;
  const monto = parseFloat(montoStr) || 0;
  const puedeGuardar = !!categoriaFinal && monto > 0 && !loading;

  const resetForm = () => {
    setCategoria('');
    setCategoriaLibre('');
    setMontoStr('');
    setFormaPago('efectivo');
    setFecha(new Date().toISOString().slice(0, 10));
    setDescripcion('');
  };

  const guardar = async () => {
    if (!puedeGuardar) return;
    await registrarGasto({
      categoria: categoriaFinal,
      monto,
      forma_pago: formaPago,
      fecha,
      descripcion: descripcion || undefined,
    });
    setToast(`Gasto guardado (en cola): ${categoriaFinal} ${money(monto)}`);
    setFormOpen(false);
    resetForm();
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonTitle>Gastos de ruta</IonTitle>
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

        {/* ── Gastos del periodo ── */}
        <span style={sectionLabel}>Gastos del periodo</span>

        {/* Resumen por bolsa (siempre visible) */}
        <div style={{ padding: '0 var(--space-md)' }}>
          <Card padding="13px 14px">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Efectivo</span>
              <span className="numeric" style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-navy)' }}>
                {money(totales.efectivo)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--color-divider)' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Transferencia</span>
              <span className="numeric" style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-navy)' }}>
                {money(totales.transferencia)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--color-divider)' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-navy)' }}>Total</span>
              <span className="numeric" style={{ fontSize: '17px', fontWeight: 800, color: 'var(--color-navy)' }}>
                {money(totales.efectivo + totales.transferencia)}
              </span>
            </div>
          </Card>
        </div>

        {/* Historial */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {!loading && gastosPeriodo.length === 0 && (
          <IonText color="medium">
            <p style={{ fontSize: 'var(--font-size-sm)', padding: '12px var(--space-md) 0' }}>
              Aún no hay gastos en este periodo.
            </p>
          </IonText>
        )}

        {!loading && gastosPeriodo.length > 0 && (
          <div style={{ padding: '12px var(--space-md) 0' }}>
            {gastosPeriodo.map((g) => (
              <div
                key={g.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '11px',
                  padding: '11px 0',
                  borderBottom: '1px solid var(--color-divider)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-navy)' }}>{g.categoria}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '4px', flexWrap: 'wrap' }}>
                    <Chip tone={g.forma_pago === 'efectivo' ? 'primarySoft' : 'neutral'}>
                      {g.forma_pago === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                    </Chip>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      {g.fecha.slice(0, 10)}
                    </span>
                    {g.descripcion && (
                      <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#8A94A6' }}>{g.descripcion}</span>
                    )}
                  </div>
                </div>
                <span className="numeric" style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-navy)' }}>
                  {money(g.monto)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={{ height: '96px' }} />

        {/* FAB: registrar nuevo gasto */}
        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton
            style={{ '--background': 'var(--color-primary)' }}
            onClick={() => setFormOpen(true)}
          >
            <IonIcon icon={addOutline} />
          </IonFabButton>
        </IonFab>
      </IonContent>

      {/* ── Modal: formulario de nuevo gasto ── */}
      <IonModal
        isOpen={formOpen}
        onDidDismiss={() => { setFormOpen(false); resetForm(); }}
      >
        <IonHeader>
          <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
            <IonButtons slot="start">
              <IonButton onClick={() => { setFormOpen(false); resetForm(); }}>
                <IonIcon icon={closeOutline} />
              </IonButton>
            </IonButtons>
            <IonTitle>Registrar gasto</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonContent>
          <IonList>
            <IonItem>
              <IonLabel position="stacked">Categoría *</IonLabel>
              <IonSelect
                value={categoria}
                placeholder="Selecciona una categoría"
                onIonChange={(e) => setCategoria(e.detail.value)}
              >
                {CATEGORIAS_RUTA.map((c) => (
                  <IonSelectOption key={c} value={c}>
                    {c}
                  </IonSelectOption>
                ))}
                <IonSelectOption value={OTRO}>Otro…</IonSelectOption>
              </IonSelect>
            </IonItem>

            {categoria === OTRO && (
              <IonItem>
                <IonLabel position="stacked">Especifica la categoría *</IonLabel>
                <IonInput
                  value={categoriaLibre}
                  onIonInput={(e) => setCategoriaLibre(e.detail.value ?? '')}
                  placeholder="Ej. Estacionamiento"
                />
              </IonItem>
            )}

            <IonItem>
              <IonLabel position="stacked">Monto *</IonLabel>
              <IonInput
                type="number"
                inputmode="decimal"
                value={montoStr}
                onIonInput={(e) => setMontoStr(e.detail.value ?? '')}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </IonItem>

            <IonItem>
              <IonSegment
                value={formaPago}
                onIonChange={(e) =>
                  setFormaPago(
                    (e.detail.value as 'efectivo' | 'transferencia') ?? 'efectivo'
                  )
                }
              >
                <IonSegmentButton value="efectivo">
                  <IonLabel>Efectivo</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="transferencia">
                  <IonLabel>Transferencia</IonLabel>
                </IonSegmentButton>
              </IonSegment>
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Fecha</IonLabel>
              <IonInput
                type="date"
                value={fecha}
                onIonInput={(e) => setFecha(e.detail.value ?? '')}
              />
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Descripción (opcional)</IonLabel>
              <IonInput
                value={descripcion}
                onIonInput={(e) => setDescripcion(e.detail.value ?? '')}
                placeholder="Detalle del gasto"
              />
            </IonItem>

            <div style={{ padding: '12px var(--space-md)' }}>
              <PrimaryCTA disabled={!puedeGuardar} onClick={guardar}>
                Registrar gasto
              </PrimaryCTA>
            </div>
          </IonList>
        </IonContent>
      </IonModal>

      <IonToast
        isOpen={!!toast}
        message={toast ?? ''}
        duration={2500}
        onDidDismiss={() => setToast(null)}
        color="dark"
      />
    </IonPage>
  );
}
