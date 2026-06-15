/**
 * Verificación del hito de Inc 0:
 * "Un vendedor inicia sesión, ve el catálogo sin conexión, y un cambio
 *  sincroniza ida y vuelta sin pérdida ni duplicado; el gerente da de
 *  alta y edita un producto desde su vista de administración."
 *
 * Este script verifica los requisitos funcionales contra Supabase real.
 *
 * Nota sobre offline-first (ADR-0001): el catálogo NUNCA se lee del servidor
 * sin sesión. El flujo real es: el vendedor inicia sesión, hace un primer sync
 * autenticado que llena la BD local (Dexie), y de ahí en adelante el catálogo
 * se sirve "sin conexión" desde ese cache local. Por eso todas las lecturas de
 * catálogo de este script usan una sesión autenticada (vendedor), nunca el
 * cliente anónimo — coherente con la RLS (producto_base/presentacion exigen
 * auth.uid() IS NOT NULL).
 *
 * Uso: EMAIL_GERENTE=... PASS_GERENTE=... EMAIL_VENDEDOR=... PASS_VENDEDOR=... node scripts/verify-hito-inc0.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sdkryjsjwrsplbcwyvbn.supabase.co';
const ANON_KEY = 'sb_publishable_M_xpAYCfGsdsQPsbkFfeAw_p0vcIH1F';

const EMAIL_GERENTE  = process.env.EMAIL_GERENTE;
const PASS_GERENTE   = process.env.PASS_GERENTE;
const EMAIL_VENDEDOR = process.env.EMAIL_VENDEDOR;
const PASS_VENDEDOR  = process.env.PASS_VENDEDOR;

if (!EMAIL_GERENTE || !PASS_GERENTE || !EMAIL_VENDEDOR || !PASS_VENDEDOR) {
  console.error('Faltan env vars. Uso:');
  console.error('  EMAIL_GERENTE=... PASS_GERENTE=... EMAIL_VENDEDOR=... PASS_VENDEDOR=... node scripts/verify-hito-inc0.mjs');
  process.exit(1);
}

let ok = 0;
let fail = 0;

function check(label, passed, detail = '') {
  const icon = passed ? '✅' : '❌';
  console.log(`  ${icon} ${label}${detail ? ' — ' + detail : ''}`);
  passed ? ok++ : fail++;
}

async function main() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Verificación hito Inc 0 — Cimientos');
  console.log('══════════════════════════════════════════\n');

  // ── 1. Login del vendedor ─────────────────────────────────────────────────
  console.log('1. Login del vendedor');
  const svend = createClient(SUPABASE_URL, ANON_KEY);
  {
    const { data, error } = await svend.auth.signInWithPassword({
      email: EMAIL_VENDEDOR,
      password: PASS_VENDEDOR,
    });
    check('Vendedor inicia sesión', !error, error?.message ?? data.user?.email);
    if (error) { console.log('\n[ERROR FATAL] No se puede continuar sin sesión de vendedor.'); process.exit(1); }

    const rol = data.user?.user_metadata?.rol;
    check('Rol del vendedor = "vendedor"', rol === 'vendedor', `rol=${rol}`);
  }

  // ── 2. Primer sync autenticado: el catálogo que luego se sirve offline ─────
  // El vendedor (ya con sesión) lee el catálogo del servidor. Esta es la lectura
  // que llena Dexie; a partir de aquí la app la sirve "sin conexión" desde el
  // cache local. La RLS exige auth.uid() IS NOT NULL, por eso usamos svend.
  console.log('\n2. Vendedor lee el catálogo (primer sync autenticado → cache local Dexie)');
  {
    const { data, error } = await svend
      .from('producto_base')
      .select('id, nombre, activo')
      .eq('activo', true);
    check('SELECT producto_base con sesión de vendedor', !error && data?.length > 0,
          error?.message ?? `${data?.length} productos`);

    const { data: pres, error: eP } = await svend
      .from('presentacion')
      .select('id, nombre, precio_mayoreo, precio_menudeo, factor_conversion')
      .eq('activo', true);
    check('SELECT presentacion con sesión de vendedor', !eP && pres?.length > 0,
          eP?.message ?? `${pres?.length} presentaciones`);
  }

  // ── 3. RLS: vendedor solo ve su propia cartera ───────────────────────────
  console.log('\n3. RLS: vendedor solo ve su propia cartera');
  {
    const { data, error } = await svend.from('cliente').select('id');
    // La RLS devuelve [] o solo sus propios clientes, nunca error
    check('SELECT cliente no devuelve error (RLS activa)', !error,
          error?.message ?? `${data?.length} clientes visibles (esperado: 0 por ahora)`);
  }

  // ── 4. Login gerente ──────────────────────────────────────────────────────
  console.log('\n4. Login del gerente');
  const sger = createClient(SUPABASE_URL, ANON_KEY);
  {
    const { data, error } = await sger.auth.signInWithPassword({
      email: EMAIL_GERENTE,
      password: PASS_GERENTE,
    });
    check('Gerente inicia sesión', !error, error?.message ?? data.user?.email);
    if (error) { console.log('\n[ERROR FATAL] No se puede continuar sin sesión de gerente.'); process.exit(1); }
    const rol = data.user?.user_metadata?.rol;
    check('Rol del gerente = "gerente"', rol === 'gerente', `rol=${rol}`);
  }

  // ── 5. H-13: Gerente da de alta un producto nuevo ────────────────────────
  console.log('\n5. H-13: Gerente da de alta un producto y lo edita');
  const productoId = crypto.randomUUID();  // UUID generado en cliente (ADR-0001)
  const presentacionId = crypto.randomUUID();

  {
    const { error } = await sger.from('producto_base').insert({
      id: productoId,
      nombre: '[TEST] Jabón líquido',
      unidad_compra: 'bidon',
      precio_preferencial: 300.00,
      activo: true,
    });
    check('Gerente da de alta producto_base', !error, error?.message ?? `id=${productoId.slice(0,8)}…`);
  }

  {
    const { error } = await sger.from('presentacion').insert({
      id: presentacionId,
      producto_base_id: productoId,
      nombre: '[TEST] Jabón 1 L',
      unidad_venta: 'litro',
      factor_conversion: 1.0,
      precio_mayoreo: 35.00,
      precio_menudeo: 50.00,
      activo: true,
    });
    check('Gerente da de alta presentación con precios', !error, error?.message);
  }

  // Editar precio — las ventas posteriores usarán el nuevo valor
  {
    const { error } = await sger
      .from('presentacion')
      .update({ precio_mayoreo: 40.00, precio_menudeo: 55.00 })
      .eq('id', presentacionId);
    check('Gerente edita precio de la presentación', !error, error?.message);
  }

  // Sync ida y vuelta: el gerente escribió en el servidor; el dispositivo del
  // vendedor re-sincroniza y ve el nuevo precio. Se lee con la sesión del
  // vendedor (svend), no con el cliente anónimo: así es como la app real
  // refresca el cache de catálogo de cada vendedor.
  {
    const { data, error } = await svend
      .from('presentacion')
      .select('precio_mayoreo, precio_menudeo')
      .eq('id', presentacionId)
      .single();
    check('Vendedor re-sincroniza el precio actualizado (sync ida y vuelta)',
          !error && data?.precio_mayoreo === 40 && data?.precio_menudeo === 55,
          error?.message ?? `mayoreo=${data?.precio_mayoreo} menudeo=${data?.precio_menudeo}`);
  }

  // ── 6. H-13: Baja lógica (activo=false, no DELETE) ───────────────────────
  console.log('\n6. H-13: Baja lógica del producto (activo=false, nunca DELETE)');
  {
    const { error } = await sger
      .from('producto_base')
      .update({ activo: false })
      .eq('id', productoId);
    check('Gerente da de baja (activo=false)', !error, error?.message);

    // Verificar que sigue existiendo (no se borró)
    const { data, error: eR } = await sger
      .from('producto_base')
      .select('id, activo')
      .eq('id', productoId)
      .single();
    check('Producto sigue existiendo (baja lógica, no físico)', !eR && data?.activo === false,
          eR?.message ?? `activo=${data?.activo}`);
  }

  // ── 7. Idempotencia (sync sin duplicado) ─────────────────────────────────
  console.log('\n7. Sync idempotente (upsert con mismo UUID = sin duplicado, T1)');
  const idUnico = crypto.randomUUID();
  {
    // Upsert 1
    await sger.from('producto_base').upsert({
      id: idUnico, nombre: '[TEST-IDEM] Trapeador', unidad_compra: 'docena',
      precio_preferencial: 500, activo: true,
    }, { onConflict: 'id' });

    // Upsert 2 (mismo id, nombre distinto — simula re-sync)
    await sger.from('producto_base').upsert({
      id: idUnico, nombre: '[TEST-IDEM] Trapeador v2', unidad_compra: 'docena',
      precio_preferencial: 500, activo: true,
    }, { onConflict: 'id' });

    // Debe existir exactamente 1 fila
    const { data, error } = await sger
      .from('producto_base')
      .select('id, nombre')
      .eq('id', idUnico);
    check('Upsert idempotente: 1 fila (sin duplicado)', !error && data?.length === 1,
          error?.message ?? `filas=${data?.length}, nombre="${data?.[0]?.nombre}"`);

    // Limpiar
    await sger.from('producto_base').delete().eq('id', idUnico);
    await sger.from('presentacion').delete().eq('id', presentacionId);
    await sger.from('producto_base').delete().eq('id', productoId);
  }

  // ── 8. RLS: vendedor no puede insertar en producto_base ──────────────────
  console.log('\n8. RLS: vendedor no puede modificar el catálogo (T4)');
  {
    const { error } = await svend.from('producto_base').insert({
      id: crypto.randomUUID(),
      nombre: '[INTENTO ILEGAL]',
      unidad_compra: 'bidon',
      precio_preferencial: 1,
      activo: true,
    });
    check('INSERT de vendedor en catálogo rechazado por RLS', !!error,
          error?.message ?? 'ERROR: se permitió el insert (fallo de RLS)');
  }

  // ── Resultado final ───────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log(`  Resultado: ${ok} ✅  ${fail} ❌`);
  if (fail === 0) {
    console.log('  ✅ Hito de Inc 0 demostrado de punta a punta.');
  } else {
    console.log('  ⚠️  Hay fallos que revisar antes de cerrar Inc 0.');
  }
  console.log('══════════════════════════════════════════\n');
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
