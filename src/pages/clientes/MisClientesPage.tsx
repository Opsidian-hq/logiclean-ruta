/**
 * Logiclean Ruta — MisClientesPage (vendedor)
 *
 * Catálogo de clientes del vendedor en sesión. Lista todos sus clientes
 * activos con búsqueda por nombre. Tocar un cliente abre su detalle.
 *
 * Ruta: /mis-clientes
 */

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonSearchbar,
  IonSpinner,
  IonText,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/react';
import { useState, useEffect, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import { personOutline } from 'ionicons/icons';
import { IonIcon } from '@ionic/react';
import { db } from '../../db/index';
import { useAuthContext } from '../../context/AuthContext';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { CuentaButton } from '../../components/CuentaButton';
import { ConnectivityStrip } from '../../components/ui/ConnectivityStrip';
import { Chip } from '../../components/ui/Chip';
import { ClienteAvatar } from '../../components/ui/ClienteAvatar';
import type { Cliente } from '../../db/schema';

export function MisClientesPage() {
  const { user } = useAuthContext();
  const history = useHistory();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const todos = await db.cliente.where('activo').equals(1).toArray();
      const propios = todos.filter((c) => c.vendedor_id === user.id);
      propios.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      setClientes(propios);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const { handleRefresh } = usePullToRefresh(
    useCallback(async () => { await load(); }, [load])
  );

  const filtrados = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(search.toLowerCase())
  );

  const diasHasta = (fechaISO?: string | null): number | null => {
    if (!fechaISO) return null;
    const [y, m, d] = fechaISO.split('-').map(Number);
    if (!y || !m || !d) return null;
    const objetivo = new Date(y, m - 1, d);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Math.round((objetivo.getTime() - hoy.getTime()) / 86_400_000);
  };

  const etiquetaProximaVisita = (c: Cliente): { texto: string; color: string } | null => {
    const dias = diasHasta(c.fecha_proxima_visita);
    if (dias == null) return null;
    if (dias < 0) return { texto: `Vencida · ${-dias}d`, color: 'var(--color-error-text)' };
    if (dias === 0) return { texto: 'Vence hoy', color: 'var(--color-amber-text, #92400E)' };
    if (dias <= 7) return { texto: `En ${dias} día${dias !== 1 ? 's' : ''}`, color: 'var(--color-text-secondary)' };
    return { texto: `En ${dias} días`, color: 'var(--color-text-secondary)' };
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonTitle>Mis Clientes</IonTitle>
          <IonButtons slot="end" style={{ marginRight: 'var(--space-sm)' }}>
            <SyncStatusBadge />
            <CuentaButton />
          </IonButtons>
        </IonToolbar>
        <ConnectivityStrip />
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <IonSearchbar
          value={search}
          onIonInput={(e) => setSearch(e.detail.value ?? '')}
          placeholder="Buscar cliente..."
          style={{ '--background': 'var(--color-surface)' }}
        />

        {!loading && (
          <div
            style={{
              padding: '4px var(--space-md) 10px',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {filtrados.length} cliente{filtrados.length !== 1 ? 's' : ''}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: 'var(--space-lg)' }}>
            <IonText color="danger">
              <p>Error al cargar clientes: {error}</p>
            </IonText>
          </div>
        )}

        {!loading && !error && filtrados.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <IonText color="medium">
              <p>
                {search ? 'Sin resultados para la búsqueda.' : 'No tienes clientes asignados.'}
              </p>
            </IonText>
          </div>
        )}

        {!loading && !error && filtrados.length > 0 && (
          <div>
            {filtrados.map((c) => {
              const etiqueta = etiquetaProximaVisita(c);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => history.push(`/clientes/${c.id}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '13px',
                    width: '100%',
                    padding: '13px var(--space-md)',
                    background: 'var(--color-surface)',
                    border: 'none',
                    borderBottom: '1px solid var(--color-divider)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <ClienteAvatar nombre={c.nombre} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '16px',
                        fontWeight: 700,
                        color: 'var(--color-navy)',
                        marginBottom: '5px',
                        lineHeight: 1.1,
                      }}
                    >
                      {c.nombre}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <Chip tone={c.tipo === 'mayoreo' ? 'mayoreo' : 'menudeo'}>
                        {c.tipo === 'mayoreo' ? 'Mayoreo' : 'Menudeo'}
                      </Chip>
                      <Chip tone={c.estado === 'activo' ? 'primarySoft' : 'amber'}>
                        {c.estado === 'activo' ? 'Activo' : 'Prospecto'}
                      </Chip>
                      {etiqueta && (
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: etiqueta.color,
                          }}
                        >
                          {etiqueta.texto}
                        </span>
                      )}
                    </div>
                  </div>
                  <IonIcon
                    icon={personOutline}
                    style={{ fontSize: '18px', color: 'var(--color-text-secondary)', flex: 'none' }}
                  />
                </button>
              );
            })}
          </div>
        )}

        <div style={{ height: 'var(--space-2xl)' }} />
      </IonContent>
    </IonPage>
  );
}
