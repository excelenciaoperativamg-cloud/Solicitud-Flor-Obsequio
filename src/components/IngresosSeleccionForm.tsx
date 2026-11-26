import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  UserPlus,
  Sparkles,
  Calendar,
  Clock,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Copy,
  LogOut,
  Search,
  Download,
  RefreshCw,
  Check,
  X,
  ChevronDown,
  Mail,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import * as XLSX from 'xlsx';
import { IngresoSeleccion, TrabajadorMaestro } from '../types';
import { EmailNotificationResult, retryEmailIngresosSeleccionApi } from '../services/apiClient';
import { getTodayString, formatDateSpanish, getISOWeekNumber } from '../utils/dateUtils';

interface IngresosSeleccionFormProps {
  sesion: TrabajadorMaestro;
  ingresosSeleccion: IngresoSeleccion[];
  sheetsSupported: boolean;
  emailSupported?: boolean;
  ingresosSeleccionSheetActual?: string;
  needsAppsScriptUpdate?: boolean;
  onGuardarIngresoSeleccion: (
    nueva: IngresoSeleccion | IngresoSeleccion[],
    correoNotificacion?: string
  ) => Promise<{
    success: boolean;
    error?: string;
    solicitud?: IngresoSeleccion;
    solicitudes?: IngresoSeleccion[];
    pendingAppsScriptUpdate?: boolean;
    ingresosSeleccionSheetName?: string;
    needsAppsScriptUpdate?: boolean;
    emailNotification?: EmailNotificationResult;
  }>;
  onRecargarIngresosSeleccion?: () => Promise<void>;
  onCerrarSesion?: () => void;
}

const PRODUCTOS_IS = ['Rosa', 'Alstroemeria', 'Clavel', 'Gypso'] as const;
const MOTIVO_FIJO_IS = 'Ingresos';
const EMAIL_ITEM_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function inferirSedePorProducto(producto: string): string {
  const p = String(producto || '').trim().toLowerCase();
  if (p === 'alstroemeria') return 'HA';
  if (p === 'clavel') return 'SC';
  if (p.includes('rosa') || p === 'bouquet' || p.includes('gypso')) return 'MG';
  return '';
}

