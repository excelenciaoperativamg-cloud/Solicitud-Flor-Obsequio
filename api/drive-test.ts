import { getDriveConfigStorage, saveMaestroStorage } from './_lib/storage';

export default async function handler(req: any, res: any) {
  try {
    const driveCfg = getDriveConfigStorage();
    // Permitir url enviada en el body o la que esté guardada
    const targetUrl = (req.body?.webhookUrl || driveCfg.webhookUrl || '').trim();

    if (!targetUrl) {
      return res.status(200).json({
        success: false,
        error: 'No hay URL de Webhook configurada. Ingrese la URL de Apps Script terminada en /exec.',
      });
    }

    // 1. Probar GET primero
    try {
      const getRes = await fetch(targetUrl, { redirect: 'follow' });
      const getText = await getRes.text();

      if (getText.includes('Script function not found: doGet')) {
        return res.status(200).json({
          success: false,
          error:
            'El script en Apps Script no tiene la función doGet. Copie el código actualizado del modal y vuelva a Implementar como "Nueva versión".',
        });
      }

      if (getText.includes('Unable to open the file') || getText.includes('Page Not Found')) {
        return res.status(200).json({
          success: false,
          error:
            'Google Apps Script no pudo abrir el archivo. Asegúrese de que el acceso esté en "Cualquier persona" y vuelva a implementar.',
        });
      }

      try {
        const jsonGet = JSON.parse(getText);
        if (jsonGet.status === 'success') {
          if (jsonGet.workers && jsonGet.workers.length > 0) {
            saveMaestroStorage(jsonGet.workers);
          }
          return res.status(200).json({
            success: true,
            status: 200,
            response: `¡Conexión exitosa! Hoja: "${jsonGet.spreadsheetName || 'Solicitud Flor Obsequio'}". Trabajadores detectados: ${jsonGet.totalWorkers || 0}`,
          });
        }
      } catch {
        // no json, continuar con POST
      }
    } catch (e: any) {
      console.warn('[drive-test] GET test warning:', e?.message || e);
    }

    // 2. Probar POST
    const testPayload = {
      action: 'ping',
      timestamp: new Date().toISOString(),
      mensaje: 'Prueba de conexión automática desde MG Consultores (Vercel)',
    };

    const postRes = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
      redirect: 'follow',
    });

    const responseText = await postRes.text().catch(() => '');

    return res.status(200).json({
      success: postRes.ok || responseText.includes('success'),
      status: postRes.status,
      response: responseText || 'Conexión recibida exitosamente por Google Drive',
    });
  } catch (err: any) {
    return res.status(200).json({
      success: false,
      error: err.message || 'Error al conectar con Webhook de Drive',
    });
  }
}
