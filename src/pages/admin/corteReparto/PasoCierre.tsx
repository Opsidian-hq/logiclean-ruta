/**
 * Logiclean Ruta — Paso 6 · Cierre y arrastre (H-20, ADR-0011)
 *
 * Comprobante del periodo: puro despliegue de `salida` + insumos derivados.
 * Los saldos de cierre mostrados aquí son exactamente los que
 * `confirmarCorte` (Inc 7.4) persiste como apertura del siguiente corte.
 */

import { IonBadge } from '@ionic/react';
import type { CorteSalida, VendedorEntrada } from '../../../domain/corte';
import type { Vendedor } from '../../../db/schema';
import type { ReconciliacionModerna } from '../../../lib/suministro';
import { Card } from '../../../components/ui/Card';
import { money } from '../../../lib/money';
import { sectionLabel, rowBetween } from './styles';

interface PasoCierreProps {
  salida: CorteSalida;
  vendedores: Vendedor[];
  vendedoresEntrada: VendedorEntrada[];
  moderna: ReconciliacionModerna;
  backofficeTotal: number;
  saldoModernaApertura: number;
  periodoInicio: string;
  periodoFin: string;
}

const saldoColor = (n: number) => (n === 0 ? '#3E6B22' : n < 0 ? '#911A11' : '#7A3E06');

