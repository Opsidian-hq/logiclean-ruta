#!/usr/bin/env node
/**
 * Logiclean Ruta — Seed de relanzamiento Inc 6.6 (cutover, una sola vez)
 *
 * ⛔ NO ejecutar sin los números del conteo físico real, hechos por el PM /
 * gerente en la bodega. Este script NO se corre solo — necesita un archivo
 * de conteo (ver `scripts/conteo-apertura.ejemplo.json`) con los datos reales.
 *
 * Qué hace (plan §6.6, modelo §Migración, ADR-0010):
 *   1. Siembra inventario_bodega_base (litros_granel_estimado, y
 *      bidones_disponibles si el anaquel de La Moderna tenía algo ese día).
 *   2. Siembra inventario_bodega_presentacion (presentaciones envasadas +
 *      piezas de escoba/trapeador/recogedor ya en bodega).
 *   3. Resetea inventario_vehiculo a los saldos reales contados por
 *      vendedor — TODO lo que no esté en el conteo queda en 0 (reset real,
 *      no upsert aditivo).
 *   4. NO toca /admin/negocio: ya se congeló como fuente de suministro en
 *      Inc 6.2 (ADR-0006) — nada que hacer aquí.
 *
 * No se siembran bidones sellados como inventario propio de Logiclean — son
 * consignación de La Moderna (ADR-0010); por diseño el archivo de conteo no
 * tiene ese campo.
 *
 * Por seguridad, por defecto corre en modo DRY RUN (solo valida e imprime lo
 * que haría, no escribe nada). Hay que pasar --apply explícitamente para
 * escribir de verdad.
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/seed-inc6-relanzamiento.mjs ./conteo-apertura.json
 *
 *   # Para escribir de verdad (dry run es el default):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/seed-inc6-relanzamiento.mjs ./conteo-apertura.json --apply
 *
 * La SUPABASE_SERVICE_ROLE_KEY es obligatoria: inventario_bodega_base e
 * inventario_bodega_presentacion no tienen política de escritura para
 * `authenticated` (solo los triggers SECURITY DEFINER de la migración 007
 * pueden escribirlos) — sembrar el saldo de apertura es, por definición, la
 * única vez que se escriben directo, y requiere el rol que salta la RLS.
 * NUNCA correr este script desde el cliente ni comitear la service role key.
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

/** Resuelve una lista de {nombre} a {id} contra una tabla, fallando si hay
 * ambigüedad o si no encuentra el nombre exacto — más seguro que aceptar un
 * match parcial en un script que escribe inventario de apertura.
 * Exportada para tests/seedRelanzamiento.test.ts. */
