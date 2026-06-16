/**
 * Logiclean Ruta — GastosPage (vendedor) · H-12 Gastos de ruta
 *
 * Registro de baja fricción de gastos de ruta + lista del día con totales por
 * bolsa (efectivo / transferencia). Offline-first. El efecto en el corte
 * (descuento de la bolsa) se calcula en Inc 3.
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
  IonListHeader,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonSegment,
  IonSegmentButton,
  IonNote,
  IonText,
  IonSpinner,
  IonToast,
} from '@ionic/react';
import { useState } from 'react';
import { useGastos } from '../../hooks/useGastos';
import { CATEGORIAS_RUTA } from '../../lib/gastos';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';

const money = (n: number) => `$${n.toFixed(2)}`;
const OTRO = '__otro__';

export function GastosPage() {
  const { gastosHoy, totales, loading, registrarGasto } = useGastos();

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
    setCategoria('');
    setCategoriaLibre('');
    setMontoStr('');
    setDescripcion('');
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': '#fff' }}>
          <IonTitle>Gastos de ruta</IonTitle>
          <IonButtons slot="end">
            <SyncStatusBadge showLabel={false} />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {/* ── Formulario ── */}
        <IonList>
          <IonListHeader>
            <IonLabel>Registrar gasto</IonLabel>
          </IonListHeader>

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

          <div style={{ padding: '12px 16px' }}>
            <IonButton
              expand="block"
              disabled={!puedeGuardar}
              style={{ '--background': 'var(--color-primary)' }}
              onClick={guardar}
            >
              Registrar gasto
            </IonButton>
          </div>
        </IonList>

        {/* ── Gastos del día ── */}
        <IonList>
          <IonListHeader>
            <IonLabel>Gastos de hoy</IonLabel>
          </IonListHeader>

          {loading && (
            <div style={{ textAlign: 'center', padding: '24px' }}>
              <IonSpinner name="crescent" />
            </div>
          )}

          {!loading && gastosHoy.length === 0 && (
            <IonItem lines="none">
              <IonNote>Aún no hay gastos registrados hoy.</IonNote>
            </IonItem>
          )}

          {!loading &&
            gastosHoy.map((g) => (
              <IonItem key={g.id}>
                <IonLabel>
                  <h3 style={{ color: 'var(--color-navy)' }}>{g.categoria}</h3>
                  <p style={{ fontSize: '12px', color: '#6B7280' }}>
                    {g.forma_pago}
                    {g.descripcion && <> · {g.descripcion}</>}
                  </p>
                </IonLabel>
                <IonText slot="end" style={{ fontWeight: 600 }}>
                  {money(g.monto)}
                </IonText>
              </IonItem>
            ))}

          {!loading && gastosHoy.length > 0 && (
            <IonItem lines="none">
              <IonLabel>
                <IonText color="medium">
                  <p style={{ fontSize: '13px', margin: 0 }}>
                    Efectivo: <strong>{money(totales.efectivo)}</strong> ·
                    Transferencia: <strong>{money(totales.transferencia)}</strong>
                  </p>
                </IonText>
              </IonLabel>
            </IonItem>
          )}
        </IonList>

        <div style={{ height: '24px' }} />
      </IonContent>

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
