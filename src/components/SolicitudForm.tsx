import React, { useState, useEffect, useMemo } from 'react';
import {
  Flower,
  Sparkles,
  Calendar,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Send,
  Printer,
  Copy,
  Info,
  Clock,
  Search,
  ExternalLink,
  Cloud,
  Check,
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
}

export const SolicitudForm: React.FC<SolicitudFormProps> = ({
  maestro,
  solicitudes,
  onGuardarSolicitud,
  isDriveConnected,
  spreadsheetLink,
  onRecargarMaestroDeDrive,
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
  const [opcionRosa, setOpcionRosa] = useState<'Rojo' | 'Color'>('Rojo');

  // En Bouquet Mixto:
  // Solo se escoge UNA opción: flor que predomina ('Rosa' | 'Clavel' | 'Alstroemeria')
  const [florBouquet, setFlorBouquet] = useState<FlowerType>('Rosa');

  // Motivo, Entrega y Remitente
  const [motivo, setMotivo] = useState(MOTIVOS_SOLICITUD[0]);
  const [motivoPersonalizado, setMotivoPersonalizado] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState(upcomingFridays[0]?.dateString || '');
  const [remitente, setRemitente] = useState('');

  // Estados UI de búsqueda de trabajador
  const [codigoSearch, setCodigoSearch] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
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

  // Autocomplete reactivo y robusto
  const trabajadoresFiltrados = useMemo(() => {
    if (!codigoSearch.trim()) return [];
    const query = codigoSearch.toLowerCase().trim();
    return maestro
      .filter(
        (t) =>
          t.activo &&
          (t.codigo.toLowerCase().includes(query) || t.nombre.toLowerCase().includes(query))
      )
      .slice(0, 10);
  }, [codigoSearch, maestro]);

  // Función para seleccionar o auto-aplicar trabajador
  const aplicarTrabajador = (trabajador: TrabajadorMaestro) => {
    setCodigo(trabajador.codigo);
    setNombre(trabajador.nombre);
    setSede(trabajador.sede); // Se asigna automáticamente de la hoja maestro
    setTrabajadorEncontrado(trabajador);
    setCodigoSearch(`${trabajador.codigo} - ${trabajador.nombre}`);
    setShowAutocomplete(false);
    setErrores((prev) => {
      const next = { ...prev };
      delete next.codigo;
      delete next.nombre;
      delete next.sede;
      return next;
    });
  };

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

  // Manejo de cambio en el campo de búsqueda rápida
  const handleSearchChange = (val: string) => {
    setCodigoSearch(val);
    setShowAutocomplete(true);

    const match = maestro.find(
      (m) => m.codigo.trim().toLowerCase() === val.trim().toLowerCase()
    );
    if (match) {
      aplicarTrabajador(match);
    } else if (val.trim()) {
      setCodigo(val.trim());
      // Buscar si hay coincidencia inmediata
      buscarYVincularCodigo(val);
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

  // Descripción exacta del producto según requerimiento del usuario
  const descripcionProducto = useMemo(() => {
    if (tipoProducto === 'ramo') {
      if (florRamo === 'Rosa') {
        return `Ramo de Rosa (${opcionRosa}) (1 unidad)`;
      } else if (florRamo === 'Clavel') {
        return 'Ramo de Clavel (Según color disponible) (1 unidad)';
      } else {
        return 'Ramo de Alstroemeria (Según color disponible) (1 unidad)';
      }
    } else {
      // Bouquet Mixto: prevaleciendo la flor que seleccione
      return `Bouquet de ${florBouquet === 'Rosa' ? 'Rosas' : florBouquet} (1 unidad)`;
    }
  }, [tipoProducto, florRamo, opcionRosa, florBouquet]);

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
      producto: descripcionProducto,
      tipoProducto,
      florPrincipal: tipoProducto === 'ramo' ? florRamo : florBouquet,
      opcionFlor:
        tipoProducto === 'ramo'
          ? florRamo === 'Rosa'
            ? opcionRosa
            : 'Según color disponible'
          : `Variado con predominancia de ${florBouquet}`,
      sede, // Tomada del Maestro
      motivo: motivoFinal,
      fechaEntrega,
      remitente: remitente.trim(),
      estado: 'Registrada',
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
    setCodigoSearch('');
    setTrabajadorEncontrado(null);
    setMotivo(MOTIVOS_SOLICITUD[0]);
    setMotivoPersonalizado('');
    setRemitente('');
    setFlorRamo('Rosa');
    setOpcionRosa('Rojo');
    setFlorBouquet('Rosa');
    setTipoProducto('ramo');
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
      {/* Banner Informativo Institucional */}
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-[#0a2958] via-[#0d346e] to-[#0a2958] text-white p-5 shadow-sm border border-[#0a2958]/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#E60000]/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
        <div className="flex items-start gap-4 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/20">
            <Clock className="w-5 h-5 text-red-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-white">
                Condiciones y Logística de Entrega
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E60000] text-white">
                MG Consultores
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 mt-1 leading-relaxed">
              La entrega de flor de obsequio se realizará exclusivamente en el área de{' '}
              <strong className="text-white font-bold underline decoration-[#E60000] decoration-2">
                Poscosecha los viernes, al finalizar la jornada laboral
              </strong>
              . Cada trabajador podrá solicitar flor de obsequio una vez cada 15 días (1 unidad por solicitud).
            </p>
          </div>
        </div>
      </div>

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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
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

            {/* 3. Sede (Tomada del Maestro) */}
            <div className="p-3 rounded-xl bg-white border border-[#0a2958]/20 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-[#0a2958] block tracking-wider">
                Sede Poscosecha
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-[#0a2958]" />
                <span className="text-xs sm:text-sm font-extrabold text-[#0a2958]">
                  {sede}
                </span>
                {trabajadorEncontrado && (
                  <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                )}
              </div>
            </div>

            {/* 4. Radicado */}
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
                  1. Datos del Trabajador (Hoja Maestro)
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

            {/* Búsqueda rápida por Maestro */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Buscar en Maestro por Código o Nombre{' '}
                <span className="text-slate-400 font-normal">
                  (Escriba código como 5705 o nombre para autocompletar de inmediato)
                </span>
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={codigoSearch}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (trabajadoresFiltrados.length > 0) {
                        aplicarTrabajador(trabajadoresFiltrados[0]);
                      } else {
                        buscarYVincularCodigo(codigoSearch);
                        setShowAutocomplete(false);
                      }
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowAutocomplete(false), 250);
                    buscarYVincularCodigo(codigoSearch);
                  }}
                  onFocus={() => setShowAutocomplete(true)}
                  placeholder="Escriba código (ej: 5705) o nombre del trabajador..."
                  className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border border-slate-300 focus:border-[#0a2958] focus:ring-2 focus:ring-[#0a2958]/20 outline-hidden transition font-medium"
                />
              </div>

              {/* Lista desplegable autocomplete */}
              {showAutocomplete && trabajadoresFiltrados.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                  {trabajadoresFiltrados.map((item) => (
                    <button
                      type="button"
                      key={item.codigo}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        aplicarTrabajador(item);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-[#0a2958]/5 flex items-center justify-between border-b border-slate-100 last:border-b-0 text-xs transition cursor-pointer"
                    >
                      <div>
                        <span className="font-bold text-[#0a2958] font-mono">
                          {item.codigo}
                        </span>{' '}
                        — <span className="font-bold text-slate-800">{item.nombre}</span>
                        <span className="text-slate-500 text-[11px] block">
                          {item.cargo} • Sede: <strong className="text-[#0a2958]">{item.sede}</strong>
                        </span>
                      </div>
                      <span className="text-[10px] px-2.5 py-1 rounded-lg bg-[#0a2958] text-white font-bold">
                        Seleccionar
                      </span>
                    </button>
                  ))}
                </div>
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
                  onChange={(e) => {
                    const val = e.target.value;
                    setCodigo(val);
                    buscarYVincularCodigo(val);
                  }}
                  placeholder="Ej: 5705, MG-101"
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border ${
                    errores.codigo ? 'border-rose-400 bg-rose-50/40' : 'border-slate-300'
                  } focus:border-[#0a2958] focus:ring-2 focus:ring-[#0a2958]/20 outline-hidden font-mono uppercase font-bold text-slate-900`}
                />
                {errores.codigo && (
                  <p className="text-[11px] text-[#E60000] font-semibold mt-1">{errores.codigo}</p>
                )}
              </div>

              {/* Nombre */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre Completo del Trabajador <span className="text-[#E60000]">*</span>
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre y apellidos del trabajador"
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border ${
                    errores.nombre ? 'border-rose-400 bg-rose-50/40' : 'border-slate-300'
                  } focus:border-[#0a2958] focus:ring-2 focus:ring-[#0a2958]/20 outline-hidden font-bold text-slate-900`}
                />
                {errores.nombre && (
                  <p className="text-[11px] text-[#E60000] font-semibold mt-1">{errores.nombre}</p>
                )}
              </div>
            </div>

            {/* Confirmación visual de la Sede asignada desde el Maestro */}
            {trabajadorEncontrado && (
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs flex items-center justify-between text-emerald-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Trabajador verificado: <strong>{trabajadorEncontrado.nombre}</strong> — Sede asignada automáticamente:{' '}
                    <strong className="text-[#0a2958] uppercase">{trabajadorEncontrado.sede}</strong>
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#0a2958] text-white">
                  {trabajadorEncontrado.sede}
                </span>
              </div>
            )}

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

          {/* SECCIÓN 2: PRODUCTO: RAMO O BOUQUET MIXTO (REORGANIZADO LIMPIO SIN TARJETAS DE SEDE) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Flower className="w-4 h-4 text-[#0a2958]" />
                <h3 className="text-sm font-extrabold text-[#0a2958] uppercase tracking-wider">
                  2. Producto: Ramo o Bouquet Mixto <span className="text-[#E60000]">*</span>
                </h3>
              </div>
              <span className="text-[11px] font-bold text-[#E60000] bg-[#E60000]/10 px-2.5 py-0.5 rounded-full">
                Límite: 1 unidad por solicitud
              </span>
            </div>

            {/* Alternador: Ramo Monovarietal vs Bouquet Mixto */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTipoProducto('ramo')}
                className={`p-4 rounded-xl border text-left transition cursor-pointer ${
                  tipoProducto === 'ramo'
                    ? 'border-[#0a2958] bg-[#0a2958]/5 ring-2 ring-[#0a2958]/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-sm text-[#0a2958]">
                      Ramo de un solo Producto
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Un solo tipo de flor (Rosa, Clavel o Alstroemeria)
                    </p>
                  </div>
                  {tipoProducto === 'ramo' && (
                    <CheckCircle2 className="w-5 h-5 text-[#0a2958] shrink-0" />
                  )}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTipoProducto('bouquet')}
                className={`p-4 rounded-xl border text-left transition cursor-pointer ${
                  tipoProducto === 'bouquet'
                    ? 'border-[#0a2958] bg-[#0a2958]/5 ring-2 ring-[#0a2958]/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm text-[#0a2958]">
                        Bouquet Mixto
                      </h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E60000] text-white font-bold">
                        1 opción
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Flores variadas con prevalencia de la flor seleccionada
                    </p>
                  </div>
                  {tipoProducto === 'bouquet' && (
                    <CheckCircle2 className="w-5 h-5 text-[#0a2958] shrink-0" />
                  )}
                </div>
              </button>
            </div>

            {/* DETALLE DE OPCIONES PARA RAMO DE UN SOLO PRODUCTO */}
            {tipoProducto === 'ramo' && (
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

                    {/* Sub-opciones de Rosa: Color o Rojo */}
                    <div className="mt-3 pt-2.5 border-t border-slate-200">
                      <span className="text-[11px] font-bold text-slate-600 block mb-1.5">
                        Escoger opción:
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFlorRamo('Rosa');
                            setOpcionRosa('Rojo');
                          }}
                          className={`py-1 px-2 text-xs font-bold rounded-lg border transition ${
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
                          className={`py-1 px-2 text-xs font-bold rounded-lg border transition ${
                            florRamo === 'Rosa' && opcionRosa === 'Color'
                              ? 'bg-[#0a2958] text-white border-[#0a2958] shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          Color
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
            )}

            {/* DETALLE DE OPCIONES PARA BOUQUET MIXTO */}
            {tipoProducto === 'bouquet' && (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700">
                  Seleccione una sola opción para el Bouquet Mixto (con prevalencia de la flor elegida):
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Opción 1: Bouquet de Rosas */}
                  <button
                    type="button"
                    onClick={() => setFlorBouquet('Rosa')}
                    className={`p-4 rounded-xl border text-left transition cursor-pointer ${
                      florBouquet === 'Rosa'
                        ? 'border-[#0a2958] bg-rose-50/50 ring-2 ring-[#0a2958]/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">🌹</span>
                      <input
                        type="radio"
                        name="florBouquet"
                        checked={florBouquet === 'Rosa'}
                        onChange={() => setFlorBouquet('Rosa')}
                        className="w-4 h-4 text-[#0a2958] accent-[#0a2958]"
                      />
                    </div>
                    <h4 className="font-extrabold text-sm text-[#0a2958]">
                      Bouquet de Rosas
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Bouquet variado con prevalencia de rosas
                    </p>
                  </button>

                  {/* Opción 2: Bouquet de Clavel */}
                  <button
                    type="button"
                    onClick={() => setFlorBouquet('Clavel')}
                    className={`p-4 rounded-xl border text-left transition cursor-pointer ${
                      florBouquet === 'Clavel'
                        ? 'border-[#0a2958] bg-pink-50/50 ring-2 ring-[#0a2958]/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">🌸</span>
                      <input
                        type="radio"
                        name="florBouquet"
                        checked={florBouquet === 'Clavel'}
                        onChange={() => setFlorBouquet('Clavel')}
                        className="w-4 h-4 text-[#0a2958] accent-[#0a2958]"
                      />
                    </div>
                    <h4 className="font-extrabold text-sm text-[#0a2958]">
                      Bouquet de Clavel
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Bouquet variado con prevalencia de clavel
                    </p>
                  </button>

                  {/* Opción 3: Bouquet Alstroemeria */}
                  <button
                    type="button"
                    onClick={() => setFlorBouquet('Alstroemeria')}
                    className={`p-4 rounded-xl border text-left transition cursor-pointer ${
                      florBouquet === 'Alstroemeria'
                        ? 'border-[#0a2958] bg-amber-50/50 ring-2 ring-[#0a2958]/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">🌺</span>
                      <input
                        type="radio"
                        name="florBouquet"
                        checked={florBouquet === 'Alstroemeria'}
                        onChange={() => setFlorBouquet('Alstroemeria')}
                        className="w-4 h-4 text-[#0a2958] accent-[#0a2958]"
                      />
                    </div>
                    <h4 className="font-extrabold text-sm text-[#0a2958]">
                      Bouquet Alstroemeria
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Bouquet variado con prevalencia de alstroemeria
                    </p>
                  </button>
                </div>
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
                  Cantidad: 1 unidad
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
