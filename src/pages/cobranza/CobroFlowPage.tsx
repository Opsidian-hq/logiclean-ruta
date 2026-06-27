/**
 * Logiclean Ruta — CobroFlowPage (P5 · P6) · cobro origen-consciente
 *
 * Una sola pantalla de cobro alcanzable desde dos orígenes del rediseño de
 * Visitas, con pequeñas variantes según el origen:
 *  - **entrega**: cobra la venta recién generada por una entrega. Atrás vuelve al
 *    resumen; ofrece total/parcial/crédito.
 *  - **cobro-pendiente**: cobra el saldo consolidado del cliente. Título "Saldo a
 *    cobrar", atrás vuelve al perfil, y **no** ofrece "A crédito" (cobrar a
 *    crédito un saldo ya a crédito es redundante).
 *
 * Reusa `CobroVentaStep` (captura) y `ConfirmacionCobro` (éxito). El registro va
 * a `registrarCobro` (entrega, aislado a esa venta) o `registrarCobroCliente`
 * (saldo consolidado, FIFO sin prorrateo).
 *
 * Ruta: /cobro/:clienteId
 */

import { IonPage, IonContent, IonSpinner } from '@ionic/react';
import { useState } from 'react';
import { useParams, useHistory, useLocation } from 'react-router-dom';
import { useClientes } from '../../hooks/useClientes';
import { useCobros, useSaldoCliente } from '../../hooks/useCobros';
import { redondear } from '../../lib/cobros';
import type { FormaPago } from '../../lib/cobros';
import { CobroVentaStep, type DecisionCobro } from './CobroVentaStep';
import { ConfirmacionCobro } from './ConfirmacionCobro';
import type { ModoCobro } from './components/OpcionesCobro';

type Origen = 'entrega' | 'cobro-pendiente';

interface CobroState {
  origen: Origen;
  total?: number;
  ventaId?: string;
  productosCount?: number;
  reprogramacion?: { productos: string[]; fecha: string };
}

interface Resultado {
  ventaId: string;
  montoCobrado: number;
  formaPago: FormaPago | null;
  saldo: number;
}

export function CobroFlowPage() {
  const { clienteId } = useParams<{ clienteId: string }>();
  const history = useHistory();
  const location = useLocation<CobroState | undefined>();
  const state: CobroState = location.state ?? { origen: 'cobro-pendiente' };
  const esEntrega = state.origen === 'entrega';

  const { clientes } = useClientes();
  const cliente = clientes.find((c) => c.id === clienteId) ?? null;

  // El saldo consolidado sólo se deriva para el origen cobro-pendiente.
  const { desglose, loading: cargandoSaldo } = useSaldoCliente(esEntrega ? null : clienteId);
  const { registrarCobro, registrarCobroCliente, submitting } = useCobros();

  const [resultado, setResultado] = useState<Resultado | null>(null);

  const total = esEntrega ? state.total ?? 0 : desglose?.saldoTotal ?? state.total ?? 0;
  const cargando = !cliente || (!esEntrega && cargandoSaldo);

  const confirmar = async (d: DecisionCobro) => {
    const esCredito = d.modo === 'credito';
    const monto = esCredito ? 0 : d.monto;
    const saldo = redondear(Math.max(0, total - monto));

    let ventaId = state.ventaId ?? clienteId;
    if (esEntrega) {
      if (!esCredito && state.ventaId) {
        await registrarCobro({ ventaId: state.ventaId, monto, forma_pago: d.forma_pago });
      }
      ventaId = state.ventaId ?? clienteId;
    } else {
      await registrarCobroCliente({ clienteId, monto, forma_pago: d.forma_pago });
    }

    setResultado({
      ventaId,
      montoCobrado: monto,
      formaPago: esCredito ? null : d.forma_pago,
      saldo,
    });
  };

  const volverARuta = () =>
    history.push({ pathname: '/visitas', state: { toast: 'Visita registrada en la ruta' } });

  if (cargando) {
    return (
      <IonPage>
        <IonContent>
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <IonSpinner name="crescent" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  // ── P6 · Éxito ──
  if (resultado) {
    return (
      <IonPage>
        <ConfirmacionCobro
          ventaId={resultado.ventaId}
          clienteNombre={cliente.nombre}
          tipo={cliente.tipo}
          total={total}
          montoCobrado={resultado.montoCobrado}
          formaPago={resultado.formaPago}
          saldo={resultado.saldo}
          titulo={esEntrega ? 'Entrega cobrada' : 'Venta cobrada'}
          totalLabel={esEntrega ? 'Total de la entrega' : 'Total de la venta'}
          reprogramacion={state.reprogramacion}
          onVolverRuta={volverARuta}
        />
      </IonPage>
    );
  }

  // ── P5 · Captura del cobro ──
  const modos: ModoCobro[] | undefined = esEntrega ? undefined : ['total', 'parcial'];
  const productosResumen =
    esEntrega && state.productosCount
      ? `${state.productosCount} producto${state.productosCount !== 1 ? 's' : ''}`
      : '';

  return (
    <IonPage>
      <CobroVentaStep
        clienteNombre={cliente.nombre}
        tipo={cliente.tipo}
        productosResumen={productosResumen}
        total={total}
        tituloTotal={esEntrega ? 'Total de la venta' : 'Saldo a cobrar'}
        backLabel={esEntrega ? 'Resumen' : 'Perfil'}
        modos={modos}
        submitting={submitting}
        onConfirm={confirmar}
        onBack={() => history.goBack()}
      />
    </IonPage>
  );
}
