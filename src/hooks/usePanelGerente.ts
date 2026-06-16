/**
 * Logiclean Ruta — usePanelGerente hook (H-03)
 *
 * Panel del gerente: embudo de prospectos por etapa + adherencia al
 * seguimiento. Lee de Dexie (que el gerente hidrata con la cartera y visitas
 * completas vía RLS). Indicadores de cartera: continuos, no se reinician.
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/index';
import { embudoPorEtapa, adherencia } from '../lib/prospectos';
import type { Embudo, Adherencia } from '../lib/prospectos';

export interface UsePanelGerenteReturn {
  embudo: Embudo;
  adherencia: Adherencia;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const EMBUDO_VACIO: Embudo = { etapas: [], convertidos: 0 };
const ADHERENCIA_VACIA: Adherencia = { pct: 0, aTiempo: 0, total: 0 };

export function usePanelGerente(): UsePanelGerenteReturn {
  const [embudo, setEmbudo] = useState<Embudo>(EMBUDO_VACIO);
  const [adher, setAdher] = useState<Adherencia>(ADHERENCIA_VACIA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFromLocal = useCallback(async () => {
    try {
      const [clientes, visitas] = await Promise.all([
        db.cliente.where('activo').equals(1).toArray(),
        db.visita.toArray(),
      ]);
      setEmbudo(embudoPorEtapa(clientes));
      setAdher(adherencia(visitas));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadFromLocal();
  }, [loadFromLocal]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFromLocal();
  }, [loadFromLocal]);

  return { embudo, adherencia: adher, loading, error, refresh };
}
