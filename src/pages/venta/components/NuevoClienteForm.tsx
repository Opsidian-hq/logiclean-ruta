/**
 * Logiclean Ruta — NuevoClienteForm (modal)
 *
 * Alta rápida de un cliente **activo** desde el flujo de venta: cuando en la
 * ruta aparece un cliente nuevo que compra, el vendedor lo registra sin salir
 * de `/venta` y le vende de inmediato.
 *
 * Pide nombre y tipo (necesarios para los precios) y, opcionalmente, el día de
 * visita para incorporarlo a la ruta recurrente.
 */

import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonSegment,
  IonSegmentButton,
  IonText,
} from '@ionic/react';
import { useState } from 'react';
import { PrimaryCTA } from '../../../components/ui/PrimaryCTA';
import { DiaVisitaSelect, diaVisitaHoy } from '../../../components/ui/DiaVisitaSelect';

export interface NuevoClienteArgs {
  nombre: string;
  tipo: 'mayoreo' | 'menudeo';
  /** Día semanal de ruta, o null si no se asigna. */
  diaRuta: string | null;
}

interface NuevoClienteFormProps {
  onCrear: (args: NuevoClienteArgs) => Promise<unknown>;
  onClose: () => void;
}

export function NuevoClienteForm({ onCrear, onClose }: NuevoClienteFormProps) {
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<'mayoreo' | 'menudeo'>('menudeo');
  const [diaRuta, setDiaRuta] = useState<string | null>(diaVisitaHoy());
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const nombreInvalido = touched && !nombre.trim();

  const handleGuardar = async () => {
    setTouched(true);
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      await onCrear({ nombre: nombre.trim(), tipo, diaRuta });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonTitle>Nuevo cliente</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose} style={{ color: 'var(--color-on-dark)' }}>
              Cancelar
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonList>
          <IonItem>
            <IonLabel position="stacked">Nombre *</IonLabel>
            <IonInput
              value={nombre}
              onIonInput={(e) => setNombre(e.detail.value ?? '')}
              placeholder="Nombre del cliente"
            />
          </IonItem>
          {nombreInvalido && (
            <IonText color="danger">
              <p style={{ marginLeft: 'var(--space-md)', fontSize: 'var(--font-size-sm)' }}>
                El nombre es obligatorio
              </p>
            </IonText>
          )}

          <IonItem>
            <IonLabel position="stacked">Tipo de cliente</IonLabel>
            <IonSegment
              value={tipo}
              onIonChange={(e) =>
                setTipo((e.detail.value as 'mayoreo' | 'menudeo') ?? 'menudeo')
              }
            >
              <IonSegmentButton value="menudeo">
                <IonLabel>Menudeo</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="mayoreo">
                <IonLabel>Mayoreo</IonLabel>
              </IonSegmentButton>
            </IonSegment>
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Día de visita</IonLabel>
            <DiaVisitaSelect value={diaRuta} onChange={setDiaRuta} placeholder="Opcional" />
          </IonItem>
          <IonText color="medium">
            <p style={{ marginLeft: 'var(--space-md)', marginRight: 'var(--space-md)', fontSize: 'var(--font-size-sm)' }}>
              Asigna un día para que aparezca en tu ruta. Puedes dejarlo en blanco
              y agregarlo después.
            </p>
          </IonText>

          <div style={{ padding: 'var(--space-md)' }}>
            <PrimaryCTA loading={saving} disabled={saving} onClick={handleGuardar}>
              {saving ? 'Guardando…' : 'Guardar cliente'}
            </PrimaryCTA>
          </div>
        </IonList>
      </IonContent>
    </>
  );
}