export function resolverPorNombre(catalogo, nombre, etiqueta) {
  const candidatos = catalogo.filter((c) => c.nombre === nombre);
  if (candidatos.length === 0) {
    console.error(`  ❌ ${etiqueta} "${nombre}" no existe en el catálogo actual.`);
    return null;
  }
  if (candidatos.length > 1) {
    console.error(`  ❌ ${etiqueta} "${nombre}" es ambiguo (${candidatos.length} coincidencias).`);
    return null;
  }
  return candidatos[0].id;
}

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const conteoPath = process.argv[2];
  const apply = process.argv.includes('--apply');

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Faltan env vars. Uso:');
    console.error('  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-inc6-relanzamiento.mjs <conteo.json> [--apply]');
    process.exit(1);
  }
  if (!conteoPath) {
    console.error('Falta la ruta al archivo de conteo. Ver scripts/conteo-apertura.ejemplo.json');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  let ok = 0;
  let fail = 0;
  const check = (label, passed, detail = '') => {
    const icon = passed ? '✅' : '❌';
    console.log(`  ${icon} ${label}${detail ? ' — ' + detail : ''}`);
    passed ? ok++ : fail++;
    return passed;
  };

  console.log('\n══════════════════════════════════════════════════');
  console.log('  Seed de relanzamiento — Inc 6.6 (cutover)');
  console.log(`  Modo: ${apply ? '⚠️  APLICANDO CAMBIOS' : 'DRY RUN (solo lectura)'}`);
  console.log('══════════════════════════════════════════════════\n');

  const conteo = JSON.parse(readFileSync(conteoPath, 'utf-8'));

  console.log('1. Cargar catálogo actual (productos, presentaciones, vendedores)');
  const [{ data: productos, error: e1 }, { data: presentaciones, error: e2 }, { data: vendedores, error: e3 }] =
    await Promise.all([
      supabase.from('producto_base').select('id, nombre'),
      supabase.from('presentacion').select('id, nombre'),
      supabase.from('vendedor').select('id, nombre'),
    ]);
  if (!check('Catálogo cargado', !e1 && !e2 && !e3, e1?.message ?? e2?.message ?? e3?.message)) {
    process.exit(1);
  }

  console.log('\n2. Resolver nombres del conteo contra el catálogo');
  const bodegaBase = [];
  for (const item of conteo.bodegaBase ?? []) {
    const producto_base_id = resolverPorNombre(productos, item.productoBaseNombre, 'Producto base');
    if (!check(`Producto base: ${item.productoBaseNombre}`, !!producto_base_id)) continue;
    bodegaBase.push({
      producto_base_id,
      litros_granel_estimado: item.litrosGranelEstimado ?? 0,
      bidones_disponibles: item.bidonesDisponibles ?? 0,
    });
  }

  const bodegaPresentaciones = [];
  for (const item of conteo.bodegaPresentaciones ?? []) {
    const presentacion_id = resolverPorNombre(presentaciones, item.presentacionNombre, 'Presentación');
    if (!check(`Presentación: ${item.presentacionNombre}`, !!presentacion_id)) continue;
    bodegaPresentaciones.push({ presentacion_id, cantidad: item.cantidad });
  }

  const inventarioVehiculo = [];
  for (const item of conteo.inventarioVehiculo ?? []) {
    const vendedor_id = resolverPorNombre(vendedores, item.vendedorNombre, 'Vendedor');
    const presentacion_id = resolverPorNombre(presentaciones, item.presentacionNombre, 'Presentación');
    if (!check(`Vehículo: ${item.vendedorNombre} / ${item.presentacionNombre}`, !!vendedor_id && !!presentacion_id)) continue;
    inventarioVehiculo.push({ vendedor_id, presentacion_id, cantidad: item.cantidad });
  }

  if (fail > 0) {
    console.error(`\n${fail} referencias no se pudieron resolver. Corrige el archivo de conteo antes de continuar.`);
    process.exit(1);
  }

  console.log('\n3. Resumen de lo que se va a sembrar:');
  console.log(`   · inventario_bodega_base: ${bodegaBase.length} productos`);
  console.log(`   · inventario_bodega_presentacion: ${bodegaPresentaciones.length} presentaciones`);
  console.log(`   · inventario_vehiculo (reset completo): ${vendedores.length} vendedores, ${inventarioVehiculo.length} líneas contadas`);

  if (!apply) {
    console.log('\nDRY RUN — no se escribió nada. Vuelve a correr con --apply para aplicar de verdad.\n');
    return;
  }

  console.log('\n4. Escribiendo (--apply)...');

  for (const row of bodegaBase) {
    const { error } = await supabase.from('inventario_bodega_base').upsert(row, { onConflict: 'producto_base_id' });
    check(`inventario_bodega_base ← ${row.producto_base_id}`, !error, error?.message);
  }

  for (const row of bodegaPresentaciones) {
    const { error } = await supabase.from('inventario_bodega_presentacion').upsert(row, { onConflict: 'presentacion_id' });
    check(`inventario_bodega_presentacion ← ${row.presentacion_id}`, !error, error?.message);
  }

  // Reset real: en 0 todo lo que ya existía para cada vendedor del conteo,
  // luego se siembran las líneas contadas. Así lo no contado queda en 0
  // (plan §6.6: "reset a los saldos reales contados por vehículo").
  const vendedoresEnConteo = [...new Set(inventarioVehiculo.map((i) => i.vendedor_id))];
  for (const vendedor_id of vendedoresEnConteo) {
    const { error } = await supabase
      .from('inventario_vehiculo')
      .update({ cantidad: 0 })
      .eq('vendedor_id', vendedor_id);
    check(`inventario_vehiculo reset a 0 (vendedor ${vendedor_id})`, !error, error?.message);
  }
  for (const row of inventarioVehiculo) {
    const { data: existente } = await supabase
      .from('inventario_vehiculo')
      .select('id')
      .eq('vendedor_id', row.vendedor_id)
      .eq('presentacion_id', row.presentacion_id)
      .maybeSingle();
    const { error } = existente
      ? await supabase.from('inventario_vehiculo').update({ cantidad: row.cantidad }).eq('id', existente.id)
      : await supabase.from('inventario_vehiculo').insert(row);
    check(`inventario_vehiculo ← ${row.vendedor_id} / ${row.presentacion_id} = ${row.cantidad}`, !error, error?.message);
  }

  console.log(`\n${ok} escrituras OK, ${fail} con error.`);
  console.log('\nRecordatorio: el PRIMER corte post-relanzamiento se trata como validación');
  console.log('del seed (plan §6.6), no como corte normal — revísalo con especial atención.\n');

  if (fail > 0) process.exit(1);
}

// Solo corre si se ejecuta directamente (`node scripts/seed-...mjs`), no al
// importarlo desde un test (tests/seedRelanzamiento.test.ts importa
// `resolverPorNombre` sin disparar el script completo).
const esEjecucionDirecta = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (esEjecucionDirecta) {
  main().catch((err) => {
    console.error('\n[ERROR FATAL]', err);
    process.exit(1);
  });
}
