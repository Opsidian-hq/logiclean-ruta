/**
 * Logiclean Ruta — ProductoForm (modal)
 *
 * Formulario para crear o editar un PRODUCTO_BASE.
 * Incluye sección de gestión de presentaciones.
 */

import React, { useState } from 'react';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonList,
  IonListHeader,
  IonText,
  IonBadge,
  IonIcon,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonSpinner,
} from '@ionic/react';
import { addOutline, pencilOutline, trashOutline } from 'ionicons/icons';
import { PresentacionForm } from './PresentacionForm';
import { generateUUID } from '../../../lib/uuid';
import { ORDEN_CATEGORIAS, NOMBRE_CATEGORIA } from '../../../lib/categoriaProducto';
import type { ProductoBase, Presentacion, CategoriaProducto } from '../../../db/schema';

// ── Tipos ─────────────────────────────────────────────────────

interface ProductoFormProps {
  /** Si se provee, se está editando un producto existente */
  inicial?: ProductoBase & { presentaciones?: Presentacion[] };
  onSave: (
    producto: Omit<ProductoBase, 'id'> & { id?: string },
    presentaciones: (Omit<Presentacion, 'id'> & { id?: string })[]
  ) => Promise<void>;
  onCancel: () => void;
}

// ── Validación del producto base ──────────────────────────────

function validarProducto(
  nombre: string,
  unidadCompra: string,
  categoria: string,
  litrosPorBidon: string
): Record<string, string> {
  const errores: Record<string, string> = {};
  if (!nombre.trim()) errores.nombre = 'El nombre es obligatorio';
  if (!unidadCompra) errores.unidad_compra = 'Selecciona la unidad de compra';
  if (!categoria) errores.categoria = 'Selecciona la categoría';
  if (unidadCompra === 'bidon' && !((parseFloat(litrosPorBidon) || 0) > 0)) {
    errores.litros_por_bidon = 'Los litros por bidón deben ser mayores que 0';
  }
  return errores;
}

// ── Componente ────────────────────────────────────────────────

