import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  FilePlus2,
  Briefcase,
  Building2,
  Sparkles,
  Calendar,
  Clock,
  Send,
  CheckCircle2,
  AlertTriangle,
  Plus,
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
  Camera,
  Upload,
  FileImage,
  FileText,
  ExternalLink,
  Eye,
  Trash2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import * as XLSX from 'xlsx';
import { SolicitudComunidad, TrabajadorMaestro } from '../types';
import { EmailNotificationResult, retryEmailSolicitudComunidadApi } from '../services/apiClient';
import { getTodayString, formatDateSpanish, getISOWeekNumber } from '../utils/dateUtils';
import type { FotoCartaUpload } from './EspecialesPersonalForm';

interface SolicitudComunidadFormProps {
  sesion: TrabajadorMaestro;
  solicitudesComunidad: SolicitudComunidad[];
  sheetsSupported: boolean;
  emailSupported?: boolean;
  solicitudComunidadSheetActual?: string;
  needsAppsScriptUpdate?: boolean;
  onGuardarSolicitudComunidad: (
    nueva: SolicitudComunidad | SolicitudComunidad[],
    correoNotificacion?: string,
    fotoCarta?: { base64: string; mimeType: string; fileName: string } | null
  ) => Promise<{
    success: boolean;
    error?: string;
    solicitud?: SolicitudComunidad;
    solicitudes?: SolicitudComunidad[];
    pendingAppsScriptUpdate?: boolean;
    solicitudComunidadSheetName?: string;
    needsAppsScriptUpdate?: boolean;
    fotoCartaDriveError?: string;
    emailNotification?: EmailNotificationResult;
  }>;
  onRecargarSolicitudComunidad?: () => Promise<void>;
  onCerrarSesion?: () => void;
}

const ENTIDADES_BASE_SC = ['Comunidad', 'Iglesia', 'Alcaldía', 'Policía', 'GHT'] as const;
const STORAGE_ENTIDADES_SC_KEY = 'sfo_entidades_solicitud_comunidad_custom';
const ROSA_VARIANTES_SC = ['Rosa (Color)', 'Rosa (Roja)', 'Bouquet'] as const;
const PRODUCTOS_RESTO_SC = ['Gypso', 'Alstroemeria', 'Clavel'] as const;
const PRODUCTOS_SC = [
  'Rosa (Color)',
  'Rosa (Roja)',
  'Bouquet',
  'Gypso',
  'Alstroemeria',
  'Clavel',
] as const;
const MOTIVOS_BASE_SC = [
  'Celebración religiosa',
  'Evento Institucional',
  'Evento Deportivo',
  'Evento Cultural',
  'Evento Social',
] as const;
const ESTADO_INICIAL_SC = 'Pendiente Aprobación';
const MODELO_CARTA_COMUNIDAD_PDF_URL =
  '/assets/aistudio/Modelo_carta_solicitud_obsequio_de_flor_para_la_comunidad_069a67d8.pdf';

function inferirSedePorProducto(producto: string): string {
  const p = String(producto || '').trim().toLowerCase();
  if (p === 'alstroemeria') return 'HA';
  if (p === 'clavel') return 'SC';
  if (p.includes('rosa') || p === 'bouquet' || p.includes('gypso')) return 'MG';
  return '';
}

const EMAIL_ITEM_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function obtenerNumSemanaSC(s: SolicitudComunidad): number {
  const m = String(s.semana || '').match(/(\d+)/);
  if (m) return Number(m[1]);
  if (s.fechaEntrega) return getISOWeekNumber(s.fechaEntrega);
  return 0;
}

async function comprimirImagenCarta(file: File): Promise<FotoCartaUpload> {
  if (file.type === 'application/pdf') {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('No se pudo leer el archivo PDF'));
      reader.readAsDataURL(file);
    });
    const base64 = dataUrl.split(',')[1] || '';
    return {
      base64,
      mimeType: 'application/pdf',
      fileName: file.name || `Carta_Comunidad_${Date.now()}.pdf`,
      previewUrl: dataUrl,
      sizeKB: Math.round((base64.length * 3) / 4 / 1024),
    };
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1280;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo procesar la imagen'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
        const base64 = dataUrl.split(',')[1] || '';
        resolve({
          base64,
          mimeType: 'image/jpeg',
          fileName: (file.name ? file.name.replace(/\.[^.]+$/, '') : `Carta_Comunidad_${Date.now()}`) + '.jpg',
          previewUrl: dataUrl,
          sizeKB: Math.round((base64.length * 3) / 4 / 1024),
        });
      };
      img.onerror = () => reject(new Error('El archivo seleccionado no es una imagen válida'));
      img.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada'));
    reader.readAsDataURL(file);
  });
}

