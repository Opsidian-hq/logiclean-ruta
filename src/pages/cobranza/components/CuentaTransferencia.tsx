/**
 * Logiclean Ruta — CuentaTransferencia (P1 · Transferencia)
 *
 * Tarjeta navy con la cuenta para transferencia en cifras grandes. Es de solo
 * lectura: el vendedor gira el equipo hacia el cliente para que la lea o
 * escanee. Aparece sólo cuando la forma de pago elegida es "Transferencia".
 */

import { CUENTA_TRANSFERENCIA } from '../../../lib/cuentaTransferencia';

export function CuentaTransferencia() {
  const { banco, titular, numero, clabe } = CUENTA_TRANSFERENCIA;
  return (
    <div
      style={{
        background: 'var(--color-navy)',
        borderRadius: '16px',
        padding: '16px',
        boxShadow: '0 10px 24px -10px rgba(0,29,81,.5)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: 'var(--color-cyan)', display: 'inline-block' }} />
        <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9FC9FF' }}>
          Cuenta para transferencia
        </span>
      </div>
      <div className="numeric" style={{ fontSize: '25px', fontWeight: 800, color: '#fff', marginTop: '11px', letterSpacing: '1px' }}>
        {numero}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '7px' }}>
        <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#AEBBD6' }}>
          {banco} · CLABE {clabe}
        </span>
      </div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#8FA3CC', marginTop: '2px' }}>{titular}</div>
      <div
        style={{
          marginTop: '13px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          minHeight: '46px',
          border: '1.5px solid rgba(51,226,255,.45)',
          borderRadius: '12px',
        }}
      >
        <span style={{ color: 'var(--color-cyan)', fontSize: '14.5px', fontWeight: 800 }}>
          Mostrar al cliente en pantalla
        </span>
      </div>
    </div>
  );
}
