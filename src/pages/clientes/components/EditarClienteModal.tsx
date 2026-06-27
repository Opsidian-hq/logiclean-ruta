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
  IonSelect,
  IonSelectOption,
  IonText,
} from '@ionic/react';
import { useState } from 'react';
import { PrimaryCTA } from '../../../components/ui/PrimaryCTA';
import { DiaVisitaSelect } from '../../../components/ui/DiaVisitaSelect';
import { guardarCliente } from '../../../lib/clientes';
import type { Cliente } from '../../../db/schema';

interface EditarClienteModalProps {
  cliente: Cliente;
  onGuardado: () => Promise<void>;
  onClose: () => void;
}

function fechaRelativa(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function EditarClienteModal({ cliente, onGuardado, onClose }: EditarClienteModalProps) {
  const [nombre, setNombre] = useState(cliente.nombre);
  const [tipo, setTipo] = useState<'mayoreo' | 'menudeo'>(cliente.tipo);
  const [diaRuta, setDiaRuta] = useState<string | null>(cliente.dia_ruta ?? null);
  const [fechaProxima, setFechaProxima] = useState(cliente.fecha_proxima_visita ?? '');
  const [saving, setSaving] = useState(false);
  const [errorNombre, setErrorNombre] = useState('');

  const handleGuardar = async () => {
    if (!nombre.trim()) {
      setErrorNombre('El nombre es obligatorio');
      return;
    }
    setErrorNombre('');
    setSaving(true);
    try {
      await guardarCliente({
        ...cliente,
        nombre: nombre.trim(),
        tipo,
        dia_ruta: diaRuta ?? undefined,
        fecha_proxima_visita: fechaProxima || undefined,
      });
      await onGuardado();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const atajos = [
    { label: 'Hoy', dias: 0 },
    { label: 'Mañana', dias: 1 },
    { label: 'En 1 semana', dias: 7 },
  ];

  return (
    <>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonTitle>Editar cliente</IonTitle>
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
            <IonLabel position="stacked">Nombre</IonLabel>
            <IonInput
              value={nombre}
              onIonInput={(e) => setNombre(e.detail.value ?? '')}
              placeholder="Nombre del cliente"
            />
          </IonItem>
          {errorNombre && (
            <IonText color="danger">
              <p style={{ marginLeft: 'var(--space-md)', fontSize: 'var(--font-size-sm)' }}>{errorNombre}</p>
            </IonText>
          )}

          <IonItem>
            <IonLabel position="stacked">Tipo de cliente</IonLabel>
            <IonSelect
              value={tipo}
              onIonChange={(e) => setTipo(e.detail.value)}
            >
              <IonSelectOption value="mayoreo">Mayoreo</IonSelectOption>
              <IonSelectOption value="menudeo">Menudeo</IonSelectOption>
            </IonSelect>
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Día de visita</IonLabel>
            <DiaVisitaSelect value={diaRuta} onChange={setDiaRuta} />
          </IonItem>

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
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </PrimaryCTA>
          </div>
        </IonList>
      </IonContent>
    </>
  );
}
