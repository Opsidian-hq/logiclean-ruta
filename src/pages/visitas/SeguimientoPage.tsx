/**
 * Logiclean Ruta — SeguimientoPage (P7 · P8) · registrar visita de prospecto
 *
 * Página dedicada del rediseño de Visitas para registrar una visita de
 * seguimiento: nota de lo hablado, siguiente paso acordado y próxima visita.
 * Al guardar avanza el ciclo (N → N+1), actualiza `fecha_proxima_visita` y queda
 * en la cola de sync. Cierra con la pantalla de éxito (ciclo avanzado).
 *
 * Ruta: /seguimiento/:clienteId
 */

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonButton,
  IonContent,
  IonFooter,
  IonSpinner,
  IonIcon,
} from '@ionic/react';
import { useState } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { arrowBackOutline, checkmarkOutline, calendarOutline } from 'ionicons/icons';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { ConnectivityStrip } from '../../components/ui/ConnectivityStrip';
import { ClienteAvatar } from '../../components/ui/ClienteAvatar';
import { PrimaryCTA } from '../../components/ui/PrimaryCTA';
import { useClientes } from '../../hooks/useClientes';
import { useSeguimiento } from '../../hooks/useSeguimiento';
import { CICLO_OBJETIVO } from '../../lib/prospectos';