export function PasoCierre({
  salida,
  vendedores,
  vendedoresEntrada,
  moderna,
  backofficeTotal,
  saldoModernaApertura,
  periodoInicio,
  periodoFin,
}: PasoCierreProps) {
  const nombrePorId = new Map(vendedores.map((v) => [v.id, v.nombre]));
  const entradaPorId = new Map(vendedoresEntrada.map((e) => [e.vendedor_id, e]));
  const pagadoLaModerna = salida.liquidacion.filter((m) => m.destino_tipo === 'la_moderna').reduce((s, m) => s + m.monto, 0);
  const pagadoBackoffice = salida.liquidacion.filter((m) => m.destino_tipo === 'backoffice').reduce((s, m) => s + m.monto, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div>
        <span style={{ display: 'block', fontSize: '15px', fontWeight: 800, color: 'var(--color-navy)' }}>Comprobante del periodo</span>
        <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: '2px' }}>
          {periodoInicio || 'cutover'} – {periodoFin} · {vendedores.length} vendedor{vendedores.length !== 1 ? 'es' : ''} activo{vendedores.length !== 1 ? 's' : ''}
        </span>
      </div>

      <span style={sectionLabel}>Por vendedor</span>
      {salida.por_vendedor.map((p) => {
        const nombre = nombrePorId.get(p.vendedor_id) ?? p.vendedor_id;
        const entrada = entradaPorId.get(p.vendedor_id);
        const bolsa = (entrada?.efectivo_cobrado_neto ?? 0) + (entrada?.transfer_cobrado_neto ?? 0);
        return (
          <Card key={p.vendedor_id} padding="11px 13px">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 800, color: p.posicion_objetivo < 0 ? '#911A11' : 'var(--color-navy)' }}>{nombre}</span>
              {p.posicion_objetivo < 0 && <IonBadge color="danger">En negativo</IonBadge>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 10px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Bolsa (efvo+transf)</span>
              <span className="numeric" style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-navy)', textAlign: 'right' }}>{money(bolsa)}</span>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>CxC nueva</span>
              <span className="numeric" style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-navy)', textAlign: 'right' }}>{money(entrada?.cxc_nueva ?? 0)}</span>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Efectivo entregado</span>
              <span className="numeric" style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-navy)', textAlign: 'right' }}>{money(p.efectivo_entregado)}</span>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Arrastre entra → sale</span>
              <span className="numeric" style={{ fontSize: '12px', fontWeight: 800, color: saldoColor(p.saldo_vendedor_cierre), textAlign: 'right' }}>
                {money(entrada?.saldo_vendedor_apertura ?? 0)} → {money(p.saldo_vendedor_cierre)}
              </span>
            </div>
          </Card>
        );
      })}

      <span style={sectionLabel}>La Moderna</span>
      <Card padding="0">
        {moderna.porProducto.map((prod) => (
          <div key={prod.producto_base_id} style={{ ...rowBetween, minHeight: '34px', padding: '0 13px', borderBottom: '1px solid var(--color-divider)' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>{prod.nombre} ({prod.recibido}/{prod.devuelto})</span>
            <span className="numeric" style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--color-navy)' }}>{money(prod.adeudo)}</span>
          </div>
        ))}
        <div style={{ ...rowBetween, minHeight: '34px', padding: '0 13px', borderBottom: '1px solid var(--color-divider)' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Saldo apertura</span>
          <span className="numeric" style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--color-navy)' }}>{money(saldoModernaApertura)}</span>
        </div>
        <div style={{ ...rowBetween, minHeight: '34px', padding: '0 13px', borderBottom: '1px solid var(--color-divider)' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Pagado</span>
          <span className="numeric" style={{ fontSize: '12.5px', fontWeight: 800, color: pagadoLaModerna < moderna.total ? '#B54708' : 'var(--color-navy)' }}>{money(pagadoLaModerna)}</span>
        </div>
        <div style={{ ...rowBetween, minHeight: '34px', padding: '0 13px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Saldo cierre</span>
          <span className="numeric" style={{ fontSize: '12.5px', fontWeight: 800, color: saldoColor(salida.saldo_moderna_cierre) }}>
            {money(salida.saldo_moderna_cierre)}
          </span>
        </div>
      </Card>

      <span style={sectionLabel}>Backoffice</span>
      <Card padding="0">
        <div style={{ ...rowBetween, minHeight: '34px', padding: '0 13px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Pendiente / pagado</span>
          <span className="numeric" style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--color-navy)' }}>{money(backofficeTotal)} / {money(pagadoBackoffice)}</span>
        </div>
      </Card>

      <span style={sectionLabel}>V y T</span>
      <Card padding="12px 14px" style={{ background: 'var(--color-navy)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ display: 'block', fontSize: '10.5px', fontWeight: 800, letterSpacing: '0.4px', textTransform: 'uppercase', color: '#9FC9FF' }}>V remanente</span>
          <span className="numeric" style={{ display: 'block', fontSize: '15px', fontWeight: 800, color: '#fff', marginTop: '2px' }}>{money(salida.v_remanente)}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ display: 'block', fontSize: '10.5px', fontWeight: 800, letterSpacing: '0.4px', textTransform: 'uppercase', color: '#9FC9FF' }}>T (÷{vendedores.length})</span>
          <span className="numeric" style={{ display: 'block', fontSize: '15px', fontWeight: 800, color: '#fff', marginTop: '2px' }}>{money(salida.t_por_vendedor)}</span>
        </div>
      </Card>

      <span style={sectionLabel}>Movimientos de liquidación</span>
      <Card padding="0">
        {salida.liquidacion.map((m, i) => {
          const origenNombre = m.origen_tipo === 'vendedor' ? nombrePorId.get(m.origen_vendedor_id ?? '') ?? 'Vendedor' : 'Negocio';
          const destinoNombre =
            m.destino_tipo === 'vendedor'
              ? nombrePorId.get(m.destino_vendedor_id ?? '') ?? 'Vendedor'
              : m.destino_tipo === 'la_moderna'
                ? 'La Moderna'
                : m.destino_tipo === 'backoffice'
                  ? 'Backoffice'
                  : 'Negocio';
          return (
            <div key={i} style={{ ...rowBetween, minHeight: '34px', padding: '0 13px', borderBottom: i < salida.liquidacion.length - 1 ? '1px solid var(--color-divider)' : 'none' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>{origenNombre} → {destinoNombre}</span>
              <span className="numeric" style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--color-navy)' }}>{money(m.monto)}</span>
            </div>
          );
        })}
      </Card>

      <span style={sectionLabel}>Saldos de cierre → apertura del próximo</span>
      <Card padding="0" style={salida.alertas.length === 0 ? { border: '1.5px solid #B7EE92', background: '#ECFCE0' } : undefined}>
        {salida.por_vendedor.map((p, i) => (
          <div key={p.vendedor_id} style={{ ...rowBetween, minHeight: '34px', padding: '0 13px', borderBottom: i < salida.por_vendedor.length ? '1px solid rgba(0,0,0,.05)' : 'none' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-body)' }}>{nombrePorId.get(p.vendedor_id) ?? p.vendedor_id} ↔ negocio</span>
            <span className="numeric" style={{ fontSize: '13px', fontWeight: 800, color: saldoColor(p.saldo_vendedor_cierre) }}>{money(p.saldo_vendedor_cierre)}</span>
          </div>
        ))}
        <div style={{ ...rowBetween, minHeight: '34px', padding: '0 13px' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-body)' }}>Negocio ↔ La Moderna</span>
          <span className="numeric" style={{ fontSize: '13px', fontWeight: 800, color: saldoColor(salida.saldo_moderna_cierre) }}>
            {salida.saldo_moderna_cierre > 0 ? `${money(salida.saldo_moderna_cierre)} a favor` : money(salida.saldo_moderna_cierre)}
          </span>
        </div>
      </Card>

      <div style={{ ...rowBetween, border: '1px solid var(--color-card-border)', background: 'var(--color-surface-muted)', borderRadius: '12px', padding: '11px 14px' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#8A94A6' }}>Exportar comprobante a PDF</span>
        <IonBadge style={{ '--background': 'var(--color-surface-muted)', color: '#8A94A6', fontSize: '10.5px', fontWeight: 800 }}>Próximamente</IonBadge>
      </div>
    </div>
  );
}
