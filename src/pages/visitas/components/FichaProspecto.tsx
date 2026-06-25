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
  IonButtons,
  IonButton,
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonText,
  IonSpinner,
  IonActionSheet,
} from '@ionic/react';
import { useEffect, useMemo, useState } from 'react';
import { CICLO_OBJETIVO } from '../../../lib/prospectos';
import { ConnectivityStrip } from '../../../components/ui/ConnectivityStrip';
import { DiaVisitaSelect } from '../../../components/ui/DiaVisitaSelect';
import { Card } from '../../../components/ui/Card';
import { Chip } from '../../../components/ui/Chip';
import { CicloBar } from '../../../components/ui/CicloBar';
import { PrimaryCTA } from '../../../components/ui/PrimaryCTA';
import type { RegistrarVisitaArgs } from '../../../hooks/useSeguimiento';
import type { PedidoPendienteVista } from '../../../lib/pedidos';
import type { Cliente, Visita } from '../../../db/schema';

interface FichaProspectoProps {
  cliente: Cliente;
  cargarVisitas: (clienteId: string) => Promise<Visita[]>;
  onRegistrar: (args: RegistrarVisitaArgs) => Promise<unknown>;
  /** Reprograma la próxima visita (H-09) sin registrar visita ni avanzar ciclo. */
  onReprogramar?: (fechaProxima: string) => Promise<unknown>;
  /** Fija/cambia el día de visita semanal del cliente (texto o null). */
  onCambiarDia?: (dia: string | null) => Promise<unknown>;
  /** Abre el cobro de saldo previo del cliente (Flujo C · P3). */
  onCobrarSaldo?: () => void;
  /** Carga los pedidos pendientes del cliente (H-05). */
  cargarPedidos?: (clienteId: string) => Promise<PedidoPendienteVista[]>;
  /** Entrega un pedido pendiente: lo convierte en venta y lo cierra (H-05). */
  onEntregarPedido?: (pedidoId: string) => Promise<unknown>;
  onClose: () => void;
}

