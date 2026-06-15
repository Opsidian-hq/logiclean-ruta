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

import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
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
import { addOutline, pencilOutline, archiveOutline } from 'ionicons/icons';
import { useClientes } from '../../hooks/useClientes';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
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

  const getBadgeColor = (estado: string) => {
    return estado === 'activo' ? 'success' : 'warning';
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': '#fff' }}>
          <IonTitle>Clientes</IonTitle>
          <IonButtons slot="end">
            <SyncStatusBadge showLabel={false} />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {/* Buscador */}
        <IonSearchbar
          value={search}
          onIonInput={(e) => setSearch(e.detail.value ?? '')}
          placeholder="Buscar cliente..."
          style={{ '--background': '#fff' }}
        />

        {/* Filtro por vendedor */}
        <IonItem style={{ paddingBottom: '8px' }}>
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
          <div style={{ padding: '8px 16px', fontSize: '13px', color: '#6B7280' }}>
            {filtrados.length} cliente{filtrados.length !== 1 ? 's' : ''}
            {filtroVendedor && ` · ${getNombreVendedor(filtroVendedor)}`}
          </div>
        )}

        {/* Estados de carga */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: '24px' }}>
            <IonText color="danger">
              <p>Error al cargar clientes: {error}</p>
            </IonText>
          </div>
        )}

        {!loading && !error && filtrados.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
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
                <IonItem>
                  <IonLabel>
                    <h2 style={{ fontWeight: 700, color: 'var(--color-navy)' }}>
                      {cliente.nombre}
                    </h2>
                    <p style={{ fontSize: '13px', color: '#6B7280' }}>
                      {getNombreVendedor(cliente.vendedor_id)} · {cliente.tipo}
                      {cliente.dia_ruta && ` · ${cliente.dia_ruta}`}
                    </p>
                    {cliente.fecha_proxima_visita && (
                      <IonNote style={{ fontSize: '12px' }}>
                        Próxima visita: {cliente.fecha_proxima_visita}
                      </IonNote>
                    )}
                  </IonLabel>
                  <IonBadge
                    slot="end"
                    color={getBadgeColor(cliente.estado)}
                    style={{ textTransform: 'capitalize' }}
                  >
                    {cliente.estado}
                  </IonBadge>
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
              handler: () => confirmBaja && handleBaja(confirmBaja),
            },
          ]}
        />
      </IonContent>
    </IonPage>
  );
}
