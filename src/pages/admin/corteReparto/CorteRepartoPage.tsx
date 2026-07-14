/**
 * Logiclean Ruta — CorteRepartoPage (H-20, Inc 7.4)
 *
 * Confirmación multi-paso (6 pasos) del corte por reparto. Consume el motor
 * de dominio puro (`src/domain/corte/`, Inc 7.1) y el esquema de negocio
 * (Inc 7.2) vía `useCorteReparto` — esta pantalla renderiza fielmente el
 * resultado, incluidos sus 4 estados de borde; no calcula nada.
 *
 * Reemplaza la pantalla de corte de H-10 (Inc 3): ese cálculo de cierre
 * quedó deprecado por el PRD delta v1.4 (H-20).
 *
 * Ruta: /admin/corte. También se embebe en el modal del FAB de Inicio
 * (mismo patrón que el resto de pantallas de registro de negocio).
 */

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonBackButton,
  IonProgressBar,
  IonSpinner,
  IonFooter,
  IonToast,
  IonText,
  IonAlert,
} from '@ionic/react';
import { useState } from 'react';
import { useAuthContext } from '../../../context/AuthContext';
import { SyncStatusBadge } from '../../../components/SyncStatusBadge';
import { CuentaButton } from '../../../components/CuentaButton';
import { PrimaryCTA } from '../../../components/ui/PrimaryCTA';
import { useCorteReparto, PASOS } from './useCorteReparto';
import { PasoValidacion } from './PasoValidacion';
import { PasoLaModerna } from './PasoLaModerna';
import { PasoObligaciones } from './PasoObligaciones';
import { PasoReparto } from './PasoReparto';
import { PasoLiquidacion } from './PasoLiquidacion';
import { PasoCierre } from './PasoCierre';

interface CorteRepartoPageProps {
  /** Presente cuando la página vive dentro del modal del FAB de Inicio. */
  onClose?: () => void;
}