function parsearListaCorreos(raw: string): {
  correos: string[];
  invalidos: string[];
  normalizado: string;
} {
  const partes = String(raw || '')
    .split(/[,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const correos: string[] = [];
  const vistos = new Set<string>();
  const invalidos: string[] = [];

  for (const correo of partes) {
    if (!EMAIL_ITEM_REGEX.test(correo)) {
      invalidos.push(correo);
      continue;
    }
    const clave = correo.toLowerCase();
    if (!vistos.has(clave)) {
      vistos.add(clave);
      correos.push(correo);
    }
  }

  return {
    correos,
    invalidos,
    normalizado: correos.join(', '),
  };
}

function obtenerNumSemanaIS(s: IngresoSeleccion): number {
  const m = String(s.semana || '').match(/(\d+)/);
  if (m) return Number(m[1]);
  if (s.fechaEntrega) return getISOWeekNumber(s.fechaEntrega);
  return 0;
}

export const IngresosSeleccionForm: React.FC<IngresosSeleccionFormProps> = ({
  sesion,
  ingresosSeleccion,
  sheetsSupported,
  emailSupported = true,
  ingresosSeleccionSheetActual = '',
  needsAppsScriptUpdate = false,
  onGuardarIngresoSeleccion,
  onRecargarIngresosSeleccion,
  onCerrarSesion,
}) => {
  const fechaSolicitud = getTodayString();

  const [productosCantidades, setProductosCantidades] = useState<Record<string, string>>({});

  const [fechaEntrega, setFechaEntrega] = useState(getTodayString());
  const [horaEntrega, setHoraEntrega] = useState('');
  const [observacion, setObservacion] = useState('');
  const [correoNotificacion, setCorreoNotificacion] = useState('');

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [solicitudesExitosas, setSolicitudesExitosas] = useState<IngresoSeleccion[]>([]);
  const [emailResultado, setEmailResultado] = useState<EmailNotificationResult | null>(null);
  const [reintentandoCorreo, setReintentandoCorreo] = useState(false);
  const [avisoPendienteScript, setAvisoPendienteScript] = useState(false);
  const [copiadoId, setCopiadoId] = useState(false);

  const [busquedaTabla, setBusquedaTabla] = useState('');
  const [filtroSemana, setFiltroSemana] = useState<string>('todas');
  const [productosFiltro, setProductosFiltro] = useState<string[]>([]);
  const [dropdownProductoAbierto, setDropdownProductoAbierto] = useState(false);
  const dropdownProductoRef = useRef<HTMLDivElement | null>(null);
  const [recargandoTabla, setRecargandoTabla] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownProductoRef.current &&
        !dropdownProductoRef.current.contains(e.target as Node)
      ) {
        setDropdownProductoAbierto(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const semanaCalculada = useMemo(() => {
    return fechaEntrega ? getISOWeekNumber(fechaEntrega) : getISOWeekNumber(fechaSolicitud);
  }, [fechaEntrega, fechaSolicitud]);

  const siguienteNumeroId = useMemo(() => {
    const year = new Date().getFullYear();
    let maxNum = 0;
    for (const s of ingresosSeleccion) {
      const m = String(s.id || '').match(/^IS-(\d{4})-(\d+)$/i);
      if (m && Number(m[1]) === year) {
        maxNum = Math.max(maxNum, Number(m[2]));
      }
    }
    return Math.max(maxNum + 1, ingresosSeleccion.length + 1);
  }, [ingresosSeleccion]);

  const productosSeleccionadosOrdenados = useMemo(
    () => PRODUCTOS_IS.filter((p) => Object.prototype.hasOwnProperty.call(productosCantidades, p)),
    [productosCantidades]
  );

  const totalRamosSeleccionados = useMemo(() => {
    return productosSeleccionadosOrdenados.reduce((acc, prod) => {
      const n = Number(productosCantidades[prod]);
      return acc + (!Number.isNaN(n) && n > 0 ? Math.floor(n) : 0);
    }, 0);
  }, [productosSeleccionadosOrdenados, productosCantidades]);

  const toggleProducto = (prod: string) => {
    setProductosCantidades((prev) => {
      if (Object.prototype.hasOwnProperty.call(prev, prod)) {
        return {};
      }
      return { [prod]: '1' };
    });
    setErrores((prev) => {
      const next = { ...prev };
      delete next.producto;
      delete next.cantidad;
      for (const key of Object.keys(next)) {
        if (key.startsWith('cant_')) {
          delete next[key];
        }
      }
      return next;
    });
  };

  const cambiarCantidadProducto = (prod: string, valor: string) => {
    setProductosCantidades((prev) => ({
      ...prev,
      [prod]: valor.replace(/\D/g, ''),
    }));
    setErrores((prev) => {
      const next = { ...prev };
      delete next.cantidad;
      delete next[`cant_${prod}`];
      return next;
    });
  };

  const validarFormulario = (): boolean => {
    const errs: Record<string, string> = {};

    if (productosSeleccionadosOrdenados.length === 0) {
      errs.producto =
        'Seleccione un producto (Rosa, Alstroemeria, Clavel o Gypso) e ingrese la cantidad.';
    } else if (productosSeleccionadosOrdenados.length > 1) {
      errs.producto = 'Solo se permite seleccionar un producto por solicitud.';
    } else {
      const prod = productosSeleccionadosOrdenados[0];
      const cantNum = Number(productosCantidades[prod]);
      if (!productosCantidades[prod] || Number.isNaN(cantNum) || cantNum < 1) {
        errs[`cant_${prod}`] = `Ingrese una cantidad válida (mínimo 1) para ${prod}.`;
        errs.cantidad = 'Revise la cantidad ingresada para el producto.';
      }
    }

    if (!fechaEntrega) {
      errs.fechaEntrega = 'Seleccione la fecha de entrega.';
    }

    if (!horaEntrega) {
      errs.horaEntrega = 'Seleccione la hora de entrega.';
    }

    const parsedCorreos = parsearListaCorreos(correoNotificacion);
    if (!correoNotificacion.trim()) {
      errs.correoNotificacion = 'Ingrese el correo electrónico para enviar la notificación.';
    } else if (parsedCorreos.invalidos.length > 0 || parsedCorreos.correos.length === 0) {
      errs.correoNotificacion =
        parsedCorreos.invalidos.length > 0
          ? `Correo(s) con formato inválido: ${parsedCorreos.invalidos.join(', ')}`
          : 'Ingrese un correo electrónico válido.';
    }

    setErrores(errs);
    return Object.keys(errs).length === 0;
  };

  const limpiarFormulario = () => {
    setProductosCantidades({});
    setFechaEntrega(getTodayString());
    setHoraEntrega('');
    setObservacion('');
    setCorreoNotificacion('');
    setErrores({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validarFormulario()) return;

    setIsSubmitting(true);
    setErrores({});

    try {
      const parsedCorreos = parsearListaCorreos(correoNotificacion);
      const correoLimpio = parsedCorreos.normalizado;
      const year = new Date().getFullYear();
      const semanaStr = String(semanaCalculada);

      const listaSolicitudes: IngresoSeleccion[] = productosSeleccionadosOrdenados
        .slice(0, 1)
        .map((prod, idx) => ({
          id: `IS-${year}-${String(siguienteNumeroId + idx).padStart(3, '0')}`,
          fechaSolicitud,
          codigo: sesion.codigo.trim(),
          nombre: sesion.nombre.trim(),
          sede: inferirSedePorProducto(prod),
          producto: prod,
          cantidad: Math.max(1, Math.floor(Number(productosCantidades[prod]) || 1)),
          motivo: MOTIVO_FIJO_IS,
          semana: semanaStr,
          fechaEntrega,
          horaEntrega,
          observacion: observacion.trim(),
          notificado: correoLimpio || 'Registrada',
          estado: correoLimpio || 'Registrada',
          creadoEn: Date.now() + idx,
        }));

      const res = await onGuardarIngresoSeleccion(listaSolicitudes, correoLimpio);

      if (res.success && (res.solicitudes?.length || res.solicitud)) {
        const guardadas =
          res.solicitudes && res.solicitudes.length > 0
            ? res.solicitudes
            : res.solicitud
            ? [res.solicitud]
            : listaSolicitudes;
        setSolicitudesExitosas(guardadas);
        setEmailResultado(res.emailNotification || null);
        setAvisoPendienteScript(
          !!res.pendingAppsScriptUpdate || !!res.needsAppsScriptUpdate
        );
        limpiarFormulario();
        try {
          confetti({
            particleCount: 70,
            spread: 60,
            origin: { y: 0.65 },
            colors: ['#0a2958', '#E60000', '#10b981'],
          });
        } catch {}
      } else {
        setErrores({
          general: res.error || 'No se pudo guardar en la hoja Ingresos Personal.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReintentarCorreo = async () => {
    if (solicitudesExitosas.length === 0) return;
    const correoDestino =
      emailResultado?.to || solicitudesExitosas[0]?.notificado || '';
    if (!correoDestino || !correoDestino.includes('@')) return;

    setReintentandoCorreo(true);
    try {
      const resMail = await retryEmailIngresosSeleccionApi(
        solicitudesExitosas,
        correoDestino
      );
      setEmailResultado(resMail);
    } finally {
      setReintentandoCorreo(false);
    }
  };

  const semanasDisponiblesTabla = useMemo(() => {
    const set = new Set<number>();
    for (const s of ingresosSeleccion) {
      const num = obtenerNumSemanaIS(s);
      if (num > 0) set.add(num);
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [ingresosSeleccion]);

  const productosDisponiblesTabla = useMemo(() => {
    const set = new Set<string>(PRODUCTOS_IS);
    for (const s of ingresosSeleccion) {
      const p = String(s.producto || '').trim();
      if (p) set.add(p);
    }
    return Array.from(set);
  }, [ingresosSeleccion]);

  const toggleProductoFiltro = (prod: string) => {
    setProductosFiltro((prev) =>
      prev.includes(prod) ? prev.filter((p) => p !== prod) : [...prev, prod]
    );
  };

  const solicitudesFiltradas = useMemo(() => {
    const q = busquedaTabla.toLowerCase().trim();
    return ingresosSeleccion.filter((s) => {
      if (filtroSemana !== 'todas') {
        const sem = obtenerNumSemanaIS(s);
        if (String(sem) !== filtroSemana) return false;
      }
      if (productosFiltro.length > 0) {
        const prod = String(s.producto || '').trim().toLowerCase();
        const coincideProd = productosFiltro.some((p) => p.toLowerCase() === prod);
        if (!coincideProd) return false;
      }
      if (!q) return true;
      return (
        s.id.toLowerCase().includes(q) ||
        s.codigo.toLowerCase().includes(q) ||
        s.nombre.toLowerCase().includes(q) ||
        s.sede.toLowerCase().includes(q) ||
        s.producto.toLowerCase().includes(q) ||
        (s.motivo || '').toLowerCase().includes(q) ||
        (s.observacion || '').toLowerCase().includes(q) ||
        (s.notificado || '').toLowerCase().includes(q)
      );
    });
  }, [ingresosSeleccion, busquedaTabla, filtroSemana, productosFiltro]);

  const totalRamosFiltrados = useMemo(
    () => solicitudesFiltradas.reduce((acc, s) => acc + (Number(s.cantidad) || 0), 0),
    [solicitudesFiltradas]
  );

  const hayFiltrosTablaActivos =
    Boolean(busquedaTabla.trim()) || filtroSemana !== 'todas' || productosFiltro.length > 0;

  const limpiarFiltrosTabla = () => {
    setBusquedaTabla('');
    setFiltroSemana('todas');
    setProductosFiltro([]);
  };

  const exportarExcel = () => {
    const rows = solicitudesFiltradas.map((s) => ({
      Id: s.id,
      'Fecha Solicitud': s.fechaSolicitud,
      Código: s.codigo,
      Nombre: s.nombre,
      Sede: s.sede,
      Producto: s.producto,
      Cantidad: s.cantidad,
      Motivo: s.motivo || MOTIVO_FIJO_IS,
      Semana: s.semana,
      'Fecha Entrega': s.fechaEntrega,
      'Hora Entrega': s.horaEntrega || '',
      Observación: s.observacion || '',
      Notificado: s.notificado || 'Registrada',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ingresos Personal');
    XLSX.writeFile(wb, `Ingresos_Personal_${getTodayString()}.xlsx`);
  };

  const primeraExitosa = solicitudesExitosas[0];
  const idsExitososTexto = solicitudesExitosas.map((s) => s.id).join(', ');
  const totalExitosaRamos = solicitudesExitosas.reduce(
    (acc, s) => acc + (Number(s.cantidad) || 1),
    0
  );

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Modal de Confirmación */}
      {primeraExitosa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 text-center space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="w-14 h-14 bg-[#0a2958]/10 text-[#0a2958] rounded-full flex items-center justify-center mx-auto ring-8 ring-[#0a2958]/5">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-[#0a2958]">¡Registro Exitoso!</h3>
              <p className="text-xs text-slate-500 mt-1">
                {solicitudesExitosas.length > 1
                  ? `Se registraron ${solicitudesExitosas.length} productos por separado en `
                  : 'La solicitud fue registrada en '}
                <strong>Ingresos Personal</strong>.
              </p>
            </div>

            {avisoPendienteScript && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs text-left flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  Guardado en respaldo local. Para escribir en la hoja{' '}
                  <strong>Ingresos Personal</strong>, el administrador debe actualizar el Apps Script e implementar una <strong>Nueva versión</strong>.
                </span>
              </div>
            )}

            {emailResultado?.requested && (
              <div
                className={`p-3 rounded-xl border text-xs text-left space-y-2 ${
                  emailResultado.sent
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex items-start gap-2">
                  {emailResultado.sent ? (
                    <Mail className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    {emailResultado.sent ? (
                      <span>
                        Notificación enviada a{' '}
                        <strong className="break-all">{emailResultado.to}</strong>.
                      </span>
                    ) : (
                      <span>
                        <strong>Notificación pendiente para {emailResultado.to}:</strong>{' '}
                        {emailResultado.error || 'No se pudo enviar el correo automáticamente.'}
                      </span>
                    )}
                  </div>
                </div>
                {!emailResultado.sent && (
                  <button
                    type="button"
                    onClick={handleReintentarCorreo}
                    disabled={reintentandoCorreo}
                    className="w-full py-1.5 px-3 rounded-lg bg-[#0a2958] hover:bg-[#0d346e] text-white font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${reintentandoCorreo ? 'animate-spin' : ''}`}
                    />
                    <span>
                      {reintentandoCorreo ? 'Reintentando envío…' : 'Reintentar envío de correo'}
                    </span>
                  </button>
                )}
              </div>
            )}

            <div className="bg-slate-50 rounded-2xl p-4 text-left border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between items-start gap-2 pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-semibold shrink-0">
                  {solicitudesExitosas.length > 1 ? 'Ids:' : 'Id:'}
                </span>
                <div className="flex items-center gap-1.5 justify-end flex-wrap">
                  <span className="font-mono font-extrabold text-[#0a2958] text-sm text-right">
                    {idsExitososTexto}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(idsExitososTexto);
                      setCopiadoId(true);
                      setTimeout(() => setCopiadoId(false), 1800);
                    }}
                    className="p-1 hover:bg-slate-200 rounded text-slate-500 cursor-pointer"
                    title="Copiar Id(s)"
                  >
                    {copiadoId ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fecha Solicitud:</span>
                <span className="font-semibold text-slate-900">
                  {primeraExitosa.fechaSolicitud}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Código:</span>
                <span className="font-mono font-bold text-slate-900">
                  {primeraExitosa.codigo}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nombre:</span>
                <span className="font-semibold text-slate-900 text-right">
                  {primeraExitosa.nombre}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sede:</span>
                <span className="font-bold text-[#0a2958]">{primeraExitosa.sede}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Motivo:</span>
                <span className="font-bold text-slate-900">
                  {primeraExitosa.motivo || MOTIVO_FIJO_IS}
                </span>
              </div>

              {solicitudesExitosas.length === 1 ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Producto:</span>
                    <span className="font-bold text-slate-900">{primeraExitosa.producto}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cantidad:</span>
                    <span className="font-bold font-mono tabular-nums text-[#0a2958]">
                      {primeraExitosa.cantidad} ramos
                    </span>
                  </div>
                </>
              ) : (
                <div className="pt-1 pb-1">
                  <span className="text-slate-500 block mb-1.5 font-semibold">
                    Detalle por producto (un registro por producto):
                  </span>
                  <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-slate-100 text-slate-600 font-bold">
                        <tr>
                          <th className="py-1.5 px-2.5">Id</th>
                          <th className="py-1.5 px-2.5">Producto</th>
                          <th className="py-1.5 px-2.5 text-right">Cantidad</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {solicitudesExitosas.map((item) => (
                          <tr key={item.id}>
                            <td className="py-1.5 px-2.5 font-mono font-bold text-[#0a2958]">
                              {item.id}
                            </td>
                            <td className="py-1.5 px-2.5 font-semibold text-slate-800">
                              {item.producto}
                            </td>
                            <td className="py-1.5 px-2.5 text-right font-mono tabular-nums font-bold text-[#0a2958]">
                              {item.cantidad}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 border-t border-slate-200 font-extrabold text-[#0a2958]">
                        <tr>
                          <td colSpan={2} className="py-1.5 px-2.5">
                            Total ramos ({solicitudesExitosas.length} registros)
                          </td>
                          <td className="py-1.5 px-2.5 text-right font-mono tabular-nums">
                            {totalExitosaRamos}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-slate-500">Semana:</span>
                <span className="font-bold text-[#E60000]">
                  Semana {primeraExitosa.semana || getISOWeekNumber(primeraExitosa.fechaEntrega)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fecha Entrega:</span>
                <span className="font-semibold text-slate-900">
                  {formatDateSpanish(primeraExitosa.fechaEntrega)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Hora Entrega:</span>
                <span className="font-mono font-bold text-[#0a2958]">
                  {primeraExitosa.horaEntrega || '—'}
                </span>
              </div>
              {primeraExitosa.observacion && (
                <div className="pt-1 border-t border-slate-200">
                  <span className="text-slate-500 block">Observación:</span>
                  <span className="font-medium text-slate-800">{primeraExitosa.observacion}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 font-semibold text-xs text-slate-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSolicitudesExitosas([]);
                  setEmailResultado(null);
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#0a2958] hover:bg-[#0d346e] text-white font-bold text-xs transition cursor-pointer"
              >
                Nueva Solicitud
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tarjeta Principal del Formulario */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
      >
        {/* Cabecera */}
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#E60000]/10 text-[#E60000] flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#0a2958] tracking-tight">
                INGRESOS PERSONAL
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Registro de flor para ingresos de personal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs">
              <Calendar className="w-4 h-4 text-[#0a2958]" />
              <span className="text-slate-500 font-medium">Fecha Solicitud:</span>
              <span className="font-mono font-extrabold text-[#0a2958]">
                {fechaSolicitud.split('-').reverse().join('/')}
              </span>
            </div>
            {onCerrarSesion && (
              <button
                type="button"
                onClick={onCerrarSesion}
                className="lg:hidden p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-[#E60000] cursor-pointer"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Aviso si el Apps Script requiere actualización */}
        {(!sheetsSupported || needsAppsScriptUpdate) && (
          <div className="mx-6 mt-5 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-extrabold">
                Sincronización con la hoja "Ingresos Personal" pendiente de actualizar en Drive
              </p>
              <p className="text-amber-800 leading-relaxed">
                {ingresosSeleccionSheetActual &&
                ingresosSeleccionSheetActual.toLowerCase() !== 'ingresos personal'
                  ? `El script activo devolvió la hoja "${ingresosSeleccionSheetActual}". `
                  : ''}
                {!emailSupported ? 'El envío de notificaciones por correo tampoco está activo en la versión desplegada. ' : ''}
                Para registrar directamente en la pestaña <strong>Ingresos Personal</strong>, actualice el código en{' '}
                <strong>Administración → Google Drive</strong> e implemente una{' '}
                <strong>Nueva versión</strong>.
              </p>
            </div>
          </div>
        )}

        {errores.general && (
          <div className="mx-6 mt-5 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#E60000]" />
            <span>{errores.general}</span>
          </div>
        )}

        <div className="p-6 space-y-7">
          {/* SECCIÓN 1: DATOS DEL SOLICITANTE */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <UserPlus className="w-4 h-4 text-[#0a2958]" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#0a2958]">
                1. Datos del Solicitante
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Código
                </label>
                <input
                  type="text"
                  value={sesion.codigo}
                  readOnly
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-mono text-sm font-bold text-[#0a2958] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nombre
                </label>
                <input
                  type="text"
                  value={sesion.nombre}
                  readOnly
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800 focus:outline-none"
                />
              </div>
            </div>
          </section>

          {/* SECCIÓN 2: PRODUCTO Y CANTIDAD */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <Sparkles className="w-4 h-4 text-[#0a2958]" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#0a2958]">
                2. Producto y Cantidad
              </h3>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <label className="block text-xs font-bold text-slate-700">
                  Producto y Cantidad <span className="text-[#E60000]">*</span>{' '}
                  <span className="text-[11px] font-normal text-slate-400">
                    (Seleccione un solo producto e ingrese la cantidad)
                  </span>
                </label>
                {productosSeleccionadosOrdenados.length > 0 && (
                  <span className="text-[11px] font-extrabold text-[#0a2958] bg-[#0a2958]/10 px-2.5 py-0.5 rounded-full">
                    {productosSeleccionadosOrdenados[0]} · {totalRamosSeleccionados}{' '}
                    {totalRamosSeleccionados === 1 ? 'ramo' : 'ramos'}
                  </span>
                )}
              </div>

              {/* Rosa, Alstroemeria, Clavel y Gypso */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {PRODUCTOS_IS.map((prod) => {
                  const seleccionado = Object.prototype.hasOwnProperty.call(
                    productosCantidades,
                    prod
                  );
                  const cantValor = productosCantidades[prod] ?? '';
                  const errorCant = errores[`cant_${prod}`];

                  return (
                    <div
                      key={prod}
                      className={`rounded-xl border transition flex flex-col justify-between ${
                        seleccionado
                          ? 'border-[#0a2958] bg-[#0a2958]/5 shadow-2xs'
                          : 'border-slate-200 bg-white hover:border-[#0a2958]/40'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleProducto(prod)}
                        className="w-full px-3.5 py-2.5 text-xs font-bold flex items-center justify-between gap-2 text-[#0a2958] cursor-pointer"
                      >
                        <span>{prod}</span>
                        <span
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            seleccionado
                              ? 'bg-[#0a2958] border-[#0a2958] text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {seleccionado && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                      </button>

                      {seleccionado && (
                        <div className="px-3.5 pb-3 pt-2 border-t border-slate-200/70">
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Cantidad <span className="text-[#E60000]">*</span>
                          </label>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            inputMode="numeric"
                            value={cantValor}
                            onChange={(e) =>
                              cambiarCantidadProducto(prod, e.target.value)
                            }
                            placeholder="Ej. 10"
                            className={`w-full px-3 py-2 rounded-lg border text-xs font-mono font-bold text-[#0a2958] bg-white focus:outline-none focus:ring-2 ${
                              errorCant
                                ? 'border-[#E60000] focus:ring-red-100'
                                : 'border-slate-200 focus:border-[#0a2958] focus:ring-[#0a2958]/10'
                            }`}
                          />
                          {errorCant && (
                            <p className="text-[10px] text-[#E60000] font-semibold mt-1">
                              {errorCant}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {errores.producto && (
                <p className="text-[11px] text-[#E60000] font-semibold mt-1.5">
                  {errores.producto}
                </p>
              )}
              {errores.cantidad && (
                <p className="text-[11px] text-[#E60000] font-semibold mt-1">
                  {errores.cantidad}
                </p>
              )}
            </div>
          </section>

          {/* SECCIÓN 3: ENTREGA, OBSERVACIÓN Y NOTIFICACIÓN */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <Calendar className="w-4 h-4 text-[#0a2958]" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#0a2958]">
                3. Entrega, Observación y Notificación
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Fecha Entrega */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Fecha Entrega <span className="text-[#E60000]">*</span>
                </label>
                <input
                  type="date"
                  value={fechaEntrega}
                  onChange={(e) => {
                    setFechaEntrega(e.target.value);
                    setErrores((prev) => ({ ...prev, fechaEntrega: '' }));
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 ${
                    errores.fechaEntrega
                      ? 'border-[#E60000] focus:ring-red-100'
                      : 'border-slate-200 focus:border-[#0a2958] focus:ring-[#0a2958]/10'
                  }`}
                />
                {errores.fechaEntrega && (
                  <p className="text-[11px] text-[#E60000] font-semibold mt-1">
                    {errores.fechaEntrega}
                  </p>
                )}
              </div>

              {/* Hora Entrega */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#0a2958]" />
                  <span>
                    Hora Entrega <span className="text-[#E60000]">*</span>
                  </span>
                </label>
                <input
                  type="time"
                  value={horaEntrega}
                  onChange={(e) => {
                    setHoraEntrega(e.target.value);
                    setErrores((prev) => ({ ...prev, horaEntrega: '' }));
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 ${
                    errores.horaEntrega
                      ? 'border-[#E60000] focus:ring-red-100'
                      : 'border-slate-200 focus:border-[#0a2958] focus:ring-[#0a2958]/10'
                  }`}
                />
                {errores.horaEntrega && (
                  <p className="text-[11px] text-[#E60000] font-semibold mt-1">
                    {errores.horaEntrega}
                  </p>
                )}
              </div>

              {/* Semana calculada automáticamente */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Semana
                </label>
                <div className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                  <span className="text-sm font-extrabold text-[#E60000]">
                    Semana {semanaCalculada}
                  </span>
                  <span className="text-[11px] text-slate-500 truncate">
                    {fechaEntrega ? formatDateSpanish(fechaEntrega) : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Observación */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-[#0a2958]" />
                <span>Observación</span>
                <span className="text-[11px] font-normal text-slate-400">(opcional)</span>
              </label>
              <textarea
                rows={3}
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                placeholder="Escriba aquí observaciones o detalles adicionales del ingreso..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#0a2958] focus:ring-2 focus:ring-[#0a2958]/10 resize-y"
              />
            </div>

            {/* Notificado */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#0a2958]" />
                <span>
                  Notificado (correo electrónico) <span className="text-[#E60000]">*</span>
                </span>
              </label>
              <input
                type="text"
                value={correoNotificacion}
                onChange={(e) => {
                  setCorreoNotificacion(e.target.value);
                  setErrores((prev) => ({ ...prev, correoNotificacion: '' }));
                }}
                placeholder="Ej. correo1@mg-consultores.com, correo2@mg-consultores.com"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                  errores.correoNotificacion
                    ? 'border-[#E60000] focus:ring-red-100'
                    : 'border-slate-200 focus:border-[#0a2958] focus:ring-[#0a2958]/10'
                }`}
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Puede ingresar uno o varios correos separados por coma (,) para enviar la notificación completa.
              </p>
              {errores.correoNotificacion && (
                <p className="text-[11px] text-[#E60000] font-semibold mt-1">
                  {errores.correoNotificacion}
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Pie del formulario */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            Campos con <span className="text-[#E60000] font-bold">*</span> son obligatorios.
          </span>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl bg-[#0a2958] hover:bg-[#0d346e] disabled:opacity-60 text-white font-bold text-sm flex items-center gap-2 shadow-sm transition cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>
              {isSubmitting ? 'Registrando…' : 'Registrar Ingresos Personal'}
            </span>
          </button>
        </div>
      </form>

      {/* Tabla de Historial */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-[#0a2958]">
                Registros en Ingresos Personal ({ingresosSeleccion.length})
              </h3>
              <p className="text-xs text-slate-500">
                Mostrando {solicitudesFiltradas.length} registro(s) ·{' '}
                <strong className="text-[#0a2958] font-mono tabular-nums">
                  {totalRamosFiltrados}
                </strong>{' '}
                ramos en vista actual
              </p>
            </div>

            <div className="flex items-center gap-2">
              {onRecargarIngresosSeleccion && (
                <button
                  type="button"
                  onClick={async () => {
                    setRecargandoTabla(true);
                    try {
                      await onRecargarIngresosSeleccion();
                    } finally {
                      setRecargandoTabla(false);
                    }
                  }}
                  disabled={recargandoTabla}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${recargandoTabla ? 'animate-spin' : ''}`} />
                  <span>Actualizar</span>
                </button>
              )}

              <button
                type="button"
                onClick={exportarExcel}
                disabled={solicitudesFiltradas.length === 0}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>
            </div>
          </div>

          {/* Barra de búsqueda y filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busquedaTabla}
                onChange={(e) => setBusquedaTabla(e.target.value)}
                placeholder="Buscar Id, código, nombre, sede…"
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#0a2958]"
              />
            </div>

            <select
              value={filtroSemana}
              onChange={(e) => setFiltroSemana(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:border-[#0a2958]"
            >
              <option value="todas">Todas las semanas</option>
              {semanasDisponiblesTabla.map((sem) => (
                <option key={sem} value={String(sem)}>
                  Semana {sem}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <div ref={dropdownProductoRef} className="relative flex-1">
                <button
                  type="button"
                  onClick={() => setDropdownProductoAbierto((prev) => !prev)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white flex items-center justify-between gap-2 text-slate-700 cursor-pointer"
                >
                  <span className="truncate">
                    {productosFiltro.length === 0
                      ? 'Todos los productos'
                      : `${productosFiltro.length} producto(s)`}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </button>
                {dropdownProductoAbierto && (
                  <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl border border-slate-200 shadow-lg z-20 p-2 space-y-1">
                    {productosDisponiblesTabla.map((prod) => {
                      const marcado = productosFiltro.includes(prod);
                      return (
                        <button
                          key={prod}
                          type="button"
                          onClick={() => toggleProductoFiltro(prod)}
                          className="w-full px-2.5 py-1.5 rounded-lg hover:bg-slate-50 text-xs text-left flex items-center justify-between cursor-pointer"
                        >
                          <span className={marcado ? 'font-bold text-[#0a2958]' : 'text-slate-700'}>
                            {prod}
                          </span>
                          <span
                            className={`w-4 h-4 rounded border flex items-center justify-center ${
                              marcado
                                ? 'bg-[#0a2958] border-[#0a2958] text-white'
                                : 'border-slate-300'
                            }`}
                          >
                            {marcado && <Check className="w-3 h-3 stroke-[3]" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {hayFiltrosTablaActivos && (
                <button
                  type="button"
                  onClick={limpiarFiltrosTabla}
                  className="p-1.5 rounded-xl border border-slate-200 text-slate-500 hover:text-[#E60000] cursor-pointer"
                  title="Limpiar filtros"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3.5 whitespace-nowrap">Id</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Fecha Sol.</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Código</th>
                <th className="py-3 px-3.5">Nombre</th>
                <th className="py-3 px-3.5">Sede</th>
                <th className="py-3 px-3.5">Producto</th>
                <th className="py-3 px-3.5 text-right">Cant.</th>
                <th className="py-3 px-3.5">Motivo</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Semana</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Fecha Ent.</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Hora Ent.</th>
                <th className="py-3 px-3.5">Observación</th>
                <th className="py-3 px-3.5">Notificado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {solicitudesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-10 text-center text-slate-400 text-xs">
                    No hay registros en Ingresos Personal que coincidan con los filtros.
                  </td>
                </tr>
              ) : (
                solicitudesFiltradas.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3.5 font-mono font-bold text-[#0a2958] whitespace-nowrap">
                      {s.id}
                    </td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-600">
                      {s.fechaSolicitud}
                    </td>
                    <td className="py-2.5 px-3.5 font-mono font-semibold text-slate-700 whitespace-nowrap">
                      {s.codigo}
                    </td>
                    <td className="py-2.5 px-3.5 font-semibold text-slate-800 max-w-[180px] truncate" title={s.nombre}>
                      {s.nombre}
                    </td>
                    <td className="py-2.5 px-3.5 font-bold text-[#0a2958] whitespace-nowrap">
                      {s.sede}
                    </td>
                    <td className="py-2.5 px-3.5 font-semibold text-slate-800 whitespace-nowrap">
                      {s.producto}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono tabular-nums font-bold text-[#0a2958]">
                      {s.cantidad}
                    </td>
                    <td className="py-2.5 px-3.5 font-semibold text-slate-700 whitespace-nowrap">
                      {s.motivo || MOTIVO_FIJO_IS}
                    </td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full bg-red-50 text-[#E60000] font-bold text-[11px]">
                        Sem. {s.semana || getISOWeekNumber(s.fechaEntrega)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-700 font-medium">
                      {s.fechaEntrega}
                    </td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap font-mono text-slate-700 font-medium">
                      {s.horaEntrega || '—'}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-600 max-w-[180px] truncate" title={s.observacion}>
                      {s.observacion || '—'}
                    </td>
                    <td className="py-2.5 px-3.5 text-emerald-700 font-medium max-w-[180px] truncate" title={s.notificado || ''}>
                      {s.notificado || 'Registrada'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
