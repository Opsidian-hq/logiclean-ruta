/**
 * Logiclean Ruta — Paso 3 · Obligaciones y pool líquido (H-20)
 *
 * Puro despliegue de `salida` (motor de dominio, Inc 7.1): obligaciones
 * contra el disponible tras reservar posiciones (regla 4). Lo pagado a cada
 * acreedor se lee de `salida.liquidacion` (no se recalcula): es la misma
 * pasada que emite el Paso 5.
 */

import { IonIcon } from '@ionic/react';
import { checkmarkCircle, warning } from 'ionicons/icons';
import type { CorteSalida, NegocioEntrada } from '../../../domain/corte';
import { Card } from '../../../components/ui/Card';
import { money } from '../../../lib/money';
import { sectionLabel, rowBetween } from './styles';
import { NotaInfo } from './shared';

interface PasoObligacionesProps {
  salida: CorteSalida;
  negocio: NegocioEntrada;
}

export function PasoObligaciones({ salida, negocio }: PasoObligacionesProps) {
  const pagadoLaModerna = salida.liquidacion
    .filter((m) => m.destino_tipo === 'la_moderna')
    .reduce((s, m) => s + m.monto, 0);
  const pagadoBackoffice = salida.liquidacion
    .filter((m) => m.destino_tipo === 'backoffice')
    .reduce((s, m) => s + m.monto, 0);
  const faltante = salida.saldo_moderna_cierre - negocio.saldo_moderna_apertura;
  const topada = faltante > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {topada ? (
        <div style={{ border: '1.5px solid #F6C97C', background: '#FEF3E2', borderRadius: '14px', padding: '11px 15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <IonIcon icon={warning} style={{ fontSize: '20px', color: 'var(--color-amber)' }} />
          <span style={{ fontSize: '14px', fontWeight: 800, color: '#7A3E06' }}>Pago a La Moderna topado · faltan {money(faltante)}</span>
        </div>
      ) : (
        <div style={{ border: '1.5px solid #B7EE92', background: '#ECFCE0', borderRadius: '14px', padding: '12px 15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <IonIcon icon={checkmarkCircle} style={{ fontSize: '22px', color: '#3E6B22' }} />
          <span style={{ fontSize: '15px', fontWeight: 800, color: '#1C4310' }}>Obligaciones cubiertas</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px' }}>
        <Card padding="12px 13px" style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, letterSpacing: '0.4px', textTransform: 'uppercase', color: '#8A94A6' }}>Necesita</span>
          <span className="numeric" style={{ display: 'block', fontSize: '19px', fontWeight: 800, color: 'var(--color-navy)', marginTop: '3px' }}>{money(salida.obligaciones_total)}</span>
          <span style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#8A94A6', marginTop: '3px' }}>
            {money(negocio.adeudo_la_moderna)} adeudo + {money(negocio.backoffice_pendiente)} backoffice
          </span>
        </Card>
        <Card padding="12px 13px" style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, letterSpacing: '0.4px', textTransform: 'uppercase', color: '#8A94A6' }}>Disponible</span>
          <span className="numeric" style={{ display: 'block', fontSize: '19px', fontWeight: 800, color: 'var(--color-navy)', marginTop: '3px' }}>{money(Math.max(salida.disponible_obligaciones, 0))}</span>
          <span style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#8A94A6', marginTop: '3px' }}>tras reservar posiciones</span>
        </Card>
      </div>

      {topada && (
        <div style={{ border: '1.5px solid #F4B3AC', background: '#FDECEA', borderRadius: '12px', padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#911A11' }}>Faltante</span>
          <span className="numeric" style={{ fontSize: '15px', fontWeight: 800, color: '#911A11' }}>{money(faltante)}</span>
        </div>
      )}

      <span style={sectionLabel}>Desglose del pago</span>
      <Card padding="0">
        <div style={{ ...rowBetween, minHeight: '44px', padding: '0 14px', borderBottom: '1px solid var(--color-divider)' }}>
          <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>A La Moderna se paga</span>
          <span className="numeric" style={{ fontSize: '14.5px', fontWeight: 800, color: topada ? '#B54708' : 'var(--color-navy)' }}>
            {money(pagadoLaModerna)} de {money(negocio.adeudo_la_moderna)}
          </span>
        </div>
        <div style={{ ...rowBetween, minHeight: '44px', padding: '0 14px' }}>
          <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>A backoffice se paga</span>
          <span className="numeric" style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--color-navy)' }}>
            {money(pagadoBackoffice)} de {money(negocio.backoffice_pendiente)}
          </span>
        </div>
      </Card>

      {topada ? (
        <Card padding="13px 15px" style={{ background: 'var(--color-navy)' }}>
          <div style={rowBetween}>
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#9FC9FF' }}>Saldo La Moderna al cierre</span>
            <span className="numeric" style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>{money(salida.saldo_moderna_cierre)}</span>
          </div>
        </Card>
      ) : (
        <NotaInfo>Sin arrastre nuevo — este corte no arrastra saldo con La Moderna.</NotaInfo>
      )}
    </div>
  );
}