export const SolicitudComunidadForm: React.FC<SolicitudComunidadFormProps> = ({
  sesion,
  solicitudesComunidad,
  sheetsSupported,
  emailSupported = true,
  solicitudComunidadSheetActual = '',
  needsAppsScriptUpdate = false,
  onGuardarSolicitudComunidad,
  onRecargarSolicitudComunidad,
  onCerrarSesion,
}) => {
  const fechaSolicitud = getTodayString();

  // Entidades con persistencia para opciones agregadas
  const [entidadesPersonalizadas, setEntidadesPersonalizadas] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ENTIDADES_SC_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [entidadSeleccionada, setEntidadSeleccionada] = useState('');
  const [mostrandoInputEntidad, setMostrandoInputEntidad] = useState(false);
  const [nuevaEntidadInput, setNuevaEntidadInput] = useState('');

  // Productos y cantidades
  const [productosCantidades, setProductosCantidades] = useState<Record<string, string>>({});
  const [rosaAbierto, setRosaAbierto] = useState(false);

  // Motivos con persistencia para opciones agregadas
  const [motivosPersonalizados, setMotivosPersonalizados] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sfo_motivos_solicitud_comunidad_custom');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [motivoSeleccionado, setMotivoSeleccionado] = useState('');
  const [mostrandoInputMotivo, setMostrandoInputMotivo] = useState(false);
  const [nuevoMotivoInput, setNuevoMotivoInput] = useState('');

  // Fecha entrega, semana calculada, correo confirmación, foto carta, notificación
  const [fechaEntrega, setFechaEntrega] = useState(getTodayString());
  const [correoConfirmacion, setCorreoConfirmacion] = useState('');
  const [correoNotificacion, setCorreoNotificacion] = useState('');
  const [fotoCarta, setFotoCarta] = useState<FotoCartaUpload | null>(null);
  const [errorFoto, setErrorFoto] = useState('');

  // Envío y modal confirmación
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [solicitudesExitosas, setSolicitudesExitosas] = useState<SolicitudComunidad[]>([]);
  const [emailResultado, setEmailResultado] = useState<EmailNotificationResult | null>(null);
  const [reintentandoCorreo, setReintentandoCorreo] = useState(false);
  const [avisoPendienteScript, setAvisoPendienteScript] = useState(false);
  const [avisoDriveFoto, setAvisoDriveFoto] = useState('');
  const [copiadoId, setCopiadoId] = useState(false);

  // Previsualización de carta en lightbox
  const [cartaLightboxUrl, setCartaLightboxUrl] = useState<string | null>(null);

  // Filtros tabla historial
  const [busquedaTabla, setBusquedaTabla] = useState('');
  const [filtroSemana, setFiltroSemana] = useState<string>('todas');
  const [productosFiltro, setProductosFiltro] = useState<string[]>([]);
  const [dropdownProductoAbierto, setDropdownProductoAbierto] = useState(false);
  const dropdownProductoRef = useRef<HTMLDivElement | null>(null);
  const [recargandoTabla, setRecargandoTabla] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_ENTIDADES_SC_KEY,
        JSON.stringify(entidadesPersonalizadas)
      );
    } catch {}
  }, [entidadesPersonalizadas]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'sfo_motivos_solicitud_comunidad_custom',
        JSON.stringify(motivosPersonalizados)
      );
    } catch {}
  }, [motivosPersonalizados]);

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
    for (const s of solicitudesComunidad) {
      const m = String(s.id || '').match(/^SC-(\d{4})-(\d+)$/i);
      if (m && Number(m[1]) === year) {
        maxNum = Math.max(maxNum, Number(m[2]));
      }
    }
    return Math.max(maxNum + 1, solicitudesComunidad.length + 1);
  }, [solicitudesComunidad]);

  const productosSeleccionadosOrdenados = useMemo(
    () => PRODUCTOS_SC.filter((p) => Object.prototype.hasOwnProperty.call(productosCantidades, p)),
    [productosCantidades]
  );

  const totalRamosSeleccionados = useMemo(() => {
    return productosSeleccionadosOrdenados.reduce((acc, prod) => {
      const n = Number(productosCantidades[prod]);
      return acc + (!Number.isNaN(n) && n > 0 ? Math.floor(n) : 0);
    }, 0);
  }, [productosSeleccionadosOrdenados, productosCantidades]);

  const opcionesEntidadVisibles = useMemo(() => {
    const mapa = new Map<string, string>();
    const agregar = (val?: string) => {
      const limpio = String(val || '').trim();
      if (!limpio) return;
      const clave = limpio.toLowerCase();
      if (!mapa.has(clave)) mapa.set(clave, limpio);
    };
    ENTIDADES_BASE_SC.forEach(agregar);
    entidadesPersonalizadas.forEach(agregar);
    solicitudesComunidad.forEach((s) => agregar(s.entidad));
    return Array.from(mapa.values());
  }, [entidadesPersonalizadas, solicitudesComunidad]);

  const entidadFinal =
    mostrandoInputEntidad && nuevaEntidadInput.trim()
      ? nuevaEntidadInput.trim()
      : entidadSeleccionada.trim();

  const opcionesMotivoVisibles = useMemo(() => {
    const set = new Set<string>([...MOTIVOS_BASE_SC, ...motivosPersonalizados]);
    return Array.from(set);
  }, [motivosPersonalizados]);

  const motivoFinal =
    mostrandoInputMotivo && nuevoMotivoInput.trim()
      ? nuevoMotivoInput.trim()
      : motivoSeleccionado.trim();

  const rosaColorActivo = Object.prototype.hasOwnProperty.call(productosCantidades, 'Rosa (Color)');
  const rosaRojaActivo = Object.prototype.hasOwnProperty.call(productosCantidades, 'Rosa (Roja)');
  const bouquetActivo = Object.prototype.hasOwnProperty.call(productosCantidades, 'Bouquet');
  const rosaTieneSeleccion = rosaColorActivo || rosaRojaActivo || bouquetActivo;
  const rosaExpandido = rosaAbierto || rosaTieneSeleccion;

  const handleAgregarEntidadPersonalizada = () => {
    const limpio = nuevaEntidadInput.trim();
    if (!limpio) return;
    if (!opcionesEntidadVisibles.some((ent) => ent.toLowerCase() === limpio.toLowerCase())) {
      setEntidadesPersonalizadas((prev) => [...prev, limpio]);
    }
    setEntidadSeleccionada(limpio);
    setNuevaEntidadInput('');
    setMostrandoInputEntidad(false);
    setErrores((prev) => {
      const next = { ...prev };
      delete next.entidad;
      return next;
    });
  };

  const toggleRosaPrincipal = () => {
    if (rosaExpandido) {
      setRosaAbierto(false);
      setProductosCantidades((prev) => {
        const next = { ...prev };
        delete next['Rosa (Color)'];
        delete next['Rosa (Roja)'];
        delete next['Bouquet'];
        return next;
      });
      setErrores((prev) => {
        const next = { ...prev };
        delete next.producto;
        delete next.cantidad;
        delete next['cant_Rosa (Color)'];
        delete next['cant_Rosa (Roja)'];
        delete next['cant_Bouquet'];
        return next;
      });
    } else {
      setRosaAbierto(true);
      setErrores((prev) => {
        const next = { ...prev };
        delete next.producto;
        return next;
      });
    }
  };

  const toggleProducto = (prod: string) => {
    setProductosCantidades((prev) => {
      const next = { ...prev };
      if (Object.prototype.hasOwnProperty.call(next, prod)) {
        delete next[prod];
      } else {
        next[prod] = '1';
      }
      return next;
    });
    setErrores((prev) => {
      const next = { ...prev };
      delete next.producto;
      delete next.cantidad;
      delete next[`cant_${prod}`];
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

  const handleAgregarMotivoPersonalizado = () => {
    const limpio = nuevoMotivoInput.trim();
    if (!limpio) return;
    if (!opcionesMotivoVisibles.some((m) => m.toLowerCase() === limpio.toLowerCase())) {
      setMotivosPersonalizados((prev) => [...prev, limpio]);
    }
    setMotivoSeleccionado(limpio);
    setNuevoMotivoInput('');
    setMostrandoInputMotivo(false);
    setErrores((prev) => {
      const next = { ...prev };
      delete next.motivo;
      return next;
    });
  };

  const handleSeleccionArchivoCarta = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const inputEl = e.target;
    if (!file) return;
    setErrorFoto('');
    try {
      const procesada = await comprimirImagenCarta(file);
      setFotoCarta(procesada);
      setErrores((prev) => {
        const next = { ...prev };
        delete next.fotoCarta;
        return next;
      });
    } catch (err: any) {
      setErrorFoto(err?.message || 'No se pudo procesar el archivo seleccionado.');
    } finally {
      inputEl.value = '';
    }
  };

  const validarFormulario = (): boolean => {
    const errs: Record<string, string> = {};

    if (!entidadFinal) {
      errs.entidad = 'Seleccione o agregue la entidad de la solicitud.';
    }

    if (productosSeleccionadosOrdenados.length === 0) {
      errs.producto =
        'Seleccione al menos un producto (Rosa, Gypso, Alstroemeria o Clavel) e ingrese la cantidad.';
    } else {
      for (const prod of productosSeleccionadosOrdenados) {
        const cantNum = Number(productosCantidades[prod]);
        if (!productosCantidades[prod] || Number.isNaN(cantNum) || cantNum < 1) {
          errs[`cant_${prod}`] = `Ingrese una cantidad válida (mínimo 1) para ${prod}.`;
          errs.cantidad = 'Revise las cantidades ingresadas por producto.';
        }
      }
    }

    if (!motivoFinal) {
      errs.motivo = 'Seleccione o agregue el motivo de la solicitud.';
    }

    if (!fechaEntrega) {
      errs.fechaEntrega = 'Seleccione la fecha de entrega.';
    }

    const correoConfirmacionLimpio = correoConfirmacion.trim();
    if (!correoConfirmacionLimpio) {
      errs.correoConfirmacion =
        'Ingrese un Correo de confirmación para recibir la respuesta de Solicitud.';
    } else if (!EMAIL_ITEM_REGEX.test(correoConfirmacionLimpio)) {
      errs.correoConfirmacion =
        'Ingrese un Correo de confirmación válido (ej. micorreo@gmail.com).';
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

    if (!fotoCarta) {
      errs.fotoCarta = 'Debe adjuntar la foto o PDF de la carta para registrar la solicitud.';
    }

    setErrores(errs);
    return Object.keys(errs).length === 0;
  };

  const limpiarFormulario = () => {
    setEntidadSeleccionada('');
    setMostrandoInputEntidad(false);
    setNuevaEntidadInput('');
    setProductosCantidades({});
    setRosaAbierto(false);
    setMotivoSeleccionado('');
    setMostrandoInputMotivo(false);
    setNuevoMotivoInput('');
    setFechaEntrega(getTodayString());
    setCorreoConfirmacion('');
    setCorreoNotificacion('');
    setFotoCarta(null);
    setErrorFoto('');
    setErrores({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validarFormulario()) return;

    setIsSubmitting(true);
    setErrores({});

    try {
      if (mostrandoInputEntidad && nuevaEntidadInput.trim()) {
        const entLimpia = nuevaEntidadInput.trim();
        if (!opcionesEntidadVisibles.some((ent) => ent.toLowerCase() === entLimpia.toLowerCase())) {
          setEntidadesPersonalizadas((prev) => [...prev, entLimpia]);
        }
      }

      if (mostrandoInputMotivo && nuevoMotivoInput.trim()) {
        const mLimpio = nuevoMotivoInput.trim();
        if (!opcionesMotivoVisibles.some((m) => m.toLowerCase() === mLimpio.toLowerCase())) {
          setMotivosPersonalizados((prev) => [...prev, mLimpio]);
        }
      }

      const parsedCorreos = parsearListaCorreos(correoNotificacion);
      const correoLimpio = parsedCorreos.normalizado;
      const correoConfirmacionLimpio = correoConfirmacion.trim();
      const year = new Date().getFullYear();
      const semanaStr = String(semanaCalculada);

      const listaSolicitudes: SolicitudComunidad[] = productosSeleccionadosOrdenados.map((prod, idx) => ({
        id: `SC-${year}-${String(siguienteNumeroId + idx).padStart(3, '0')}`,
        fechaSolicitud,
        usuario: sesion.nombre.trim(),
        entidad: entidadFinal,
        motivo: motivoFinal,
        sede: inferirSedePorProducto(prod),
        producto: prod,
        cantidad: Math.max(1, Math.floor(Number(productosCantidades[prod]) || 1)),
        semana: semanaStr,
        fechaEntrega,
        correoConfirmacion: correoConfirmacionLimpio,
        estado: ESTADO_INICIAL_SC,
        fotoCarta: '',
        notificado: correoLimpio || 'Registrada',
        creadoEn: Date.now() + idx,
      }));

      const res = await onGuardarSolicitudComunidad(
        listaSolicitudes,
        correoLimpio,
        fotoCarta
          ? {
              base64: fotoCarta.base64,
              mimeType: fotoCarta.mimeType,
              fileName: fotoCarta.fileName,
            }
          : null
      );

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
        setAvisoDriveFoto(res.fotoCartaDriveError || '');
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
          general: res.error || 'No se pudo guardar en la hoja Solicitud Comunidad.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReintentarCorreo = async () => {
    if (solicitudesExitosas.length === 0) return;
    const correoDestino =
      emailResultado?.to ||
      solicitudesExitosas[0]?.notificado ||
      solicitudesExitosas[0]?.correoConfirmacion ||
      '';
    if (!correoDestino || !correoDestino.includes('@')) return;

    setReintentandoCorreo(true);
    try {
      const resMail = await retryEmailSolicitudComunidadApi(solicitudesExitosas, correoDestino);
      setEmailResultado(resMail);
    } finally {
      setReintentandoCorreo(false);
    }
  };

  // Filtros tabla
  const semanasDisponiblesTabla = useMemo(() => {
    const set = new Set<number>();
    for (const s of solicitudesComunidad) {
      const num = obtenerNumSemanaSC(s);
      if (num > 0) set.add(num);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [solicitudesComunidad]);

  const productosDisponiblesTabla = useMemo(() => {
    const set = new Set<string>(PRODUCTOS_SC);
    for (const s of solicitudesComunidad) {
      const p = String(s.producto || '').trim();
      if (p) set.add(p);
    }
    return Array.from(set);
  }, [solicitudesComunidad]);

  const toggleProductoFiltro = (prod: string) => {
    setProductosFiltro((prev) =>
      prev.includes(prod) ? prev.filter((p) => p !== prod) : [...prev, prod]
    );
  };

  const solicitudesFiltradas = useMemo(() => {
    const q = busquedaTabla.toLowerCase().trim();
    return solicitudesComunidad.filter((s) => {
      if (filtroSemana !== 'todas') {
        const sem = obtenerNumSemanaSC(s);
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
        (s.usuario || '').toLowerCase().includes(q) ||
        s.entidad.toLowerCase().includes(q) ||
        s.motivo.toLowerCase().includes(q) ||
        s.sede.toLowerCase().includes(q) ||
        s.producto.toLowerCase().includes(q) ||
        (s.correoConfirmacion || '').toLowerCase().includes(q) ||
        (s.estado || '').toLowerCase().includes(q) ||
        (s.notificado || '').toLowerCase().includes(q)
      );
    });
  }, [solicitudesComunidad, busquedaTabla, filtroSemana, productosFiltro]);

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
      Usuario: s.usuario,
      Entidad: s.entidad,
      Motivo: s.motivo,
      Sede: s.sede,
      Producto: s.producto,
      Cantidad: s.cantidad,
      Semana: s.semana,
      'Fecha Entrega': s.fechaEntrega,
      'Correo de confirmación': s.correoConfirmacion || '',
      Estado: s.estado || ESTADO_INICIAL_SC,
      'Foto Carta': s.fotoCarta || '',
      Notificado: s.notificado || 'Registrada',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Solicitud Comunidad');
    XLSX.writeFile(wb, `Solicitud_Comunidad_${getTodayString()}.xlsx`);
  };

  const primeraExitosa = solicitudesExitosas[0];
  const idsExitososTexto = solicitudesExitosas.map((s) => s.id).join(', ');
  const totalExitosaRamos = solicitudesExitosas.reduce(
    (acc, s) => acc + (Number(s.cantidad) || 1),
    0
  );

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Lightbox para visualizar Foto Carta */}
      {cartaLightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs"
          onClick={() => setCartaLightboxUrl(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full p-4 shadow-2xl border border-slate-200 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-extrabold text-[#0a2958] uppercase tracking-wider flex items-center gap-1.5">
                <FileImage className="w-4 h-4 text-[#E60000]" />
                Carta Autorizada
              </span>
              <button
                type="button"
                onClick={() => setCartaLightboxUrl(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {cartaLightboxUrl.startsWith('http') ? (
              <div className="p-4 text-center space-y-3">
                <p className="text-xs text-slate-600">
                  La carta está almacenada de forma segura en Google Drive.
                </p>
                <a
                  href={cartaLightboxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0a2958] text-white text-xs font-bold hover:bg-[#0d346e]"
                >
                  <ExternalLink className="w-4 h-4 text-[#E60000]" />
                  <span>Abrir Carta en Google Drive</span>
                </a>
              </div>
            ) : cartaLightboxUrl.toLowerCase().endsWith('.pdf') ? (
              <iframe
                src={cartaLightboxUrl}
                title="Carta Autorizada"
                className="w-full h-[65vh] rounded-xl border border-slate-200"
              />
            ) : (
              <div className="max-h-[75vh] overflow-auto flex items-center justify-center bg-slate-50 rounded-xl p-2">
                <img
                  src={cartaLightboxUrl}
                  alt="Carta Autorizada"
                  className="max-w-full max-h-[70vh] rounded-lg object-contain"
                />
              </div>
            )}
          </div>
        </div>
      )}

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
                <strong>Solicitud Comunidad</strong>.
              </p>
            </div>

            {avisoPendienteScript && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs text-left flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  Guardado en respaldo local. Para escribir en la hoja <strong>Solicitud Comunidad</strong>, el administrador debe actualizar el Apps Script e implementar una <strong>Nueva versión</strong>.
                </span>
              </div>
            )}

            {avisoDriveFoto && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs text-left flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  La foto de la carta quedó en respaldo local (para guardar directamente en Google Drive ejecute <code>autorizarEnvioCorreos</code> en Apps Script).
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
                        Notificación enviada a <strong className="break-all">{emailResultado.to}</strong>.
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
                    <RefreshCw className={`w-3.5 h-3.5 ${reintentandoCorreo ? 'animate-spin' : ''}`} />
                    <span>{reintentandoCorreo ? 'Reintentando envío…' : 'Reintentar envío de correo'}</span>
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
                <span className="font-semibold text-slate-900">{primeraExitosa.fechaSolicitud}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Usuario:</span>
                <span className="font-semibold text-slate-900 text-right">{primeraExitosa.usuario}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Entidad:</span>
                <span className="font-bold text-[#0a2958]">{primeraExitosa.entidad}</span>
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
                <span className="text-slate-500">Motivo:</span>
                <span className="font-bold text-slate-900">{primeraExitosa.motivo}</span>
              </div>
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
              {primeraExitosa.fotoCarta && (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500">Foto Carta:</span>
                  <button
                    type="button"
                    onClick={() => setCartaLightboxUrl(primeraExitosa.fotoCarta!)}
                    className="inline-flex items-center gap-1 font-bold text-[#0a2958] hover:underline cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#E60000]" />
                    <span>Ver Carta</span>
                  </button>
                </div>
              )}
              {primeraExitosa.correoConfirmacion && (
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 shrink-0">Correo de confirmación:</span>
                  <span className="font-bold text-[#0a2958] break-all text-right">
                    {primeraExitosa.correoConfirmacion}
                  </span>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <span className="text-slate-500 shrink-0">Estado:</span>
                <span className="font-bold text-amber-700 text-right">
                  {primeraExitosa.estado || ESTADO_INICIAL_SC}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500 shrink-0">Notificado:</span>
                <span className="font-bold text-emerald-700 break-all text-right">
                  {primeraExitosa.notificado || 'Registrada'}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Imprimir
              </button>
              <button
                type="button"
                onClick={() => {
                  setSolicitudesExitosas([]);
                  setEmailResultado(null);
                  setAvisoDriveFoto('');
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Nueva Solicitud
              </button>
              <button
                type="button"
                onClick={() => {
                  setSolicitudesExitosas([]);
                  setEmailResultado(null);
                  setAvisoDriveFoto('');
                  onCerrarSesion?.();
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#0a2958] hover:bg-[#0d346e] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-[#E60000]" /> Salir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formulario Principal SOLICITUD COMUNIDAD */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0a2958]/10 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-[#E60000]" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#0a2958] uppercase tracking-wide">
                SOLICITUD COMUNIDAD
              </h2>
              <p className="text-[11px] text-slate-500">
                Solicitudes externas y comunitarias con soporte autorizado
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2">
              <Calendar className="w-4 h-4 text-[#0a2958] shrink-0" />
              <span className="text-xs font-bold text-slate-600 whitespace-nowrap">
                Fecha Solicitud:
              </span>
              <input
                type="date"
                value={fechaSolicitud}
                readOnly
                tabIndex={-1}
                className="text-xs font-extrabold text-[#0a2958] bg-transparent outline-hidden pointer-events-none select-none"
              />
            </div>
          </div>
        </div>

        {!sheetsSupported || needsAppsScriptUpdate ? (
          <div className="mx-6 mt-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              La hoja <strong>Solicitud Comunidad</strong> aún no está activa en el webhook de Google Apps Script
              {solicitudComunidadSheetActual ? ` (${solicitudComunidadSheetActual})` : ''}. Para sincronizar directamente con Google Drive, el administrador debe copiar el código actualizado desde <strong>Administración → Google Drive</strong>, ejecutar <code>autorizarEnvioCorreos</code> e implementar una <strong>Nueva versión</strong>.
            </div>
          </div>
        ) : !emailSupported ? (
          <div className="mx-6 mt-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <Mail className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              Para activar el envío automático de correos desde Google Sheets, el administrador debe implementar la versión actualizada del script y autorizar permisos.
            </div>
          </div>
        ) : null}

        {errores.general && (
          <div className="mx-6 mt-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errores.general}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 1. DATOS DE ENTIDAD */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#0a2958]" />
                <h3 className="text-sm font-extrabold text-[#0a2958] uppercase tracking-wider">
                  1. DATOS DE ENTIDAD
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-slate-500">
                Reporta: <strong className="text-[#0a2958]">{sesion.nombre}</strong>
              </span>
            </div>

            {/* Entidad (listar y permitir agregar) */}
            <div className="max-w-md">
              <label
                htmlFor="select-entidad-sc"
                className="block text-xs font-bold text-slate-700 mb-1.5"
              >
                Entidad <span className="text-[#E60000]">*</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <select
                    id="select-entidad-sc"
                    value={mostrandoInputEntidad ? '__AGREGAR__' : entidadSeleccionada}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '__AGREGAR__') {
                        setMostrandoInputEntidad(true);
                      } else {
                        setEntidadSeleccionada(val);
                        setMostrandoInputEntidad(false);
                      }
                      setErrores((prev) => {
                        const next = { ...prev };
                        delete next.entidad;
                        return next;
                      });
                    }}
                    className={`w-full appearance-none pl-3.5 pr-9 py-2.5 text-xs rounded-xl border font-bold bg-white outline-hidden cursor-pointer truncate ${
                      errores.entidad
                        ? 'border-rose-400 bg-rose-50/40 text-slate-900'
                        : 'border-slate-300 focus:border-[#0a2958] text-slate-800'
                    }`}
                  >
                    <option value="">Seleccione una entidad…</option>
                    {opcionesEntidadVisibles.map((ent) => (
                      <option key={ent} value={ent}>
                        {ent}
                      </option>
                    ))}
                    <option value="__AGREGAR__">+ Agregar otra entidad…</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMostrandoInputEntidad((prev) => !prev);
                    setErrores((prev) => {
                      const next = { ...prev };
                      delete next.entidad;
                      return next;
                    });
                  }}
                  title="Agregar otra entidad"
                  aria-label="Agregar otra entidad"
                  className={`p-2.5 rounded-xl border transition cursor-pointer shrink-0 ${
                    mostrandoInputEntidad
                      ? 'bg-[#E60000]/10 text-[#E60000] border-[#E60000]/40'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:border-[#0a2958] hover:text-[#0a2958]'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {mostrandoInputEntidad && (
                <div className="flex gap-2 pt-2">
                  <input
                    type="text"
                    value={nuevaEntidadInput}
                    onChange={(e) => {
                      setNuevaEntidadInput(e.target.value);
                      setErrores((prev) => {
                        const next = { ...prev };
                        delete next.entidad;
                        return next;
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAgregarEntidadPersonalizada();
                      }
                    }}
                    placeholder="Escriba la nueva entidad…"
                    className="flex-1 min-w-0 px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-[#0a2958] outline-hidden font-medium"
                  />
                  <button
                    type="button"
                    onClick={handleAgregarEntidadPersonalizada}
                    className="px-3.5 py-2 rounded-xl bg-[#0a2958] text-white text-xs font-bold hover:bg-[#0d346e] cursor-pointer shrink-0"
                  >
                    Agregar
                  </button>
                </div>
              )}

              {errores.entidad && (
                <p className="text-[11px] text-[#E60000] font-semibold mt-1">{errores.entidad}</p>
              )}
            </div>
          </div>

          {/* 2. PRODUCTO Y CANTIDAD */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#0a2958]" />
                <h3 className="text-sm font-extrabold text-[#0a2958] uppercase tracking-wider">
                  2. PRODUCTO Y CANTIDAD
                </h3>
              </div>
              {productosSeleccionadosOrdenados.length > 0 && (
                <span className="text-[11px] font-bold text-[#0a2958] bg-[#0a2958]/10 px-2.5 py-1 rounded-lg">
                  {productosSeleccionadosOrdenados.length}{' '}
                  {productosSeleccionadosOrdenados.length === 1
                    ? 'producto (1 registro)'
                    : 'productos (se guardan por separado)'}{' '}
                  · Total: <strong className="font-mono tabular-nums">{totalRamosSeleccionados}</strong>
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Producto <span className="text-[#E60000]">*</span>{' '}
                <span className="text-[11px] font-normal text-slate-500">
                  (Puede seleccionar varios productos; cada uno se guarda por separado)
                </span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-start">
                {/* Tarjeta Rosa con subopciones Rosa (Color), Rosa (Roja) y Bouquet */}
                <div
                  className={`rounded-xl border p-3 transition ${
                    rosaExpandido
                      ? 'border-[#0a2958] bg-[#0a2958]/[0.04] shadow-xs'
                      : 'border-slate-200 bg-white hover:border-[#0a2958]/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={toggleRosaPrincipal}
                    aria-pressed={rosaExpandido}
                    className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
                  >
                    <span
                      className={`text-xs font-extrabold ${
                        rosaExpandido ? 'text-[#0a2958]' : 'text-slate-700'
                      }`}
                    >
                      Rosa
                    </span>
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                        rosaExpandido
                          ? 'bg-[#0a2958] border-[#0a2958] text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {rosaExpandido && <Check className="w-3.5 h-3.5" />}
                    </span>
                  </button>

                  {rosaExpandido && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200/80 space-y-2">
                      {ROSA_VARIANTES_SC.map((variante) => {
                        const activoVar = Object.prototype.hasOwnProperty.call(
                          productosCantidades,
                          variante
                        );
                        const cantValorVar = productosCantidades[variante] ?? '';
                        const errCantVar = errores[`cant_${variante}`];

                        return (
                          <div
                            key={variante}
                            className={`rounded-lg border p-2 transition ${
                              activoVar
                                ? 'border-[#0a2958]/60 bg-white shadow-2xs'
                                : 'border-slate-200 bg-white/80 hover:border-[#0a2958]/30'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleProducto(variante)}
                              aria-pressed={activoVar}
                              className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
                            >
                              <span
                                className={`text-[11px] font-bold ${
                                  activoVar ? 'text-[#0a2958]' : 'text-slate-700'
                                }`}
                              >
                                {variante}
                              </span>
                              <span
                                className={`w-4 h-4 rounded flex items-center justify-center border transition shrink-0 ${
                                  activoVar
                                    ? 'bg-[#0a2958] border-[#0a2958] text-white'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {activoVar && <Check className="w-3 h-3" />}
                              </span>
                            </button>

                            {activoVar && (
                              <div className="mt-2 pt-2 border-t border-slate-100">
                                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                                  Cantidad <span className="text-[#E60000]">*</span>
                                </label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={cantValorVar}
                                  onChange={(e) => cambiarCantidadProducto(variante, e.target.value)}
                                  placeholder="Ej: 1"
                                  className={`w-full px-2.5 py-1 text-xs rounded-lg border font-mono font-bold text-[#0a2958] bg-white outline-hidden ${
                                    errCantVar
                                      ? 'border-rose-400 bg-rose-50/40'
                                      : 'border-slate-300 focus:border-[#0a2958]'
                                  }`}
                                />
                                {errCantVar && (
                                  <p className="text-[10px] text-[#E60000] font-semibold mt-1">
                                    {errCantVar}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Gypso, Alstroemeria, Clavel */}
                {PRODUCTOS_RESTO_SC.map((prod) => {
                  const activo = Object.prototype.hasOwnProperty.call(productosCantidades, prod);
                  const cantValor = productosCantidades[prod] ?? '';
                  const errCant = errores[`cant_${prod}`];

                  return (
                    <div
                      key={prod}
                      className={`rounded-xl border p-3 transition ${
                        activo
                          ? 'border-[#0a2958] bg-[#0a2958]/[0.04] shadow-xs'
                          : 'border-slate-200 bg-white hover:border-[#0a2958]/40'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleProducto(prod)}
                        aria-pressed={activo}
                        className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
                      >
                        <span
                          className={`text-xs font-extrabold ${
                            activo ? 'text-[#0a2958]' : 'text-slate-700'
                          }`}
                        >
                          {prod}
                        </span>
                        <span
                          className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                            activo
                              ? 'bg-[#0a2958] border-[#0a2958] text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {activo && <Check className="w-3.5 h-3.5" />}
                        </span>
                      </button>

                      {activo && (
                        <div className="mt-3 pt-2.5 border-t border-slate-200/80">
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Cantidad <span className="text-[#E60000]">*</span>
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={cantValor}
                            onChange={(e) => cambiarCantidadProducto(prod, e.target.value)}
                            placeholder="Ej: 1"
                            className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono font-bold text-[#0a2958] bg-white outline-hidden ${
                              errCant
                                ? 'border-rose-400 bg-rose-50/40'
                                : 'border-slate-300 focus:border-[#0a2958]'
                            }`}
                          />
                          {errCant && (
                            <p className="text-[10px] text-[#E60000] font-semibold mt-1">
                              {errCant}
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
              {errores.cantidad && !errores.producto && (
                <p className="text-[11px] text-[#E60000] font-semibold mt-1.5">
                  {errores.cantidad}
                </p>
              )}
            </div>
          </div>

          {/* 3. MOTIVO, ENTREGA, CARTA Y NOTIFICACIÓN */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Calendar className="w-4 h-4 text-[#0a2958]" />
              <h3 className="text-sm font-extrabold text-[#0a2958] uppercase tracking-wider">
                3. MOTIVO, ENTREGA, CARTA Y NOTIFICACIÓN
              </h3>
            </div>

            {/* Motivo (lista desplegable), Fecha de Entrega y Semana */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              <div>
                <label
                  htmlFor="select-motivo-sc"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  Motivo <span className="text-[#E60000]">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <select
                      id="select-motivo-sc"
                      value={mostrandoInputMotivo ? '__AGREGAR__' : motivoSeleccionado}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__AGREGAR__') {
                          setMostrandoInputMotivo(true);
                        } else {
                          setMotivoSeleccionado(val);
                          setMostrandoInputMotivo(false);
                        }
                        setErrores((prev) => {
                          const next = { ...prev };
                          delete next.motivo;
                          return next;
                        });
                      }}
                      className={`w-full appearance-none pl-3.5 pr-9 py-2.5 text-xs rounded-xl border font-bold bg-white outline-hidden cursor-pointer truncate ${
                        errores.motivo
                          ? 'border-rose-400 bg-rose-50/40 text-slate-900'
                          : 'border-slate-300 focus:border-[#0a2958] text-slate-800'
                      }`}
                    >
                      <option value="">Seleccione un motivo…</option>
                      {opcionesMotivoVisibles.map((mot) => (
                        <option key={mot} value={mot}>
                          {mot}
                        </option>
                      ))}
                      <option value="__AGREGAR__">+ Agregar otro motivo…</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMostrandoInputMotivo((prev) => !prev);
                      setErrores((prev) => {
                        const next = { ...prev };
                        delete next.motivo;
                        return next;
                      });
                    }}
                    title="Agregar otro motivo"
                    aria-label="Agregar otro motivo"
                    className={`p-2.5 rounded-xl border transition cursor-pointer shrink-0 ${
                      mostrandoInputMotivo
                        ? 'bg-[#E60000]/10 text-[#E60000] border-[#E60000]/40'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:border-[#0a2958] hover:text-[#0a2958]'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {mostrandoInputMotivo && (
                  <div className="flex gap-2 pt-2">
                    <input
                      type="text"
                      value={nuevoMotivoInput}
                      onChange={(e) => {
                        setNuevoMotivoInput(e.target.value);
                        setErrores((prev) => {
                          const next = { ...prev };
                          delete next.motivo;
                          return next;
                        });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAgregarMotivoPersonalizado();
                        }
                      }}
                      placeholder="Escriba el nuevo motivo…"
                      className="flex-1 min-w-0 px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-[#0a2958] outline-hidden font-medium"
                    />
                    <button
                      type="button"
                      onClick={handleAgregarMotivoPersonalizado}
                      className="px-3.5 py-2 rounded-xl bg-[#0a2958] text-white text-xs font-bold hover:bg-[#0d346e] cursor-pointer shrink-0"
                    >
                      Agregar
                    </button>
                  </div>
                )}

                {errores.motivo && (
                  <p className="text-[11px] text-[#E60000] font-semibold mt-1">{errores.motivo}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="sc-fecha-entrega"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  Fecha Entrega <span className="text-[#E60000]">*</span>
                </label>
                <input
                  id="sc-fecha-entrega"
                  type="date"
                  value={fechaEntrega}
                  onChange={(e) => {
                    setFechaEntrega(e.target.value);
                    setErrores((prev) => {
                      const next = { ...prev };
                      delete next.fechaEntrega;
                      return next;
                    });
                  }}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border font-semibold outline-hidden ${
                    errores.fechaEntrega
                      ? 'border-rose-400 bg-rose-50/40'
                      : 'border-slate-300 focus:border-[#0a2958]'
                  }`}
                />
                {errores.fechaEntrega && (
                  <p className="text-[11px] text-[#E60000] font-semibold mt-1">
                    {errores.fechaEntrega}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Semana
                </label>
                <div className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-extrabold text-[#E60000] flex items-center justify-between gap-2">
                  <span className="shrink-0">Semana {semanaCalculada}</span>
                  <span className="text-[11px] font-medium text-slate-500 truncate">
                    {fechaEntrega ? formatDateSpanish(fechaEntrega) : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Correo de confirmación y Estado */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <div>
                <label
                  htmlFor="sc-correo-confirmacion"
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5"
                >
                  <Mail className="w-3.5 h-3.5 text-[#0a2958]" />
                  <span>Correo de confirmación</span>
                  <span className="text-[#E60000]">*</span>
                </label>
                <input
                  id="sc-correo-confirmacion"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={correoConfirmacion}
                  onChange={(e) => {
                    setCorreoConfirmacion(e.target.value);
                    setErrores((prev) => {
                      const next = { ...prev };
                      delete next.correoConfirmacion;
                      return next;
                    });
                  }}
                  placeholder="Ej. micorreo@gmail.com"
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border font-semibold outline-hidden ${
                    errores.correoConfirmacion
                      ? 'border-rose-400 bg-rose-50/40 text-slate-900'
                      : 'border-slate-300 focus:border-[#0a2958] text-slate-800'
                  }`}
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Ingrese un Correo de confirmación para recibir la respuesta de Solicitud.
                </p>
                {errores.correoConfirmacion && (
                  <p className="text-[11px] text-[#E60000] font-semibold mt-1">
                    {errores.correoConfirmacion}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="sc-estado"
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Estado</span>
                </label>
                <input
                  id="sc-estado"
                  type="text"
                  value={ESTADO_INICIAL_SC}
                  readOnly
                  tabIndex={-1}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-amber-200 bg-amber-50/70 font-extrabold text-amber-800 outline-hidden"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Toda solicitud registrada inicia en estado <strong>{ESTADO_INICIAL_SC}</strong>.
                </p>
              </div>
            </div>

            {/* Foto Carta + Modelo de carta descargable */}
            <div className="space-y-2.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <FileImage className="w-3.5 h-3.5 text-[#0a2958]" />
                <span>
                  Foto Carta <span className="text-[#E60000]">*</span>
                </span>
              </label>

              {/* Carta modelo para descargar, llenar, firmar y adjuntar */}
              <div className="p-3.5 rounded-xl border border-[#0a2958]/20 bg-[#0a2958]/[0.03] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-[#0a2958] text-white flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-[#0a2958]">
                      Modelo de carta de solicitud (Comunidad)
                    </p>
                    <p className="text-[11px] text-slate-600">
                      Descargue el formato modelo, llénelo, fírmelo y luego adjúntelo o tómele una foto abajo.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setCartaLightboxUrl(MODELO_CARTA_COMUNIDAD_PDF_URL)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-[#0a2958] text-xs font-bold shadow-xs cursor-pointer transition"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#E60000]" />
                    <span>Ver modelo</span>
                  </button>
                  <a
                    href={MODELO_CARTA_COMUNIDAD_PDF_URL}
                    download="Modelo_carta_solicitud_obsequio_de_flor_para_la_comunidad.pdf"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0a2958] hover:bg-[#0d346e] text-white text-xs font-bold shadow-xs transition"
                  >
                    <Download className="w-3.5 h-3.5 text-[#E60000]" />
                    <span>Descargar carta modelo (PDF)</span>
                  </a>
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border border-dashed space-y-3 ${
                  errores.fotoCarta
                    ? 'border-rose-400 bg-rose-50/40'
                    : 'border-slate-300 bg-slate-50/70'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-xs cursor-pointer transition">
                    <Upload className="w-3.5 h-3.5 text-[#0a2958]" />
                    <span>Adjuntar archivo</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleSeleccionArchivoCarta}
                      className="hidden"
                    />
                  </label>

                  <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#0a2958]/30 bg-[#0a2958]/5 hover:bg-[#0a2958]/10 text-[#0a2958] text-xs font-bold shadow-xs cursor-pointer transition">
                    <Camera className="w-3.5 h-3.5 text-[#E60000]" />
                    <span>Tomar foto (móvil)</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleSeleccionArchivoCarta}
                      className="hidden"
                    />
                  </label>
                </div>

                {errorFoto && (
                  <p className="text-[11px] text-[#E60000] font-semibold">{errorFoto}</p>
                )}

                {fotoCarta ? (
                  <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white border border-slate-200">
                    <div className="flex items-center gap-3 min-w-0">
                      {fotoCarta.mimeType === 'application/pdf' ? (
                        <div className="w-12 h-12 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-[#E60000] text-[10px] font-extrabold shrink-0">
                          PDF
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCartaLightboxUrl(fotoCarta.previewUrl)}
                          className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 shrink-0 cursor-pointer"
                          title="Ampliar vista"
                        >
                          <img
                            src={fotoCarta.previewUrl}
                            alt="Vista previa carta"
                            className="w-full h-full object-cover"
                          />
                        </button>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {fotoCarta.fileName}
                        </p>
                        <p className="text-[11px] text-emerald-700 font-semibold">
                          Carta lista ({fotoCarta.sizeKB} KB)
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFotoCarta(null)}
                      className="p-2 rounded-lg text-slate-400 hover:text-[#E60000] hover:bg-rose-50 cursor-pointer"
                      title="Quitar archivo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    Debe adjuntar una imagen o PDF de la carta, o tomar la foto directamente desde su dispositivo.
                  </p>
                )}
              </div>
              {errores.fotoCarta && (
                <p className="text-[11px] text-[#E60000] font-semibold">{errores.fotoCarta}</p>
              )}
            </div>

            {/* Notificado */}
            <div>
              <label
                htmlFor="sc-notificado"
                className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5"
              >
                <Mail className="w-3.5 h-3.5 text-[#0a2958]" />
                <span>Notificado (correo electrónico)</span>
                <span className="text-[#E60000]">*</span>
              </label>
              <input
                id="sc-notificado"
                type="text"
                inputMode="email"
                autoComplete="email"
                value={correoNotificacion}
                onChange={(e) => {
                  setCorreoNotificacion(e.target.value);
                  setErrores((prev) => {
                    const next = { ...prev };
                    delete next.correoNotificacion;
                    return next;
                  });
                }}
                placeholder="Ej. correo@mg-consultores.com (separe con coma si son varios)"
                className={`w-full px-3.5 py-2.5 text-xs rounded-xl border font-semibold outline-hidden ${
                  errores.correoNotificacion
                    ? 'border-rose-400 bg-rose-50/40 text-slate-900'
                    : 'border-slate-300 focus:border-[#0a2958] text-slate-800'
                }`}
              />
              {errores.correoNotificacion && (
                <p className="text-[11px] text-[#E60000] font-semibold mt-1">
                  {errores.correoNotificacion}
                </p>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              Campos con <span className="text-[#E60000] font-bold">*</span> son obligatorios.
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-[#0a2958] hover:bg-[#0d346e] text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-md transition cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Registrando…</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-[#E60000]" />
                  <span>
                    {productosSeleccionadosOrdenados.length > 1
                      ? `Registrar ${productosSeleccionadosOrdenados.length} productos`
                      : 'Registrar Solicitud Comunidad'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Historial: Registros en Solicitud Comunidad */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-[#0a2958]">
                Registros en Solicitud Comunidad ({solicitudesFiltradas.length})
              </h3>
              <p className="text-xs text-slate-500">
                Mostrando <strong className="text-slate-700">{solicitudesFiltradas.length}</strong> de{' '}
                <strong className="text-slate-700">{solicitudesComunidad.length}</strong> registros · Total:{' '}
                <strong className="font-mono tabular-nums text-[#0a2958]">
                  {totalRamosFiltrados} ramos
                </strong>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onRecargarSolicitudComunidad && (
                <button
                  type="button"
                  disabled={recargandoTabla}
                  onClick={async () => {
                    setRecargandoTabla(true);
                    try {
                      await onRecargarSolicitudComunidad();
                    } finally {
                      setRecargandoTabla(false);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${recargandoTabla ? 'animate-spin' : ''}`} />
                  <span>Actualizar</span>
                </button>
              )}
              <button
                type="button"
                onClick={exportarExcel}
                disabled={solicitudesFiltradas.length === 0}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar Excel</span>
              </button>
            </div>
          </div>

          {/* Filtros: Búsqueda, Semana y Producto */}
          <div className="flex flex-col md:flex-row md:items-center gap-2.5 pt-2 border-t border-slate-100">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busquedaTabla}
                onChange={(e) => setBusquedaTabla(e.target.value)}
                placeholder="Buscar por ID, usuario, entidad, motivo, sede o correo…"
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-[#0a2958] outline-hidden font-medium"
              />
            </div>

            <div className="flex items-center gap-2">
              <label
                htmlFor="filtro-semana-sc"
                className="text-xs font-bold text-slate-500 shrink-0"
              >
                Semana:
              </label>
              <select
                id="filtro-semana-sc"
                value={filtroSemana}
                onChange={(e) => setFiltroSemana(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:border-[#0a2958] outline-hidden font-semibold text-slate-800 cursor-pointer"
              >
                <option value="todas">Todas las semanas</option>
                {semanasDisponiblesTabla.map((sem) => (
                  <option key={sem} value={String(sem)}>
                    Semana {sem}
                  </option>
                ))}
              </select>
            </div>

            <div ref={dropdownProductoRef} className="relative flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 shrink-0">Producto:</span>
              <button
                type="button"
                onClick={() => setDropdownProductoAbierto((prev) => !prev)}
                aria-expanded={dropdownProductoAbierto}
                className="flex-1 md:flex-initial min-w-[175px] flex items-center justify-between gap-2 text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-[#0a2958]/40 focus:border-[#0a2958] outline-hidden font-semibold text-slate-800 cursor-pointer"
              >
                <span className="truncate">
                  {productosFiltro.length === 0
                    ? 'Todos los productos'
                    : productosFiltro.length <= 2
                    ? productosFiltro.join(', ')
                    : `${productosFiltro.length} productos`}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${
                    dropdownProductoAbierto ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {dropdownProductoAbierto && (
                <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-xl border border-slate-200 shadow-xl z-30 p-2 space-y-1">
                  <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100 mb-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Filtrar productos
                    </span>
                    {productosFiltro.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setProductosFiltro([])}
                        className="text-[11px] font-bold text-[#E60000] hover:underline cursor-pointer"
                      >
                        Todos
                      </button>
                    )}
                  </div>
                  {productosDisponiblesTabla.map((prod) => {
                    const seleccionado = productosFiltro.includes(prod);
                    return (
                      <button
                        key={prod}
                        type="button"
                        onClick={() => toggleProductoFiltro(prod)}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          seleccionado
                            ? 'bg-[#0a2958]/10 text-[#0a2958]'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{prod}</span>
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center ${
                            seleccionado
                              ? 'bg-[#0a2958] border-[#0a2958] text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {seleccionado && <Check className="w-3 h-3" />}
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
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-[#E60000] hover:bg-rose-50 inline-flex items-center gap-1 cursor-pointer shrink-0"
                title="Limpiar filtros"
              >
                <X className="w-3.5 h-3.5" />
                <span>Limpiar</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-[11px] uppercase text-slate-600 font-bold">
              <tr>
                <th className="py-2.5 px-3">Id</th>
                <th className="py-2.5 px-3">Fecha Solicitud</th>
                <th className="py-2.5 px-3">Usuario</th>
                <th className="py-2.5 px-3">Entidad</th>
                <th className="py-2.5 px-3">Motivo</th>
                <th className="py-2.5 px-3">Sede</th>
                <th className="py-2.5 px-3">Producto</th>
                <th className="py-2.5 px-3 text-right">Cantidad</th>
                <th className="py-2.5 px-3">Semana</th>
                <th className="py-2.5 px-3">Fecha Entrega</th>
                <th className="py-2.5 px-3">Correo de confirmación</th>
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 px-3">Foto Carta</th>
                <th className="py-2.5 px-3">Notificado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {solicitudesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-8 text-center text-slate-400">
                    {solicitudesComunidad.length === 0
                      ? 'No hay registros en Solicitud Comunidad todavía.'
                      : 'No hay registros que coincidan con los filtros seleccionados.'}
                  </td>
                </tr>
              ) : (
                solicitudesFiltradas.map((s, idx) => {
                  const estadoMostrar = s.estado || ESTADO_INICIAL_SC;
                  const notificadoMostrar = s.notificado || 'Registrada';
                  const estadoNormalizado = estadoMostrar.toLowerCase();
                  const esAprobado =
                    estadoNormalizado === 'aprobado' || estadoNormalizado === 'aprobada';
                  const esNoAprobado =
                    estadoNormalizado === 'no aprobado' || estadoNormalizado === 'no aprobada';
                  return (
                    <tr key={`${s.id}-${s.entidad}-${idx}`} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#0a2958] whitespace-nowrap">
                        {s.id}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">{s.fechaSolicitud}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-700">{s.usuario}</td>
                      <td className="py-2.5 px-3 font-bold text-[#0a2958]">{s.entidad}</td>
                      <td className="py-2.5 px-3">{s.motivo}</td>
                      <td className="py-2.5 px-3 font-bold whitespace-nowrap">{s.sede}</td>
                      <td className="py-2.5 px-3 font-semibold">{s.producto}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-[#0a2958]">
                        {s.cantidad}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-[#E60000]">
                        {s.semana ||
                          (s.fechaEntrega ? String(getISOWeekNumber(s.fechaEntrega)) : '—')}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">{s.fechaEntrega}</td>
                      <td
                        className="py-2.5 px-3 text-[#0a2958] font-medium max-w-[200px] truncate"
                        title={s.correoConfirmacion}
                      >
                        {s.correoConfirmacion || '—'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                            esAprobado
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : esNoAprobado
                              ? 'bg-rose-50 text-[#E60000] border-rose-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {estadoMostrar}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {s.fotoCarta ? (
                          <button
                            type="button"
                            onClick={() => setCartaLightboxUrl(s.fotoCarta!)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#0a2958]/10 hover:bg-[#0a2958]/15 text-[#0a2958] font-bold text-[11px] cursor-pointer"
                          >
                            <Eye className="w-3 h-3 text-[#E60000]" />
                            <span>Ver carta</span>
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td
                        className="py-2.5 px-3 font-semibold text-emerald-700 max-w-[220px] truncate"
                        title={notificadoMostrar}
                      >
                        {notificadoMostrar}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
