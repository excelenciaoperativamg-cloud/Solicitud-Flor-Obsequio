import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TRABAJADORES_INICIALES, SOLICITUDES_INICIALES } from '../src/data/initialData';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// In-memory cache para garantizar respuesta instantánea y compatibilidad Serverless en Vercel
let cacheSolicitudes: any[] | null = null;
let cacheMaestro: any[] | null = null;
let cacheConfig: any | null = null;

function resolveStoragePath(filename: string): string {
  // En Vercel Serverless, /var/task es de solo lectura y /tmp es de lectura/escritura
  const tmpPath = path.join('/tmp', filename);
  if (fs.existsSync(tmpPath)) {
    return tmpPath;
  }

  // Verificar en la carpeta data del proyecto
  const localPath = path.join(process.cwd(), 'data', filename);
  if (fs.existsSync(localPath)) {
    return localPath;
  }

  // Fallback con __dirname por si process.cwd() difiere
  const dirPath = path.join(__dirname, '..', 'data', filename);
  if (fs.existsSync(dirPath)) {
    return dirPath;
  }

  return localPath;
}

function safeReadFile<T>(filename: string, fallback: T): T {
  try {
    const filePath = resolveStoragePath(filename);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as T;
    }
  } catch (err) {
    console.warn(`[Storage] Aviso al leer ${filename}:`, err);
  }
  return fallback;
}

function safeWriteFile(filename: string, data: any): void {
  const content = JSON.stringify(data, null, 2);

  // 1. Intentar escribir en data/ local (desarrollo o servidor tradicional)
  try {
    const localDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const localPath = path.join(localDir, filename);
    fs.writeFileSync(localPath, content, 'utf-8');
    return;
  } catch {
    // Si falla por EROFS (sistema de solo lectura de Vercel)
  }

  // 2. Fallback a /tmp (Vercel Serverless Function writable directory)
  try {
    const tmpPath = path.join('/tmp', filename);
    fs.writeFileSync(tmpPath, content, 'utf-8');
  } catch (tmpErr) {
    console.warn(`[Storage] Error al escribir en /tmp/${filename}:`, tmpErr);
  }
}

// Helpers de lectura/escritura con persistencia
function getSolicitudes(): any[] {
  if (cacheSolicitudes && cacheSolicitudes.length > 0) {
    return cacheSolicitudes;
  }
  cacheSolicitudes = safeReadFile('solicitudes.json', SOLICITUDES_INICIALES);
  return cacheSolicitudes;
}

function saveSolicitudes(data: any[]): void {
  cacheSolicitudes = data;
  safeWriteFile('solicitudes.json', data);
}

function getMaestro(): any[] {
  if (cacheMaestro && cacheMaestro.length > 0) {
    return cacheMaestro;
  }
  cacheMaestro = safeReadFile('maestro.json', TRABAJADORES_INICIALES);
  return cacheMaestro;
}

function saveMaestro(data: any[]): void {
  cacheMaestro = data;
  safeWriteFile('maestro.json', data);
}

function getDriveConfig(): any {
  if (cacheConfig) {
    return cacheConfig;
  }

  const defaultCfg = {
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

  const saved = safeReadFile('drive-config.json', defaultCfg);
  cacheConfig = {
    ...defaultCfg,
    ...saved,
    // Asegurar que si hay env var en Vercel, prevalezca
    webhookUrl: process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL || saved.webhookUrl || defaultCfg.webhookUrl,
  };
  return cacheConfig;
}

function saveDriveConfig(data: any): void {
  cacheConfig = data;
  safeWriteFile('drive-config.json', data);
}

// Router común para API
const router = express.Router();

// 1. Obtener todas las solicitudes registradas
router.get('/solicitudes', (_req: Request, res: Response) => {
  const data = getSolicitudes();
  res.json({ success: true, solicitudes: data });
});

// 2. Registrar nueva solicitud (segura, sin pedir correo al trabajador)
router.post('/solicitudes', async (req: Request, res: Response) => {
  try {
    const nueva = req.body;
    if (!nueva || !nueva.codigo || !nueva.nombre) {
      return res.status(400).json({ success: false, error: 'Faltan datos obligatorios' });
    }

    const solicitudes = getSolicitudes();
    const filtradas = solicitudes.filter((s: any) => s.id !== nueva.id);

    // Intentar envío automático al Webhook de Drive
    const driveCfg = getDriveConfig();
    let driveSynced = false;

    if (driveCfg.webhookUrl && driveCfg.syncEnabled) {
      try {
        const fetchRes = await fetch(driveCfg.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nueva),
          redirect: 'follow',
        });
        const resText = await fetchRes.text().catch(() => '');
        if (fetchRes.ok || resText.includes('success')) {
          driveSynced = true;
        }
      } catch (driveErr) {
        console.warn('Aviso: no se pudo enviar a Webhook de Drive:', driveErr);
      }
    }

    const finalNueva = {
      ...nueva,
      syncedToDrive: driveSynced,
      guardadoEnServidor: true,
    };

    filtradas.unshift(finalNueva);
    saveSolicitudes(filtradas);

    res.json({ success: true, solicitud: finalNueva });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Error al guardar en el servidor' });
  }
});

// 3. Obtener el Maestro oficial de trabajadores
router.get('/maestro', (_req: Request, res: Response) => {
  const data = getMaestro();
  res.json({ success: true, maestro: data });
});

