/**
 * Logiclean Ruta — Corte por reparto (H-20, Inc 7.1)
 *
 * Tipos del motor de dominio puro. Nombres de campo en snake_case a
 * propósito: coinciden 1:1 con las columnas de CORTE / CORTE_VENDEDOR /
 * LIQUIDACION_MOVIMIENTO (modelo-datos-v1_4-corte-reparto.md), para que la
 * capa de persistencia (Inc 7.2+) no tenga que remapear nombres.
 */

/** Insumos de un vendedor para el periodo (reglas 1-2 del modelo delta). */
export interface VendedorEntrada {
  vendedor_id: string;
  /** Cobros efectivo − gastos de ruta efectivo, del periodo. */
  efectivo_cobrado_neto: number;
  /** Cobros transferencia − gastos de ruta transferencia, del periodo. */
  transfer_cobrado_neto: number;
  /** Porción a crédito de ventas de ESTE periodo, aún no cobrada. */
  cxc_nueva: number;
  /** Cobros de este periodo sobre ventas de periodos anteriores (R9: no es ingreso). */
  cobro_cxc_vieja: number;
  /** Saldo vendedor↔negocio entrante (cierre del corte anterior; 0 en el primer corte). */
  saldo_vendedor_apertura: number;
  /**
   * Efectivo/transferencia que el vendedor ya se quedó (abono
   * `direccion='negocio_a_vendedor'`, Inc 7.5.2) desde el corte anterior —
   * salió de su bolsa física antes de este corte. Opcionales: `undefined`
   * equivale a 0, para no romper construcciones existentes de `VendedorEntrada`.
   */
  abono_ya_retirado_efectivo?: number;
  abono_ya_retirado_transferencia?: number;
  /**
   * Efectivo/transferencia que el vendedor ya entregó al negocio (abono
   * `direccion='vendedor_a_negocio'`) desde el corte anterior — también salió
   * de su bolsa física, aunque nunca dejó el pool colectivo.
   */
  abono_ya_entregado_efectivo?: number;
  abono_ya_entregado_transferencia?: number;
}

/** Insumos a nivel negocio para el periodo (Inc 6 + gastos de backoffice). */
export interface NegocioEntrada {
  /** (recibido − devuelto) × precio_preferencial, Inc 6 / ADR-0009. */
  adeudo_la_moderna: number;
  /** Gastos de backoffice del periodo aún no liquidados. */
  backoffice_pendiente: number;
  /** Saldo negocio↔La Moderna entrante (cierre del corte anterior; 0 en el primer corte). */
  saldo_moderna_apertura: number;
}

export interface CorteEntrada {
  vendedores: VendedorEntrada[];
  negocio: NegocioEntrada;
}

export type FormaPago = 'efectivo' | 'transferencia';
export type OrigenTipo = 'vendedor' | 'negocio';
export type DestinoTipo = 'la_moderna' | 'backoffice' | 'vendedor' | 'negocio';

/** Una instrucción concreta de movimiento de dinero (Paso 5, ADR-0011). */
export interface LiquidacionMovimiento {
  origen_tipo: OrigenTipo;
  origen_vendedor_id: string | null;
  destino_tipo: DestinoTipo;
  destino_vendedor_id: string | null;
  monto: number;
  forma_pago: FormaPago;
  nota?: string;
}

/** Estados de borde detectables desde los propios insumos/salidas del motor
 * (la identidad de control de Inc 6 vive fuera de este motor — el corte la
 * lee, no la recalcula: modelo-datos-v1_4-corte-reparto.md §Estados de borde). */
export type Alerta =
  | { tipo: 'la_moderna_topada'; faltante: number }
  | { tipo: 'vendedor_negativo'; vendedor_id: string; monto: number }
  | { tipo: 'arrastre_entrante'; vendedor_id?: string }
  | { tipo: 'abono_excede_bolsa'; vendedor_id: string; monto: number };

export interface VendedorSalida {
  vendedor_id: string;
  /** t_por_vendedor − cxc_nueva. Puede ser negativa (regla 3). */
  posicion_objetivo: number;
  /** Lo que se le entrega hoy: max(posicion_objetivo, 0). */
  efectivo_entregado: number;
  /** Saldo vendedor↔negocio saliente (regla 5). */
  saldo_vendedor_cierre: number;
}

export interface CorteSalida {
  ventas_periodo: number;
  obligaciones_total: number;
  pool_liquido: number;
  v_remanente: number;
  t_por_vendedor: number;
  /** Lo que liberan los vendedores tras reservar su posición objetivo (regla 4). */
  disponible_obligaciones: number;
  por_vendedor: VendedorSalida[];
  /** Saldo negocio↔La Moderna saliente, topado si el pool no alcanza (regla 4-5). */
  saldo_moderna_cierre: number;
  liquidacion: LiquidacionMovimiento[];
  alertas: Alerta[];
}