export function CorteRepartoPage({ onClose }: CorteRepartoPageProps = {}) {
  const { user } = useAuthContext();
  const [toast, setToast] = useState<string | null>(null);
  const [cerrado, setCerrado] = useState(false);
  const [confirmarCierre, setConfirmarCierre] = useState(false);

  const {
    loading,
    error,
    paso,
    setPaso,
    periodoInicio,
    periodoFin,
    vendedores,
    vendedoresEntrada,
    negocioInsumos,
    salida,
    confirmaciones,
    toggleConfirmacion,
    todosConfirmados,
    reconoceDescuadre,
    setReconoceDescuadre,
    selladosDisponibles,
    acopioSeleccion,
    setAcopioCantidad,
    totalAcopioSeleccionado,
    confirmarAcopio,
    acopioPendiente,
    cerrando,
    cerrarCorte,
  } = useCorteReparto(user?.id ?? null);

  const hayDescuadre = negocioInsumos?.identidadControl.some((ic) => !ic.cuadra) ?? false;
  const puedeAvanzarPaso2 = !hayDescuadre || reconoceDescuadre;

  const puedeAvanzar =
    paso === 0 ? todosConfirmados : paso === 1 ? puedeAvanzarPaso2 : true;

  const avanzar = () => {
    if (paso < PASOS.length - 1) {
      setPaso(paso + 1);
      return;
    }
    // El cierre es append-only e irreversible (ADR-0011): exige una
    // confirmación explícita en vez de ejecutarlo directo desde este tap.
    setConfirmarCierre(true);
  };

  const confirmarYCerrar = async () => {
    if (cerrando) return;
    try {
      await cerrarCorte();
      setCerrado(true);
      setToast('Corte cerrado. Queda registrado como evento de cierre del periodo.');
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'No se pudo cerrar el corte.');
    }
  };

  const retroceder = () => {
    if (paso > 0) setPaso(paso - 1);
  };

  const periodoLabel = periodoInicio ? `Periodo ${periodoInicio} – ${periodoFin}` : `Periodo hasta ${periodoFin} · primer corte`;

  return (
    <IonPage>
      <IonHeader style={{ boxShadow: 'none' }}>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonButtons slot="start">
            {onClose ? (
              <IonButton onClick={onClose} style={{ '--color': 'var(--color-cyan)' }}>
                Cerrar
              </IonButton>
            ) : (
              <IonBackButton defaultHref="/admin/dashboard" style={{ '--color': 'var(--color-cyan)' }} />
            )}
          </IonButtons>
          <IonTitle>Corte semanal</IonTitle>
          <IonButtons slot="end" style={{ marginRight: 'var(--space-sm)' }}>
            <SyncStatusBadge showLabel={false} />
            <CuentaButton />
          </IonButtons>
        </IonToolbar>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--min-height': '22px', '--padding-top': '0', '--padding-bottom': '10px' }}>
          <div style={{ display: 'flex', gap: '5px', padding: '0 18px' }}>
            {PASOS.map((p, i) => (
              <IonProgressBar
                key={p}
                value={1}
                style={{
                  height: '4px',
                  borderRadius: '2px',
                  '--progress-background': i < paso ? 'var(--color-lime)' : i === paso ? 'var(--color-primary)' : 'transparent',
                  '--background': i <= paso ? undefined : 'rgba(255,255,255,.18)',
                }}
              />
            ))}
          </div>
        </IonToolbar>
        <IonToolbar style={{ '--background': '#0A2566', '--min-height': '30px' }}>
          <span style={{ color: '#AEBBD6', fontSize: '12.5px', fontWeight: 600, paddingLeft: '4px' }}>
            {periodoLabel} · {vendedores.length} vendedor{vendedores.length !== 1 ? 'es' : ''} activo{vendedores.length !== 1 ? 's' : ''}
          </span>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--background': 'var(--color-bg)' }}>
        <div style={{ padding: 'var(--space-md)' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--color-primary)' }}>
            Paso {paso + 1} de 6
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-navy)', marginTop: '3px', marginBottom: '14px' }}>
            {PASOS[paso]}
          </div>

          {loading && (
            <div style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
              <IonSpinner name="crescent" />
            </div>
          )}

          {!loading && error && (
            <IonText color="danger">
              <p style={{ fontSize: 'var(--font-size-sm)' }}>Error al calcular el corte: {error}</p>
            </IonText>
          )}

          {!loading && !error && salida && negocioInsumos && (
            <>
              {paso === 0 && (
                <PasoValidacion
                  vendedores={vendedores}
                  vendedoresEntrada={vendedoresEntrada}
                  confirmaciones={confirmaciones}
                  toggleConfirmacion={toggleConfirmacion}
                  saldoModernaApertura={negocioInsumos.negocio.saldo_moderna_apertura}
                  responsableId={user?.id ?? null}
                />
              )}
              {paso === 1 && (
                <PasoLaModerna
                  identidadControl={negocioInsumos.identidadControl}
                  moderna={negocioInsumos.moderna}
                  negocio={negocioInsumos.negocio}
                  vendedoresEntrada={vendedoresEntrada}
                  reconoceDescuadre={reconoceDescuadre}
                  setReconoceDescuadre={setReconoceDescuadre}
                  selladosDisponibles={selladosDisponibles}
                  acopioSeleccion={acopioSeleccion}
                  setAcopioCantidad={setAcopioCantidad}
                  totalAcopioSeleccionado={totalAcopioSeleccionado}
                  confirmarAcopio={confirmarAcopio}
                  acopioPendiente={acopioPendiente}
                />
              )}
              {paso === 2 && <PasoObligaciones salida={salida} negocio={negocioInsumos.negocio} />}
              {paso === 3 && <PasoReparto salida={salida} vendedores={vendedores} vendedoresEntrada={vendedoresEntrada} />}
              {paso === 4 && <PasoLiquidacion salida={salida} vendedores={vendedores} />}
              {paso === 5 && (
                <PasoCierre
                  salida={salida}
                  vendedores={vendedores}
                  vendedoresEntrada={vendedoresEntrada}
                  moderna={negocioInsumos.moderna}
                  backofficeTotal={negocioInsumos.backofficeTotal}
                  saldoModernaApertura={negocioInsumos.negocio.saldo_moderna_apertura}
                  periodoInicio={periodoInicio}
                  periodoFin={periodoFin}
                />
              )}
            </>
          )}
        </div>
      </IonContent>

      <IonFooter>
        <IonToolbar style={{ '--background': 'var(--color-bg)', '--border-color': 'var(--color-divider)', '--padding-top': '8px', '--padding-bottom': '14px', '--padding-start': '18px', '--padding-end': '18px' }}>
          {paso > 0 && !cerrado && (
            <IonButton fill="clear" onClick={retroceder} style={{ '--color': 'var(--color-text-secondary)' }}>
              Atrás
            </IonButton>
          )}
          <PrimaryCTA onClick={avanzar} disabled={!puedeAvanzar || loading || !!error || cerrado || cerrando} loading={cerrando}>
            {cerrado ? 'Corte cerrado' : paso === PASOS.length - 1 ? 'Cerrar corte' : `Continuar a Paso ${paso + 2}`}
          </PrimaryCTA>
        </IonToolbar>
      </IonFooter>

      <IonAlert
        isOpen={confirmarCierre}
        onDidDismiss={() => setConfirmarCierre(false)}
        header="¿Cerrar el corte?"
        message="Esta acción no se puede deshacer: el adeudo con La Moderna, el reparto y los saldos de arrastre quedan registrados como definitivos del periodo."
        buttons={[
          { text: 'Cancelar', role: 'cancel' },
          {
            text: 'Cerrar corte',
            role: 'destructive',
            handler: confirmarYCerrar,
          },
        ]}
      />

      <IonToast
        isOpen={!!toast}
        message={toast ?? ''}
        duration={3500}
        onDidDismiss={() => {
          setToast(null);
          if (cerrado) onClose?.();
        }}
        color="dark"
      />
    </IonPage>
  );
}