// 4. Agregar trabajador al Maestro
router.post('/maestro', async (req: Request, res: Response) => {
  try {
    const trabajador = req.body;
    if (!trabajador || !trabajador.codigo || !trabajador.nombre) {
      return res.status(400).json({ success: false, error: 'Código y nombre son obligatorios' });
    }

    const maestro = getMaestro();
    const codigoUpper = trabajador.codigo.trim().toUpperCase();

    const filtrado = maestro.filter((t: any) => t.codigo.trim().toUpperCase() !== codigoUpper);
    filtrado.unshift({
      ...trabajador,
      codigo: codigoUpper,
      activo: true,
    });
    saveMaestro(filtrado);

    // Intentar registrar en Webhook si está disponible
    const driveCfg = getDriveConfig();
    if (driveCfg.webhookUrl) {
      try {
        await fetch(driveCfg.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'addWorker', worker: trabajador }),
          redirect: 'follow',
        });
      } catch (wErr) {
        console.warn('Aviso sincronizando trabajador al Webhook:', wErr);
      }
    }

    res.json({ success: true, maestro: filtrado });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Configuración de Google Drive
router.get('/drive-config', (_req: Request, res: Response) => {
  const cfg = getDriveConfig();
  res.json({ success: true, config: cfg });
});

router.post('/drive-config', (req: Request, res: Response) => {
  try {
    const { webhookUrl, spreadsheetUrl } = req.body;
    const cfg = {
      webhookUrl: (webhookUrl || '').trim(),
      spreadsheetUrl: (
        spreadsheetUrl ||
        'https://docs.google.com/spreadsheets/d/1ecAKLTKJ-qrIWMGl5Rk1SpxhlTpfY6k5Gkyl4b5efzA/edit'
      ).trim(),
      syncEnabled: true,
      lastUpdated: new Date().toISOString(),
    };
    saveDriveConfig(cfg);
    res.json({ success: true, config: cfg });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Probar conexión inmediata con Google Drive
router.post('/drive-test', async (_req: Request, res: Response) => {
  try {
    const driveCfg = getDriveConfig();
    if (!driveCfg.webhookUrl) {
      return res.json({ success: false, error: 'No hay URL de Webhook configurada' });
    }

    // 1. Probar GET primero
    try {
      const getRes = await fetch(driveCfg.webhookUrl, { redirect: 'follow' });
      const getText = await getRes.text();

      if (getText.includes('Script function not found: doGet')) {
        return res.json({
          success: false,
          error:
            'El script actual no tiene la función doGet. Por favor actualice el código en Apps Script con el que aparece en la ventana y vuelva a Implementar como Nueva versión.',
        });
      }

      if (getText.includes('Unable to open the file') || getText.includes('Page Not Found')) {
        return res.json({
          success: false,
          error:
            'Google Apps Script no pudo abrir la hoja. Actualice el código del script con el ID directo y asegúrese de que el acceso esté configurado en "Cualquier persona".',
        });
      }

      try {
        const jsonGet = JSON.parse(getText);
        if (jsonGet.status === 'success') {
          if (jsonGet.workers && jsonGet.workers.length > 0) {
            saveMaestro(jsonGet.workers);
          }
          return res.json({
            success: true,
            status: 200,
            response: `¡Conexión exitosa! Hoja: "${jsonGet.spreadsheetName || 'Solicitud Flor Obsequio'}". Trabajadores detectados: ${jsonGet.totalWorkers || 0}`,
          });
        }
      } catch {
        // no json
      }
    } catch (e: any) {
      console.warn('GET test warning:', e);
    }

    // 2. Probar POST
    const testPayload = {
      action: 'ping',
      timestamp: new Date().toISOString(),
      mensaje: 'Prueba de conexión automática desde MG Consultores',
    };

    const postRes = await fetch(driveCfg.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
      redirect: 'follow',
    });

    const responseText = await postRes.text();

    res.json({
      success: postRes.ok || responseText.includes('success'),
      status: postRes.status,
      response: responseText || 'Conexión recibida por Google Drive',
    });
  } catch (err: any) {
    res.json({ success: false, error: err.message || 'Error al conectar con Webhook de Drive' });
  }
});

// 7. Sincronizar todos los trabajadores desde el Webhook de Google Drive
router.post('/maestro/sync-from-drive', async (_req: Request, res: Response) => {
  try {
    const driveCfg = getDriveConfig();
    if (!driveCfg.webhookUrl) {
      return res.status(400).json({ success: false, error: 'No hay URL de Webhook configurada' });
    }

    const fetchRes = await fetch(driveCfg.webhookUrl, { redirect: 'follow' });
    const text = await fetchRes.text();
    const data = JSON.parse(text);

    if (data.status === 'success' && data.workers && data.workers.length > 0) {
      saveMaestro(data.workers);
      return res.json({ success: true, count: data.workers.length, maestro: data.workers });
    }

    res.json({ success: false, error: data.message || 'No se pudieron extraer trabajadores de la hoja' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Montar router en ambas rutas:
// - '/api': para llamadas directas como /api/solicitudes
// - '/': por si Vercel Serverless Function reescribe la ruta eliminando el prefijo /api
app.use('/api', router);
app.use('/', router);

export default app;
