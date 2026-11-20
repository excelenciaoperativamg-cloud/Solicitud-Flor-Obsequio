import fs from 'fs';
import path from 'path';

export const DEFAULT_CONFIG = {
  webhookUrl:
    process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL ||
    process.env.VITE_GOOGLE_APPS_SCRIPT_WEBHOOK_URL ||
    'https://script.google.com/macros/s/AKfycbyombeZp7panywXAoIq8Q0cSjliwnOoPt3lUlH4R-h8YAoOvsCZNZrW7shziRJl92E7/exec',
  spreadsheetUrl:
    process.env.SPREADSHEET_URL ||
    process.env.VITE_SPREADSHEET_URL ||
    'https://docs.google.com/spreadsheets/d/1ecAKLTKJ-qrIWMGI5Rk1SpxhlTpfY6k5Gkyl4b5efzA/edit?gid=1512106769#gid=1512106769',
  syncEnabled: true,
};

let cacheSolicitudes = null;
let cacheSolicitudesIntExt = null;
let cacheMaestro = null;
let cacheConfig = null;

function resolvePath(filename) {
  const tmpPath = path.join('/tmp', filename);
  if (fs.existsSync(tmpPath)) return tmpPath;
  return path.join(process.cwd(), 'data', filename);
}

export function safeRead(filename, fallback) {
  try {
    const p = resolvePath(filename);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (err) {
    console.warn(`[Storage] Aviso leyendo ${filename}:`, err);
  }
  return fallback;
}

export function safeWrite(filename, data) {
  const content = JSON.stringify(data);
  try {
    fs.writeFileSync(path.join('/tmp', filename), content, 'utf-8');
  } catch (e) {
    console.warn(`[Storage] Aviso escribiendo en /tmp/${filename}:`, e);
  }
  if (!process.env.VERCEL) {
    try {
      const localDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
      fs.writeFileSync(path.join(localDir, filename), content, 'utf-8');
    } catch {
      // filesystem de solo lectura
    }
  }
}

export function getSolicitudesStorage() {
  if (cacheSolicitudes) return cacheSolicitudes;
  cacheSolicitudes = safeRead('solicitudes.json', []);
  return cacheSolicitudes;
}

export function saveSolicitudesStorage(data) {
  cacheSolicitudes = data;
  safeWrite('solicitudes.json', data);
}

export function getSolicitudesIntExtStorage() {
  if (cacheSolicitudesIntExt) return cacheSolicitudesIntExt;
  cacheSolicitudesIntExt = safeRead('solicitudes-int-ext.json', []);
  return cacheSolicitudesIntExt;
}

export function saveSolicitudesIntExtStorage(data) {
  cacheSolicitudesIntExt = data;
  safeWrite('solicitudes-int-ext.json', data);
}

export function normalizarSedeMaestro(raw) {
  const t = String(raw || '').toUpperCase();
  if (t.includes('HA')) return 'Sede HA';
  if (t.includes('SC')) return 'Sede SC';
  return 'Sede MG';
}

export function isValidWorker(w) {
  if (!w || typeof w !== 'object') return false;
  const codigo = String(w.codigo || '').trim();
  const nombre = String(w.nombre || '').trim();
  if (!codigo || !nombre) return false;
  // Evitar IDs de solicitudes (SFO-2026-001, SIE-2026-001, SE-2026-001)
  if (/^(SFO|SIE|SE)-\d{4}-/i.test(codigo)) return false;
  // Evitar fechas convertidas a string como nombre (ej. "Wed Nov 18 2026 ...")
  if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{4}/i.test(nombre)) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(nombre)) return false;
  return true;
}

export function sanitizeMaestroWorkers(workers) {
  if (!Array.isArray(workers)) return [];
  const mapa = new Map();
  for (const w of workers) {
    if (!isValidWorker(w)) continue;
    const codigo = String(w.codigo).trim();
    const key = codigo.toUpperCase();
    mapa.set(key, {
      ...w,
      codigo,
      nombre: String(w.nombre).trim(),
      sede: normalizarSedeMaestro(w.sede),
      cargo: w.cargo ? String(w.cargo).trim() : 'Operario',
      area: w.area ? String(w.area).trim() : 'Poscosecha',
      activo: w.activo !== false,
    });
  }
  return Array.from(mapa.values());
}

export function getMaestroStorage() {
  if (cacheMaestro && cacheMaestro.length > 0) {
    const valid = sanitizeMaestroWorkers(cacheMaestro);
    if (valid.length > 0) return valid;
  }
  const raw = safeRead('maestro.json', []);
  const valid = sanitizeMaestroWorkers(raw);
  cacheMaestro = valid;
  return cacheMaestro;
}

export function saveMaestroStorage(data) {
  const valid = sanitizeMaestroWorkers(data);
  if (valid.length === 0) {
    console.warn('[Storage] Se omitió guardar Maestro vacío o inválido.');
    return;
  }
  cacheMaestro = valid;
  safeWrite('maestro.json', valid);
}

export function getDriveConfigStorage() {
  if (cacheConfig) return cacheConfig;
  const saved = safeRead('drive-config.json', DEFAULT_CONFIG);
  cacheConfig = {
    ...DEFAULT_CONFIG,
    ...saved,
    webhookUrl: process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL || saved.webhookUrl || DEFAULT_CONFIG.webhookUrl,
    spreadsheetUrl: saved.spreadsheetUrl || DEFAULT_CONFIG.spreadsheetUrl,
  };
  return cacheConfig;
}

export function saveDriveConfigStorage(data) {
  cacheConfig = data;
  safeWrite('drive-config.json', data);
}

export async function callAppsScript(webhookUrl, payload) {
  const url = (webhookUrl || '').trim();
  if (!url) throw new Error('No hay URL de Apps Script configurada.');

  const res = await fetch(
    url,
    payload
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
          redirect: 'follow',
        }
      : { method: 'GET', redirect: 'follow' }
  );
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    const limpio = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    throw new Error(limpio.slice(0, 220) || `Google respondió HTTP ${res.status} sin JSON`);
  }
  if (data.status && data.status !== 'success') {
    throw new Error(data.message || data.emailError || 'Google Sheets rechazó la operación');
  }
  return data;
}
