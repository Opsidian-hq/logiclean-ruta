/**
 * Logiclean Ruta — CobrosPendientesPage (vendedor · D-002)
 *
 * Lista todos los clientes con saldo > 0, tengan o no visita agendada esta
 * semana. Resuelve el hueco operativo: los clientes llaman para pagar fuera de
 * la visita programada y, sin esta entrada, el vendedor no tenía forma de
 * llegar a la ficha de cobro de un cliente que no está en la ruta del día.
 *
 * Cada cliente enlaza al flujo P3 ya existente (`/cobranza/:clienteId`), donde
 * se registra el cobro contra el saldo derivado.
 *
 * Ruta: /cobros
 */

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonSpinner,
  IonSearchbar,
  IonRefresher,
  IonRefresherContent,
  useIonViewWillEnter,
} from '@ionic/react';
import { useState, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { CuentaButton } from '../../components/CuentaButton';
import { ConnectivityStrip } from '../../components/ui/ConnectivityStrip';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { ClienteAvatar } from '../../components/ui/ClienteAvatar';
import { useCobrosPendientes } from '../../hooks/useCobros';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { money } from '../../lib/money';

export function CobrosPendientesPage() {
  const history = useHistory();
  const { pendientes, loading, refresh } = useCobrosPendientes();
  const [search, setSearch] = useState('');

  const { handleRefresh } = usePullToRefresh(
    useCallback(async () => { await refresh(); }, [refresh])
  );

  // Recalcular al entrar al tab: tras cobrar y volver, el saldo se actualiza.
  useIonViewWillEnter(() => {
    void refresh();
  });

  const filtrados = pendientes.filter((p) =>
    p.nombre.toLowerCase().includes(search.toLowerCase())
  );

  const totalPorCobrar = pendientes.reduce((s, p) => s + p.saldoTotal, 0);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonTitle>Cobros pendientes</IonTitle>
          <IonButtons slot="end" style={{ marginRight: 'var(--space-sm)' }}>
            <SyncStatusBadge />
            <CuentaButton />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && (
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {!loading && pendientes.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: '8px',
              padding: '56px 24px',
            }}
          >
            <div
              style={{
                width: '78px',
                height: '78px',
                borderRadius: '24px',
                background: '#ECFCE0',
                border: '1.5px solid #B7EE92',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ color: '#3E6B22', fontSize: '38px', fontWeight: 800 }}>✓</span>
            </div>
            <div style={{ fontSize: '21px', fontWeight: 800, color: 'var(--color-navy)', marginTop: '8px' }}>
              Sin cobros pendientes
            </div>
            <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
              Todos tus clientes están al corriente.
            </div>
          </div>
        )}

        {!loading && pendientes.length > 0 && (
          <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Resumen total por cobrar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                padding: '0 2px',
              }}
            >
              <span style={{ fontSize: '12.5px', fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: '#8A94A6' }}>
                {pendientes.length} cliente{pendientes.length !== 1 ? 's' : ''} por cobrar
              </span>
              <span className="numeric" style={{ fontSize: '17px', fontWeight: 800, color: '#7A3E06' }}>
                {money(totalPorCobrar)}
              </span>
            </div>

            <IonSearchbar
              value={search}
              onIonInput={(e) => setSearch(e.detail.value ?? '')}
              placeholder="Buscar cliente..."
              style={{ '--background': 'var(--color-surface)', padding: 0 }}
            />

            {filtrados.length === 0 && (
              <div style={{ textAlign: 'center', padding: 'var(--space-lg)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                Sin resultados para "{search}"
              </div>
            )}

            {filtrados.map((p) => (
              <button
                key={p.clienteId}
                type="button"
                onClick={() =>
                  history.push({
                    pathname: `/cobro/${p.clienteId}`,
                    state: { origen: 'cobro-pendiente', total: p.saldoTotal },
                  })
                }
                style={{
                  textAlign: 'left',
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                <Card padding="12px 14px">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                    <ClienteAvatar nombre={p.nombre} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-navy)' }}>{p.nombre}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '4px' }}>
                        <Chip tone={p.tipo === 'mayoreo' ? 'mayoreo' : 'menudeo'}>
                          {p.tipo === 'mayoreo' ? 'Mayoreo' : 'Menudeo'}
                        </Chip>
                        <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#8A94A6' }}>
                          {p.ventasPendientes} venta{p.ventasPendientes !== 1 ? 's' : ''} con saldo
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flex: 'none' }}>
                      <div className="numeric" style={{ fontSize: '17px', fontWeight: 800, color: '#7A3E06' }}>
                        {money(p.saldoTotal)}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-primary)', marginTop: '2px' }}>
                        Cobrar ›
                      </div>
                    </div>
                  </div>
                </Card>
              </button>
            ))}

            <div style={{ height: 'var(--space-lg)' }} />
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}
