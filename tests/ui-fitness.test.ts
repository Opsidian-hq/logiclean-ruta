/**
 * Logiclean Ruta — Fitness functions de UI (regresión de defectos de QA Fase 5)
 *
 * Estos defectos se reabrieron 2–3 veces porque su causa raíz es estructural
 * (forma del DOM / herencia de custom properties), no de lógica de dominio: los
 * tests unitarios de `lib/` no los detectan. Aquí se fijan los invariantes
 * exactos que causaron cada reapertura, leyendo el código fuente, para que una
 * regresión rompa la suite.
 *
 *  - UIFIT-001/002/003 → D-005 (alta de producto: forms anidados)
 *  - UIFIT-004/005     → D-007 (contraste de tabs sobre navy)
 *  - UIFIT-006         → CP-028 (blanco de toque ≥ 44 px)
 */

import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

const src = (rel: string) =>
  readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');

/** Elimina comentarios de línea (//…) y de bloque para no confundir las
 *  menciones de `<form>` en la documentación con elementos JSX reales. */
function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

/** Cuenta las etiquetas de apertura JSX `<form …>` (ignora `</form>`). */
function countOpeningForms(code: string): number {
  return (stripComments(code).match(/<form[\s>]/g) ?? []).length;
}

describe('[D-005] alta de producto — sin forms anidados', () => {
  it('UIFIT-001: PresentacionForm NO renderiza un <form> (vive embebido en el form del producto)', () => {
    const code = src('pages/admin/components/PresentacionForm.tsx');
    expect(countOpeningForms(code)).toBe(0);
  });

  it('UIFIT-002: el botón de acción de PresentacionForm es type="button", nunca submit', () => {
    const code = stripComments(src('pages/admin/components/PresentacionForm.tsx'));
    // El submit del producto debe ser el ÚNICO submit de la pantalla: ningún
    // botón de la presentación puede burbujear un submit al form externo.
    expect(code).not.toMatch(/type=["']submit["']/);
    expect(code).toMatch(/type=["']button["']/);
  });

  it('UIFIT-003: ProductoForm tiene exactamente un <form> (el único submit de la pantalla)', () => {
    const code = src('pages/admin/components/ProductoForm.tsx');
    expect(countOpeningForms(code)).toBe(1);
  });
});

describe('[D-007] contraste de tabs sobre navy', () => {
  it('UIFIT-004: --color-checked cuelga de `.segment-on-navy ion-segment-button`, no del padre', () => {
    const css = src('theme/variables.css');

    // El bloque del HOST del botón debe definir --color-checked en blanco.
    const hostBlock = css.match(
      /\.segment-on-navy\s+ion-segment-button\s*\{([^}]*)\}/
    );
    expect(hostBlock, 'falta el selector .segment-on-navy ion-segment-button').not.toBeNull();
    expect(hostBlock![1]).toMatch(/--color-checked:\s*#FFFFFF/i);

    // El bloque del PADRE NO debe redefinir --color-checked: Ionic lo ignora
    // ahí y los tabs vuelven a salir azul/gris (la regresión de #18→#20→#21).
    const parentBlock = css.match(/\.segment-on-navy\s*\{([^}]*)\}/);
    expect(parentBlock).not.toBeNull();
    expect(parentBlock![1]).not.toMatch(/--color-checked/);
  });

  it('UIFIT-005: todos los segmentos sobre navy usan la clase compartida .segment-on-navy', () => {
    expect(src('pages/visitas/VisitasPage.tsx')).toMatch(/className="segment-on-navy"/);
    expect(src('pages/CargaDevolucionPage.tsx')).toMatch(/className="segment-on-navy"/);
    expect(src('pages/admin/InventarioBodegaPage.tsx')).toMatch(/className="segment-on-navy"/);
  });
});

describe('[CP-028] accesibilidad — blanco de toque', () => {
  it('UIFIT-006: el token --touch-min es ≥ 44 px (WCAG / dedo en campo)', () => {
    const css = src('theme/variables.css');
    const m = css.match(/--touch-min:\s*(\d+)px/);
    expect(m, 'falta el token --touch-min').not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(44);
  });
});
