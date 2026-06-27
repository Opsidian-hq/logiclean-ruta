/**
 * Logiclean Ruta — NuevoProspectoForm (modal) · H-01
 *
 * Alta rápida de prospecto. Queda en "visita 1 de 4" con la fecha indicada
 * (hoy por defecto) como su primera próxima visita.
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
import type { CrearProspectoArgs } from '../../../hooks/useSeguimiento';

interface NuevoProspectoFormProps {
  onCrear: (args: CrearProspectoArgs) => Promise<unknown>;
  onClose: () => void;
}

export function NuevoProspectoForm({ onCrear, onClose }: NuevoProspectoFormProps) {
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<'mayoreo' | 'menudeo'>('menudeo');
  const [diaRuta, setDiaRuta] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const nombreInvalido = touched && !nombre.trim();
  // Sin día de ruta el prospecto no entra en la ruta recurrente (HOY/SEMANA),
  // así que se exige al darlo de alta (D-003).
  const diaRutaInvalido = touched && !diaRuta.trim();

  const handleCrear = async () => {
    setTouched(true);
    if (!nombre.trim() || !diaRuta.trim()) return;
    setSaving(true);
    try {
      await onCrear({
        nombre,
        tipo,
        dia_ruta: diaRuta || undefined,
        fecha,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonTitle>Nuevo prospecto</IonTitle>
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
              placeholder="Nombre del prospecto"
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
            <IonLabel position="stacked">Día de ruta *</IonLabel>
            <IonInput
              value={diaRuta}
              onIonInput={(e) => setDiaRuta(e.detail.value ?? '')}
              placeholder="Ej. Lunes"
            />
          </IonItem>
          {diaRutaInvalido ? (
            <IonText color="danger">
              <p style={{ marginLeft: 'var(--space-md)', fontSize: 'var(--font-size-sm)' }}>
                El día de ruta es obligatorio
              </p>
            </IonText>
          ) : (
            <IonText color="medium">
              <p style={{ marginLeft: 'var(--space-md)', marginRight: 'var(--space-md)', fontSize: 'var(--font-size-sm)' }}>
                Sin día de ruta el prospecto no aparecerá en tu lista de visitas.
              </p>
            </IonText>
          )}

          <IonItem>
            <IonLabel position="stacked">Primera visita</IonLabel>
            <IonInput
              type="date"
              value={fecha}
              onIonInput={(e) => setFecha(e.detail.value ?? '')}
            />
          </IonItem>

          <div style={{ padding: 'var(--space-md)' }}>
            <PrimaryCTA loading={saving} disabled={saving} onClick={handleCrear}>
              {saving ? 'Guardando…' : 'Crear prospecto'}
            </PrimaryCTA>
          </div>
        </IonList>
      </IonContent>
    </>
  );
}