/** ISO date (local) desplazada `n` días desde hoy. */
function fechaRelativa(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const fechaCorta = (iso: string) =>
  new Date(iso + 'T00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

const cardHead = {
  padding: '12px 16px',
  background: '#FAFBFF',
  borderBottom: '1px solid var(--color-border)',
  fontSize: '11px',
  fontWeight: 800 as const,
  letterSpacing: '0.6px',
  textTransform: 'uppercase' as const,
  color: 'var(--color-text-secondary)',
};

const cardWrap = {
  border: '1px solid var(--color-border)',
  borderRadius: '16px',
  overflow: 'hidden' as const,
  background: 'var(--color-surface)',
};

export function SeguimientoPage() {
  const { clienteId } = useParams<{ clienteId: string }>();
  const history = useHistory();
  const { clientes } = useClientes();
  const { registrarVisita } = useSeguimiento();
  const cliente = clientes.find((c) => c.id === clienteId) ?? null;

  const [nota, setNota] = useState('');
  const [siguientePaso, setSiguientePaso] = useState('');
  const [fechaProxima, setFechaProxima] = useState(fechaRelativa(7));
  const [saving, setSaving] = useState(false);
  const [hecho, setHecho] = useState(false);

  if (!cliente) {
    return (
      <IonPage>
        <Cabecera titulo="Registrar visita" onBack={() => history.goBack()} />
        <IonContent>
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <IonSpinner name="crescent" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  const etapa = Math.min(cliente.ciclo_visita, CICLO_OBJETIVO);
  const siguienteEtapa = Math.min(etapa + 1, CICLO_OBJETIVO);
  const pctNuevo = Math.round((siguienteEtapa / CICLO_OBJETIVO) * 100);

  const guardar = async () => {
    setSaving(true);
    try {
      await registrarVisita({
        cliente,
        nota: nota || undefined,
        siguientePaso: siguientePaso || undefined,
        fechaProxima: fechaProxima || undefined,
      });
      setHecho(true);
    } finally {
      setSaving(false);
    }
  };

  const volverARuta = () =>
    history.push({ pathname: '/visitas', state: { toast: 'Visita registrada en la ruta' } });

  // ── P8 · Éxito de seguimiento ──
  if (hecho) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
            <span style={{ fontSize: '18px', fontWeight: 800, color: '#fff', paddingLeft: 'var(--space-md)' }}>Visita registrada</span>
            <IonButtons slot="end" style={{ marginRight: 'var(--space-sm)' }}>
              <SyncStatusBadge />
            </IonButtons>
          </IonToolbar>
          <ConnectivityStrip text="En línea · sincronizado hace un momento" />
        </IonHeader>
        <IonContent>
          <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: '#E6FAD8', borderRadius: '16px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '46px', height: '46px', borderRadius: '14px', background: 'var(--color-lime)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: 'var(--color-navy)' }}>
                <IonIcon icon={checkmarkOutline} style={{ fontSize: '24px' }} />
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-navy)' }}>Seguimiento guardado</div>
                <div style={{ fontSize: '12.5px', color: '#3D7A00', marginTop: '3px' }}>Guardado ✓ · Sincronizado ✓</div>
              </div>
            </div>

            <div style={{ ...cardWrap, padding: '16px' }}>
              <div style={{ background: 'var(--color-primary-bg)', borderRadius: '11px', padding: '12px 14px' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#1E40AF', marginBottom: '7px' }}>
                  Visita {siguienteEtapa} de {CICLO_OBJETIVO}
                </div>
                <div style={{ background: 'var(--color-primary-line)', borderRadius: '4px', height: '7px', marginBottom: '6px' }}>
                  <div style={{ background: 'var(--color-primary)', borderRadius: '4px', height: '7px', width: `${pctNuevo}%` }} />
                </div>
                <div style={{ fontSize: '12px', color: '#3B82F6' }}>{pctNuevo}% del ciclo completado</div>
              </div>
            </div>

            <div style={{ background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary-line)', borderRadius: '14px', padding: '14px 16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <IonIcon icon={calendarOutline} style={{ fontSize: '15px' }} /> Próxima visita programada
              </div>
              <div style={{ fontSize: '12px', color: '#3B82F6', marginTop: '4px' }}>
                {fechaProxima ? `${fechaCorta(fechaProxima)} · se reflejará en la ruta de ese día` : 'sin fecha agendada'}
              </div>
            </div>
          </div>
        </IonContent>
        <IonFooter>
          <IonToolbar style={{ '--background': 'var(--color-bg)' }}>
            <div style={{ padding: 'var(--space-sm) var(--space-md) var(--space-md)' }}>
              <PrimaryCTA onClick={volverARuta}>VOLVER A LA RUTA</PrimaryCTA>
            </div>
          </IonToolbar>
        </IonFooter>
      </IonPage>
    );
  }

  // ── P7 · Registrar visita ──
  return (
    <IonPage>
      <Cabecera titulo="Registrar visita" onBack={() => history.push(`/clientes/${clienteId}`)} />
      <IonContent>
        <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Cliente */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ClienteAvatar nombre={cliente.nombre} size={40} />
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-navy)' }}>{cliente.nombre}</div>
              <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                Prospecto · Visita {etapa} de {CICLO_OBJETIVO}
              </div>
            </div>
          </div>

          {/* Nota */}
          <div style={cardWrap}>
            <div style={cardHead}>¿Qué se habló en esta visita?</div>
            <div style={{ padding: '14px 16px' }}>
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Notas de la conversación..."
                style={{ width: '100%', minHeight: '80px', border: '1.5px solid var(--color-border)', borderRadius: '10px', padding: '12px', fontSize: '14px', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }}
              />
            </div>
          </div>

          {/* Siguiente paso */}
          <div style={cardWrap}>
            <div style={cardHead}>Siguiente paso acordado</div>
            <div style={{ padding: '14px 16px' }}>
              <input
                type="text"
                value={siguientePaso}
                onChange={(e) => setSiguientePaso(e.target.value)}
                placeholder="Ej. Llevar muestra de blanqueador"
                style={{ width: '100%', border: '1.5px solid var(--color-border)', borderRadius: '10px', padding: '12px', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }}
              />
            </div>
          </div>

          {/* Próxima visita */}
          <div style={cardWrap}>
            <div style={cardHead}>Próxima visita</div>
            <div style={{ padding: '14px 16px' }}>
              <input
                type="date"
                value={fechaProxima}
                onChange={(e) => setFechaProxima(e.target.value)}
                style={{ width: '100%', border: '1.5px solid var(--color-primary)', borderRadius: '10px', padding: '12px', fontSize: '14px', color: 'var(--color-navy)', fontWeight: 600, outline: 'none', fontFamily: 'inherit' }}
              />
            </div>
          </div>
        </div>
      </IonContent>
      <IonFooter>
        <IonToolbar style={{ '--background': 'var(--color-bg)' }}>
          <div style={{ padding: 'var(--space-sm) var(--space-md) var(--space-md)' }}>
            <PrimaryCTA loading={saving} disabled={saving} onClick={guardar}>
              {saving ? 'Guardando…' : `Guardar visita · avanzar a ${siguienteEtapa} de ${CICLO_OBJETIVO}`}
            </PrimaryCTA>
          </div>
        </IonToolbar>
      </IonFooter>
    </IonPage>
  );
}

function Cabecera({ titulo, onBack }: { titulo: string; onBack: () => void }) {
  return (
    <IonHeader>
      <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
        <IonButtons slot="start">
          <IonButton onClick={onBack} style={{ color: 'var(--color-cyan)', fontSize: '15px', fontWeight: 700 }}>
            <IonIcon icon={arrowBackOutline} style={{ fontSize: '18px', marginRight: '4px' }} /> Perfil
          </IonButton>
        </IonButtons>
        <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: '17px', fontWeight: 700, color: '#fff', pointerEvents: 'none' }}>{titulo}</span>
        <IonButtons slot="end" style={{ marginRight: 'var(--space-sm)' }}>
          <SyncStatusBadge />
        </IonButtons>
      </IonToolbar>
      <ConnectivityStrip text="Se guarda en el equipo al instante" />
    </IonHeader>
  );
}
