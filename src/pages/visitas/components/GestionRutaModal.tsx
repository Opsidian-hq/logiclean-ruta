/**
 * Logiclean Ruta — GestionRutaModal (modal)
 *
 * El vendedor gestiona la ruta de un cliente: fija/cambia su día de visita
 * semanal (`dia_ruta`) y, opcionalmente, reprograma su próxima visita. Sirve
 * para cualquier cliente (activo o prospecto), no sólo para los de la ficha de
 * seguimiento.
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
  IonText,
} from '@ionic/react';
import { useState } from 'react';
import { PrimaryCTA } from '../../../components/ui/PrimaryCTA';
import { DiaVisitaSelect } from '../../../components/ui/DiaVisitaSelect';
import type { Cliente } from '../../../db/schema';

interface GestionRutaModalProps {
  cliente: Cliente;
  onGuardar: (args: { diaRuta: string | null; fechaProxima?: string }) => Promise<unknown>;
  onClose: () => void;
}

/** ISO date (local) desplazada `n` días desde hoy. */
function fechaRelativa(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function GestionRutaModal({ cliente, onGuardar, onClose }: GestionRutaModalProps) {
  const [diaRuta, setDiaRuta] = useState<string | null>(cliente.dia_ruta ?? null);
  const [fechaProxima, setFechaProxima] = useState<string>(cliente.fecha_proxima_visita ?? '');
  const [saving, setSaving] = useState(false);

  const handleGuardar = async () => {
    setSaving(true);
    try {
      await onGuardar({
        diaRuta,
        fechaProxima: fechaProxima || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const atajos: { label: string; dias: number }[] = [
    { label: 'Hoy', dias: 0 },
    { label: 'Mañana', dias: 1 },
    { label: 'En 1 semana', dias: 7 },
  ];

  return (
    <>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonTitle>Gestionar visita</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose} style={{ color: 'var(--color-on-dark)' }}>
              Cancelar
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div style={{ padding: 'var(--space-md) var(--space-md) 0' }}>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-navy)', lineHeight: 1.1 }}>
            {cliente.nombre}
          </div>
        </div>

        <IonList>
          <IonItem>
            <IonLabel position="stacked">Día de visita</IonLabel>
            <DiaVisitaSelect value={diaRuta} onChange={setDiaRuta} />
          </IonItem>
          <IonText color="medium">
            <p style={{ marginLeft: 'var(--space-md)', marginRight: 'var(--space-md)', fontSize: 'var(--font-size-sm)' }}>
              Este cliente aparecerá en tu ruta el día que elijas. "Sin día fijo" lo
              deja fuera de la ruta recurrente.
            </p>
          </IonText>

          <IonItem>
            <IonLabel position="stacked">Próxima visita</IonLabel>
            <IonInput
              type="date"
              value={fechaProxima}
              onIonInput={(e) => setFechaProxima(e.detail.value ?? '')}
            />
          </IonItem>
          <div style={{ display: 'flex', gap: '8px', padding: '6px var(--space-md) 0', flexWrap: 'wrap' }}>
            {atajos.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => setFechaProxima(fechaRelativa(a.dias))}
                style={{
                  minHeight: '36px',
                  padding: '0 12px',
                  border: '1.5px solid var(--color-primary)',
                  borderRadius: '10px',
                  background: 'var(--color-surface)',
                  color: 'var(--color-primary)',
                  fontSize: '13.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {a.label}
              </button>
            ))}
          </div>

          <div style={{ padding: 'var(--space-md)' }}>
            <PrimaryCTA loading={saving} disabled={saving} onClick={handleGuardar}>
              {saving ? 'Guardando…' : 'Guardar'}
            </PrimaryCTA>
          </div>
        </IonList>
      </IonContent>
    </>
  );
}
