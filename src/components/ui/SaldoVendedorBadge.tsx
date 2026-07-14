/**
 * Logiclean Ruta — SaldoVendedorBadge (Inc 7.5)
 *
 * Saldo vigente de un vendedor con el negocio: "Debe $X" (tono error) o
 * "A favor $X" (paleta ámbar ya usada en PasoValidacion.tsx para arrastre).
 * No renderiza nada si el saldo es 0 (al corriente) — sin ruido visual.
 */

import { Chip } from './Chip';
import { money } from '../../lib/money';

interface SaldoVendedorBadgeProps {
  saldo: number;
}

export function SaldoVendedorBadge({ saldo }: SaldoVendedorBadgeProps) {
  if (saldo === 0) return null;

  const debe = saldo < 0;
  return (
    <Chip
      tone={debe ? 'error' : 'amber'}
      style={debe ? undefined : { background: '#FEF3E2', color: '#7A3E06' }}
    >
      {debe ? `Debe ${money(Math.abs(saldo))}` : `A favor ${money(saldo)}`}
    </Chip>
  );
}
