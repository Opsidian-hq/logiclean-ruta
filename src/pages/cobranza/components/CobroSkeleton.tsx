/**
 * Logiclean Ruta — CobroSkeleton (estado Cargando)
 *
 * Skeleton breve mientras se deriva el saldo del cliente (ventas − cobros). El
 * cálculo es local, así que dura poco; el shimmer reproduce el del prototipo.
 */

export function CobroSkeleton() {
  return (
    <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* fila de cliente */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
        <div className="lc-sk" style={{ width: '40px', height: '40px', borderRadius: '11px' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '7px' }}>
          <div className="lc-sk" style={{ width: '62%', height: '15px', borderRadius: '6px' }} />
          <div className="lc-sk" style={{ width: '38%', height: '12px', borderRadius: '6px' }} />
        </div>
      </div>

      {/* tarjeta de saldo */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)', borderRadius: '16px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '13px' }}>
        <div className="lc-sk" style={{ width: '45%', height: '13px', borderRadius: '6px' }} />
        <div className="lc-sk" style={{ width: '60%', height: '38px', borderRadius: '10px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div className="lc-sk" style={{ width: '40%', height: '13px', borderRadius: '6px' }} />
          <div className="lc-sk" style={{ width: '20%', height: '13px', borderRadius: '6px' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div className="lc-sk" style={{ width: '40%', height: '13px', borderRadius: '6px' }} />
          <div className="lc-sk" style={{ width: '20%', height: '13px', borderRadius: '6px' }} />
        </div>
      </div>

      {/* campos del formulario */}
      <div className="lc-sk" style={{ width: '100%', height: '54px', borderRadius: '14px' }} />
      <div style={{ display: 'flex', gap: '9px' }}>
        <div className="lc-sk" style={{ flex: 1, height: '50px', borderRadius: '13px' }} />
        <div className="lc-sk" style={{ flex: 1, height: '50px', borderRadius: '13px' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px', marginTop: '4px' }}>
        <div
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            border: '2.5px solid #D7DCE5',
            borderTopColor: 'var(--color-primary)',
            animation: 'lc-spin .8s linear infinite',
          }}
        />
        <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#8A94A6' }}>Cargando saldo…</span>
      </div>
    </div>
  );
}
