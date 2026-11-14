import { getSolicitudesStorage, saveSolicitudesStorage, getDriveConfigStorage, callAppsScript } from './_lib/storage.js';

function soloSemana(valor) {
  const m = String(valor || '').match(/(\d+)/);
  return m ? m[1] : String(valor || '');
}

function soloSede(valor) {
  return String(valor || '').replace(/^sede\s+/i, '').trim();
}

function soloProducto(valor) {
  const raw = String(valor || '').trim();
  const low = raw.toLowerCase();
  if (low.includes('bouquet')) return 'Bouquet';
  if (low.includes('clavel')) return 'Clavel';
  if (low.includes('alstroemeria')) return 'Alstroemeria';
  if (low.includes('rosa')) {
    if (low.includes('color')) return 'Rosa (Color)';
    return 'Rosa (Rojo)';
  }
  return raw
    .replace(/^ramo de\s+/i, '')
    .replace(/\s*\(seg[uú]n color disponible\)/gi, '')
    .replace(/\s*\(\d+\s+unidad(?:es)?\)\s*$/i, '')
    .trim();
}

const CUPOS_PRODUCTO = {
  rosa: 20, // Rosa (Color) + Rosa (Rojo) total entre las 3 sedes
  bouquet: 5, // Bouquet total entre las 3 sedes
  clavel: 20, // Clavel total entre las 3 sedes
  alstroemeria: 30, // Alstroemeria total entre las 3 sedes
};

function categoriaCuotaProducto(producto, tipoProducto) {
  const low = String(producto || '').toLowerCase();
  if (tipoProducto === 'bouquet' || low.includes('bouquet')) return 'bouquet';
  if (low.includes('clavel')) return 'clavel';
  if (low.includes('alstroemeria')) return 'alstroemeria';
  return 'rosa';
}

function normalizarSede(valor) {
  const s = String(valor || '').toUpperCase();
  if (s.includes('HA')) return 'Sede HA';
  if (s.includes('SC')) return 'Sede SC';
  return 'Sede MG';
}

