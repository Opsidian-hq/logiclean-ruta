/**
 * Logiclean Ruta — Paso 2 · Cierre con La Moderna (H-20)
 *
 * Adeudo = (recibido − devuelto) × precio preferencial (ADR-0009), leído de
 * `negocioInsumos` (Inc 7.4) — no se recalcula aquí. La identidad de control
 * (Inc 6) se lee tal cual; si no cuadra, bloquea el avance sin
 * reconocimiento explícito. El acopio hacia La Moderna reusa la mutación de
 * `lib/movimientoLaModerna.ts` (Inc 6.2) tal cual.
 */

import { IonIcon, IonCheckbox, IonSpinner, IonBadge } from '@ionic/react';
import { alertOutline, cubeOutline, timeOutline, cloudOfflineOutline } from 'ionicons/icons';
import { useMemo, useState, useEffect } from 'react';
import { calcularCorte } from '../../../domain/corte';
import type { VendedorEntrada, NegocioEntrada } from '../../../domain/corte';
import type { IdentidadControlProducto } from '../../../lib/corte';
import type { ReconciliacionModerna } from '../../../lib/suministro';
import type { SelladoDisponible } from '../../../lib/corteReparto';
import { Card } from '../../../components/ui/Card';
import { PrimaryCTA } from '../../../components/ui/PrimaryCTA';
import { StepperCantidad } from '../../../components/StepperCantidad';
import { money } from '../../../lib/money';
import { useSyncContext } from '../../../context/SyncContext';
import { sectionLabel, rowBetween } from './styles';

interface PasoLaModernaProps {
  identidadControl: IdentidadControlProducto[];
  moderna: ReconciliacionModerna;
  negocio: NegocioEntrada;
  vendedoresEntrada: VendedorEntrada[];
  reconoceDescuadre: boolean;
  setReconoceDescuadre: (v: boolean) => void;
  selladosDisponibles: SelladoDisponible[];
  acopioSeleccion: Record<string, number>;
  setAcopioCantidad: (productoBaseId: string, cantidad: number) => void;
  totalAcopioSeleccionado: number;
  confirmarAcopio: () => Promise<void>;
  acopioPendiente: boolean;
}

