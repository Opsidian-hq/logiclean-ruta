/**
 * Logiclean Ruta — Paso 5 · Instrucciones de liquidación (H-20, ADR-0011)
 *
 * Puro despliegue de `salida.liquidacion` — la pasada ya decidió el mínimo
 * de movimientos, efectivo antes que transferencia y qué cuenta como avance
 * hacia el objetivo. Esta vista solo agrupa por actor para mostrarlo, no
 * recalcula nada.
 */

import type { CorteSalida } from '../../../domain/corte';
import type { Vendedor } from '../../../db/schema';
import { Card } from '../../../components/ui/Card';
import { Chip } from '../../../components/ui/Chip';
import { money } from '../../../lib/money';
import { sectionLabel, rowBetween } from './styles';

interface PasoLiquidacionProps {
  salida: CorteSalida;
  vendedores: Vendedor[];
}

function etiquetaActor(
  tipo: 'vendedor' | 'negocio' | 'la_moderna' | 'backoffice',
  vendedorId: string | null,
  nombrePorId: Map<string, string>
): string {
  if (tipo === 'vendedor') return (vendedorId && nombrePorId.get(vendedorId)) ?? 'Vendedor';
  if (tipo === 'negocio') return 'Negocio';
  if (tipo === 'la_moderna') return 'La Moderna';
  return 'Backoffice';
}

export function PasoLiquidacion({ salida, vendedores }: PasoLiquidacionProps) {
  const nombrePorId = new Map(vendedores.map((v) => [v.id, v.nombre]));

  // Agrupa movimientos del mismo origen→destino (pueden venir en efectivo Y
  // transferencia como filas separadas del motor) para una sola card, como
  // en el prototipo ("Efvo. + transf.").
  const grupos = new Map<
    string,
    { origen: string; destino: string; monto: number; formas: Set<string>; topado: boolean }
  >();
  for (const m of salida.liquidacion) {
    const origen = etiquetaActor(m.origen_tipo, m.origen_vendedor_id, nombrePorId);
    const destino = etiquetaActor(m.destino_tipo, m.destino_vendedor_id, nombrePorId);
    const key = `${origen}→${destino}`;
    const g = grupos.get(key) ?? { origen, destino, monto: 0, formas: new Set(), topado: false };
    g.monto += m.monto;
    g.formas.add(m.forma_pago);
    grupos.set(key, g);
  }

  const faltanteModerna = salida.alertas.find((a) => a.tipo === 'la_moderna_topada');
  const vendedoresNegativos = salida.alertas.filter((a) => a.tipo === 'vendedor_negativo');
  const abonosExcedidos = salida.alertas.filter((a) => a.tipo === 'abono_excede_bolsa');

  const etiquetaFormaPago = (formas: Set<string>) => {
    if (formas.has('efectivo') && formas.has('transferencia')) return 'Efvo. + transf.';
    return formas.has('efectivo') ? 'Efectivo' : 'Transferencia';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
      {abonosExcedidos.length > 0 && (
        <div style={{ border: '1.5px solid #F4B3AC', background: '#FDECEA', borderRadius: '14px', padding: '13px 14px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#911A11' }}>
            ● No se puede cerrar el corte
          </span>
          {abonosExcedidos.map((a) => (
            <div key={a.vendedor_id} style={{ ...rowBetween, marginTop: '8px' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#7A1610' }}>
                {nombrePorId.get(a.vendedor_id) ?? a.vendedor_id} ya retiró/entregó más de lo que trae de bolsa esta semana
              </span>
              <span className="numeric" style={{ fontSize: '13.5px', fontWeight: 800, color: '#911A11' }}>
                +{money(a.monto)}
              </span>
            </div>
          ))}
          <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#7A1610', marginTop: '6px' }}>
            Revisa el abono registrado en "Mi saldo" de ese vendedor antes de continuar — probable error de captura.
          </span>
        </div>
      )}

      <span style={sectionLabel}>Movimientos a realizar</span>

      {[...grupos.values()].map((g) => {
        const esPagoModernaTopado = g.destino === 'La Moderna' && !!faltanteModerna;
        const esOrigenVendedorNegativo = vendedoresNegativos.some(
          (a) => a.tipo === 'vendedor_negativo' && nombrePorId.get(a.vendedor_id) === g.origen
        );
        return (
          <Card key={`${g.origen}→${g.destino}`} padding="13px 14px" style={esOrigenVendedorNegativo ? { border: '1.5px solid #F4B3AC' } : undefined}>
            <div style={rowBetween}>
              <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-navy)' }}>{g.origen} → {g.destino}</span>
              <Chip tone={esPagoModernaTopado ? 'pending' : 'primarySoft'}>{esPagoModernaTopado ? 'Topado' : etiquetaFormaPago(g.formas)}</Chip>
            </div>
            <span className="numeric" style={{ display: 'block', fontSize: '19px', fontWeight: 800, color: 'var(--color-navy)', marginTop: '4px' }}>
              {money(g.monto)}
            </span>
            {esOrigenVendedorNegativo && (
              <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#911A11', marginTop: '3px' }}>
                Entrega todo lo que trae; no cubre su objetivo
              </span>
            )}
          </Card>
        );
      })}

      {faltanteModerna ? (
        vendedoresNegativos.map((a) => (
          <div
            key={a.vendedor_id}
            style={{ border: '1.5px solid #F4B3AC', background: '#FDECEA', borderRadius: '12px', padding: '11px 14px', marginTop: '4px' }}
          >
            <div style={rowBetween}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#911A11' }}>Registrado, no movido</span>
              <span className="numeric" style={{ fontSize: '13.5px', fontWeight: 800, color: '#911A11' }}>{money(a.monto)}</span>
            </div>
            <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#7A1610', marginTop: '4px' }}>
              Deuda de {nombrePorId.get(a.vendedor_id) ?? a.vendedor_id} con el negocio, arrastrada al próximo corte
            </div>
          </div>
        ))
      ) : (
        <div style={{ border: '1.5px solid #B7EE92', background: '#ECFCE0', borderRadius: '14px', padding: '11px 14px', marginTop: '4px', ...rowBetween }}>
          <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#1C4310' }}>Cuadra exacto</span>
          <span className="numeric" style={{ fontSize: '14px', fontWeight: 800, color: '#3E6B22' }}>
            {money(salida.obligaciones_total)} = {money(salida.obligaciones_total)}
          </span>
        </div>
      )}
    </div>
  );
}