/** ISO date (local) desplazada `n` días desde hoy. */
function fechaRelativa(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function FichaProspecto({
  cliente,
  cargarVisitas,
  onRegistrar,
  onReprogramar,
  onCambiarDia,
  onCobrarSaldo,
  cargarPedidos,
  onEntregarPedido,
  onClose,
}: FichaProspectoProps) {
  const [reprogOpen, setReprogOpen] = useState(false);
  const [diaRuta, setDiaRuta] = useState<string | null>(cliente.dia_ruta ?? null);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [loading, setLoading] = useState(true);
  const [nota, setNota] = useState('');
  const [siguientePaso, setSiguientePaso] = useState('');
  const [fechaProxima, setFechaProxima] = useState('');
  const [saving, setSaving] = useState(false);
  const [pedidos, setPedidos] = useState<PedidoPendienteVista[]>([]);
  const [entregando, setEntregando] = useState<string | null>(null);

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

  useEffect(() => {
    if (!cargarPedidos) return;
    let activo = true;
    cargarPedidos(cliente.id).then((ps) => {
      if (activo) setPedidos(ps);
    });
    return () => {
      activo = false;
    };
  }, [cliente.id, cargarPedidos]);

  const entregarPedido = async (pedidoId: string) => {
    if (!onEntregarPedido) return;
    setEntregando(pedidoId);
    try {
      await onEntregarPedido(pedidoId);
      setPedidos((prev) => prev.filter((p) => p.id !== pedidoId));
    } finally {
      setEntregando(null);
    }
  };

  const etapa = Math.min(cliente.ciclo_visita, CICLO_OBJETIVO);

  // Visitas ordenadas de la más reciente a la más antigua.
  const previas = useMemo(
    () => [...visitas].sort((a, b) => b.numero_ciclo - a.numero_ciclo),
    [visitas]
  );
  // Siguiente paso vigente = el de la última visita registrada.
  const pasoVigente = previas.find((v) => v.siguiente_paso)?.siguiente_paso;

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

  const handleReprogramar = async (fecha: string) => {
    if (!onReprogramar) return;
    await onReprogramar(fecha);
    onClose();
  };

  const handleCambiarDia = async (dia: string | null) => {
    setDiaRuta(dia);
    if (onCambiarDia) await onCambiarDia(dia);
  };

  return (
    <>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonButtons slot="start">
            <IonButton onClick={onClose} style={{ color: 'var(--color-cyan)', fontSize: '15px', fontWeight: 700 }}>
              ‹ Prospectos
            </IonButton>
          </IonButtons>
          <IonButtons slot="end" style={{ marginRight: 'var(--space-sm)' }}>
            <Chip tone={cliente.estado === 'prospecto' ? 'amber' : 'menudeo'}>
              {cliente.estado === 'prospecto' ? 'Prospecto' : 'Cliente'}
            </Chip>
          </IonButtons>
        </IonToolbar>
        <ConnectivityStrip />
      </IonHeader>

      <IonContent>
        <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Identidad */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <Chip tone={cliente.tipo === 'mayoreo' ? 'mayoreo' : 'menudeo'}>
                {cliente.tipo === 'mayoreo' ? 'Mayoreo' : 'Menudeo'}
              </Chip>
              <Chip tone="neutral">Prospecto</Chip>
              {cliente.fecha_proxima_visita && (
                <Chip tone="neutral">Próxima: {cliente.fecha_proxima_visita}</Chip>
              )}
            </div>
            <div style={{ fontSize: '27px', fontWeight: 800, color: 'var(--color-navy)', marginTop: '11px', lineHeight: 1.1, letterSpacing: '-0.3px' }}>
              {cliente.nombre}
            </div>
            {diaRuta && (
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                Día de ruta · {diaRuta}
              </div>
            )}
          </div>

          {/* Tarjeta de ciclo */}
          <Card padding="16px" style={{ borderRadius: '16px', boxShadow: '0 1px 2px rgba(16,24,40,.04)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#8A94A6' }}>
                Ciclo de visitas
              </span>
              <span className="numeric" style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-navy)' }}>
                Visita {etapa} <span style={{ color: '#9AA4B6' }}>de {CICLO_OBJETIVO}</span>
              </span>
            </div>
            <div style={{ marginTop: '13px' }}>
              <CicloBar actual={etapa} objetivo={CICLO_OBJETIVO} block />
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: '12px', lineHeight: 1.4 }}>
              La mayoría compra en la 3.ª o 4.ª visita. Cada visita acerca el cierre.
            </div>
          </Card>

          {/* Día de visita semanal: el vendedor decide qué día visitarlo. */}
          {onCambiarDia && (
            <Card padding="6px 14px">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-body)' }}>
                  Día de visita
                </span>
                <DiaVisitaSelect value={diaRuta} onChange={handleCambiarDia} />
              </div>
            </Card>
          )}

          {/* Reprogramar próxima visita (H-09) */}
          {onReprogramar && (
            <button
              type="button"
              onClick={() => setReprogOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                minHeight: '46px',
                width: '100%',
                border: '1.5px solid var(--color-primary)',
                borderRadius: '12px',
                background: 'var(--color-surface)',
                color: 'var(--color-primary)',
                fontSize: '15px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              ↻ Reprogramar próxima visita
            </button>
          )}

          {/* Cobrar saldo previo (Flujo C · P3) */}
          {onCobrarSaldo && (
            <button
              type="button"
              onClick={onCobrarSaldo}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                minHeight: '46px',
                width: '100%',
                border: 'none',
                borderRadius: '12px',
                background: 'var(--color-primary)',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: 'var(--shadow-cta)',
              }}
            >
              Cobrar saldo
            </button>
          )}

          {/* Pedidos pendientes (H-05): entregar = convertir en venta */}
          {pedidos.length > 0 && (
            <div>
              <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#8A94A6', marginBottom: '8px' }}>
                Pedidos pendientes · {pedidos.length}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pedidos.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      border: '1.5px solid var(--color-primary-line)',
                      background: 'var(--color-primary-bg)',
                      borderRadius: '14px',
                      padding: '12px 13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <span className="numeric" style={{ minWidth: '28px', fontSize: '15px', fontWeight: 800, color: 'var(--color-primary)' }}>
                      {p.cantidad}×
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-body)' }}>{p.nombre}</div>
                      {p.fecha_compromiso && (
                        <div className="numeric" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          entrega {p.fecha_compromiso}
                        </div>
                      )}
                    </div>
                    {onEntregarPedido && (
                      <button
                        type="button"
                        onClick={() => entregarPedido(p.id)}
                        disabled={entregando === p.id}
                        style={{
                          flex: 'none',
                          minHeight: '44px',
                          padding: '0 15px',
                          border: 'none',
                          borderRadius: '12px',
                          background: 'var(--color-primary)',
                          color: '#fff',
                          fontSize: '14.5px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          opacity: entregando === p.id ? 0.7 : 1,
                        }}
                      >
                        {entregando === p.id ? 'Entregando…' : 'Entregar'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: '8px' }}>
                Al entregar, el pedido se convierte en venta y se cierra.
              </div>
            </div>
          )}

          {/* Siguiente paso acordado */}
          {pasoVigente && (
            <div style={{ background: 'var(--color-primary-bg)', border: '1.5px solid var(--color-primary-line)', borderRadius: '16px', padding: '15px' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--color-primary)' }}>
                Siguiente paso acordado
              </div>
              <div style={{ fontSize: '16.5px', fontWeight: 700, color: '#101B3D', marginTop: '7px', lineHeight: 1.32 }}>
                {pasoVigente}
              </div>
            </div>
          )}

          {/* Notas previas (timeline) */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#8A94A6', marginBottom: '10px' }}>
              Notas previas
            </div>

            {loading && (
              <div style={{ textAlign: 'center', padding: 'var(--space-md)' }}>
                <IonSpinner name="crescent" />
              </div>
            )}

            {!loading && previas.length === 0 && (
              <IonText color="medium">
                <p style={{ fontSize: 'var(--font-size-sm)', margin: 0 }}>Sin visitas registradas aún.</p>
              </IonText>
            )}

            {!loading &&
              previas.map((v, idx) => {
                const ultima = idx === 0;
                return (
                  <div key={v.id} style={{ display: 'flex', gap: '11px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: ultima ? 'var(--color-navy)' : '#C7CED9', flex: 'none' }} />
                      {idx < previas.length - 1 && (
                        <span style={{ width: '2px', flex: 1, background: '#E1E5EC', margin: '3px 0' }} />
                      )}
                    </div>
                    <div style={{ paddingBottom: '14px', minWidth: 0 }}>
                      <div className="numeric" style={{ fontSize: '13px', fontWeight: 800, color: ultima ? 'var(--color-navy)' : '#5B6678' }}>
                        Visita {v.numero_ciclo} · {v.fecha}
                      </div>
                      {v.nota && (
                        <div style={{ fontSize: '14.5px', fontWeight: 500, color: ultima ? 'var(--color-body)' : '#3A4150', marginTop: '3px', lineHeight: 1.4 }}>
                          {v.nota}
                        </div>
                      )}
                      {v.siguiente_paso && (
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: '3px' }}>
                          Siguiente paso: {v.siguiente_paso}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Registrar visita */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#8A94A6', marginBottom: '8px' }}>
              Registrar visita
            </div>
            <Card padding="4px 14px">
              <IonItem lines="full" style={{ '--background': 'transparent', '--padding-start': '0' }}>
                <IonLabel position="stacked">¿Qué hablaron?</IonLabel>
                <IonTextarea
                  value={nota}
                  onIonInput={(e) => setNota(e.detail.value ?? '')}
                  autoGrow
                  placeholder="Nota de lo hablado en la visita"
                />
              </IonItem>
              <IonItem lines="full" style={{ '--background': 'transparent', '--padding-start': '0' }}>
                <IonLabel position="stacked">Siguiente paso acordado</IonLabel>
                <IonInput
                  value={siguientePaso}
                  onIonInput={(e) => setSiguientePaso(e.detail.value ?? '')}
                  placeholder="Ej. Llevar muestra de 1 L"
                />
              </IonItem>
              <IonItem lines="none" style={{ '--background': 'transparent', '--padding-start': '0' }}>
                <IonLabel position="stacked">Fecha de la próxima visita</IonLabel>
                <IonInput
                  type="date"
                  value={fechaProxima}
                  onIonInput={(e) => setFechaProxima(e.detail.value ?? '')}
                />
              </IonItem>
            </Card>
          </div>
        </div>
      </IonContent>

      <div style={{ padding: '14px var(--space-md) 22px', background: 'var(--color-bg)', borderTop: '1px solid var(--color-divider)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-amber)', display: 'inline-block' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            Se guarda sin conexión y avanza a visita {etapa + 1} de {CICLO_OBJETIVO}.
          </span>
        </div>
        <PrimaryCTA loading={saving} disabled={saving} onClick={handleRegistrar}>
          {saving ? 'Guardando…' : 'Guardar visita'}
        </PrimaryCTA>
      </div>

      <IonActionSheet
        isOpen={reprogOpen}
        onDidDismiss={() => setReprogOpen(false)}
        header="Reprogramar próxima visita"
        buttons={[
          { text: 'Para hoy', handler: () => { handleReprogramar(fechaRelativa(0)); } },
          { text: 'Mañana', handler: () => { handleReprogramar(fechaRelativa(1)); } },
          { text: 'En 1 semana', handler: () => { handleReprogramar(fechaRelativa(7)); } },
          { text: 'Cancelar', role: 'cancel' },
        ]}
      />
    </>
  );
}