export function PasoLaModerna({
  identidadControl,
  moderna,
  negocio,
  vendedoresEntrada,
  reconoceDescuadre,
  setReconoceDescuadre,
  selladosDisponibles,
  acopioSeleccion,
  setAcopioCantidad,
  totalAcopioSeleccionado,
  confirmarAcopio,
  acopioPendiente,
}: PasoLaModernaProps) {
  const { isOnline, syncStatus, pendingCount, syncNow } = useSyncContext();
  const [mostrarEstadoSync, setMostrarEstadoSync] = useState(false);
  const [calculando, setCalculando] = useState(false);

  const descuadres = identidadControl.filter((ic) => !ic.cuadra);
  const hayDescuadre = descuadres.length > 0;

  const totalSeleccionado = Object.values(acopioSeleccion).reduce((s, c) => s + c, 0);

  // Debounce corto: honra el micro-estado "calculando impacto…" del
  // prototipo aunque el recálculo (invocar de nuevo el motor puro) sea
  // instantáneo — la proyección se marca "sin confirmar" hasta aplicarse.
  useEffect(() => {
    if (totalSeleccionado === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCalculando(false);
      return;
    }
    setCalculando(true);
    const t = setTimeout(() => setCalculando(false), 350);
    return () => clearTimeout(t);
  }, [totalSeleccionado]);

  // Proyección: el mismo motor de dominio, con el adeudo hipotético tras el
  // acopio seleccionado (sin confirmar) — cero regla nueva, misma invocación.
  const proyeccion = useMemo(() => {
    if (totalSeleccionado === 0) return null;
    const negocioProyectado: NegocioEntrada = {
      ...negocio,
      adeudo_la_moderna: Math.max(0, negocio.adeudo_la_moderna - totalAcopioSeleccionado),
    };
    return calcularCorte({ vendedores: vendedoresEntrada, negocio: negocioProyectado });
  }, [totalSeleccionado, totalAcopioSeleccionado, negocio, vendedoresEntrada]);

  const salidaActual = useMemo(
    () => calcularCorte({ vendedores: vendedoresEntrada, negocio }),
    [vendedoresEntrada, negocio]
  );

  const onConfirmarAcopio = async () => {
    await confirmarAcopio();
    setMostrarEstadoSync(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {mostrarEstadoSync && (pendingCount > 0 || syncStatus === 'error' || !isOnline) && (
        <Card
          padding="15px"
          style={{
            border: syncStatus === 'error' ? '1.5px solid #F4B3AC' : '1.5px solid #F6C97C',
            background: syncStatus === 'error' ? '#FDECEA' : '#FEF3E2',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <IonIcon
              icon={syncStatus === 'error' ? cloudOfflineOutline : timeOutline}
              style={{ fontSize: '19px', color: syncStatus === 'error' ? '#D92D20' : '#F79009' }}
            />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: syncStatus === 'error' ? '#911A11' : '#7A3E06' }}>
                {syncStatus === 'error' ? 'No se pudo sincronizar' : 'Acopio registrado'}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: syncStatus === 'error' ? '#B42318' : '#B54708' }}>
                {syncStatus === 'error' ? 'Guardado en el equipo ✓ · Sin subir ✕' : 'Guardado ✓ · pendiente de sincronizar'}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', marginTop: '8px' }}>
            {syncStatus === 'error'
              ? 'Sigue en el equipo; nada se pierde.'
              : 'Se sincroniza sola al recuperar señal, o reintenta a mano.'}
          </div>
          {syncStatus === 'error' && (
            <button
              onClick={() => syncNow()}
              style={{
                marginTop: '10px',
                width: '100%',
                height: '42px',
                borderRadius: '12px',
                border: '1.5px solid #D92D20',
                background: 'transparent',
                color: '#D92D20',
                fontWeight: 800,
                fontSize: '13px',
              }}
            >
              Reintentar ahora
            </button>
          )}
        </Card>
      )}

      <span style={sectionLabel}>Cálculo del adeudo</span>
      <Card padding="13px 15px" style={{ background: 'var(--color-navy)' }}>
        <span style={{ display: 'block', fontSize: '10.5px', fontWeight: 800, letterSpacing: '0.4px', textTransform: 'uppercase', color: '#9FC9FF' }}>
          Adeudo a La Moderna
        </span>
        <span className="numeric" style={{ display: 'block', fontSize: '22px', fontWeight: 800, color: '#fff', marginTop: '3px' }}>
          {money(negocio.adeudo_la_moderna)}
        </span>
      </Card>

      <span style={sectionLabel}>Productos recibidos de La Moderna</span>
      {moderna.porProducto.map((p) => (
        <Card key={p.producto_base_id} padding="9px 12px">
          <span style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--color-navy)' }}>{p.nombre}</span>
          <div style={{ ...rowBetween, marginTop: '5px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>{p.recibido} recib. − {p.devuelto} devuel.</span>
            <span className="numeric" style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--color-primary)' }}>Saldo {p.neto}</span>
          </div>
        </Card>
      ))}

      {hayDescuadre && (
        <>
          <Card padding="15px" style={{ border: '1.5px solid #F4B3AC', background: '#FDECEA' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'var(--color-error)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <IonIcon icon={alertOutline} style={{ color: '#fff', fontSize: '19px' }} />
              </div>
              <span style={{ fontSize: '15.5px', fontWeight: 800, color: '#911A11' }}>Alerta de descuadre</span>
            </div>
            {descuadres.map((ic) => (
              <div key={ic.producto_base_id} style={{ marginTop: '11px', paddingTop: '11px', borderTop: '1px solid #F4B3AC' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#7A1610', marginBottom: '4px' }}>{ic.nombre}</div>
                <div style={rowBetween}>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#7A1610' }}>Recibido − devuelto</span>
                  <span className="numeric" style={{ fontSize: '13px', fontWeight: 800, color: '#911A11' }}>{ic.recibido - ic.devuelto} bidones</span>
                </div>
                <div style={rowBetween}>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#7A1610' }}>Σ bidones abiertos (envasado)</span>
                  <span className="numeric" style={{ fontSize: '13px', fontWeight: 800, color: '#911A11' }}>{ic.bidonesAbiertos} bidones</span>
                </div>
                <div style={{ ...rowBetween, marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #F4B3AC' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#7A1610' }}>Diferencia sin explicar</span>
                  <span className="numeric" style={{ fontSize: '14px', fontWeight: 800, color: '#911A11' }}>{Math.abs(ic.diferencia)} bidones</span>
                </div>
              </div>
            ))}
          </Card>

          <div style={{ border: '1px solid var(--color-card-border)', borderRadius: '12px', background: 'var(--color-surface)', padding: '10px 14px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <IonCheckbox
              checked={reconoceDescuadre}
              onIonChange={(e) => setReconoceDescuadre(e.detail.checked)}
              color="danger"
              style={{ marginTop: '2px' }}
              aria-label="Reconozco el descuadre y continúo"
            />
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-body)', lineHeight: 1.4 }}>
              Reconozco el descuadre de {descuadres.reduce((s, ic) => s + Math.abs(ic.diferencia), 0)} bidones y continúo; queda registrado para revisión de envasado.
            </span>
          </div>
        </>
      )}

      <div style={{ height: '1px', background: 'var(--color-divider)', margin: '2px 0' }} />

      <span style={{ ...sectionLabel, color: 'var(--color-primary)' }}>Acopio hacia La Moderna</span>

      {selladosDisponibles.length === 0 ? (
        <Card padding="26px 20px" style={{ border: '1px dashed #DDE2EA', textAlign: 'center' }}>
          <IonIcon icon={cubeOutline} style={{ fontSize: '34px', color: '#8A94A6' }} />
          <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-navy)', marginTop: '10px' }}>Bodega sin mercancía para devolver</div>
          <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: '6px', lineHeight: 1.4 }}>
            No hay mercancía disponible para devolver en esta bodega. El acopio queda en 0 piezas — el cierre continúa sin devolución.
          </div>
        </Card>
      ) : (
        <>
          <Card padding="12px 13px">
            <div style={{ ...rowBetween, marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-navy)' }}>Mercancía disponible en bodega</span>
              <IonBadge style={{ '--background': 'var(--color-primary-soft)', color: 'var(--color-primary)', fontSize: '12px', fontWeight: 800 }}>
                {selladosDisponibles.reduce((s, p) => s + p.disponibles, 0)} pzas
              </IonBadge>
            </div>
            {selladosDisponibles.map((s) => (
              <div key={s.productoBaseId} style={{ ...rowBetween, minHeight: '44px', borderTop: '1px solid var(--color-divider)', paddingTop: '8px', marginTop: '8px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-body)' }}>
                  {s.nombre} <span style={{ color: '#8A94A6', fontWeight: 600 }}>· {s.disponibles} disp.</span>
                </span>
                <StepperCantidad
                  value={acopioSeleccion[s.productoBaseId] ?? 0}
                  onChange={(v) => setAcopioCantidad(s.productoBaseId, v)}
                  max={s.disponibles}
                />
              </div>
            ))}
            {totalSeleccionado > 0 && (
              <div style={{ ...rowBetween, borderTop: '1px solid var(--color-divider)', marginTop: '6px', paddingTop: '9px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Seleccionaste</span>
                <span className="numeric" style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-primary)' }}>{totalSeleccionado} piezas</span>
              </div>
            )}
          </Card>

          {totalSeleccionado > 0 && (
            <Card padding="14px 15px" style={{ border: '1.5px dashed #A9BBFF', background: '#F6F8FF' }}>
              <IonBadge style={{ '--background': 'var(--color-primary)', color: '#fff', fontSize: '9.5px', fontWeight: 800, letterSpacing: '0.4px', textTransform: 'uppercase', padding: '5px 8px', marginBottom: '10px' }}>
                Proyección · sin confirmar
              </IonBadge>
              {calculando || !proyeccion ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '4px' }}>
                  <IonSpinner name="crescent" style={{ width: '15px', height: '15px' }} />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#3547B0' }}>Calculando impacto…</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginTop: '4px' }}>
                  <div style={rowBetween}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#3547B0' }}>Adeudo baja</span>
                    <span className="numeric" style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--color-navy)' }}>
                      {money(negocio.adeudo_la_moderna)} → {money(Math.max(0, negocio.adeudo_la_moderna - totalAcopioSeleccionado))}
                    </span>
                  </div>
                  <div style={rowBetween}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#3547B0' }}>V sube</span>
                    <span className="numeric" style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--color-navy)' }}>
                      {money(salidaActual.v_remanente)} → {money(proyeccion.v_remanente)}
                    </span>
                  </div>
                  <div style={{ ...rowBetween, background: '#fff', borderRadius: '10px', padding: '9px 11px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#1C4310' }}>Cada vendedor</span>
                    <span className="numeric" style={{ fontSize: '16px', fontWeight: 800, color: '#3E6B22' }}>
                      +{money((proyeccion.t_por_vendedor - salidaActual.t_por_vendedor))}
                    </span>
                  </div>
                </div>
              )}
              <div style={{ marginTop: '11px' }}>
                <PrimaryCTA onClick={onConfirmarAcopio} loading={acopioPendiente} disabled={calculando || acopioPendiente}>
                  Confirmar devolución · {totalSeleccionado} piezas
                </PrimaryCTA>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
