/**
 * Logiclean Ruta — PresentacionForm
 *
 * Formulario para crear o editar una PRESENTACION.
 * Usado dentro de ProductoForm.
 */

import { useState } from 'react';
import {
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonText,
} from '@ionic/react';
import type { Presentacion } from '../../../db/schema';

// ── Tipos ─────────────────────────────────────────────────────

type PresentacionDraft = Omit<Presentacion, 'id' | 'producto_base_id' | 'activo'>;

interface PresentacionFormProps {
  /** Si se provee, se está editando una presentación existente */
  inicial?: Partial<Presentacion>;
  productoBaseId: string;
  onSave: (data: Omit<Presentacion, 'id'> & { id?: string }) => void;
  onCancel: () => void;
}

// ── Validación ────────────────────────────────────────────────

function validar(draft: PresentacionDraft): Record<string, string> {
  const errores: Record<string, string> = {};
  if (!draft.nombre.trim()) errores.nombre = 'El nombre es obligatorio';
  if (!draft.unidad_venta.trim()) errores.unidad_venta = 'La unidad de venta es obligatoria';
  if (draft.factor_conversion <= 0) errores.factor_conversion = 'El factor debe ser mayor que 0';
  if (draft.precio_mayoreo < 0) errores.precio_mayoreo = 'El precio no puede ser negativo';
  if (draft.precio_menudeo < 0) errores.precio_menudeo = 'El precio no puede ser negativo';
  return errores;
}

// ── Componente ────────────────────────────────────────────────

export function PresentacionForm({
  inicial,
  productoBaseId,
  onSave,
  onCancel,
}: PresentacionFormProps) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [unidadVenta, setUnidadVenta] = useState(inicial?.unidad_venta ?? '');
  const [factorConversion, setFactorConversion] = useState(
    String(inicial?.factor_conversion ?? 1)
  );
  const [precioMayoreo, setPrecioMayoreo] = useState(
    String(inicial?.precio_mayoreo ?? '')
  );
  const [precioMenudeo, setPrecioMenudeo] = useState(
    String(inicial?.precio_menudeo ?? '')
  );
  const [touched, setTouched] = useState(false);

  const draft: PresentacionDraft = {
    nombre,
    unidad_venta: unidadVenta,
    factor_conversion: parseFloat(factorConversion) || 0,
    precio_mayoreo: parseFloat(precioMayoreo) || 0,
    precio_menudeo: parseFloat(precioMenudeo) || 0,
  };

  // Estado derivado: los errores se recalculan en cada render una vez que
  // el usuario interactuó con el formulario (sin efecto ni setState).
  const errores = touched ? validar(draft) : {};

  const handleSubmit = () => {
    setTouched(true);
    const errs = validar(draft);
    if (Object.keys(errs).length > 0) {
      return;
    }
    onSave({
      ...(inicial?.id ? { id: inicial.id } : {}),
      producto_base_id: productoBaseId,
      nombre: draft.nombre.trim(),
      unidad_venta: draft.unidad_venta.trim(),
      factor_conversion: draft.factor_conversion,
      precio_mayoreo: draft.precio_mayoreo,
      precio_menudeo: draft.precio_menudeo,
      activo: inicial?.activo ?? true,
    });
  };

  return (
    // NO es un <form>: este sub-formulario vive embebido dentro del <form> de
    // ProductoForm. Un <form> anidado hace que el submit de "Agregar
    // presentación" burbujee y dispare también el submit del producto con un
    // estado de presentaciones aún sin actualizar (D-005). Se usa un <div> y un
    // botón type="button" para aislar la acción.
    <div style={{ padding: 'var(--space-sm) 0' }}>
      {/* Nombre */}
      <IonItem>
        <IonLabel position="stacked">Nombre de la presentación *</IonLabel>
        <IonInput
          value={nombre}
          onIonInput={(e) => setNombre(e.detail.value ?? '')}
          placeholder="Ej. Multiusos 1 L"
          style={{ minHeight: 'var(--touch-min, 48px)' }}
        />
      </IonItem>
      {errores.nombre && (
        <IonText color="danger">
          <p style={{ marginLeft: 'var(--space-md)', fontSize: 'var(--font-size-sm)' }}>{errores.nombre}</p>
        </IonText>
      )}

      {/* Unidad de venta */}
      <IonItem>
        <IonLabel position="stacked">Unidad de venta *</IonLabel>
        <IonInput
          value={unidadVenta}
          onIonInput={(e) => setUnidadVenta(e.detail.value ?? '')}
          placeholder="litro, pieza, kg..."
          style={{ minHeight: 'var(--touch-min, 48px)' }}
        />
      </IonItem>
      {errores.unidad_venta && (
        <IonText color="danger">
          <p style={{ marginLeft: 'var(--space-md)', fontSize: 'var(--font-size-sm)' }}>{errores.unidad_venta}</p>
        </IonText>
      )}

      {/* Factor de conversión */}
      <IonItem>
        <IonLabel position="stacked">Factor de conversión *</IonLabel>
        <IonInput
          type="number"
          value={factorConversion}
          onIonInput={(e) => setFactorConversion(e.detail.value ?? '1')}
          min="0.001"
          step="0.001"
          style={{ minHeight: 'var(--touch-min, 48px)' }}
        />
      </IonItem>
      {errores.factor_conversion && (
        <IonText color="danger">
          <p style={{ marginLeft: 'var(--space-md)', fontSize: 'var(--font-size-sm)' }}>{errores.factor_conversion}</p>
        </IonText>
      )}

      {/* Precio mayoreo */}
      <IonItem>
        <IonLabel position="stacked">Precio mayoreo *</IonLabel>
        <IonInput
          type="number"
          value={precioMayoreo}
          onIonInput={(e) => setPrecioMayoreo(e.detail.value ?? '')}
          min="0"
          step="0.01"
          inputmode="decimal"
          style={{ minHeight: 'var(--touch-min, 48px)' }}
        />
      </IonItem>
      {errores.precio_mayoreo && (
        <IonText color="danger">
          <p style={{ marginLeft: 'var(--space-md)', fontSize: 'var(--font-size-sm)' }}>{errores.precio_mayoreo}</p>
        </IonText>
      )}

      {/* Precio menudeo */}
      <IonItem>
        <IonLabel position="stacked">Precio menudeo *</IonLabel>
        <IonInput
          type="number"
          value={precioMenudeo}
          onIonInput={(e) => setPrecioMenudeo(e.detail.value ?? '')}
          min="0"
          step="0.01"
          inputmode="decimal"
          style={{ minHeight: 'var(--touch-min, 48px)' }}
        />
      </IonItem>
      {errores.precio_menudeo && (
        <IonText color="danger">
          <p style={{ marginLeft: 'var(--space-md)', fontSize: 'var(--font-size-sm)' }}>{errores.precio_menudeo}</p>
        </IonText>
      )}

      {/* Acciones */}
      <div style={{ display: 'flex', gap: '12px', padding: 'var(--space-md) 0', justifyContent: 'flex-end' }}>
        <IonButton fill="outline" color="medium" onClick={onCancel} type="button">
          Cancelar
        </IonButton>
        <IonButton
          type="button"
          onClick={handleSubmit}
          style={{ '--background': 'var(--color-primary)' }}
        >
          {inicial?.id ? 'Actualizar presentación' : 'Agregar presentación'}
        </IonButton>
      </div>
    </div>
  );
}
