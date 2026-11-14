import React, { useState, useEffect, useMemo } from 'react';
import {
  Flower,
  Sparkles,
  Calendar,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  Send,
  Printer,
  Copy,
  Clock,
  ExternalLink,
  Cloud,
  Lock,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  Sede,
  FlowerType,
  ProductType,
  SolicitudFlor,
  TrabajadorMaestro,
} from '../types';
import { CUPOS_POR_PRODUCTO } from '../data/initialData';
import {
  getTodayString,
  formatDateSpanish,
  formatShortDate,
  verificarRegla15Dias,
  getWeekLabel,
  getISOWeekNumber,
  getVentanaSolicitud,
} from '../utils/dateUtils';
import { esDirectorPoscosecha } from '../utils/roles';

interface SolicitudFormProps {
  maestro: TrabajadorMaestro[];
  solicitudes: SolicitudFlor[];
  onGuardarSolicitud: (nueva: SolicitudFlor) => Promise<{ success: boolean; error?: string }>;
  isDriveConnected: boolean;
  spreadsheetLink: string | null;
  onRecargarMaestroDeDrive?: () => Promise<void>;
  sesion?: TrabajadorMaestro | null;
}

export const SolicitudForm: React.FC<SolicitudFormProps> = ({
  maestro,
  solicitudes,
  onGuardarSolicitud,
  isDriveConnected,
  spreadsheetLink,
  sesion,
}) => {
  const ventana = useMemo(() => getVentanaSolicitud(), []);
  const esDirector = useMemo(() => esDirectorPoscosecha(sesion), [sesion]);
  const formularioHabilitado = ventana.abierto || esDirector;
  const cantidad = 1;
  const fechaEntrega = ventana.fechaEntrega;
  const motivoFijo = 'Obsequio';

  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [sede, setSede] = useState<Sede>('Sede MG');
  const [trabajadorEncontrado, setTrabajadorEncontrado] = useState<TrabajadorMaestro | null>(null);
  const [tipoProducto, setTipoProducto] = useState<ProductType>('ramo');
  const [florRamo, setFlorRamo] = useState<FlowerType>('Rosa');
  const [opcionRosa, setOpcionRosa] = useState<'Rojo' | 'Color' | 'Bouquet'>('Rojo');
  const [remitente, setRemitente] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [solicitudExitosa, setSolicitudExitosa] = useState<SolicitudFlor | null>(null);
  const [copiadoId, setCopiadoId] = useState(false);

  const hoyStr = useMemo(() => getTodayString(), []);
  const semanaNumero = useMemo(() => String(getISOWeekNumber(fechaEntrega)), [fechaEntrega]);
  const semanaEntrega = useMemo(() => getWeekLabel(fechaEntrega), [fechaEntrega]);

  const proximoId = useMemo(() => {
    const year = new Date().getFullYear();
    const count = solicitudes.length + 1;
    return `SFO-${year}-${String(count).padStart(3, '0')}`;
  }, [solicitudes.length]);

  const aplicarTrabajador = (trabajador: TrabajadorMaestro) => {
    setCodigo(trabajador.codigo);
    setNombre(trabajador.nombre);
    setSede(trabajador.sede);
    setTrabajadorEncontrado(trabajador);
    setErrores((prev) => {
      const next = { ...prev };
      delete next.codigo;
      delete next.nombre;
      delete next.sede;
      return next;
    });
  };

  useEffect(() => {
    if (sesion) aplicarTrabajador(sesion);
  }, [sesion]);

  const validacion15Dias = useMemo(() => {
    if (!codigo) return { puedeSolicitar: true, diasTranscurridos: 999, diasFaltantes: 0 };
    const historialTrabajador = solicitudes.filter(
      (s) => s.codigo.trim().toUpperCase() === codigo.trim().toUpperCase()
    );
    return verificarRegla15Dias(historialTrabajador, hoyStr);
  }, [codigo, solicitudes, hoyStr]);

  const cuposSemana = useMemo(() => {
    // Conteo global por producto entre las tres sedes para esta semana de entrega
    const solicitudesEnSemana = solicitudes.filter(
      (s) => s.fechaEntrega === fechaEntrega && s.estado !== 'Cancelada'
    );

    let rosaUsados = 0;
    let bouquetUsados = 0;
    let clavelUsados = 0;
    let alstroemeriaUsados = 0;

    for (const s of solicitudesEnSemana) {
      const cant = Number(s.cantidad) || 1;
      const prodLow = String(s.producto || '').toLowerCase();
      if (s.tipoProducto === 'bouquet' || prodLow.includes('bouquet')) {
        bouquetUsados += cant;
      } else if (prodLow.includes('clavel') || s.florPrincipal === 'Clavel') {
        clavelUsados += cant;
      } else if (prodLow.includes('alstroemeria') || s.florPrincipal === 'Alstroemeria') {
        alstroemeriaUsados += cant;
      } else {
        rosaUsados += cant;
      }
    }

    const rosaMax = CUPOS_POR_PRODUCTO.rosaMax;
    const bouquetMax = CUPOS_POR_PRODUCTO.bouquetMax;
    const clavelMax = CUPOS_POR_PRODUCTO.clavelMax;
    const alstroemeriaMax = CUPOS_POR_PRODUCTO.alstroemeriaMax;

    const rosaDisponibles = Math.max(0, rosaMax - rosaUsados);
    const bouquetDisponibles = Math.max(0, bouquetMax - bouquetUsados);
    const clavelDisponibles = Math.max(0, clavelMax - clavelUsados);
    const alstroemeriaDisponibles = Math.max(0, alstroemeriaMax - alstroemeriaUsados);

    const rosaAgotado = rosaUsados >= rosaMax;
    const bouquetAgotado = bouquetUsados >= bouquetMax;
    const clavelAgotado = clavelUsados >= clavelMax;
    const alstroemeriaAgotado = alstroemeriaUsados >= alstroemeriaMax;
    const todosAgotados =
      rosaAgotado && bouquetAgotado && clavelAgotado && alstroemeriaAgotado;

    let estaAgotado = false;
    if (florRamo === 'Rosa' && opcionRosa === 'Bouquet') estaAgotado = bouquetAgotado;
    else if (florRamo === 'Rosa') estaAgotado = rosaAgotado;
    else if (florRamo === 'Clavel') estaAgotado = clavelAgotado;
    else estaAgotado = alstroemeriaAgotado;

    return {
      rosaUsados,
      rosaMax,
      rosaDisponibles,
      rosaAgotado,
      bouquetUsados,
      bouquetMax,
      bouquetDisponibles,
      bouquetAgotado,
      clavelUsados,
      clavelMax,
      clavelDisponibles,
      clavelAgotado,
      alstroemeriaUsados,
      alstroemeriaMax,
      alstroemeriaDisponibles,
      alstroemeriaAgotado,
      todosAgotados,
      estaAgotado,
    };
  }, [fechaEntrega, solicitudes, florRamo, opcionRosa]);

  useEffect(() => {
    if (florRamo === 'Rosa' && opcionRosa === 'Bouquet') setTipoProducto('bouquet');
    else setTipoProducto('ramo');
  }, [florRamo, opcionRosa]);

  // Si el producto seleccionado está agotado y otro producto aún tiene disponibilidad, seleccionar uno disponible
  useEffect(() => {
    if (cuposSemana.todosAgotados || !cuposSemana.estaAgotado) return;
    if (!cuposSemana.rosaAgotado) {
      setFlorRamo('Rosa');
      setOpcionRosa('Rojo');
    } else if (!cuposSemana.bouquetAgotado) {
      setFlorRamo('Rosa');
      setOpcionRosa('Bouquet');
    } else if (!cuposSemana.clavelAgotado) {
      setFlorRamo('Clavel');
      setOpcionRosa('Rojo');
    } else if (!cuposSemana.alstroemeriaAgotado) {
      setFlorRamo('Alstroemeria');
      setOpcionRosa('Rojo');
    }
  }, [
    cuposSemana.todosAgotados,
    cuposSemana.estaAgotado,
    cuposSemana.rosaAgotado,
    cuposSemana.bouquetAgotado,
    cuposSemana.clavelAgotado,
    cuposSemana.alstroemeriaAgotado,
  ]);

  const descripcionProducto = useMemo(() => {
    if (florRamo === 'Rosa' && opcionRosa === 'Bouquet') return 'Bouquet';
    if (florRamo === 'Rosa') return `Rosa (${opcionRosa})`;
    if (florRamo === 'Clavel') return 'Clavel';
    return 'Alstroemeria';
  }, [florRamo, opcionRosa]);

  const validarFormulario = (): boolean => {
    const nuevosErrores: Record<string, string> = {};
    if (!formularioHabilitado) nuevosErrores.ventana = ventana.mensajeCerrado;
    if (!codigo.trim()) nuevosErrores.codigo = 'El código del trabajador es obligatorio';
    if (!nombre.trim()) nuevosErrores.nombre = 'El nombre del trabajador es obligatorio';
    if (!sede) nuevosErrores.sede = 'No se ha determinado la sede del trabajador';
    if (!fechaEntrega) nuevosErrores.fechaEntrega = 'No hay fecha de entrega configurada';
    if (!remitente.trim()) nuevosErrores.remitente = 'Debe indicar el remitente de la solicitud';
    if (!validacion15Dias.puedeSolicitar) {
      nuevosErrores.regla15 = `El trabajador ya solicitó flor hace ${validacion15Dias.diasTranscurridos} días. Debe esperar 15 días entre solicitudes (1 ramo cada 15 días).`;
    }
    if (cuposSemana.todosAgotados) {
      nuevosErrores.cupo = `Se han agotado las disponibilidades para todos los productos en la ${semanaEntrega}.`;
    } else if (cuposSemana.estaAgotado) {
      nuevosErrores.cupo = `Producto sin existencia / agotado: ${descripcionProducto} alcanzó su límite semanal entre las tres sedes.`;
    }
    if (!trabajadorEncontrado) {
      nuevosErrores.codigo = 'Debe iniciar sesión ingresando un código de trabajador válido';
    }
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validarFormulario()) return;
    setIsSubmitting(true);
    const nuevaSolicitud: SolicitudFlor = {
      id: proximoId,
      fecha: hoyStr,
      semana: semanaNumero,
      codigo: codigo.trim(),
      nombre: nombre.trim(),
      cargo: trabajadorEncontrado?.cargo || '',
      cantidad: 1,
      producto: descripcionProducto,
      tipoProducto,
      florPrincipal: florRamo,
      opcionFlor: florRamo === 'Rosa' ? opcionRosa : undefined,
      sede,
      motivo: motivoFijo,
      fechaEntrega,
      remitente: remitente.trim(),
      estado: 'Registrada',
      requiereAutorizacion: false,
      creadoEn: Date.now(),
    };
    try {
      const res = await onGuardarSolicitud(nuevaSolicitud);
      if (res.success) {
        setSolicitudExitosa(nuevaSolicitud);
        try {
          confetti({
            particleCount: 85,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#0a2958', '#E60000', '#ffffff', '#10b981', '#f59e0b'],
          });
        } catch {}
      } else {
        setErrores({ general: res.error || 'Error al guardar la solicitud' });
      }
    } catch (err: any) {
      setErrores({ general: err.message || 'Error inesperado al registrar' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNuevaSolicitud = () => {
    setSolicitudExitosa(null);
    setRemitente('');
    setFlorRamo('Rosa');
    setOpcionRosa('Rojo');
    setTipoProducto('ramo');
    setErrores({});
    if (sesion) aplicarTrabajador(sesion);
  };

  const copiarIdComprobante = () => {
    if (solicitudExitosa?.id) {
      navigator.clipboard.writeText(solicitudExitosa.id);
      setCopiadoId(true);
      setTimeout(() => setCopiadoId(false), 2000);
    }
  };

  if (!formularioHabilitado) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4">
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-extrabold text-[#0a2958] mb-2">Formulario cerrado</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{ventana.mensajeCerrado}</p>
          <p className="text-xs text-slate-500 mt-4">
            Hoy es <strong className="capitalize">{ventana.nombreDia}</strong>. Las solicitudes se
            reciben solo lunes y martes; la entrega es el viernes de esa misma semana.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6">
      {solicitudExitosa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="w-14 h-14 rounded-2xl bg-[#0a2958]/10 text-[#0a2958] flex items-center justify-center mx-auto mb-4 ring-8 ring-[#0a2958]/5">
              <CheckCircle2 className="w-8 h-8 text-[#0a2958]" />
            </div>
            <div className="text-center mb-5">
              <span className="inline-block px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#0a2958] bg-[#0a2958]/10 rounded-full mb-2">
                Solicitud Registrada
              </span>
              <h3 className="text-xl font-extrabold text-[#0a2958] mb-2">¡Registro Exitoso!</h3>
              <div className="p-4 rounded-xl bg-slate-50 border-l-4 border-[#0a2958] text-slate-800 font-medium text-sm text-left">
                <p className="mb-2 text-base font-bold text-[#0a2958]">Su solicitud a sido registrada con exito.</p>
                <p className="text-xs text-slate-600">La entrega de flor se realizará en Poscosecha el viernes, al finalizar la jornada laboral.</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs text-slate-700 space-y-2 mb-6">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">Número de Radicado (ID):</span>
                <div className="flex items-center gap-1.5 font-mono font-bold text-[#0a2958] text-sm">
                  <span>{solicitudExitosa.id}</span>
                  <button type="button" onClick={copiarIdComprobante} className="p-1 hover:bg-slate-200 rounded">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {copiadoId && <span className="text-[10px] text-[#E60000] font-sans font-bold">¡Copiado!</span>}
                </div>
              </div>
              <div className="flex justify-between"><span className="text-slate-500">Semana de Entrega:</span><span className="font-bold text-[#E60000] px-2 py-0.5 rounded-md bg-[#E60000]/10">{solicitudExitosa.semana}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Trabajador:</span><span className="font-bold text-slate-900">{solicitudExitosa.nombre} ({solicitudExitosa.codigo})</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Producto:</span><span className="font-bold text-slate-900">{solicitudExitosa.producto}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Cantidad:</span><span className="font-bold text-slate-900">{solicitudExitosa.cantidad}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Fecha de Entrega:</span><span className="font-semibold text-slate-900">{formatDateSpanish(solicitudExitosa.fechaEntrega)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Remitente:</span><span className="text-slate-800">{solicitudExitosa.remitente}</span></div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button type="button" onClick={() => window.print()} className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-2">
                <Printer className="w-4 h-4" /> Imprimir Comprobante
              </button>
              <button type="button" onClick={handleNuevaSolicitud} className="flex-1 py-2.5 px-4 rounded-xl bg-[#0a2958] hover:bg-[#0d346e] text-white text-xs font-bold">
                Nueva Solicitud
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0a2958]/10 flex items-center justify-center">
              <Flower className="w-5 h-5 text-[#E60000]" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#0a2958]">Formulario de Solicitud</h2>
            </div>
          </div>
          {isDriveConnected && (
            <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              <Cloud className="w-3.5 h-3.5" /> Guardado automático activo
            </div>
          )}
        </div>

        {cuposSemana.todosAgotados && (
          <div className="mx-6 mt-6 p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#E60000] shrink-0 mt-0.5" />
            <div>
              <h4 className="font-extrabold text-[#E60000]">
                Disponibilidad agotada para todos los productos
              </h4>
              <p className="mt-0.5 leading-relaxed">
                Se han agotado todas las disponibilidades para todos los productos (Rosa, Bouquet, Clavel y Alstroemeria) para la{' '}
                <strong>{semanaEntrega}</strong> (entrega el <strong>{formatShortDate(fechaEntrega)}</strong>). No es posible registrar más solicitudes esta semana.
              </p>
            </div>
          </div>
        )}

        {errores.general && (
          <div className="m-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errores.general}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-7">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#0a2958]" />
                <h3 className="text-sm font-extrabold text-[#0a2958] uppercase tracking-wider">1. Datos del Trabajador</h3>
              </div>
              {trabajadorEncontrado && (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Verificado
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Código <span className="text-[#E60000]">*</span></label>
                <input type="text" value={codigo} readOnly={!!sesion} onChange={(e) => setCodigo(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border font-mono font-bold uppercase ${errores.codigo ? 'border-rose-400 bg-rose-50/40' : 'border-slate-300'} ${sesion ? 'bg-slate-50' : ''} outline-hidden`} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre</label>
                <input type="text" value={nombre} readOnly className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-semibold" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Sede</label>
                <input type="text" value={sede} readOnly className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-semibold text-[#0a2958]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cargo</label>
                <input type="text" value={trabajadorEncontrado?.cargo || ''} readOnly className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cantidad</label>
                <div className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-extrabold text-[#0a2958]">1 ramo (fijo)</div>
                <p className="text-[11px] text-slate-500 mt-1">Máximo 1 solicitud cada 15 días</p>
              </div>
            </div>
            {!validacion15Dias.puedeSolicitar && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold">Regla de 15 días</h4>
                  <p className="mt-0.5">{errores.regla15}</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#0a2958]" />
                <h3 className="text-sm font-extrabold text-[#0a2958] uppercase tracking-wider">2. Tipo de Flor / Producto</h3>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                <span
                  className={`px-2.5 py-0.5 rounded-full border ${
                    cuposSemana.rosaAgotado
                      ? 'bg-rose-50 text-[#E60000] border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  Rosa (Rojo/Color): {cuposSemana.rosaDisponibles} / {cuposSemana.rosaMax} disp.
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full border ${
                    cuposSemana.bouquetAgotado
                      ? 'bg-rose-50 text-[#E60000] border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  Bouquet: {cuposSemana.bouquetDisponibles} / {cuposSemana.bouquetMax} disp.
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full border ${
                    cuposSemana.clavelAgotado
                      ? 'bg-rose-50 text-[#E60000] border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  Clavel: {cuposSemana.clavelDisponibles} / {cuposSemana.clavelMax} disp.
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full border ${
                    cuposSemana.alstroemeriaAgotado
                      ? 'bg-rose-50 text-[#E60000] border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  Alstroemeria: {cuposSemana.alstroemeriaDisponibles} / {cuposSemana.alstroemeriaMax} disp.
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['Rosa', 'Clavel', 'Alstroemeria'] as FlowerType[]).map((f) => {
                const deshabilitado =
                  f === 'Rosa'
                    ? cuposSemana.rosaAgotado && cuposSemana.bouquetAgotado
                    : f === 'Clavel'
                    ? cuposSemana.clavelAgotado
                    : cuposSemana.alstroemeriaAgotado;
                const dispTexto =
                  f === 'Rosa'
                    ? `${cuposSemana.rosaDisponibles} disp. (${cuposSemana.bouquetDisponibles} bouq.)`
                    : f === 'Clavel'
                    ? `${cuposSemana.clavelDisponibles} / ${cuposSemana.clavelMax} disp.`
                    : `${cuposSemana.alstroemeriaDisponibles} / ${cuposSemana.alstroemeriaMax} disp.`;
                return (
                  <button
                    key={f}
                    type="button"
                    disabled={deshabilitado}
                    onClick={() => {
                      setFlorRamo(f);
                      if (f === 'Rosa') {
                        setOpcionRosa(cuposSemana.rosaAgotado && !cuposSemana.bouquetAgotado ? 'Bouquet' : 'Rojo');
                      } else {
                        setOpcionRosa('Rojo');
                      }
                    }}
                    className={`px-4 py-3 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-0.5 ${
                      deshabilitado
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : florRamo === f
                        ? 'bg-[#0a2958] text-white border-[#0a2958] cursor-pointer'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-[#0a2958]/40 cursor-pointer'
                    }`}
                  >
                    <span>
                      {f}
                      {deshabilitado && (
                        <span className="ml-1.5 text-[10px] text-[#E60000] font-bold">(Agotado)</span>
                      )}
                    </span>
                    {!deshabilitado && (
                      <span
                        className={`text-[10px] font-medium ${
                          florRamo === f ? 'text-slate-200' : 'text-slate-500'
                        }`}
                      >
                        {dispTexto}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {florRamo === 'Rosa' && (
              <div className="flex flex-wrap gap-2">
                {(['Rojo', 'Color', 'Bouquet'] as const).map((o) => {
                  const opcionAgotada =
                    o === 'Bouquet' ? cuposSemana.bouquetAgotado : cuposSemana.rosaAgotado;
                  const dispOpc =
                    o === 'Bouquet'
                      ? `${cuposSemana.bouquetDisponibles}/${cuposSemana.bouquetMax}`
                      : `${cuposSemana.rosaDisponibles}/${cuposSemana.rosaMax}`;
                  return (
                    <button
                      key={o}
                      type="button"
                      disabled={opcionAgotada}
                      onClick={() => setOpcionRosa(o)}
                      className={`px-3 py-2 rounded-lg border text-[11px] font-bold transition ${
                        opcionAgotada
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : opcionRosa === o
                          ? 'bg-[#E60000]/10 text-[#E60000] border-[#E60000]/30 cursor-pointer'
                          : 'bg-slate-50 text-slate-600 border-slate-200 cursor-pointer'
                      }`}
                    >
                      {o === 'Bouquet' ? 'Bouquet de Rosas' : `Rosa (${o})`}
                      {opcionAgotada ? ' (Sin existencia / Agotado)' : ` (${dispOpc} disp.)`}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-slate-600 font-medium">Producto: <span className="text-[#0a2958] font-bold">{descripcionProducto}</span></p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Calendar className="w-4 h-4 text-[#0a2958]" />
              <h3 className="text-sm font-extrabold text-[#0a2958] uppercase tracking-wider">3. Fecha de Entrega y Remitente</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700">Fecha de entrega</label>
                  <span className="text-[11px] font-bold text-[#E60000] bg-[#E60000]/10 px-2 py-0.5 rounded-md">{semanaEntrega}</span>
                </div>
                <div className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-900">{ventana.labelEntrega}</div>
                <p className="text-[11px] text-slate-500 mt-1">Fija: viernes de la misma semana en que solicita (lun/mar).</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Remitente <span className="text-[#E60000]">*</span></label>
                <input type="text" value={remitente} onChange={(e) => setRemitente(e.target.value)} placeholder="Quién solicita / entrega el obsequio"
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border ${errores.remitente ? 'border-rose-400 bg-rose-50/40' : 'border-slate-300'} outline-hidden`} />
              </div>
            </div>
            {(cuposSemana.todosAgotados || cuposSemana.estaAgotado) && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-[#E60000] shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold">
                    {cuposSemana.todosAgotados
                      ? 'Se han agotado las disponibilidades para todos los productos'
                      : `Producto sin existencia / agotado: ${descripcionProducto}`}
                  </h4>
                  <p className="mt-0.5">
                    {cuposSemana.todosAgotados
                      ? `No hay más disponibilidad para ningún producto en la ${semanaEntrega} (entrega el ${formatShortDate(fechaEntrega)}).`
                      : `Se alcanzó el límite semanal entre las tres sedes para este producto en la ${semanaEntrega} (entrega el ${formatShortDate(fechaEntrega)}).`}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500">Campos con <span className="text-[#E60000] font-bold">*</span> son obligatorios.</div>
            <button type="submit" disabled={isSubmitting || !validacion15Dias.puedeSolicitar || cuposSemana.estaAgotado || cuposSemana.todosAgotados}
              className={`w-full sm:w-auto px-8 py-3 rounded-xl text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-md transition ${isSubmitting || !validacion15Dias.puedeSolicitar || cuposSemana.estaAgotado || cuposSemana.todosAgotados ? 'bg-slate-400 cursor-not-allowed opacity-60' : 'bg-[#0a2958] hover:bg-[#0d346e]'}`}>
              {isSubmitting ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Registrando…</span></>) : (<><Send className="w-4 h-4 text-[#E60000]" /><span>Registrar Solicitud de Flor</span></>)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