export function ProductoForm({ inicial, onSave, onCancel }: ProductoFormProps) {
  const isEditing = !!inicial?.id;

  // Estado del producto base
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [unidadCompra, setUnidadCompra] = useState<'bidon' | 'docena' | ''>(
    (inicial?.unidad_compra as 'bidon' | 'docena') ?? ''
  );
  const [categoria, setCategoria] = useState<CategoriaProducto | ''>(
    inicial?.categoria ?? ''
  );
  const [precioPreferencial, setPrecioPreferencial] = useState(
    String(inicial?.precio_preferencial ?? '')
  );
  const [litrosPorBidon, setLitrosPorBidon] = useState(
    String(inicial?.litros_por_bidon ?? '')
  );

  // Estado de presentaciones
  const [presentaciones, setPresentaciones] = useState<
    (Omit<Presentacion, 'id'> & { id?: string })[]
  >(inicial?.presentaciones ?? []);
  const [editandoPresentacion, setEditandoPresentacion] = useState<
    Partial<Presentacion> | null
  >(null);
  const [agregandoPresentacion, setAgregandoPresentacion] = useState(false);

  // Estado del formulario
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  // Generar ID temporal para el producto (si es nuevo)
  const productoId = inicial?.id ?? generateUUID();

  // Estado derivado: los errores se recalculan en cada render una vez que
  // el usuario interactuó con el formulario (sin efecto ni setState).
  const errores = touched ? validarProducto(nombre, unidadCompra, categoria, litrosPorBidon) : {};

  const handleSavePresentacion = (
    data: Omit<Presentacion, 'id'> & { id?: string }
  ) => {
    if (editandoPresentacion?.id) {
      // Editar existente
      setPresentaciones((prev) =>
        prev.map((p) => (p.id === editandoPresentacion.id ? data : p))
      );
    } else {
      // Agregar nueva
      setPresentaciones((prev) => [...prev, { ...data, id: generateUUID() }]);
    }
    setEditandoPresentacion(null);
    setAgregandoPresentacion(false);
  };

  const handleDesactivarPresentacion = (id: string | undefined) => {
    if (!id) return;
    setPresentaciones((prev) =>
      prev.map((p) => (p.id === id ? { ...p, activo: false } : p))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const errs = validarProducto(nombre, unidadCompra, categoria, litrosPorBidon);
    if (Object.keys(errs).length > 0) {
      return;
    }

    setSaving(true);
    try {
      await onSave(
        {
          id: productoId,
          nombre: nombre.trim(),
          unidad_compra: unidadCompra as 'bidon' | 'docena',
          categoria: categoria as CategoriaProducto,
          precio_preferencial: precioPreferencial
            ? parseFloat(precioPreferencial)
            : undefined,
          litros_por_bidon: unidadCompra === 'bidon' && litrosPorBidon
            ? parseFloat(litrosPorBidon)
            : undefined,
          activo: inicial?.activo ?? true,
        },
        presentaciones
      );
    } finally {
      setSaving(false);
    }
  };

  const presentacionesActivas = presentaciones.filter((p) => p.activo !== false);

  return (
    <>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonTitle>{isEditing ? 'Editar producto' : 'Nuevo producto'}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onCancel} style={{ color: 'var(--color-on-dark)' }}>
              Cancelar
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <form onSubmit={handleSubmit} noValidate>
          {/* ── Datos del producto base ────────────────────── */}
          <IonListHeader
            style={{
              color: 'var(--color-navy)',
              fontWeight: 700,
              fontSize: 'var(--font-size-sm)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              paddingTop: 'var(--space-md)',
            }}
          >
            Datos del producto
          </IonListHeader>

          <IonList>
            <IonItem>
              <IonLabel position="stacked">Nombre *</IonLabel>
              <IonInput
                value={nombre}
                onIonInput={(e) => setNombre(e.detail.value ?? '')}
                placeholder="Ej. Multiusos concentrado"
                style={{ minHeight: 'var(--touch-min, 48px)' }}
              />
            </IonItem>
            {errores.nombre && (
              <IonText color="danger">
                <p style={{ marginLeft: 'var(--space-md)', fontSize: 'var(--font-size-sm)' }}>{errores.nombre}</p>
              </IonText>
            )}

            <IonItem>
              <IonLabel position="stacked">Unidad de compra *</IonLabel>
              <IonSelect
                value={unidadCompra}
                onIonChange={(e) => setUnidadCompra(e.detail.value)}
                placeholder="Seleccionar..."
                style={{ minHeight: 'var(--touch-min, 48px)' }}
              >
                <IonSelectOption value="bidon">Bidón</IonSelectOption>
                <IonSelectOption value="docena">Docena</IonSelectOption>
              </IonSelect>
            </IonItem>
            {errores.unidad_compra && (
              <IonText color="danger">
                <p style={{ marginLeft: 'var(--space-md)', fontSize: 'var(--font-size-sm)' }}>{errores.unidad_compra}</p>
              </IonText>
            )}

            {unidadCompra === 'bidon' && (
              <>
                <IonItem>
                  <IonLabel position="stacked">Litros por bidón *</IonLabel>
                  <IonInput
                    type="number"
                    value={litrosPorBidon}
                    onIonInput={(e) => setLitrosPorBidon(e.detail.value ?? '')}
                    placeholder="Ej. 20"
                    min="0.001"
                    step="0.001"
                    inputmode="decimal"
                    style={{ minHeight: 'var(--touch-min, 48px)' }}
                  />
                </IonItem>
                {errores.litros_por_bidon && (
                  <IonText color="danger">
                    <p style={{ marginLeft: 'var(--space-md)', fontSize: 'var(--font-size-sm)' }}>{errores.litros_por_bidon}</p>
                  </IonText>
                )}
              </>
            )}

            <IonItem>
              <IonLabel position="stacked">Categoría *</IonLabel>
              <IonSelect
                value={categoria}
                onIonChange={(e) => setCategoria(e.detail.value)}
                placeholder="Seleccionar..."
                style={{ minHeight: 'var(--touch-min, 48px)' }}
              >
                {ORDEN_CATEGORIAS.map((c) => (
                  <IonSelectOption key={c} value={c}>
                    {NOMBRE_CATEGORIA[c]}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            {errores.categoria && (
              <IonText color="danger">
                <p style={{ marginLeft: 'var(--space-md)', fontSize: 'var(--font-size-sm)' }}>{errores.categoria}</p>
              </IonText>
            )}

            <IonItem>
              <IonLabel position="stacked">Precio preferencial</IonLabel>
              <IonInput
                type="number"
                value={precioPreferencial}
                onIonInput={(e) => setPrecioPreferencial(e.detail.value ?? '')}
                placeholder="Opcional"
                min="0"
                step="0.01"
                inputmode="decimal"
                style={{ minHeight: 'var(--touch-min, 48px)' }}
              />
            </IonItem>
          </IonList>

          {/* ── Presentaciones ─────────────────────────────── */}
          <IonListHeader
            style={{
              color: 'var(--color-navy)',
              fontWeight: 700,
              fontSize: 'var(--font-size-sm)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              paddingTop: 'var(--space-md)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            Presentaciones
            <IonBadge
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-on-dark)',
              }}
            >
              {presentacionesActivas.length}
            </IonBadge>
          </IonListHeader>

          <IonList>
            {presentacionesActivas.map((pres, idx) => (
              <IonItemSliding key={pres.id ?? idx}>
                <IonItem>
                  <IonLabel>
                    <h3>{pres.nombre}</h3>
                    <p style={{ fontSize: 'var(--font-size-sm)' }}>
                      {pres.unidad_venta} · factor {pres.factor_conversion}
                      · May ${pres.precio_mayoreo} / Men ${pres.precio_menudeo}
                    </p>
                  </IonLabel>
                </IonItem>
                <IonItemOptions side="end">
                  <IonItemOption
                    color="primary"
                    onClick={() => {
                      setEditandoPresentacion(pres as Presentacion);
                      setAgregandoPresentacion(false);
                    }}
                    style={{ minWidth: '60px' }}
                  >
                    <IonIcon icon={pencilOutline} slot="icon-only" />
                  </IonItemOption>
                  <IonItemOption
                    color="danger"
                    onClick={() => handleDesactivarPresentacion(pres.id)}
                    style={{ minWidth: '60px' }}
                  >
                    <IonIcon icon={trashOutline} slot="icon-only" />
                  </IonItemOption>
                </IonItemOptions>
              </IonItemSliding>
            ))}
          </IonList>

          {/* Formulario de presentación inline */}
          {(agregandoPresentacion || editandoPresentacion) && (
            <div
              style={{
                margin: 'var(--space-sm) var(--space-md)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-sm)',
              }}
            >
              <PresentacionForm
                inicial={editandoPresentacion ?? undefined}
                productoBaseId={productoId}
                onSave={handleSavePresentacion}
                onCancel={() => {
                  setEditandoPresentacion(null);
                  setAgregandoPresentacion(false);
                }}
              />
            </div>
          )}

          {/* Botón agregar presentación */}
          {!agregandoPresentacion && !editandoPresentacion && (
            <div style={{ padding: 'var(--space-sm) var(--space-md)' }}>
              <IonButton
                fill="outline"
                expand="block"
                onClick={() => setAgregandoPresentacion(true)}
                style={{
                  '--border-color': 'var(--color-primary)',
                  '--color': 'var(--color-primary)',
                  minHeight: 'var(--touch-min, 48px)',
                }}
              >
                <IonIcon icon={addOutline} slot="start" />
                Agregar presentación
              </IonButton>
            </div>
          )}

          {/* Botón guardar producto */}
          <div style={{ padding: 'var(--space-md)' }}>
            <IonButton
              type="submit"
              expand="block"
              disabled={saving}
              style={{
                '--background': 'var(--color-primary)',
                '--border-radius': 'var(--radius-lg)',
                '--box-shadow': 'var(--shadow-cta)',
                height: 'var(--cta-height)',
                fontWeight: 800,
              }}
            >
              {saving ? (
                <IonSpinner name="crescent" style={{ color: 'var(--color-on-dark)' }} />
              ) : isEditing ? (
                'Guardar cambios'
              ) : (
                'Crear producto'
              )}
            </IonButton>
          </div>
        </form>
      </IonContent>
    </>
  );
}
