import fs from 'fs';
import path from 'path';
import { TRABAJADORES_INICIALES, SOLICITUDES_INICIALES } from '../../src/data/initialData';

// Memoria compartida en el contenedor
let cacheSolicitudes: any[] | null = null;
let cacheMaestro: any[] | null = null;
let cacheConfig: any | null = null;

export const DEFAULT_CONFIG = {
  webhookUrl:
    process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL ||
    process.env.VITE_GOOGLE_APPS_SCRIPT_WEBHOOK_URL ||
    'https://script.google.com/macros/s/AKfycbyombeZp7panywXAoIq8Q0cSjliwnOoPt3lUlH4R-h8YAoOvsCZNZrW7shziRJl92E7/exec',
  spreadsheetUrl:
    process.env.SPREADSHEET_URL ||
    process.env.VITE_SPREADSHEET_URL ||
    'https://docs.google.com/spreadsheets/d/1ecAKLTKJ-qrIWMGl5Rk1SpxhlTpfY6k5Gkyl4b5efzA/edit',
  syncEnabled: true,
};

function resolvePath(filename: string): string {
  // 1. Revisar si ya existe en /tmp (escrito previamente en esta lambda)
  const tmpPath = path.join('/tmp', filename);
  if (fs.existsSync(tmpPath)) {
    return tmpPath;
  }

  // 2. Revisar en data/ del proyecto
  const localDataPath = path.join(process.cwd(), 'data', filename);
  if (fs.existsSync(localDataPath)) {
    return localDataPath;
  }

  return localDataPath;
}

export function safeRead<T>(filename: string, fallback: T): T {
  try {
    const p = resolvePath(filename);
    if (fs.existsSync(p)) {
      const data = fs.readFileSync(p, 'utf-8');
      return JSON.parse(data) as T;
    }
  } catch (err) {
    console.warn(`[Storage] Aviso leyendo ${filename}:`, err);
  }
  return fallback;
}

export function safeWrite(filename: string, data: any): void {
  const content = JSON.stringify(data, null, 2);

  // En Vercel Serverless Function, la carpeta del proyecto es read-only.
  // Intentar escribir en /tmp de forma segura
  try {
    const tmpPath = path.join('/tmp', filename);
    fs.writeFileSync(tmpPath, content, 'utf-8');
  } catch (e) {
    console.warn(`[Storage] Aviso escribiendo en /tmp/${filename}:`, e);
  }

  // Si estamos en un entorno tradicional (local AI Studio), también escribir en data/
  if (!process.env.VERCEL) {
    try {
      const localDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }
      fs.writeFileSync(path.join(localDir, filename), content, 'utf-8');
    } catch {
      // Ignorar si el sistema de archivos es de solo lectura
    }
  }
}

export function getSolicitudesStorage(): any[] {
  if (cacheSolicitudes && cacheSolicitudes.length > 0) {
    return cacheSolicitudes;
  }
  cacheSolicitudes = safeRead('solicitudes.json', SOLICITUDES_INICIALES);
  return cacheSolicitudes;
}

export function saveSolicitudesStorage(data: any[]): void {
  cacheSolicitudes = data;
  safeWrite('solicitudes.json', data);
}

export function getMaestroStorage(): any[] {
  if (cacheMaestro && cacheMaestro.length > 0) {
    return cacheMaestro;
  }
  cacheMaestro = safeRead('maestro.json', TRABAJADORES_INICIALES);
  return cacheMaestro;
}

export function saveMaestroStorage(data: any[]): void {
  cacheMaestro = data;
  safeWrite('maestro.json', data);
}

export function getDriveConfigStorage(): any {
  if (cacheConfig) {
    return cacheConfig;
  }
  const saved = safeRead('drive-config.json', DEFAULT_CONFIG);
  cacheConfig = {
    ...DEFAULT_CONFIG,
    ...saved,
    webhookUrl: process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL || saved.webhookUrl || DEFAULT_CONFIG.webhookUrl,
  };
  return cacheConfig;
}

export function saveDriveConfigStorage(data: any): void {
  cacheConfig = data;
  safeWrite('drive-config.json', data);
}
