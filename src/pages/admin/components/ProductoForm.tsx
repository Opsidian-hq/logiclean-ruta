/**
 * Logiclean Ruta — ProductoForm (modal)
 *
 * Formulario para crear o editar un PRODUCTO_BASE.
 * Incluye sección de gestión de presentaciones.
 */

import React, { useState, useEffect } from 'react';
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
import type { ProductoBase, Presentacion } from '../../../db/schema';

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

function validarProducto(nombre: string, unidadCompra: string): Record<string, string> {
  const errores: Record<string, string> = {};
  if (!nombre.trim()) errores.nombre = 'El nombre es obligatorio';
  if (!unidadCompra) errores.unidad_compra = 'Selecciona la unidad de compra';
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
  const [precioPreferencial, setPrecioPreferencial] = useState(
    String(inicial?.precio_preferencial ?? '')
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
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  // Generar ID temporal para el producto (si es nuevo)
  const productoId = inicial?.id ?? generateUUID();

  useEffect(() => {
    if (touched) {
      setErrores(validarProducto(nombre, unidadCompra));
    }
  }, [nombre, unidadCompra, touched]);

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
    const errs = validarProducto(nombre, unidadCompra);
    if (Object.keys(errs).length > 0) {
      setErrores(errs);
      return;
    }

    setSaving(true);
    try {
      await onSave(
        {
          id: productoId,
          nombre: nombre.trim(),
          unidad_compra: unidadCompra as 'bidon' | 'docena',
          precio_preferencial: precioPreferencial
            ? parseFloat(precioPreferencial)
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
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': '#fff' }}>
          <IonTitle>{isEditing ? 'Editar producto' : 'Nuevo producto'}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onCancel} style={{ color: '#fff' }}>
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
              fontSize: '13px',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              paddingTop: '16px',
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
                <p style={{ marginLeft: '16px', fontSize: '13px' }}>{errores.nombre}</p>
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
                <p style={{ marginLeft: '16px', fontSize: '13px' }}>{errores.unidad_compra}</p>
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
              fontSize: '13px',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              paddingTop: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            Presentaciones
            <IonBadge
              style={{
                backgroundColor: 'var(--color-primary)',
                color: '#fff',
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
                    <p style={{ fontSize: '13px' }}>
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
                margin: '8px 16px',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                padding: '8px',
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
            <div style={{ padding: '8px 16px' }}>
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
          <div style={{ padding: '16px' }}>
            <IonButton
              type="submit"
              expand="block"
              disabled={saving}
              style={{
                '--background': 'var(--color-primary)',
                minHeight: 'var(--touch-min, 48px)',
              }}
            >
              {saving ? (
                <IonSpinner name="crescent" style={{ color: '#fff' }} />
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
