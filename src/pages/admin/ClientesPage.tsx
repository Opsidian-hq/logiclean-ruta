/**
 * Logiclean Ruta — ClientesPage (H-14 — gerente)
 *
 * Gestión de clientes.
 * Ruta: /admin/clientes
 *
 * Funciones:
 *  - Lista de clientes con filtro por vendedor
 *  - Edición de datos del cliente
 *  - Reasignación de vendedor
 *  - Baja lógica (activo=false)
 */

import { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonModal,
  IonSpinner,
  IonText,
  IonAlert,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonFab,
  IonFabButton,
  IonNote,
} from '@ionic/react';
import { addOutline, pencilOutline, archiveOutline, chevronForwardOutline } from 'ionicons/icons';
import { useClientes } from '../../hooks/useClientes';
import { useHistory } from 'react-router-dom';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { CuentaButton } from '../../components/CuentaButton';
import { ConnectivityStrip } from '../../components/ui/ConnectivityStrip';
import { Chip } from '../../components/ui/Chip';
import { ClienteForm } from './components/ClienteForm';
import { db } from '../../db/index';
import type { Cliente, Vendedor } from '../../db/schema';

// ── Componente ────────────────────────────────────────────────

export function ClientesPage() {
  const {
    clientes,
    loading,
    error,
    filtroVendedor,
    setFiltroVendedor,
    saveCliente,
    desactivarCliente,
    refresh,
  } = useClientes();

  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [confirmBaja, setConfirmBaja] = useState<string | null>(null);
  const history = useHistory();

  // Cargar lista de vendedores para el filtro y el formulario
  useEffect(() => {
    db.vendedor.toArray().then(setVendedores);
  }, []);

  // Filtrar por búsqueda de texto
  const filtrados = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (data: Omit<Cliente, 'id'> & { id?: string }) => {
    await saveCliente(data);
    setModalOpen(false);
    setEditando(null);
    await refresh();
  };

  const handleBaja = async (id: string) => {
    await desactivarCliente(id);
    setConfirmBaja(null);
  };

  const getNombreVendedor = (vendedorId: string) => {
    const v = vendedores.find((v) => v.id === vendedorId);
    return v ? v.nombre : 'Sin asignar';
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonTitle>Clientes</IonTitle>
          <IonButtons slot="end" style={{ marginRight: 'var(--space-sm)' }}>
            <SyncStatusBadge />
            <CuentaButton />
          </IonButtons>
        </IonToolbar>
        <ConnectivityStrip />
      </IonHeader>

      <IonContent>
        {/* Buscador */}
        <IonSearchbar
          value={search}
          onIonInput={(e) => setSearch(e.detail.value ?? '')}
          placeholder="Buscar cliente..."
          style={{ '--background': 'var(--color-surface)' }}
        />

        {/* Filtro por vendedor */}
        <IonItem style={{ paddingBottom: 'var(--space-sm)' }}>
          <IonLabel style={{ fontSize: '14px', color: 'var(--color-navy)' }}>
            Filtrar por vendedor
          </IonLabel>
          <IonSelect
            value={filtroVendedor ?? ''}
            onIonChange={(e) =>
              setFiltroVendedor(e.detail.value === '' ? null : e.detail.value)
            }
            placeholder="Todos"
            style={{ minHeight: 'var(--touch-min, 48px)' }}
          >
            <IonSelectOption value="">Todos</IonSelectOption>
            {vendedores.map((v) => (
              <IonSelectOption key={v.id} value={v.id}>
                {v.nombre}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>

        {/* Conteo de resultados */}
        {!loading && (
          <div style={{ padding: 'var(--space-sm) var(--space-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            {filtrados.length} cliente{filtrados.length !== 1 ? 's' : ''}
            {filtroVendedor && ` · ${getNombreVendedor(filtroVendedor)}`}
          </div>
        )}

        {/* Estados de carga */}
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
                {search || filtroVendedor
                  ? 'Sin resultados para los filtros actuales.'
                  : 'No hay clientes. Crea el primero.'}
              </p>
            </IonText>
          </div>
        )}

        {/* Lista de clientes */}
        {!loading && !error && (
          <IonList>
            {filtrados.map((cliente) => (
              <IonItemSliding key={cliente.id}>
                <IonItem
                  button
                  detail={false}
                  onClick={() => history.push(`/admin/clientes/${cliente.id}`)}
                >
                  <IonLabel>
                    <h2 style={{ fontWeight: 700, color: 'var(--color-navy)' }}>
                      {cliente.nombre}
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '5px 0', flexWrap: 'wrap' }}>
                      <Chip tone={cliente.tipo === 'mayoreo' ? 'mayoreo' : 'menudeo'}>
                        {cliente.tipo === 'mayoreo' ? 'Mayoreo' : 'Menudeo'}
                      </Chip>
                      <Chip tone={cliente.estado === 'activo' ? 'primarySoft' : 'amber'}>
                        {cliente.estado === 'activo' ? 'Activo' : 'Prospecto'}
                      </Chip>
                    </div>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      {getNombreVendedor(cliente.vendedor_id)}
                      {cliente.dia_ruta && ` · ${cliente.dia_ruta}`}
                    </p>
                    {cliente.fecha_proxima_visita && (
                      <IonNote style={{ fontSize: 'var(--font-size-xs)' }}>
                        Próxima visita: {cliente.fecha_proxima_visita}
                      </IonNote>
                    )}
                  </IonLabel>
                  <IonIcon icon={chevronForwardOutline} slot="end" style={{ color: 'var(--color-text-secondary)', fontSize: '16px' }} />
                </IonItem>

                <IonItemOptions side="end">
                  {/* Editar */}
                  <IonItemOption
                    color="primary"
                    onClick={() => {
                      setEditando(cliente);
                      setModalOpen(true);
                    }}
                    style={{ minWidth: '60px' }}
                  >
                    <IonIcon icon={pencilOutline} slot="icon-only" />
                  </IonItemOption>
                  {/* Baja lógica */}
                  <IonItemOption
                    color="danger"
                    onClick={() => setConfirmBaja(cliente.id)}
                    style={{ minWidth: '60px' }}
                  >
                    <IonIcon icon={archiveOutline} slot="icon-only" />
                  </IonItemOption>
                </IonItemOptions>
              </IonItemSliding>
            ))}
          </IonList>
        )}

        {/* FAB: Nuevo cliente */}
        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton
            style={{ '--background': 'var(--color-primary)' }}
            onClick={() => {
              setEditando(null);
              setModalOpen(true);
            }}
          >
            <IonIcon icon={addOutline} />
          </IonFabButton>
        </IonFab>

        {/* Modal: ClienteForm */}
        <IonModal
          isOpen={modalOpen}
          onDidDismiss={() => {
            setModalOpen(false);
            setEditando(null);
          }}
        >
          <ClienteForm
            inicial={editando ?? undefined}
            vendedores={vendedores}
            onSave={handleSave}
            onCancel={() => {
              setModalOpen(false);
              setEditando(null);
            }}
          />
        </IonModal>

        {/* Alerta: confirmar baja */}
        <IonAlert
          isOpen={!!confirmBaja}
          onDidDismiss={() => setConfirmBaja(null)}
          header="¿Dar de baja este cliente?"
          message="El cliente se marcará como inactivo. Su historial se conserva."
          buttons={[
            { text: 'Cancelar', role: 'cancel' },
            {
              text: 'Dar de baja',
              role: 'destructive',
              handler: () => {
                if (confirmBaja) handleBaja(confirmBaja);
              },
            },
          ]}
        />
      </IonContent>
    </IonPage>
  );
}
