/**
 * Logiclean Ruta — CatalogoPage (H-13 — gerente)
 *
 * Gestión del catálogo de productos y presentaciones.
 * Ruta: /admin/catalogo
 *
 * Funciones:
 *  - Lista de PRODUCTO_BASE activos con sus presentaciones
 *  - Botón "Nuevo producto" → modal ProductoForm
 *  - Por cada producto: Editar y Dar de baja (activo=false)
 */

import { useState, useCallback } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonIcon,
  IonList,
  IonListHeader,
  IonItem,
  IonLabel,
  IonBadge,
  IonSearchbar,
  IonModal,
  IonSpinner,
  IonText,
  IonAlert,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonFab,
  IonFabButton,
  IonToast,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/react';
import { addOutline, pencilOutline, archiveOutline, swapHorizontalOutline } from 'ionicons/icons';
import { useCatalog } from '../../hooks/useCatalog';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { CuentaButton } from '../../components/CuentaButton';
import { ProductoForm } from './components/ProductoForm';
import { agruparPorCategoria, NOMBRE_CATEGORIA } from '../../lib/categoriaProducto';
import type { ProductoBase, Presentacion } from '../../db/schema';

// ── Componente ────────────────────────────────────────────────

export function CatalogoPage() {
  const {
    productos,
    loading,
    error,
    saveProducto,
    desactivarProducto,
    savePresentacion,
    refresh,
  } = useCatalog();

  const { handleRefresh } = usePullToRefresh(
    useCallback(async () => { await refresh(); }, [refresh])
  );

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<
    (ProductoBase & { presentaciones?: Presentacion[] }) | null
  >(null);
  const [confirmBaja, setConfirmBaja] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; color: 'success' | 'danger' } | null>(null);

  const filtrados = productos.filter((p) =>
    p.nombre.toLowerCase().includes(search.toLowerCase())
  );
  const grupos = agruparPorCategoria(filtrados);

  const handleSaveProducto = async (
    productoData: Omit<ProductoBase, 'id'> & { id?: string },
    presentacionesData: (Omit<Presentacion, 'id'> & { id?: string })[]
  ) => {
    const editandoExistente = !!productoData.id && !!editando;
    try {
      await saveProducto(productoData);

      // Guardar presentaciones
      for (const pres of presentacionesData) {
        await savePresentacion({
          ...pres,
          producto_base_id: productoData.id!,
        });
      }

      setModalOpen(false);
      setEditando(null);
      // Refrescar la lista para que el producto recién guardado aparezca sin
      // navegación manual, y confirmar al gerente que la operación se guardó.
      await refresh();
      setToast({
        message: editandoExistente ? 'Cambios guardados' : 'Producto guardado',
        color: 'success',
      });
    } catch (err) {
      // El insert falló (p. ej. validación o BD local): feedback explícito en
      // vez de cerrar el modal en silencio. El modal queda abierto para reintentar.
      // Logging explícito para diagnosticar la causa raíz del fallo (D-005).
      console.error('[Catalogo] alta/edición de producto falló:', err);
      const detalle = err instanceof Error ? err.message : '';
      setToast({
        message: detalle
          ? `No se pudo guardar el producto: ${detalle}`
          : 'No se pudo guardar el producto. Intenta de nuevo.',
        color: 'danger',
      });
    }
  };

  const handleBaja = async (id: string) => {
    try {
      await desactivarProducto(id);
      setConfirmBaja(null);
      setToast({ message: 'Producto dado de baja', color: 'success' });
    } catch {
      setConfirmBaja(null);
      setToast({ message: 'No se pudo dar de baja el producto. Intenta de nuevo.', color: 'danger' });
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonTitle>Catálogo</IonTitle>
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

        {/* Buscador */}
        <IonSearchbar
          value={search}
          onIonInput={(e) => setSearch(e.detail.value ?? '')}
          placeholder="Buscar producto..."
          style={{ '--background': 'var(--color-surface)' }}
        />

        {/* Estados de carga */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: 'var(--space-lg)' }}>
            <IonText color="danger">
              <p>Error al cargar el catálogo: {error}</p>
            </IonText>
          </div>
        )}

        {!loading && !error && filtrados.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <IonText color="medium">
              <p>
                {search
                  ? `Sin resultados para "${search}"`
                  : 'No hay productos. Crea el primero.'}
              </p>
            </IonText>
          </div>
        )}

        {/* Pista de swipe: el patrón de deslizar no es descubrible por sí solo (D-006). */}
        {!loading && !error && filtrados.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px var(--space-md) 8px',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
            }}
          >
            <IonIcon icon={swapHorizontalOutline} aria-hidden="true" />
            <span>Desliza un producto a la izquierda para editar o dar de baja.</span>
          </div>
        )}

        {/* Lista de productos, agrupada por categoría */}
        {!loading && !error && grupos.map((grupo) => (
          <IonList key={grupo.categoria}>
            <IonListHeader
              style={{
                color: 'var(--color-navy)',
                fontWeight: 700,
                fontSize: 'var(--font-size-sm)',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              {NOMBRE_CATEGORIA[grupo.categoria]}
              <IonBadge
                slot="end"
                style={{ backgroundColor: 'var(--color-surface-muted)', color: 'var(--color-text-secondary)' }}
              >
                {grupo.items.length}
              </IonBadge>
            </IonListHeader>

            {grupo.items.map((producto) => (
              <IonItemSliding key={producto.id}>
                <IonItem>
                  <IonLabel>
                    <h2 style={{ fontWeight: 700, color: 'var(--color-navy)' }}>
                      {producto.nombre}
                    </h2>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      {producto.unidad_compra}
                      {producto.precio_preferencial != null && (
                        <> · Precio pref: ${producto.precio_preferencial.toFixed(2)}</>
                      )}
                    </p>
                    {/* Presentaciones resumidas */}
                    <p style={{ fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-xs)' }}>
                      {producto.presentaciones.length > 0
                        ? producto.presentaciones.map((p) => p.nombre).join(' · ')
                        : 'Sin presentaciones'}
                    </p>
                  </IonLabel>
                  <IonBadge
                    slot="end"
                    style={{
                      backgroundColor: 'var(--color-cyan)',
                      color: 'var(--color-navy)',
                    }}
                  >
                    {producto.presentaciones.length}
                  </IonBadge>
                </IonItem>

                <IonItemOptions side="end">
                  {/* Editar */}
                  <IonItemOption
                    color="primary"
                    onClick={() => {
                      setEditando(producto);
                      setModalOpen(true);
                    }}
                    style={{ minWidth: '60px' }}
                  >
                    <IonIcon icon={pencilOutline} slot="icon-only" />
                  </IonItemOption>
                  {/* Baja lógica */}
                  <IonItemOption
                    color="danger"
                    onClick={() => setConfirmBaja(producto.id)}
                    style={{ minWidth: '60px' }}
                  >
                    <IonIcon icon={archiveOutline} slot="icon-only" />
                  </IonItemOption>
                </IonItemOptions>
              </IonItemSliding>
            ))}
          </IonList>
        ))}

        {/* FAB: Nuevo producto */}
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

        {/* Modal: ProductoForm */}
        <IonModal
          isOpen={modalOpen}
          onDidDismiss={() => {
            setModalOpen(false);
            setEditando(null);
          }}
        >
          <ProductoForm
            inicial={editando ?? undefined}
            onSave={handleSaveProducto}
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
          header="¿Dar de baja este producto?"
          message="El producto se marcará como inactivo. Puedes reactivarlo desde la base de datos."
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

        {/* Feedback explícito de guardado / baja (D-005) */}
        <IonToast
          isOpen={!!toast}
          message={toast?.message ?? ''}
          color={toast?.color}
          duration={2500}
          onDidDismiss={() => setToast(null)}
        />
      </IonContent>
    </IonPage>
  );
}
