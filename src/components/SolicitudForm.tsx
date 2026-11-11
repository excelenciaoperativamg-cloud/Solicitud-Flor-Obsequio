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
  Info,
  Clock,
  ExternalLink,
  Cloud,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  Sede,
  FlowerType,
  ProductType,
  SolicitudFlor,
  TrabajadorMaestro,
} from '../types';
import {
  MOTIVOS_SOLICITUD,
  CUPOS_CONFIG,
} from '../data/initialData';
import {
  getTodayString,
  getUpcomingFridays,
  formatDateSpanish,
  formatShortDate,
  verificarRegla15Dias,
  getWeekLabel,
} from '../utils/dateUtils';

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
  onRecargarMaestroDeDrive,
  sesion,
}) => {
  const upcomingFridays = useMemo(() => getUpcomingFridays(6), []);

  // Estado del formulario
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [sede, setSede] = useState<Sede>('Sede MG');
  const [trabajadorEncontrado, setTrabajadorEncontrado] = useState<TrabajadorMaestro | null>(null);

  // Tipo de producto: 'ramo' o 'bouquet'
  const [tipoProducto, setTipoProducto] = useState<ProductType>('ramo');

  // En Ramo:
  // Flor principal: 'Rosa' | 'Clavel' | 'Alstroemeria'
  // Si Rosa: opción 'Rojo' o 'Color'
  // Si Clavel: opción fija 'Según color disponible'
  // Si Alstroemeria: opción fija 'Según color disponible'
  const [florRamo, setFlorRamo] = useState<FlowerType>('Rosa');
  const [opcionRosa, setOpcionRosa] = useState<'Rojo' | 'Color' | 'Bouquet'>('Rojo');

  // En Bouquet Mixto (legacy, ahora se maneja vía opción Bouquet en Rosa o selección)
  const [florBouquet, setFlorBouquet] = useState<FlowerType>('Rosa');

  // Cantidad y autorización según cargo
  const [cantidad, setCantidad] = useState(1);
  const [autorizacionPoscosecha, setAutorizacionPoscosecha] = useState('');
  const [requiereAutorizacion, setRequiereAutorizacion] = useState(false);

  // Motivo, Entrega y Remitente
  const [motivo, setMotivo] = useState(MOTIVOS_SOLICITUD[0]);
  const [motivoPersonalizado, setMotivoPersonalizado] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState(upcomingFridays[0]?.dateString || '');
  const [remitente, setRemitente] = useState('');

  // Estados UI de búsqueda de trabajador
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [solicitudExitosa, setSolicitudExitosa] = useState<SolicitudFlor | null>(null);
  const [copiadoId, setCopiadoId] = useState(false);

  // Fecha y Semana actual
  const hoyStr = useMemo(() => getTodayString(), []);
  const semanaEntrega = useMemo(() => getWeekLabel(fechaEntrega), [fechaEntrega]);

  // Generar ID correlativo estimado
  const proximoId = useMemo(() => {
    const year = new Date().getFullYear();
    const count = solicitudes.length + 1;
    return `SFO-${year}-${String(count).padStart(3, '0')}`;
  }, [solicitudes.length]);

  // Función para seleccionar o auto-aplicar trabajador (login por código)
  const aplicarTrabajador = (trabajador: TrabajadorMaestro) => {
    setCodigo(trabajador.codigo);
    setNombre(trabajador.nombre);
    setSede(trabajador.sede); // Se asigna automáticamente de la hoja maestro
    setTrabajadorEncontrado(trabajador);
    // Límite según cargo: si contiene "operario" → 1 ramo; si no → 2
    const cargoLower = (trabajador.cargo || '').toLowerCase();
    const esOperario = cargoLower.includes('operario');
    const maxPermitido = esOperario ? 1 : 2;
    setCantidad(1); // por defecto 1
    setRequiereAutorizacion(false);
    setAutorizacionPoscosecha('');
    setErrores((prev) => {
      const next = { ...prev };
      delete next.codigo;
      delete next.nombre;
      delete next.sede;
      delete next.cantidad;
      delete next.autorizacion;
      return next;
    });
  };

  // Máximo de ramos según cargo del trabajador logueado
  const maxCantidadPorCargo = useMemo(() => {
    if (!trabajadorEncontrado) return 1;
    const cargoLower = (trabajadorEncontrado.cargo || '').toLowerCase();
    return cargoLower.includes('operario') ? 1 : 2;
  }, [trabajadorEncontrado]);

  useEffect(() => {
    if (sesion) aplicarTrabajador(sesion);
  }, [sesion]);

  // Buscar y vincular automáticamente cuando el usuario escribe código
  const buscarYVincularCodigo = (valorInput: string) => {
    const limpio = valorInput.trim();
    if (!limpio) {
      setTrabajadorEncontrado(null);
      return;
    }

    // Coincidencia exacta por código (ej: 5705 o MG-101)
    const matchExacto = maestro.find(
      (m) => m.codigo.trim().toLowerCase() === limpio.toLowerCase()
    );

    if (matchExacto) {
      aplicarTrabajador(matchExacto);
    } else {
      // Buscar si el texto comienza con el código
      const primerToken = limpio.split(' ')[0].toLowerCase();
      const matchPrefijo = maestro.find(
        (m) => m.codigo.trim().toLowerCase() === primerToken
      );
      if (matchPrefijo) {
        aplicarTrabajador(matchPrefijo);
      }
    }
  };

  // Validación de la regla de 15 días para el código actual
  const validacion15Dias = useMemo(() => {
    if (!codigo) {
      return { puedeSolicitar: true, diasTranscurridos: 999, diasFaltantes: 0 };
    }
    const historialTrabajador = solicitudes.filter(
      (s) => s.codigo.trim().toUpperCase() === codigo.trim().toUpperCase()
    );
    return verificarRegla15Dias(historialTrabajador, hoyStr);
  }, [codigo, solicitudes, hoyStr]);

  // Conteo de cupos para la sede del trabajador y la semana de entrega
  const cuposSemana = useMemo(() => {
    const solicitudesEnSemana = solicitudes.filter(
      (s) => s.sede === sede && s.fechaEntrega === fechaEntrega && s.estado !== 'Cancelada'
    );

    const config = CUPOS_CONFIG[sede] || CUPOS_CONFIG['Sede MG'];
    const ramosUsados = solicitudesEnSemana.filter((s) => s.tipoProducto === 'ramo').length;
    const bouquetsUsados = solicitudesEnSemana.filter((s) => s.tipoProducto === 'bouquet').length;
    const totalSolicitudesSemana = solicitudesEnSemana.length;

    let ramoAgotado = false;
    let bouquetAgotado = false;

    if (sede === 'Sede MG') {
      // MG tiene: 20 ramos/semana y 5 bouquet/semana
      ramoAgotado = ramosUsados >= config.ramosMax;
      bouquetAgotado = bouquetsUsados >= (config.bouquetsMax || 5);
    } else {
      // HA (30 ramos) y SC (20 ramos) tienen cupo global por semana
      ramoAgotado = totalSolicitudesSemana >= config.ramosMax;
      bouquetAgotado = totalSolicitudesSemana >= config.ramosMax;
    }

    return {
      ramosUsados,
      ramosMax: config.ramosMax,
      bouquetsUsados,
      bouquetsMax: config.bouquetsMax || 0,
      totalSolicitudesSemana,
      ramoAgotado,
      bouquetAgotado,
      estaAgotado: tipoProducto === 'ramo' ? ramoAgotado : bouquetAgotado,
    };
  }, [sede, fechaEntrega, solicitudes, tipoProducto]);

  // Determinar tipoProducto a partir de la selección (si Rosa + Bouquet → bouquet, sino ramo)
  useEffect(() => {
    if (florRamo === 'Rosa' && opcionRosa === 'Bouquet') {
      setTipoProducto('bouquet');
      setFlorBouquet('Rosa');
    } else {
      setTipoProducto('ramo');
    }
  }, [florRamo, opcionRosa]);

  // Descripción exacta del producto según requerimiento del usuario
  const descripcionProducto = useMemo(() => {
    const unidadTxt = cantidad === 1 ? '1 unidad' : `${cantidad} unidades`;
    if (florRamo === 'Rosa' && opcionRosa === 'Bouquet') {
      return `Bouquet de Rosas (${unidadTxt})`;
    }
    if (florRamo === 'Rosa') {
      return `Ramo de Rosa (${opcionRosa}) (${unidadTxt})`;
    } else if (florRamo === 'Clavel') {
      return `Ramo de Clavel (Según color disponible) (${unidadTxt})`;
    } else {
      return `Ramo de Alstroemeria (Según color disponible) (${unidadTxt})`;
    }
  }, [florRamo, opcionRosa, cantidad]);

  // Validación de campos obligatorios
  const validarFormulario = (): boolean => {
    const nuevosErrores: Record<string, string> = {};

    if (!codigo.trim()) {
      nuevosErrores.codigo = 'El código del trabajador es obligatorio';
    }
    if (!nombre.trim()) {
      nuevosErrores.nombre = 'El nombre del trabajador es obligatorio';
    }
    if (!sede) {
      nuevosErrores.sede = 'No se ha determinado la sede del trabajador';
    }
    if (!fechaEntrega) {
      nuevosErrores.fechaEntrega = 'Debe seleccionar la fecha de entrega';
    }
    if (!remitente.trim()) {
      nuevosErrores.remitente = 'Debe indicar el remitente de la solicitud';
    }
    if (motivo === 'Otro motivo' && !motivoPersonalizado.trim()) {
      nuevosErrores.motivo = 'Por favor especifique el motivo';
    }

    // Regla de 15 días
    if (!validacion15Dias.puedeSolicitar) {
      nuevosErrores.regla15 = `El trabajador ya solicitó flor hace ${validacion15Dias.diasTranscurridos} días. Debe esperar 15 días entre solicitudes.`;
    }

    // Regla de Cupos semanales
    if (cuposSemana.estaAgotado) {
      nuevosErrores.cupo = `El cupo de ${tipoProducto === 'ramo' ? 'ramos' : 'bouquets'} para ${sede} en la ${semanaEntrega} está agotado.`;
    }

    // Regla de cantidad según cargo
    if (!trabajadorEncontrado) {
      nuevosErrores.codigo = 'Debe iniciar sesión ingresando un código de trabajador válido';
    }
    if (cantidad < 1) {
      nuevosErrores.cantidad = 'La cantidad mínima es 1';
    }
    if (cantidad > maxCantidadPorCargo) {
      if (!autorizacionPoscosecha.trim()) {
        nuevosErrores.autorizacion = `Para pedir ${cantidad} ramos (límite por cargo: ${maxCantidadPorCargo}) se requiere autorización de la Dirección de Poscosecha`;
      }
      setRequiereAutorizacion(true);
    } else {
      setRequiereAutorizacion(false);
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  // Enviar formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validarFormulario()) {
      return;
    }

    setIsSubmitting(true);

    const motivoFinal = motivo === 'Otro motivo' ? motivoPersonalizado.trim() : motivo;

    const nuevaSolicitud: SolicitudFlor = {
      id: proximoId,
      fecha: hoyStr,
      semana: semanaEntrega,
      codigo: codigo.trim(),
      nombre: nombre.trim(),
      cargo: trabajadorEncontrado?.cargo || '',
      cantidad,
      producto: descripcionProducto,
      tipoProducto,
      florPrincipal: florRamo,
      opcionFlor:
        florRamo === 'Rosa'
          ? opcionRosa
          : 'Según color disponible',
      sede, // Tomada del Maestro
      motivo: motivoFinal,
      fechaEntrega,
      remitente: remitente.trim(),
      estado: 'Registrada',
      requiereAutorizacion: cantidad > maxCantidadPorCargo,
      autorizacionPoscosecha: cantidad > maxCantidadPorCargo ? autorizacionPoscosecha.trim() : undefined,
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
        } catch {
          // ignore
        }
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
    setCodigo('');
    setNombre('');
    setSede('Sede MG');
    setTrabajadorEncontrado(null);
    setMotivo(MOTIVOS_SOLICITUD[0]);
    setMotivoPersonalizado('');
    setRemitente('');
    setFlorRamo('Rosa');
    setOpcionRosa('Rojo');
    setFlorBouquet('Rosa');
    setTipoProducto('ramo');
    setCantidad(1);
    setAutorizacionPoscosecha('');
    setRequiereAutorizacion(false);
    setErrores({});
  };

  const copiarIdComprobante = () => {
    if (solicitudExitosa?.id) {
      navigator.clipboard.writeText(solicitudExitosa.id);
      setCopiadoId(true);
      setTimeout(() => setCopiadoId(false), 2000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6">

      {/* MODAL DE ÉXITO EXACTO */}
      {solicitudExitosa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="w-14 h-14 rounded-2xl bg-[#0a2958]/10 text-[#0a2958] flex items-center justify-center mx-auto mb-4 ring-8 ring-[#0a2958]/5">
              <CheckCircle2 className="w-8 h-8 text-[#0a2958]" />
            </div>

            {/* MENSAJE OBLIGATORIO EXACTO */}
            <div className="text-center mb-5">
              <span className="inline-block px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#0a2958] bg-[#0a2958]/10 rounded-full mb-2">
                Solicitud Registrada
              </span>
              <h3 className="text-xl font-extrabold text-[#0a2958] mb-2">
                ¡Registro Exitoso!
              </h3>
              <div className="p-4 rounded-xl bg-slate-50 border-l-4 border-[#0a2958] text-slate-800 font-medium text-sm leading-relaxed text-left shadow-xs">
                <p className="mb-2 text-base font-bold text-[#0a2958]">
                  Su solicitud a sido registrada con exito.
                </p>
                <p className="text-xs text-slate-600">
                  Recuerde que la entrega de flor se realizará en el área de Poscosecha los viernes, al finalizar la jornada laboral.
                </p>
              </div>
            </div>

            {/* Resumen de la Solicitud con todos los campos requeridos */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs text-slate-700 space-y-2 mb-6">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">Número de Radicado (ID):</span>
                <div className="flex items-center gap-1.5 font-mono font-bold text-[#0a2958] text-sm">
                  <span>{solicitudExitosa.id}</span>
                  <button
                    onClick={copiarIdComprobante}
                    className="p-1 hover:bg-slate-200 rounded text-slate-500 cursor-pointer"
                    title="Copiar ID"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {copiadoId && <span className="text-[10px] text-[#E60000] font-sans font-bold">¡Copiado!</span>}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Semana de Entrega:</span>
                <span className="font-bold text-[#E60000] px-2 py-0.5 rounded-md bg-[#E60000]/10">
                  {solicitudExitosa.semana}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Trabajador Beneficiario:</span>
                <span className="font-bold text-slate-900">
                  {solicitudExitosa.nombre} ({solicitudExitosa.codigo})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sede (Tomada del Maestro):</span>
                <span className="font-semibold text-[#0a2958]">{solicitudExitosa.sede}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Producto Solicitado:</span>
                <span className="font-bold text-slate-900">{solicitudExitosa.producto}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fecha de Entrega:</span>
                <span className="font-semibold text-slate-900">
                  {formatDateSpanish(solicitudExitosa.fechaEntrega)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Remitente:</span>
                <span className="text-slate-800">{solicitudExitosa.remitente}</span>
              </div>

              {/* Confirmación explícita de Google Drive */}
              <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-emerald-700 font-semibold">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  Registrado en Google Drive / Hoja "Solicitud Flor Obsequio"
                </span>
                {spreadsheetLink && (
                  <a
                    href={spreadsheetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline flex items-center gap-0.5 text-[#0a2958]"
                  >
                    Ver en Drive
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Acciones */}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Imprimir Comprobante
              </button>
              <button
                onClick={handleNuevaSolicitud}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#0a2958] hover:bg-[#0d346e] text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
              >
                <Flower className="w-4 h-4 text-[#E60000]" />
                Hacer Otra Solicitud
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FORMULARIO PRINCIPAL */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* CABECERA SUPERIOR: MOSTRAR SEDE, SEMANA, FECHA Y RADICADO ARRIBA (SIN TEXTO 'FORMULARIO OFICIAL') */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {/* 1. Fecha de Registro */}
            <div className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Fecha Registro
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-slate-800 flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-[#0a2958]" />
                {formatShortDate(hoyStr)}
              </span>
            </div>

            {/* 2. Semana de Entrega */}
            <div className="p-3 rounded-xl bg-white border border-[#E60000]/20 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-[#E60000] block tracking-wider">
                Semana de Entrega
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-[#E60000] flex items-center gap-1 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-[#E60000]" />
                {semanaEntrega}
              </span>
            </div>

            {/* 3. Radicado */}
            <div className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Radicado
              </span>
              <span className="text-xs sm:text-sm font-mono font-extrabold text-[#0a2958] block mt-0.5">
                {proximoId}
              </span>
            </div>
          </div>

          {/* Estado de sincronización permanente con Google Drive */}
          <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                <span>Google Drive Conectado ("Solicitud Flor Obsequio")</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                Guardado automático sin pedir correo ni contraseñas
              </span>
            </div>

            {spreadsheetLink && (
              <a
                href={spreadsheetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-[#0a2958] hover:underline flex items-center gap-1"
              >
                <span>Ver Hoja en Drive</span>
                <ExternalLink className="w-3 h-3 text-[#0a2958]" />
              </a>
            )}
          </div>
        </div>

        {/* ALERTA GENERAL DE ERROR */}
        {errores.general && (
          <div className="m-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errores.general}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-7">
          {/* SECCIÓN 1: DATOS DEL TRABAJADOR (HOJA MAESTRO) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#0a2958]" />
                <h3 className="text-sm font-extrabold text-[#0a2958] uppercase tracking-wider">
                  1. Datos del Trabajador
                </h3>
              </div>
              {trabajadorEncontrado ? (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Trabajador Verificado en Maestro
                </span>
              ) : (
                <span className="text-[11px] text-slate-500 font-medium">
                  {maestro.length} trabajadores vinculados de la hoja
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Código */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Código de Trabajador <span className="text-[#E60000]">*</span>
                </label>
                <input
                  type="text"
                  value={codigo}
                  readOnly={!!sesion}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCodigo(val);
                    buscarYVincularCodigo(val);
                  }}
                  onBlur={() => buscarYVincularCodigo(codigo)}
                  placeholder="Ej: 5705, MG-101"
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border ${
                    errores.codigo ? 'border-rose-400 bg-rose-50/40' : 'border-slate-300'
                  } focus:border-[#0a2958] focus:ring-2 focus:ring-[#0a2958]/20 outline-hidden font-mono uppercase font-bold text-slate-900`}
                />
                {errores.codigo && (
                  <p className="text-[11px] text-[#E60000] font-semibold mt-1">{errores.codigo}</p>
                )}
              </div>

              {/* Nombre (extraído del Maestro) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre Completo <span className="text-[#E60000]">*</span>
                </label>
                <input
                  type="text"
                  value={nombre}
                  readOnly
                  placeholder="Se completa al ingresar el código"
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border ${
                    errores.nombre ? 'border-rose-400 bg-rose-50/40' : 'border-slate-300'
                  } bg-slate-50 text-slate-800 font-bold outline-hidden cursor-default`}
                />
                {errores.nombre && (
                  <p className="text-[11px] text-[#E60000] font-semibold mt-1">{errores.nombre}</p>
                )}
              </div>

              {/* Sede (extraída del Maestro) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Sede <span className="text-[#E60000]">*</span>
                </label>
                <input
                  type="text"
                  value={sede}
                  readOnly
                  placeholder="Se completa al ingresar el código"
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border ${
                    errores.sede ? 'border-rose-400 bg-rose-50/40' : 'border-slate-300'
                  } bg-slate-50 text-[#0a2958] font-extrabold outline-hidden cursor-default`}
                />
                {errores.sede && (
                  <p className="text-[11px] text-[#E60000] font-semibold mt-1">{errores.sede}</p>
                )}
              </div>
            </div>

            {/* ALERTA REGLA 15 DÍAS */}
            {!validacion15Dias.puedeSolicitar && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-3 animate-in fade-in">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-950">
                    Restricción de Frecuencia: 1 solicitud cada 15 días
                  </h4>
                  <p className="mt-0.5">
                    El trabajador <strong>{nombre || codigo}</strong> ya realizó una solicitud el día{' '}
                    <strong>{formatShortDate(validacion15Dias.ultimaFecha || '')}</strong> (hace{' '}
                    {validacion15Dias.diasTranscurridos} días).
                  </p>
                  <p className="mt-1 font-bold text-amber-800">
                    Podrá solicitar flor nuevamente a partir del:{' '}
                    <span className="underline">
                      {formatDateSpanish(validacion15Dias.fechaProximaPermitida || '')}
                    </span>{' '}
                    (faltan {validacion15Dias.diasFaltantes} días).
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* SECCIÓN 2: PRODUCTO (tarjetas de flor, sin selector Ramo/Bouquet superior) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Flower className="w-4 h-4 text-[#0a2958]" />
                <h3 className="text-sm font-extrabold text-[#0a2958] uppercase tracking-wider">
                  2. Producto <span className="text-[#E60000]">*</span>
                </h3>
              </div>
              <span className="text-[11px] font-bold text-[#E60000] bg-[#E60000]/10 px-2.5 py-0.5 rounded-full">
                {trabajadorEncontrado
                  ? `Límite por cargo: ${maxCantidadPorCargo} unidad${maxCantidadPorCargo > 1 ? 'es' : ''}`
                  : 'Inicie sesión con código'}
              </span>
            </div>

            {/* DETALLE DE OPCIONES DE FLOR */}
            <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700">
                  Seleccione el tipo de flor para el ramo:
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Tarjeta 1: Rosa */}
                  <div
                    onClick={() => setFlorRamo('Rosa')}
                    className={`p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                      florRamo === 'Rosa'
                        ? 'border-[#0a2958] bg-rose-50/50 ring-2 ring-[#0a2958]/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">🌹</span>
                        <input
                          type="radio"
                          name="florRamo"
                          checked={florRamo === 'Rosa'}
                          onChange={() => setFlorRamo('Rosa')}
                          className="w-4 h-4 text-[#0a2958] accent-[#0a2958]"
                        />
                      </div>
                      <h4 className="font-extrabold text-sm text-[#0a2958] mb-1">
                        Rosa
                      </h4>
                    </div>

                    {/* Sub-opciones de Rosa: Rojo, Color, Bouquet */}
                    <div className="mt-3 pt-2.5 border-t border-slate-200">
                      <span className="text-[11px] font-bold text-slate-600 block mb-1.5">
                        Escoger opción:
                      </span>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFlorRamo('Rosa');
                            setOpcionRosa('Rojo');
                          }}
                          className={`py-1 px-1 text-xs font-bold rounded-lg border transition ${
                            florRamo === 'Rosa' && opcionRosa === 'Rojo'
                              ? 'bg-[#E60000] text-white border-[#E60000] shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          Rojo
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFlorRamo('Rosa');
                            setOpcionRosa('Color');
                          }}
                          className={`py-1 px-1 text-xs font-bold rounded-lg border transition ${
                            florRamo === 'Rosa' && opcionRosa === 'Color'
                              ? 'bg-[#0a2958] text-white border-[#0a2958] shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          Color
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFlorRamo('Rosa');
                            setOpcionRosa('Bouquet');
                          }}
                          className={`py-1 px-1 text-xs font-bold rounded-lg border transition ${
                            florRamo === 'Rosa' && opcionRosa === 'Bouquet'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          Bouquet
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Tarjeta 2: Clavel */}
                  <div
                    onClick={() => setFlorRamo('Clavel')}
                    className={`p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                      florRamo === 'Clavel'
                        ? 'border-[#0a2958] bg-pink-50/50 ring-2 ring-[#0a2958]/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">🌸</span>
                        <input
                          type="radio"
                          name="florRamo"
                          checked={florRamo === 'Clavel'}
                          onChange={() => setFlorRamo('Clavel')}
                          className="w-4 h-4 text-[#0a2958] accent-[#0a2958]"
                        />
                      </div>
                      <h4 className="font-extrabold text-sm text-[#0a2958] mb-1">
                        Clavel
                      </h4>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200">
                      <span className="inline-block px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg w-full text-center">
                        Según color disponible
                      </span>
                    </div>
                  </div>

                  {/* Tarjeta 3: Alstroemeria */}
                  <div
                    onClick={() => setFlorRamo('Alstroemeria')}
                    className={`p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                      florRamo === 'Alstroemeria'
                        ? 'border-[#0a2958] bg-amber-50/50 ring-2 ring-[#0a2958]/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">🌺</span>
                        <input
                          type="radio"
                          name="florRamo"
                          checked={florRamo === 'Alstroemeria'}
                          onChange={() => setFlorRamo('Alstroemeria')}
                          className="w-4 h-4 text-[#0a2958] accent-[#0a2958]"
                        />
                      </div>
                      <h4 className="font-extrabold text-sm text-[#0a2958] mb-1">
                        Alstroemeria
                      </h4>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200">
                      <span className="inline-block px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg w-full text-center">
                        Según color disponible
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            {/* Selector de cantidad según cargo */}
            {trabajadorEncontrado && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    Cantidad de ramos / unidades
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Cargo: <strong>{trabajadorEncontrado.cargo || 'Operario'}</strong> → máx. {maxCantidadPorCargo} sin autorización
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                    className="w-9 h-9 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-100"
                  >
                    −
                  </button>
                  <span className="text-lg font-extrabold text-[#0a2958] w-8 text-center">{cantidad}</span>
                  <button
                    type="button"
                    onClick={() => setCantidad(cantidad + 1)}
                    className="w-9 h-9 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-100"
                  >
                    +
                  </button>
                  {cantidad > maxCantidadPorCargo && (
                    <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                      Requiere autorización Dirección Poscosecha
                    </span>
                  )}
                </div>
                {cantidad > maxCantidadPorCargo && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Autorización de Dirección de Poscosecha <span className="text-[#E60000]">*</span>
                    </label>
                    <input
                      type="text"
                      value={autorizacionPoscosecha}
                      onChange={(e) => setAutorizacionPoscosecha(e.target.value)}
                      placeholder="Nombre o código de quien autoriza"
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border ${
                        errores.autorizacion ? 'border-rose-400 bg-rose-50/40' : 'border-slate-300'
                      } focus:border-[#0a2958] focus:ring-2 focus:ring-[#0a2958]/20 outline-hidden`}
                    />
                    {errores.autorizacion && (
                      <p className="text-[11px] text-[#E60000] font-semibold mt-1">{errores.autorizacion}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Resumen del producto seleccionado */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">
                  Producto resultante que se registrará en Drive:
                </span>
                <span className="font-extrabold text-[#0a2958] text-sm flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#E60000]" />
                  {descripcionProducto}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-lg bg-[#0a2958] text-white font-bold text-xs shadow-xs">
                  Cantidad: {cantidad} {cantidad === 1 ? 'unidad' : 'unidades'}
                </span>
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: FECHA DE ENTREGA, MOTIVO Y REMITENTE */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Calendar className="w-4 h-4 text-[#0a2958]" />
              <h3 className="text-sm font-extrabold text-[#0a2958] uppercase tracking-wider">
                3. Fecha de Entrega, Motivo y Remitente <span className="text-[#E60000]">*</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Fecha Entrega de Regalo */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Fecha Entrega de Regalo (Viernes en Poscosecha){' '}
                    <span className="text-[#E60000]">*</span>
                  </label>
                  <span className="text-[11px] font-bold text-[#E60000] bg-[#E60000]/10 px-2 py-0.2 rounded-md">
                    {semanaEntrega}
                  </span>
                </div>
                <select
                  value={fechaEntrega}
                  onChange={(e) => setFechaEntrega(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:border-[#0a2958] focus:ring-2 focus:ring-[#0a2958]/20 outline-hidden bg-white font-semibold text-slate-900"
                >
                  {upcomingFridays.map((fri) => (
                    <option key={fri.dateString} value={fri.dateString}>
                      {fri.label} ({getWeekLabel(fri.dateString)})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Entrega al finalizar la jornada laboral en el área de Poscosecha.
                </p>
              </div>

              {/* Remitente */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Remitente <span className="text-[#E60000]">*</span>
                </label>
                <input
                  type="text"
                  value={remitente}
                  onChange={(e) => setRemitente(e.target.value)}
                  placeholder="Ej: Gestión Humana, Jefe Inmediato, o Auto-solicitud"
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border ${
                    errores.remitente ? 'border-rose-400 bg-rose-50/40' : 'border-slate-300'
                  } focus:border-[#0a2958] focus:ring-2 focus:ring-[#0a2958]/20 outline-hidden font-medium`}
                />
                {errores.remitente && (
                  <p className="text-[11px] text-[#E60000] font-semibold mt-1">{errores.remitente}</p>
                )}
              </div>
            </div>

            {/* Motivo */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Motivo del Obsequio <span className="text-[#E60000]">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:border-[#0a2958] focus:ring-2 focus:ring-[#0a2958]/20 outline-hidden bg-white font-medium text-slate-900"
                >
                  {MOTIVOS_SOLICITUD.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>

                {motivo === 'Otro motivo' && (
                  <input
                    type="text"
                    value={motivoPersonalizado}
                    onChange={(e) => setMotivoPersonalizado(e.target.value)}
                    placeholder="Describa el motivo específico..."
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:border-[#0a2958] outline-hidden"
                  />
                )}
              </div>
            </div>

            {/* Alerta de Cupo Semanal si está agotado */}
            {cuposSemana.estaAgotado && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-[#E60000] shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-rose-950">Cupo Semanal Agotado para {sede}</h4>
                  <p className="mt-0.5">
                    Se ha alcanzado el límite semanal en la {semanaEntrega} (entrega el{' '}
                    <strong>{formatShortDate(fechaEntrega)}</strong>).
                  </p>
                  <p className="mt-1 font-semibold text-rose-800">
                    Por favor seleccione la siguiente fecha de entrega (siguiente viernes) o consulte la pestaña de Cupos Semanales.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* BOTÓN DE ACCIÓN Y VALIDACIÓN */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              Campos marcados con <span className="text-[#E60000] font-bold">*</span> son obligatorios.
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !validacion15Dias.puedeSolicitar || cuposSemana.estaAgotado}
              className={`w-full sm:w-auto px-8 py-3 rounded-xl text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-md transition cursor-pointer ${
                isSubmitting || !validacion15Dias.puedeSolicitar || cuposSemana.estaAgotado
                  ? 'bg-slate-400 cursor-not-allowed opacity-60 shadow-none'
                  : 'bg-[#0a2958] hover:bg-[#0d346e] active:scale-98 shadow-[#0a2958]/30'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Registrando solicitud...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-[#E60000]" />
                  <span>Registrar Solicitud de Flor</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