function normalizarSolicitudDesdeSheet(s) {
  const cantidadNum = Number(s?.cantidad);
  const fechaEntregaOk = /^\d{4}-\d{2}-\d{2}$/.test(String(s?.fechaEntrega || '').trim())
    ? String(s.fechaEntrega).trim()
    : '';
  const prod = soloProducto(s?.producto);
  return {
    ...s,
    semana: soloSemana(s?.semana),
    sede: normalizarSede(s?.sede),
    producto: prod,
    tipoProducto: s?.tipoProducto === 'bouquet' || prod.toLowerCase().includes('bouquet') ? 'bouquet' : 'ramo',
    cantidad: cantidadNum && !Number.isNaN(cantidadNum) ? cantidadNum : 1,
    fechaEntrega: fechaEntregaOk,
    syncedToDrive: true,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const nueva = req.body;
      if (!nueva || !nueva.codigo || !nueva.nombre) {
        return res.status(400).json({ success: false, error: 'Faltan datos obligatorios' });
      }
      const driveCfg = getDriveConfigStorage();
      if (!driveCfg.webhookUrl) {
        return res.status(400).json({
          success: false,
          error: 'No hay webhook de Google Sheets. Abra Conexión con Drive y guarde la URL /exec.',
        });
      }

      const cantidadNum = Math.max(1, Number(nueva.cantidad) || 1);
      const prodLimpio = soloProducto(nueva.producto);
      const tipoProd =
        nueva.tipoProducto === 'bouquet' || prodLimpio.toLowerCase().includes('bouquet')
          ? 'bouquet'
          : 'ramo';
      const categoriaNueva = categoriaCuotaProducto(prodLimpio, tipoProd);
      const fechaEntregaNueva = String(nueva.fechaEntrega || '').trim();

      // Verificar disponibilidad real global por producto entre las 3 sedes antes de registrar
      let existentes = getSolicitudesStorage();
      try {
        const sheetData = await callAppsScript(driveCfg.webhookUrl);
        if (Array.isArray(sheetData.solicitudes)) {
          existentes = sheetData.solicitudes.map(normalizarSolicitudDesdeSheet);
          saveSolicitudesStorage(existentes);
        }
      } catch (e) {
        console.warn('[solicitudes] validación usando caché local:', e?.message || e);
      }

      if (fechaEntregaNueva) {
        const enSemana = existentes.filter(
          (s) =>
            String(s.fechaEntrega || '').trim() === fechaEntregaNueva &&
            s.estado !== 'Cancelada'
        );
        const usados = { rosa: 0, bouquet: 0, clavel: 0, alstroemeria: 0 };
        for (const s of enSemana) {
          const cat = categoriaCuotaProducto(s.producto, s.tipoProducto);
          usados[cat] += Number(s.cantidad) || 1;
        }

        const todosAgotados =
          usados.rosa >= CUPOS_PRODUCTO.rosa &&
          usados.bouquet >= CUPOS_PRODUCTO.bouquet &&
          usados.clavel >= CUPOS_PRODUCTO.clavel &&
          usados.alstroemeria >= CUPOS_PRODUCTO.alstroemeria;

        if (todosAgotados) {
          return res.status(400).json({
            success: false,
            error: 'Se han agotado las disponibilidades para todos los productos en esta semana.',
          });
        }

        const maxCat = CUPOS_PRODUCTO[categoriaNueva];
        if (usados[categoriaNueva] + cantidadNum > maxCat) {
          const nombresCat = {
            rosa: 'Rosa (Color y Rojo)',
            bouquet: 'Bouquet',
            clavel: 'Clavel',
            alstroemeria: 'Alstroemeria',
          };
          return res.status(400).json({
            success: false,
            error: `Producto sin existencia / agotado: ${nombresCat[categoriaNueva]} alcanzó el límite semanal de ${maxCat} unidades entre las tres sedes (${usados[categoriaNueva]}/${maxCat}).`,
          });
        }
      }

      const payload = {
        id: nueva.id,
        fecha: nueva.fecha,
        semana: soloSemana(nueva.semana),
        codigo: nueva.codigo,
        nombre: nueva.nombre,
        cargo: nueva.cargo || '',
        cantidad: cantidadNum,
        producto: soloProducto(nueva.producto),
        sede: soloSede(nueva.sede),
        motivo: nueva.motivo || 'Obsequio',
        fechaEntrega: fechaEntregaNueva,
        remitente: nueva.remitente,
        estado: nueva.estado || 'Registrada',
      };

      await callAppsScript(driveCfg.webhookUrl, payload);

      const finalNueva = {
        ...nueva,
        cantidad: cantidadNum,
        motivo: payload.motivo,
        fechaEntrega: payload.fechaEntrega,
        syncedToDrive: true,
        guardadoEnServidor: true,
      };
      const solicitudes = existentes.filter((s) => s.id !== nueva.id);
      solicitudes.unshift(finalNueva);
      saveSolicitudesStorage(solicitudes);
      return res.status(200).json({ success: true, solicitud: finalNueva });
    }
    const driveCfg = getDriveConfigStorage();
    if (driveCfg.webhookUrl) {
      try {
        const data = await callAppsScript(driveCfg.webhookUrl);
        if (Array.isArray(data.solicitudes)) {
          const limpias = data.solicitudes.map(normalizarSolicitudDesdeSheet);
          saveSolicitudesStorage(limpias);
          return res.status(200).json({ success: true, solicitudes: limpias, source: 'sheets' });
        }
      } catch (e) {
        console.warn('[solicitudes] lectura hoja:', e?.message || e);
      }
    }
    return res.status(200).json({ success: true, solicitudes: getSolicitudesStorage(), source: 'cache' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Error en solicitudes' });
  }
}
