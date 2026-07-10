/**
 * Logiclean Ruta — Paso 1 · Validación por vendedor (H-20, reusa H-10 c1-c3)
 *
 * Por cada vendedor activo: bolsa reconciliada (efectivo/transferencia neta
 * de ruta) y CxC nueva del periodo — ya derivadas por
 * `derivarVendedorEntrada` (Inc 7.4), sin recálculo aquí. Con arrastre
 * entrante (saldo de apertura ≠ 0), se muestra la banda de apertura antes de
 * la lista.
 */

import { IonItem, IonLabel, IonCheckbox, IonButton, IonBadge } from '@ionic/react';
import { useState } from 'react';
import type { VendedorEntrada } from '../../../domain/corte';
import type { Vendedor } from '../../../db/schema';
import { Card } from '../../../components/ui/Card';
import { money } from '../../../lib/money';
import { sectionLabel, rowBetween } from './styles';
import { AvatarInicial, NotaInfo } from './shared';
import { DevolucionBodegaModal } from './DevolucionBodegaModal';

interface PasoValidacionProps {
  vendedores: Vendedor[];
  vendedoresEntrada: VendedorEntrada[];
  confirmaciones: Record<string, boolean>;
  toggleConfirmacion: (vendedorId: string) => void;
  saldoModernaApertura: number;
  responsableId: string | null;
}

export function PasoValidacion({
  vendedores,
  vendedoresEntrada,
  confirmaciones,
  toggleConfirmacion,
  saldoModernaApertura,
  responsableId,
}: PasoValidacionProps) {
  const [devolucionPara, setDevolucionPara] = useState<Vendedor | null>(null);
  const entradaPorId = new Map(vendedoresEntrada.map((e) => [e.vendedor_id, e]));

  const vendedoresConArrastre = vendedoresEntrada.filter((e) => e.saldo_vendedor_apertura !== 0);
  const hayArrastreEntrante = vendedoresConArrastre.length > 0 || saldoModernaApertura !== 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {hayArrastreEntrante && (
        <div
          style={{
            border: '1.5px solid #F6C97C',
            background: '#FEF3E2',
            borderRadius: '16px',
            padding: '13px 15px',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#7A3E06', marginBottom: '8px' }}>
            ● Este corte abre con arrastre
          </div>
          {vendedoresConArrastre.map((e) => {
            const nombre = vendedores.find((v) => v.id === e.vendedor_id)?.nombre ?? e.vendedor_id;
            const debe = e.saldo_vendedor_apertura < 0;
            return (
              <div key={e.vendedor_id} style={{ ...rowBetween, paddingTop: '9px', borderTop: '1px solid #F6C97C', marginTop: '9px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#7A3E06' }}>{nombre} ↔ negocio</span>
                <span className="numeric" style={{ fontSize: '14.5px', fontWeight: 800, color: debe ? '#911A11' : '#7A3E06' }}>
                  {debe ? `Debe ${money(Math.abs(e.saldo_vendedor_apertura))}` : `A favor ${money(e.saldo_vendedor_apertura)}`}
                </span>
              </div>
            );
          })}
          {saldoModernaApertura !== 0 && (
            <div style={{ ...rowBetween, paddingTop: '9px', borderTop: vendedoresConArrastre.length ? '1px solid #F6C97C' : 'none', marginTop: vendedoresConArrastre.length ? '9px' : 0 }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#7A3E06' }}>Negocio ↔ La Moderna</span>
              <span className="numeric" style={{ fontSize: '13px', fontWeight: 800, color: '#7A3E06' }}>
                {money(saldoModernaApertura)} a favor de La Moderna
              </span>
            </div>
          )}
        </div>
      )}

      <span style={sectionLabel}>Validación por vendedor</span>

      {vendedores.map((v) => {
        const entrada = entradaPorId.get(v.id);
        if (!entrada) return null;
        return (
          <Card key={v.id} padding="15px">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <AvatarInicial nombre={v.nombre} />
              <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-navy)' }}>{v.nombre}</span>
            </div>

            <IonItem lines="full" style={{ '--background': 'transparent', '--padding-start': '0', '--min-height': '34px' }}>
              <IonLabel style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Efectivo neto de ruta</IonLabel>
              <span slot="end" className="numeric" style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-navy)' }}>
                {money(entrada.efectivo_cobrado_neto)}
              </span>
            </IonItem>
            <IonItem lines="full" style={{ '--background': 'transparent', '--padding-start': '0', '--min-height': '34px' }}>
              <IonLabel style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Transferencia neta</IonLabel>
              <span slot="end" className="numeric" style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-navy)' }}>
                {money(entrada.transfer_cobrado_neto)}
              </span>
            </IonItem>
            <IonItem lines="none" style={{ '--background': 'transparent', '--padding-start': '0', '--min-height': '34px' }}>
              <IonLabel style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>CxC nueva del periodo</IonLabel>
              <span slot="end" className="numeric" style={{ fontSize: '14px', fontWeight: 800, color: '#B54708' }}>
                {money(entrada.cxc_nueva)}
              </span>
            </IonItem>

            <IonItem
              lines="none"
              style={{
                '--background': 'transparent',
                '--padding-start': '0',
                '--min-height': '0',
                borderTop: '1px solid var(--color-divider)',
                marginTop: '6px',
                paddingTop: '9px',
              }}
            >
              <IonCheckbox
                slot="start"
                checked={!!confirmaciones[v.id]}
                onIonChange={() => toggleConfirmacion(v.id)}
                color="success"
                style={{ marginRight: '8px' }}
                aria-label={`Confirmado por ${v.nombre}`}
              />
              <IonLabel style={{ fontSize: '12.5px', fontWeight: 700, color: confirmaciones[v.id] ? '#3E6B22' : 'var(--color-text-secondary)' }}>
                Confirmado por {v.nombre}
              </IonLabel>
              {confirmaciones[v.id] && <IonBadge slot="end" color="success">✓</IonBadge>}
            </IonItem>

            <IonButton
              expand="block"
              fill="clear"
              size="small"
              onClick={() => setDevolucionPara(v)}
              style={{ '--background': 'var(--color-primary-soft)', '--color': 'var(--color-primary)', '--border-radius': '9px', height: '36px', fontWeight: 800, fontSize: '12.5px', marginTop: '8px' }}
            >
              ↩ Devolver stock a bodega
            </IonButton>
          </Card>
        );
      })}

      {vendedores.length === 1 && (
        <NotaInfo>
          Con un solo vendedor activo, el reparto del Paso 4 no compara: él se queda el remanente completo.
        </NotaInfo>
      )}

      {devolucionPara && (
        <DevolucionBodegaModal
          isOpen
          onClose={() => setDevolucionPara(null)}
          vendedorId={devolucionPara.id}
          vendedorNombre={devolucionPara.nombre}
          responsableId={responsableId}
        />
      )}
    </div>
  );
}
