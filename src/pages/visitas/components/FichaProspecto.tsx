/**
 * Logiclean Ruta — FichaProspecto (modal) · H-01
 *
 * Muestra el punto del prospecto en el ciclo ("Visita N de 4"), las notas de
 * visitas previas y el siguiente paso; permite registrar una visita (nota,
 * siguiente paso, próxima fecha), que avanza el ciclo.
 */

import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonList,
  IonListHeader,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonNote,
  IonText,
  IonBadge,
  IonSpinner,
} from '@ionic/react';
import { useEffect, useState } from 'react';
import { CICLO_OBJETIVO } from '../../../lib/prospectos';
import type { RegistrarVisitaArgs } from '../../../hooks/useSeguimiento';
import type { Cliente, Visita } from '../../../db/schema';

interface FichaProspectoProps {
  cliente: Cliente;
  cargarVisitas: (clienteId: string) => Promise<Visita[]>;
  onRegistrar: (args: RegistrarVisitaArgs) => Promise<unknown>;
  onClose: () => void;
}

export function FichaProspecto({
  cliente,
  cargarVisitas,
  onRegistrar,
  onClose,
}: FichaProspectoProps) {
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [loading, setLoading] = useState(true);
  const [nota, setNota] = useState('');
  const [siguientePaso, setSiguientePaso] = useState('');
  const [fechaProxima, setFechaProxima] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let activo = true;
    cargarVisitas(cliente.id).then((vs) => {
      if (activo) {
        setVisitas(vs);
        setLoading(false);
      }
    });
    return () => {
      activo = false;
    };
  }, [cliente.id, cargarVisitas]);

  const etapa = Math.min(cliente.ciclo_visita, CICLO_OBJETIVO);

  const handleRegistrar = async () => {
    setSaving(true);
    try {
      await onRegistrar({
        cliente,
        nota: nota || undefined,
        siguientePaso: siguientePaso || undefined,
        fechaProxima: fechaProxima || undefined,
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
          <IonTitle>{cliente.nombre}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose} style={{ color: 'var(--color-on-dark)' }}>
              Cerrar
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {/* Punto del ciclo */}
        <div style={{ padding: 'var(--space-md)' }}>
          <IonBadge style={{ backgroundColor: 'var(--color-primary)' }}>
            Visita {etapa} de {CICLO_OBJETIVO}
          </IonBadge>
          <div style={{ marginTop: 'var(--space-sm)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            {cliente.tipo}
            {cliente.dia_ruta && <> · día de ruta: {cliente.dia_ruta}</>}
            {cliente.fecha_proxima_visita && (
              <> · próxima: {cliente.fecha_proxima_visita}</>
            )}
          </div>
        </div>

        {/* Historial de visitas */}
        <IonList>
          <IonListHeader>
            <IonLabel>Visitas previas</IonLabel>
          </IonListHeader>

          {loading && (
            <div style={{ textAlign: 'center', padding: 'var(--space-md)' }}>
              <IonSpinner name="crescent" />
            </div>
          )}

          {!loading && visitas.length === 0 && (
            <IonItem lines="none">
              <IonNote>Sin visitas registradas aún.</IonNote>
            </IonItem>
          )}

          {!loading &&
            visitas.map((v) => (
              <IonItem key={v.id}>
                <IonLabel className="ion-text-wrap">
                  <h3 style={{ color: 'var(--color-navy)' }}>
                    Visita {v.numero_ciclo} · {v.fecha}
                  </h3>
                  {v.nota && <p style={{ fontSize: 'var(--font-size-sm)' }}>{v.nota}</p>}
                  {v.siguiente_paso && (
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                      Siguiente paso: {v.siguiente_paso}
                    </p>
                  )}
                </IonLabel>
              </IonItem>
            ))}
        </IonList>

        {/* Registrar visita */}
        <IonList>
          <IonListHeader>
            <IonLabel>Registrar visita</IonLabel>
          </IonListHeader>

          <IonItem>
            <IonLabel position="stacked">Nota de lo hablado</IonLabel>
            <IonTextarea
              value={nota}
              onIonInput={(e) => setNota(e.detail.value ?? '')}
              autoGrow
              placeholder="¿Qué se habló en la visita?"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Siguiente paso acordado</IonLabel>
            <IonInput
              value={siguientePaso}
              onIonInput={(e) => setSiguientePaso(e.detail.value ?? '')}
              placeholder="Ej. Llevar muestra de 1 L"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Fecha de la próxima visita</IonLabel>
            <IonInput
              type="date"
              value={fechaProxima}
              onIonInput={(e) => setFechaProxima(e.detail.value ?? '')}
            />
          </IonItem>

          <div style={{ padding: 'var(--space-md)' }}>
            <IonButton
              expand="block"
              disabled={saving}
              style={{ '--background': 'var(--color-primary)' }}
              onClick={handleRegistrar}
            >
              {saving ? <IonSpinner name="crescent" /> : 'Registrar visita y avanzar ciclo'}
            </IonButton>
            <IonText color="medium">
              <p style={{ fontSize: 'var(--font-size-xs)', textAlign: 'center' }}>
                El contador pasará a visita {etapa + 1} de {CICLO_OBJETIVO}.
              </p>
            </IonText>
          </div>
        </IonList>
      </IonContent>
    </>
  );
}
