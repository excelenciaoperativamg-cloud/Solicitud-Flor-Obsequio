import fs from 'fs';
import path from 'path';

// No importar desde src/: en Vercel esas rutas .ts no se resuelven y la función muere al iniciar.

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

let cacheSolicitudes: any[] | null = null;
let cacheMaestro: any[] | null = null;
let cacheConfig: any | null = null;

function resolvePath(filename: string): string {
  const tmpPath = path.join('/tmp', filename);
  if (fs.existsSync(tmpPath)) return tmpPath;
  return path.join(process.cwd(), 'data', filename);
}

export function safeRead<T>(filename: string, fallback: T): T {
  try {
    const p = resolvePath(filename);
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
    }
  } catch (err) {
    console.warn(`[Storage] Aviso leyendo ${filename}:`, err);
  }
  return fallback;
}

export function safeWrite(filename: string, data: any): void {
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

export function getSolicitudesStorage(): any[] {
  if (cacheSolicitudes) return cacheSolicitudes;
  cacheSolicitudes = safeRead('solicitudes.json', []);
  return cacheSolicitudes;
}

export function saveSolicitudesStorage(data: any[]): void {
  cacheSolicitudes = data;
  safeWrite('solicitudes.json', data);
}

export function getMaestroStorage(): any[] {
  if (cacheMaestro && cacheMaestro.length > 0) return cacheMaestro;
  cacheMaestro = safeRead('maestro.json', []);
  return cacheMaestro;
}

export function saveMaestroStorage(data: any[]): void {
  cacheMaestro = data;
  safeWrite('maestro.json', data);
}

export function getDriveConfigStorage(): any {
  if (cacheConfig) return cacheConfig;
  const saved = safeRead<any>('drive-config.json', DEFAULT_CONFIG);
  cacheConfig = {
    ...DEFAULT_CONFIG,
    ...saved,
    webhookUrl: process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL || saved.webhookUrl || DEFAULT_CONFIG.webhookUrl,
    spreadsheetUrl: saved.spreadsheetUrl || DEFAULT_CONFIG.spreadsheetUrl,
  };
  return cacheConfig;
}

export function saveDriveConfigStorage(data: any): void {
  cacheConfig = data;
  safeWrite('drive-config.json', data);
}

/** Llama al Web App de Apps Script. El POST debe ir como text/plain para que Google no pierda el cuerpo en el redirect. */
export async function callAppsScript(webhookUrl: string, payload?: Record<string, unknown>): Promise<any> {
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
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    const limpio = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    throw new Error(limpio.slice(0, 220) || `Google respondió HTTP ${res.status} sin JSON`);
  }
  if (data.status && data.status !== 'success') {
    throw new Error(data.message || 'Google Sheets rechazó la operación');
  }
  return data;
}
