import { TrabajadorMaestro } from '../types';

/**
 * Roles con acceso a pestañas administrativas y a la hoja de Drive:
 * - Auxiliar de Gestión humana (o área Gestión Humana)
 * - Cargos administrativos de Poscosecha (Auxiliar, Líder, Supervisor, Director)
 * No incluye operarios de línea aunque digan "Poscosecha" en el cargo.
 */
export function esRolAdmin(trabajador?: TrabajadorMaestro | null): boolean {
  if (!trabajador) return false;

  const normalizar = (s: string) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const cargo = normalizar(trabajador.cargo || '');
  const area = normalizar(trabajador.area || '');
  const full = `${cargo} ${area}`;

  // Gestión Humana / Auxiliar de Gestión
  if (full.includes('gestion humana') || full.includes('auxiliar de gestion')) {
    return true;
  }

  // Analista Gestión de Información EAI
  if (full.includes('analista') && full.includes('gestion') && full.includes('informacion')) {
    return true;
  }

  // Cargo exactamente "Poscosecha" (rol de área)
  if (cargo === 'poscosecha') {
    return true;
  }

  // Poscosecha con cargo de apoyo/administración (no operario de línea)
  if (full.includes('poscosecha')) {
    const esAdminPoscosecha =
      full.includes('auxiliar') ||
      full.includes('lider') ||
      full.includes('supervisor') ||
      full.includes('director') ||
      full.includes('coordinador');
    if (esAdminPoscosecha) return true;
  }

  return false;
}

/**
 * Controla si el usuario administrador puede visualizar la pestaña Hoja Maestro (Trabajadores).
 * Se oculta para AUXILIAR TÉCNICO POSCOSECHA EAI y AUXILIAR GESTIÓN HUMANA EAI.
 */
export function puedeVerHojaMaestro(trabajador?: TrabajadorMaestro | null): boolean {
  if (!esRolAdmin(trabajador)) return false;

  const cargo = String(trabajador?.cargo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cargo.includes('auxiliar') && cargo.includes('tecnico') && cargo.includes('poscosecha')) {
    return false;
  }
  if (cargo.includes('auxiliar') && cargo.includes('gestion') && cargo.includes('humana')) {
    return false;
  }

  return true;
}

/**
 * Verifica si el trabajador tiene el cargo de DIRECTOR POSCOSECHA,
 * quien tiene habilitado el formulario todos los días de la semana.
 */
export function esDirectorPoscosecha(trabajador?: TrabajadorMaestro | null): boolean {
  if (!trabajador) return false;

  const normalizar = (s: string) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const cargo = normalizar(trabajador.cargo || '');
  return cargo.includes('director') && cargo.includes('poscosecha');
}

/**
 * Verifica si el trabajador tiene habilitado el formulario todos los días de la semana:
 * - DIRECTOR POSCOSECHA
 * - ANALISTA GESTIÓN DE INFORMACIÓN EAI
 */
export function tieneFormularioTodosLosDias(trabajador?: TrabajadorMaestro | null): boolean {
  if (!trabajador) return false;
  if (esDirectorPoscosecha(trabajador)) return true;

  const cargo = String(trabajador.cargo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    cargo.includes('analista') &&
    cargo.includes('gestion') &&
    cargo.includes('informacion')
  );
}
