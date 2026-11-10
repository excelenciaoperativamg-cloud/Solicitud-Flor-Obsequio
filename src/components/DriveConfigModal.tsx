import React, { useState } from 'react';
import { Cloud, CheckCircle2, Copy, ExternalLink, ShieldCheck, RefreshCw, AlertTriangle, HelpCircle, Check, ArrowRight } from 'lucide-react';
import { DriveConfig } from '../services/apiClient';

interface DriveConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: DriveConfig;
  onGuardarConfig: (webhookUrl: string, spreadsheetUrl: string) => Promise<void>;
  onProbarConexion: (targetUrl?: string) => Promise<{ success: boolean; error?: string; response?: string }>;
}

export const DriveConfigModal: React.FC<DriveConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onGuardarConfig,
  onProbarConexion,
}) => {
  const [webhookUrl, setWebhookUrl] = useState(config.webhookUrl || '');
  const [spreadsheetUrl, setSpreadsheetUrl] = useState(
    config.spreadsheetUrl || 'https://docs.google.com/spreadsheets/d/1ecAKLTKJ-qrIWMGl5Rk1SpxhlTpfY6k5Gkyl4b5efzA/edit'
  );
  const [copiadoCodigo, setCopiadoCodigo] = useState(false);
  const [probando, setProbando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [resultadoPrueba, setResultadoPrueba] = useState<{ success: boolean; mensaje: string } | null>(null);

  if (!isOpen) return null;

  // Código optimizado específicamente para el archivo oficial "Solicitud Flor Obsequio" (ID: 1ecAKLTKJ-qrIWMGl5Rk1SpxhlTpfY6k5Gkyl4b5efzA)
  const codigoAppsScript = `// ==============================================================
// CONECTOR OFICIAL: MG CONSULTORES - FLOR DE OBSEQUIO
// Hoja vinculada: Solicitud Flor Obsequio
// ==============================================================
var SPREADSHEET_ID = "1ecAKLTKJ-qrIWMGl5Rk1SpxhlTpfY6k5Gkyl4b5efzA";

function getSpreadsheet() {
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch(e) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

// 1. Manejador GET: Verifica conexión y extrae los trabajadores (ID RH, NOMBRE, SEDE)
function doGet(e) {
  try {
    var ss = getSpreadsheet();
    if (!ss) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "No se pudo acceder a la hoja con ID: " + SPREADSHEET_ID
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Buscar la pestaña que contiene los trabajadores (ID RH, NOMBRE, SEDE)
    var sheets = ss.getSheets();
    var sheetMaestro = null;
    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i].getName() !== "Solicitudes") {
        var val = sheets[i].getRange(1, 1).getValue();
        if (val && String(val).toUpperCase().indexOf("ID") !== -1) {
          sheetMaestro = sheets[i];
          break;
        }
      }
    }
    if (!sheetMaestro) {
      sheetMaestro = ss.getSheetByName("Maestro") || sheets[0];
    }
    
    var data = sheetMaestro ? sheetMaestro.getDataRange().getValues() : [];
    var workers = [];
    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      if (row[0] && row[1]) {
        var rawSede = String(row[2] || "Sede MG").trim();
        var sedeNorm = "Sede MG";
        if (rawSede.toUpperCase().indexOf("HA") !== -1) sedeNorm = "Sede HA";
        else if (rawSede.toUpperCase().indexOf("SC") !== -1) sedeNorm = "Sede SC";
        else if (rawSede.toUpperCase().indexOf("MG") !== -1) sedeNorm = "Sede MG";
        
        workers.push({
          codigo: String(row[0]).trim(),
          nombre: String(row[1]).trim(),
          sede: sedeNorm,
          cargo: "Operario",
          activo: true
        });
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Conexión exitosa",
      spreadsheetName: ss.getName(),
      totalWorkers: workers.length,
      workers: workers
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// 2. Manejador POST: Registra cada solicitud en la pestaña "Solicitudes"
function doPost(e) {
  try {
    var ss = getSpreadsheet();
    if (!ss) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "No se pudo acceder a la hoja"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var sheet = ss.getSheetByName("Solicitudes");
    if (!sheet) {
      sheet = ss.insertSheet("Solicitudes");
      sheet.appendRow([
        "Id", "Fecha", "Semana", "Código", "Nombre", "Producto", 
        "Sede", "Motivo", "Fecha Entrega", "Remitente", "Estado"
      ]);
      sheet.getRange("A1:K1").setFontWeight("bold").setBackground("#0a2958").setFontColor("#ffffff");
    }
    
    var raw = e && e.postData ? e.postData.contents : "";
    var data = {};
    try {
      data = JSON.parse(raw);
    } catch(pe) {
      data = (e && e.parameter) ? e.parameter : {};
    }
    
    if (data.action === "ping") {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Ping recibido correctamente",
        spreadsheet: ss.getName()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Insertar la fila de la solicitud
    sheet.appendRow([
      data.id || ("SFO-" + new Date().getTime()),
      data.fecha || "",
      data.semana || "",
      data.codigo || "",
      data.nombre || "",
      data.producto || "",
      data.sede || "",
      data.motivo || "",
      data.fechaEntrega || "",
      data.remitente || "",
      data.estado || "Registrada"
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Solicitud registrada con éxito en Google Drive",
      id: data.id
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const copiarCodigo = () => {
    navigator.clipboard.writeText(codigoAppsScript);
    setCopiadoCodigo(true);
    setTimeout(() => setCopiadoCodigo(false), 2500);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await onGuardarConfig(webhookUrl, spreadsheetUrl);
      onClose();
    } finally {
      setGuardando(false);
    }
  };

  const handleTest = async () => {
    setProbando(true);
    setResultadoPrueba(null);
    try {
      await onGuardarConfig(webhookUrl, spreadsheetUrl);
      const res = await onProbarConexion(webhookUrl);
      if (res.success) {
        setResultadoPrueba({
          success: true,
          mensaje: res.response || '¡Conexión automática exitosa! Google Drive respondió y se sincronizó correctamente.',
        });
      } else {
        setResultadoPrueba({
          success: false,
          mensaje: res.error || 'No se recibió respuesta exitosa de Apps Script.',
        });
      }
    } catch (err: any) {
      setResultadoPrueba({ success: false, mensaje: err.message || 'Error al conectar' });
    } finally {
      setProbando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0a2958] text-white flex items-center justify-center shadow-xs">
              <Cloud className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#0a2958]">
                Conexión Automática con su Hoja de Google Drive
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                "Solicitud Flor Obsequio" • Sin pedir correo ni contraseñas a los trabajadores
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-lg leading-none cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* ALERTA: PASO CLAVE QUE FALTABA */}
        <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-300 text-amber-950 text-xs mb-4 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-extrabold text-amber-950">
              ¿Por qué no sincronizaba al pegar el script?
            </h4>
            <p className="mt-1 leading-relaxed text-amber-900">
              En Google Apps Script, después de pegar o modificar el código, es <strong>obligatorio crear una "Nueva versión"</strong> al implementar. Si solo se pega el código, la URL continúa ejecutando la versión vieja.
            </p>
          </div>
        </div>

        {/* PASOS DE 1 MINUTO PARA SOLUCIONARLO */}
        <div className="bg-[#0a2958]/5 rounded-xl p-4 border border-[#0a2958]/20 space-y-2 mb-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-[#0a2958] flex items-center gap-1.5">
              <Check className="w-4 h-4 text-[#E60000]" />
              Siga estos 3 pasos rápidos en su hoja:
            </span>
            <button
              type="button"
              onClick={copiarCodigo}
              className="text-xs font-bold px-3 py-1 bg-[#0a2958] hover:bg-[#0d346e] text-white rounded-lg flex items-center gap-1 shadow-xs transition cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiadoCodigo ? '¡Código Copiado!' : '1. Copiar Código Actualizado'}</span>
            </button>
          </div>

          <ol className="list-decimal list-inside space-y-1.5 text-slate-700 text-[11px] leading-relaxed pt-1">
            <li>
              En su hoja <strong>Solicitud Flor Obsequio</strong>, abra <strong>Extensiones &gt; Apps Script</strong>.
            </li>
            <li>
              Pegue este nuevo código (que ya tiene el ID exacto de su archivo y lee su columna <code>ID RH</code>). Haga clic en el disquete <strong>Guardar (💾)</strong>.
            </li>
            <li>
              Arriba a la derecha, haga clic en <strong>Implementar &gt; Administrar implementaciones</strong>.
            </li>
            <li>
              Haga clic en el <strong>icono de lápiz ✏️ (Editar)</strong>.
            </li>
            <li>
              En el desplegable <strong>Versión</strong>, elija <strong className="text-[#0a2958]">Nueva versión</strong>.
            </li>
            <li>
              Asegúrese de que <em>Quién tiene acceso</em> diga <strong className="text-emerald-700">Cualquier persona</strong>.
            </li>
            <li>
              Haga clic en <strong>Implementar</strong>, copie la URL terminada en <code>/exec</code> y péguela abajo.
            </li>
          </ol>
        </div>

        <form onSubmit={handleGuardar} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-800 mb-1">
              URL del Webhook de Apps Script (/exec)
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#0a2958] focus:ring-2 focus:ring-[#0a2958]/20 outline-hidden font-mono text-slate-800 font-medium"
            />
          </div>

          {/* Resultado de Prueba */}
          {resultadoPrueba && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                resultadoPrueba.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold'
                  : 'bg-rose-50 border-rose-200 text-rose-800 font-semibold'
              }`}
            >
              {resultadoPrueba.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-[#E60000] shrink-0" />
              )}
              <span>{resultadoPrueba.mensaje}</span>
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleTest}
              disabled={probando || !webhookUrl}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${probando ? 'animate-spin' : ''}`} />
              <span>{probando ? 'Verificando...' : 'Probar Conexión con Google Drive'}</span>
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold cursor-pointer text-xs"
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="px-5 py-2.5 rounded-xl bg-[#0a2958] hover:bg-[#0d346e] text-white font-bold cursor-pointer text-xs shadow-xs"
              >
                {guardando ? 'Guardando...' : 'Guardar y Activar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
