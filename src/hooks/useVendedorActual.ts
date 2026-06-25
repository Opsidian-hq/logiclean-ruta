/**
 * Logiclean Ruta — useVendedorActual
 *
 * Datos del usuario en sesión para el menú de cuenta: nombre (de la tabla
 * `vendedor` en Dexie), correo (de Supabase Auth) y rol. Para el gerente puede
 * no existir fila en `vendedor`; en ese caso el nombre cae al correo.
 */

import { useEffect, useState } from 'react';
import { db } from '../db/index';
import { useAuthContext } from '../context/AuthContext';

export interface VendedorActual {
  nombre: string | null;
  email: string | null;
  rol: 'vendedor' | 'gerente' | null;
}

export function useVendedorActual(): VendedorActual {
  const { user, rol } = useAuthContext();
  const [nombre, setNombre] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNombre(null);
      return;
    }
    db.vendedor
      .get(user.id)
      .then((v) => {
        if (activo) setNombre(v?.nombre ?? null);
      })
      .catch(() => {
        if (activo) setNombre(null);
      });
    return () => {
      activo = false;
    };
  }, [user]);

  return { nombre, email: user?.email ?? null, rol };
}
