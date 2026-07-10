/**
 * Logiclean Ruta — Paso 4 · Reparto (H-20)
 *
 * T = V ÷ N; posición objetivo = T − CxC nueva (regla 3, sin ramas por N).
 * Puro despliegue de `salida.por_vendedor` — el vendedor en negativo no
 * recibe efectivo y su déficit ya viene sumado a su arrastre previo en
 * `saldo_vendedor_cierre` (regla 5): esta vista no lo vuelve a sumar.
 */

import { IonBadge } from '@ionic/react';
import type { CorteSalida, VendedorEntrada } from '../../../domain/corte';
import type { Vendedor } from '../../../db/schema';
import { Card } from '../../../components/ui/Card';
import { money } from '../../../lib/money';
import { rowBetween } from './styles';
import { AvatarInicial, NotaInfo } from './shared';

interface PasoRepartoProps {
  salida: CorteSalida;
  vendedores: Vendedor[];
  vendedoresEntrada: VendedorEntrada[];
}

export function PasoReparto({ salida, vendedores, vendedoresEntrada }: PasoRepartoProps) {
  const nombrePorId = new Map(vendedores.map((v) => [v.id, v.nombre]));
  const entradaPorId = new Map(vendedoresEntrada.map((e) => [e.vendedor_id, e]));
  const n = vendedores.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <Card padding="15px" style={{ background: 'var(--color-navy)', textAlign: 'center' }}>
        <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#9FC9FF' }}>
          V remanente ÷ {n} vendedor{n !== 1 ? 'es' : ''}
        </span>
        <span className="numeric" style={{ display: 'block', fontSize: '30px', fontWeight: 800, color: '#fff', marginTop: '5px' }}>
          T = {money(salida.t_por_vendedor)}
        </span>
        {n === 1 && (
          <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#8FA3CC', marginTop: '5px' }}>
            N=1 → T = V, sin división
          </span>
        )}
      </Card>

      {salida.por_vendedor.map((p) => {
        const nombre = nombrePorId.get(p.vendedor_id) ?? p.vendedor_id;
        const entrada = entradaPorId.get(p.vendedor_id);
        const negativo = p.posicion_objetivo < 0;
        return (
          <Card
            key={p.vendedor_id}
            padding="14px"
            style={{ border: `1.5px solid ${negativo ? '#F4B3AC' : '#B7EE92'}`, background: negativo ? '#FDECEA' : 'var(--color-surface)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <AvatarInicial nombre={nombre} tono={negativo ? 'rojo' : 'azul'} />
              <span style={{ fontSize: '15px', fontWeight: 800, color: negativo ? '#911A11' : 'var(--color-navy)', flex: 1 }}>{nombre}</span>
              {negativo && <IonBadge color="danger">En negativo</IonBadge>}
            </div>

            {negativo ? (
              <>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#7A1610' }}>
                  CxC nueva ({money(entrada?.cxc_nueva ?? 0)}) &gt; T ({money(salida.t_por_vendedor)})
                </div>
                <div style={{ ...rowBetween, border: '1px solid #F4B3AC', background: '#fff', borderRadius: '10px', padding: '9px 12px', marginTop: '5px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#911A11' }}>Posición objetivo</span>
                  <span className="numeric" style={{ fontSize: '16px', fontWeight: 800, color: '#911A11' }}>{money(p.posicion_objetivo)}</span>
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#7A1610', marginTop: '8px', lineHeight: 1.4 }}>
                  No recibe efectivo. Queda debiendo al negocio
                  {entrada && entrada.saldo_vendedor_apertura !== 0
                    ? `; se suma a su arrastre previo (${money(entrada.saldo_vendedor_apertura)})`
                    : ''}{' '}
                  → cierra en <strong className="numeric">{money(p.saldo_vendedor_cierre)}</strong>.
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary)', margin: '2px 0 4px' }}>
                  T − CxC ({money(salida.t_por_vendedor)} − {money(entrada?.cxc_nueva ?? 0)})
                </div>
                <div style={{ ...rowBetween, background: '#ECFCE0', borderRadius: '10px', padding: '9px 12px' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#1C4310' }}>Posición objetivo</span>
                  <span className="numeric" style={{ fontSize: '16px', fontWeight: 800, color: '#3E6B22' }}>{money(p.posicion_objetivo)}</span>
                </div>
              </>
            )}
          </Card>
        );
      })}

      {n === 1 && (
        <NotaInfo>Sin segundo vendedor, no hay comparación ni lista: se lleva el remanente completo.</NotaInfo>
      )}
    </div>
  );
}
