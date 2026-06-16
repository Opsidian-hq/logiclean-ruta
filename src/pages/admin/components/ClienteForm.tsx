/**
 * Logiclean Ruta — ClienteForm (modal)
 *
 * Formulario para crear o editar un CLIENTE.
 * También permite reasignar a otro vendedor.
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
  IonText,
  IonList,
  IonListHeader,
  IonSpinner,
} from '@ionic/react';
import type { Cliente, Vendedor } from '../../../db/schema';

// ── Tipos ─────────────────────────────────────────────────────

interface ClienteFormProps {
  inicial?: Cliente;
  vendedores: Vendedor[];
  onSave: (data: Omit<Cliente, 'id'> & { id?: string }) => Promise<void>;
  onCancel: () => void;
}

// ── Validación ────────────────────────────────────────────────

function validar(
  nombre: string,
  tipo: string,
  estado: string,
  vendedorId: string
): Record<string, string> {
  const errores: Record<string, string> = {};
  if (!nombre.trim()) errores.nombre = 'El nombre es obligatorio';
  if (!tipo) errores.tipo = 'Selecciona el tipo';
  if (!estado) errores.estado = 'Selecciona el estado';
  if (!vendedorId) errores.vendedor_id = 'Asigna un vendedor';
  return errores;
}

// ── Componente ────────────────────────────────────────────────

export function ClienteForm({
  inicial,
  vendedores,
  onSave,
  onCancel,
}: ClienteFormProps) {
  const isEditing = !!inicial?.id;

  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [tipo, setTipo] = useState<'mayoreo' | 'menudeo' | ''>(
    (inicial?.tipo as 'mayoreo' | 'menudeo') ?? ''
  );
  const [estado, setEstado] = useState<'prospecto' | 'activo' | ''>(
    (inicial?.estado as 'prospecto' | 'activo') ?? ''
  );
  const [vendedorId, setVendedorId] = useState(inicial?.vendedor_id ?? '');
  const [cicloVisita, setCicloVisita] = useState(String(inicial?.ciclo_visita ?? 1));
  const [diaRuta, setDiaRuta] = useState(inicial?.dia_ruta ?? '');
  const [fechaProxima, setFechaProxima] = useState(
    inicial?.fecha_proxima_visita ?? ''
  );

  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  // Estado derivado: los errores se recalculan en cada render una vez que
  // el usuario interactuó con el formulario (sin efecto ni setState).
  const errores = touched ? validar(nombre, tipo, estado, vendedorId) : {};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const errs = validar(nombre, tipo, estado, vendedorId);
    if (Object.keys(errs).length > 0) {
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...(inicial?.id ? { id: inicial.id } : {}),
        nombre: nombre.trim(),
        tipo: tipo as 'mayoreo' | 'menudeo',
        estado: estado as 'prospecto' | 'activo',
        vendedor_id: vendedorId,
        ciclo_visita: parseInt(cicloVisita, 10) || 1,
        dia_ruta: diaRuta.trim() || undefined,
        fecha_proxima_visita: fechaProxima || undefined,
        activo: inicial?.activo ?? true,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': '#fff' }}>
          <IonTitle>{isEditing ? 'Editar cliente' : 'Nuevo cliente'}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onCancel} style={{ color: '#fff' }}>
              Cancelar
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <form onSubmit={handleSubmit} noValidate>
          {/* ── Datos básicos ─────────────────────────────── */}
          <IonListHeader
            style={{
              color: 'var(--color-navy)',
              fontWeight: 700,
              fontSize: '13px',
              textTransform: 'uppercase',
              paddingTop: '16px',
            }}
          >
            Datos del cliente
          </IonListHeader>

          <IonList>
            {/* Nombre */}
            <IonItem>
              <IonLabel position="stacked">Nombre *</IonLabel>
              <IonInput
                value={nombre}
                onIonInput={(e) => setNombre(e.detail.value ?? '')}
                placeholder="Nombre del cliente"
                style={{ minHeight: 'var(--touch-min, 48px)' }}
              />
            </IonItem>
            {errores.nombre && (
              <IonText color="danger">
                <p style={{ marginLeft: '16px', fontSize: '13px' }}>{errores.nombre}</p>
              </IonText>
            )}

            {/* Vendedor asignado */}
            <IonItem>
              <IonLabel position="stacked">Vendedor asignado *</IonLabel>
              <IonSelect
                value={vendedorId}
                onIonChange={(e) => setVendedorId(e.detail.value)}
                placeholder="Seleccionar vendedor..."
                style={{ minHeight: 'var(--touch-min, 48px)' }}
              >
                {vendedores.map((v) => (
                  <IonSelectOption key={v.id} value={v.id}>
                    {v.nombre} ({v.tipo})
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            {errores.vendedor_id && (
              <IonText color="danger">
                <p style={{ marginLeft: '16px', fontSize: '13px' }}>{errores.vendedor_id}</p>
              </IonText>
            )}

            {/* Tipo */}
            <IonItem>
              <IonLabel position="stacked">Tipo de cliente *</IonLabel>
              <IonSelect
                value={tipo}
                onIonChange={(e) => setTipo(e.detail.value)}
                placeholder="Seleccionar..."
                style={{ minHeight: 'var(--touch-min, 48px)' }}
              >
                <IonSelectOption value="mayoreo">Mayoreo</IonSelectOption>
                <IonSelectOption value="menudeo">Menudeo</IonSelectOption>
              </IonSelect>
            </IonItem>
            {errores.tipo && (
              <IonText color="danger">
                <p style={{ marginLeft: '16px', fontSize: '13px' }}>{errores.tipo}</p>
              </IonText>
            )}

            {/* Estado */}
            <IonItem>
              <IonLabel position="stacked">Estado *</IonLabel>
              <IonSelect
                value={estado}
                onIonChange={(e) => setEstado(e.detail.value)}
                placeholder="Seleccionar..."
                style={{ minHeight: 'var(--touch-min, 48px)' }}
              >
                <IonSelectOption value="prospecto">Prospecto</IonSelectOption>
                <IonSelectOption value="activo">Activo</IonSelectOption>
              </IonSelect>
            </IonItem>
            {errores.estado && (
              <IonText color="danger">
                <p style={{ marginLeft: '16px', fontSize: '13px' }}>{errores.estado}</p>
              </IonText>
            )}
          </IonList>

          {/* ── Ruta ──────────────────────────────────────── */}
          <IonListHeader
            style={{
              color: 'var(--color-navy)',
              fontWeight: 700,
              fontSize: '13px',
              textTransform: 'uppercase',
              paddingTop: '8px',
            }}
          >
            Datos de ruta
          </IonListHeader>

          <IonList>
            {/* Ciclo de visita */}
            <IonItem>
              <IonLabel position="stacked">Punto del ciclo (visita actual)</IonLabel>
              <IonInput
                type="number"
                value={cicloVisita}
                onIonInput={(e) => setCicloVisita(e.detail.value ?? '1')}
                min="1"
                step="1"
                style={{ minHeight: 'var(--touch-min, 48px)' }}
              />
            </IonItem>

            {/* Día de ruta */}
            <IonItem>
              <IonLabel position="stacked">Día de ruta</IonLabel>
              <IonInput
                value={diaRuta}
                onIonInput={(e) => setDiaRuta(e.detail.value ?? '')}
                placeholder="Ej. Lunes, Martes..."
                style={{ minHeight: 'var(--touch-min, 48px)' }}
              />
            </IonItem>

            {/* Fecha próxima visita */}
            <IonItem>
              <IonLabel position="stacked">Fecha próxima visita</IonLabel>
              <IonInput
                type="date"
                value={fechaProxima}
                onIonInput={(e) => setFechaProxima(e.detail.value ?? '')}
                style={{ minHeight: 'var(--touch-min, 48px)' }}
              />
            </IonItem>
          </IonList>

          {/* ── Guardar ────────────────────────────────────── */}
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
                'Crear cliente'
              )}
            </IonButton>
          </div>
        </form>
      </IonContent>
    </>
  );
}
