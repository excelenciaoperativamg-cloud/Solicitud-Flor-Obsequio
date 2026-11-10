import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Directorio de persistencia en disco
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const SOLICITUDES_FILE = path.join(DATA_DIR, 'solicitudes.json');
const MAESTRO_FILE = path.join(DATA_DIR, 'maestro.json');
const CONFIG_FILE = path.join(DATA_DIR, 'drive-config.json');

// Importar datos iniciales si no existen los archivos
import { TRABAJADORES_INICIALES, SOLICITUDES_INICIALES } from './src/data/initialData.ts';

if (!fs.existsSync(SOLICITUDES_FILE)) {
  fs.writeFileSync(SOLICITUDES_FILE, JSON.stringify(SOLICITUDES_INICIALES, null, 2), 'utf-8');
}

if (!fs.existsSync(MAESTRO_FILE)) {
  fs.writeFileSync(MAESTRO_FILE, JSON.stringify(TRABAJADORES_INICIALES, null, 2), 'utf-8');
}

if (!fs.existsSync(CONFIG_FILE)) {
  fs.writeFileSync(
    CONFIG_FILE,
    JSON.stringify(
      {
        webhookUrl: '',
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1ecAKLTKJ-qrIWMGl5Rk1SpxhlTpfY6k5Gkyl4b5efzA/edit',
        syncEnabled: true,
      },
      null,
      2
    ),
    'utf-8'
  );
}

// Helpers para leer y escribir
function getSolicitudes() {
  try {
    return JSON.parse(fs.readFileSync(SOLICITUDES_FILE, 'utf-8'));
  } catch {
    return SOLICITUDES_INICIALES;
  }
}

function saveSolicitudes(data: any[]) {
  fs.writeFileSync(SOLICITUDES_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function getMaestro() {
  try {
    return JSON.parse(fs.readFileSync(MAESTRO_FILE, 'utf-8'));
  } catch {
    return TRABAJADORES_INICIALES;
  }
}

function saveMaestro(data: any[]) {
  fs.writeFileSync(MAESTRO_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function getDriveConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return {
      webhookUrl: '',
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1ecAKLTKJ-qrIWMGl5Rk1SpxhlTpfY6k5Gkyl4b5efzA/edit',
      syncEnabled: true,
    };
  }
}

function saveDriveConfig(data: any) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ================= API ENDPOINTS =================

// 1. Obtener todas las solicitudes registradas
app.get('/api/solicitudes', (req, res) => {
  const data = getSolicitudes();
  res.json({ success: true, solicitudes: data });
});

// 2. Registrar nueva solicitud (segura, sin pedir correo al trabajador)
app.post('/api/solicitudes', async (req, res) => {
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
app.get('/api/maestro', (req, res) => {
  const data = getMaestro();
  res.json({ success: true, maestro: data });
});

// 4. Agregar trabajador al Maestro
app.post('/api/maestro', async (req, res) => {
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
app.get('/api/drive-config', (req, res) => {
  const cfg = getDriveConfig();
  res.json({ success: true, config: cfg });
});

app.post('/api/drive-config', async (req, res) => {
  try {
    const { webhookUrl, spreadsheetUrl } = req.body;
    const cfg = {
      webhookUrl: (webhookUrl || '').trim(),
      spreadsheetUrl: (spreadsheetUrl || 'https://docs.google.com/spreadsheets/d/1ecAKLTKJ-qrIWMGl5Rk1SpxhlTpfY6k5Gkyl4b5efzA/edit').trim(),
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
app.post('/api/drive-test', async (req, res) => {
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
          error: 'El script actual no tiene la función doGet. Por favor actualice el código en Apps Script con el que aparece en la ventana y vuelva a Implementar como Nueva versión.',
        });
      }
      
      if (getText.includes('Unable to open the file') || getText.includes('Page Not Found')) {
        return res.json({
          success: false,
          error: 'Google Apps Script no pudo abrir la hoja. Actualice el código del script con el ID directo y asegúrese de que el acceso esté configurado en "Cualquier persona".',
        });
      }

      try {
        const jsonGet = JSON.parse(getText);
        if (jsonGet.status === 'success') {
          // Si trajo trabajadores, actualizar el maestro
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

    if (responseText.includes('Unable to open the file') || responseText.includes('Page Not Found')) {
      return res.json({
        success: false,
        error: 'Google Apps Script indicó que no se pudo abrir el archivo. Siga los pasos actualizados para volver a implementar como "Nueva versión".',
      });
    }

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
app.post('/api/maestro/sync-from-drive', async (req, res) => {
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

// Iniciar servidor Vite o estático
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Flor de Obsequio ejecutándose en http://0.0.0.0:${PORT}`);
  });
}

startServer();
