import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  FilePlus2,
  UserCheck,
  Sparkles,
  Calendar,
  MessageSquare,
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
  ExternalLink,
  Eye,
  Trash2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import * as XLSX from 'xlsx';
import { EspecialPersonal, TrabajadorMaestro } from '../types';
import { EmailNotificationResult, retryEmailEspecialesPersonalApi } from '../services/apiClient';
import { getTodayString, formatDateSpanish, getISOWeekNumber } from '../utils/dateUtils';

export interface FotoCartaUpload {
  base64: string;
  mimeType: string;
  fileName: string;
  previewUrl: string;
  sizeKB: number;
}

interface EspecialesPersonalFormProps {
  sesion: TrabajadorMaestro;
  maestro: TrabajadorMaestro[];
  solicitudesEspecialesPersonal: EspecialPersonal[];
  sheetsSupported: boolean;
  emailSupported?: boolean;
  especialesPersonalSheetActual?: string;
  needsAppsScriptUpdate?: boolean;
  onGuardarEspecialPersonal: (
    nueva: EspecialPersonal | EspecialPersonal[],
    correoNotificacion?: string,
    fotoCarta?: { base64: string; mimeType: string; fileName: string } | null
  ) => Promise<{
    success: boolean;
    error?: string;
    solicitud?: EspecialPersonal;
    solicitudes?: EspecialPersonal[];
    pendingAppsScriptUpdate?: boolean;
    especialesPersonalSheetName?: string;
    needsAppsScriptUpdate?: boolean;
    fotoCartaDriveError?: string;
    emailNotification?: EmailNotificationResult;
  }>;
  onRecargarEspecialPersonal?: () => Promise<void>;
  onRecargarMaestro?: () => Promise<void>;
  onCerrarSesion?: () => void;
}

const PRODUCTOS_EP = ['Rosa', 'Clavel', 'Alstroemeria', 'Bouquet'] as const;
const MOTIVOS_BASE_EP = ['Matrimonio', '15 años'] as const;

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

function normalizarDigitos(raw?: string): string {
  return String(raw || '').replace(/\D/g, '');
}

function obtenerNumSemanaEP(s: EspecialPersonal): number {
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
      fileName: file.name || `Carta_${Date.now()}.pdf`,
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
          fileName: (file.name ? file.name.replace(/\.[^.]+$/, '') : `Carta_${Date.now()}`) + '.jpg',
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

export const EspecialesPersonalForm: React.FC<EspecialesPersonalFormProps> = ({
  sesion,
  maestro,
  solicitudesEspecialesPersonal,
  sheetsSupported,
  emailSupported = true,
  especialesPersonalSheetActual = '',
  needsAppsScriptUpdate = false,
  onGuardarEspecialPersonal,
  onRecargarEspecialPersonal,
  onRecargarMaestro,
  onCerrarSesion,
}) => {
  const fechaSolicitud = getTodayString();

  // Beneficiario buscado en Maestro por Cédula (solo numérico)
  const [cedula, setCedula] = useState('');
  const [sincronizandoMaestro, setSincronizandoMaestro] = useState(false);

  // Productos y cantidades
  const [productosCantidades, setProductosCantidades] = useState<Record<string, string>>({});

  // Motivos con persistencia para opciones agregadas
  const [motivosPersonalizados, setMotivosPersonalizados] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sfo_motivos_especiales_personal_custom');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [motivoSeleccionado, setMotivoSeleccionado] = useState('');
  const [mostrandoInputMotivo, setMostrandoInputMotivo] = useState(false);
  const [nuevoMotivoInput, setNuevoMotivoInput] = useState('');

  // Fecha entrega, semana calculada, observación, foto carta, notificación
  const [fechaEntrega, setFechaEntrega] = useState(getTodayString());
  const [observacion, setObservacion] = useState('');
  const [correoNotificacion, setCorreoNotificacion] = useState('');
  const [fotoCarta, setFotoCarta] = useState<FotoCartaUpload | null>(null);
  const [errorFoto, setErrorFoto] = useState('');

  // Cámara web (para escritorio/laptop)
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  const [camaraError, setCamaraError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Envío y modal confirmación
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [solicitudesExitosas, setSolicitudesExitosas] = useState<EspecialPersonal[]>([]);
  const [emailResultado, setEmailResultado] = useState<EmailNotificationResult | null>(null);
  const [reintentandoCorreo, setReintentandoCorreo] = useState(false);
  const [avisoPendienteScript, setAvisoPendienteScript] = useState(false);
  const [avisoDriveFoto, setAvisoDriveFoto] = useState('');
  const [copiadoId, setCopiadoId] = useState(false);

  // Previsualización de carta en modal lightbox
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
        'sfo_motivos_especiales_personal_custom',
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

  // Limpiar cámara si se desmonta
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Coincidencia automática por Cédula contra Maestro
  const trabajadorPorCedula = useMemo(() => {
    const cedNorm = normalizarDigitos(cedula);
    if (!cedNorm) return null;
    return (
      maestro.find((t) => {
        const tc = normalizarDigitos(t.cedula);
        return tc && tc === cedNorm;
      }) || null
    );
  }, [cedula, maestro]);

  const maestroTieneCedulas = useMemo(
    () => maestro.some((t) => normalizarDigitos(t.cedula).length > 0),
    [maestro]
  );

  const nombreBeneficiario = trabajadorPorCedula?.nombre || '';
  const sedeBeneficiario = trabajadorPorCedula?.sede || '';

  const semanaCalculada = useMemo(() => {
    return fechaEntrega ? getISOWeekNumber(fechaEntrega) : getISOWeekNumber(fechaSolicitud);
  }, [fechaEntrega, fechaSolicitud]);

  const siguienteNumeroId = useMemo(() => {
    const year = new Date().getFullYear();
    let maxNum = 0;
    for (const s of solicitudesEspecialesPersonal) {
      const m = String(s.id || '').match(/^SEP-(\d{4})-(\d+)$/i);
      if (m && Number(m[1]) === year) {
        maxNum = Math.max(maxNum, Number(m[2]));
      }
    }
    return Math.max(maxNum + 1, solicitudesEspecialesPersonal.length + 1);
  }, [solicitudesEspecialesPersonal]);

  const productosSeleccionadosOrdenados = useMemo(
    () => PRODUCTOS_EP.filter((p) => Object.prototype.hasOwnProperty.call(productosCantidades, p)),
    [productosCantidades]
  );

  const totalRamosSeleccionados = useMemo(() => {
    return productosSeleccionadosOrdenados.reduce((acc, prod) => {
      const n = Number(productosCantidades[prod]);
      return acc + (!Number.isNaN(n) && n > 0 ? Math.floor(n) : 0);
    }, 0);
  }, [productosSeleccionadosOrdenados, productosCantidades]);

  const opcionesMotivoVisibles = useMemo(() => {
    const set = new Set<string>([...MOTIVOS_BASE_EP, ...motivosPersonalizados]);
    return Array.from(set);
  }, [motivosPersonalizados]);

  const motivoFinal =
    mostrandoInputMotivo && nuevoMotivoInput.trim()
      ? nuevoMotivoInput.trim()
      : motivoSeleccionado.trim();

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

  const abrirCamaraWeb = async () => {
    setCamaraError('');
    setErrorFoto('');
    setCamaraAbierta(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCamaraError(
          'El navegador no habilita cámara en vivo en este contexto. Use el botón "Tomar Foto" o "Adjuntar Carta".'
        );
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      setCamaraError(
        err?.message ||
          'No se pudo acceder a la cámara. Verifique los permisos o use "Adjuntar Carta".'
      );
    }
  };

  const cerrarCamaraWeb = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCamaraAbierta(false);
    setCamaraError('');
  };

  const capturarDesdeCamaraWeb = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const maxDim = 1280;
    let width = video.videoWidth;
    let height = video.videoHeight;
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
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    const base64 = dataUrl.split(',')[1] || '';
    setFotoCarta({
      base64,
      mimeType: 'image/jpeg',
      fileName: `Carta_Camara_${Date.now()}.jpg`,
      previewUrl: dataUrl,
      sizeKB: Math.round((base64.length * 3) / 4 / 1024),
    });
    setErrores((prev) => {
      const next = { ...prev };
      delete next.fotoCarta;
      return next;
    });
    cerrarCamaraWeb();
  };

  const validarFormulario = (): boolean => {
    const errs: Record<string, string> = {};
    const cedNorm = normalizarDigitos(cedula);

    if (!cedNorm) {
      errs.cedula = 'Digite el número de cédula del colaborador.';
    } else if (!trabajadorPorCedula) {
      errs.cedula = 'Esta cédula no figura en el Maestro. Verifique o sincronice el Maestro.';
    }

    if (productosSeleccionadosOrdenados.length === 0) {
      errs.producto = 'Seleccione al menos un producto (Rosa, Clavel, Alstroemeria o Bouquet).';
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

    const parsedCorreos = parsearListaCorreos(correoNotificacion);
    if (!correoNotificacion.trim()) {
      errs.correoNotificacion = 'Ingrese al menos un correo electrónico para notificar.';
    } else if (parsedCorreos.invalidos.length > 0 || parsedCorreos.correos.length === 0) {
      errs.correoNotificacion =
        parsedCorreos.invalidos.length > 0
          ? `Correo(s) con formato inválido: ${parsedCorreos.invalidos.join(', ')}`
          : 'Ingrese un correo válido (sepárelos por coma si son varios).';
    }

    setErrores(errs);
    return Object.keys(errs).length === 0;
  };

  const limpiarFormulario = () => {
    setCedula('');
    setProductosCantidades({});
    setMotivoSeleccionado('');
    setMostrandoInputMotivo(false);
    setNuevoMotivoInput('');
    setFechaEntrega(getTodayString());
    setObservacion('');
    setCorreoNotificacion('');
    setFotoCarta(null);
    setErrorFoto('');
    setErrores({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validarFormulario() || !trabajadorPorCedula) return;

    setIsSubmitting(true);
    setErrores({});

    try {
      // Si había un motivo nuevo escrito sin haber presionado "Agregar", guardarlo
      if (mostrandoInputMotivo && nuevoMotivoInput.trim()) {
        const mLimpio = nuevoMotivoInput.trim();
        if (!opcionesMotivoVisibles.some((m) => m.toLowerCase() === mLimpio.toLowerCase())) {
          setMotivosPersonalizados((prev) => [...prev, mLimpio]);
        }
      }

      const parsedCorreos = parsearListaCorreos(correoNotificacion);
      const correoLimpio = parsedCorreos.normalizado;
      const year = new Date().getFullYear();
      const semanaStr = String(semanaCalculada);

      const listaSolicitudes: EspecialPersonal[] = productosSeleccionadosOrdenados.map((prod, idx) => ({
        id: `SEP-${year}-${String(siguienteNumeroId + idx).padStart(3, '0')}`,
        fechaSolicitud,
        usuario: sesion.nombre.trim(),
        cedula: normalizarDigitos(cedula),
        nombre: trabajadorPorCedula.nombre,
        sede: trabajadorPorCedula.sede,
        producto: prod,
        cantidad: Math.max(1, Math.floor(Number(productosCantidades[prod]) || 1)),
        motivo: motivoFinal,
        semana: semanaStr,
        fechaEntrega,
        observacion: observacion.trim(),
        fotoCarta: '',
        notificado: correoLimpio || 'Registrada',
        estado: correoLimpio || 'Registrada',
        creadoEn: Date.now() + idx,
      }));

      const res = await onGuardarEspecialPersonal(
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
          general: res.error || 'No se pudo guardar en la hoja Especiales Personal.',
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
      solicitudesExitosas[0]?.estado ||
      '';
    if (!correoDestino || !correoDestino.includes('@')) return;

    setReintentandoCorreo(true);
    try {
      const resMail = await retryEmailEspecialesPersonalApi(solicitudesExitosas, correoDestino);
      setEmailResultado(resMail);
    } finally {
      setReintentandoCorreo(false);
    }
  };

  // Opciones dinámicas de filtros tabla
  const semanasDisponiblesTabla = useMemo(() => {
    const set = new Set<number>();
    for (const s of solicitudesEspecialesPersonal) {
      const num = obtenerNumSemanaEP(s);
      if (num > 0) set.add(num);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [solicitudesEspecialesPersonal]);

  const productosDisponiblesTabla = useMemo(() => {
    const set = new Set<string>(PRODUCTOS_EP);
    for (const s of solicitudesEspecialesPersonal) {
      const p = String(s.producto || '').trim();
      if (p) set.add(p);
    }
    return Array.from(set);
  }, [solicitudesEspecialesPersonal]);

  const toggleProductoFiltro = (prod: string) => {
    setProductosFiltro((prev) =>
      prev.includes(prod) ? prev.filter((p) => p !== prod) : [...prev, prod]
    );
  };

  const solicitudesFiltradas = useMemo(() => {
    const q = busquedaTabla.toLowerCase().trim();
    return solicitudesEspecialesPersonal.filter((s) => {
      if (filtroSemana !== 'todas') {
        const sem = obtenerNumSemanaEP(s);
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
        (s.cedula || '').toLowerCase().includes(q) ||
        s.nombre.toLowerCase().includes(q) ||
        s.sede.toLowerCase().includes(q) ||
        s.producto.toLowerCase().includes(q) ||
        s.motivo.toLowerCase().includes(q) ||
        (s.notificado || '').toLowerCase().includes(q)
      );
    });
  }, [solicitudesEspecialesPersonal, busquedaTabla, filtroSemana, productosFiltro]);

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
      Cédula: s.cedula,
      Nombre: s.nombre,
      Sede: s.sede,
      Producto: s.producto,
      Cantidad: s.cantidad,
      Motivo: s.motivo,
      Semana: s.semana,
      'Fecha Entrega': s.fechaEntrega,
      Observación: s.observacion,
      'Foto Carta': s.fotoCarta || '',
      Notificado: s.notificado || s.estado || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Especiales Personal');
    XLSX.writeFile(wb, `Especiales_Personal_${getTodayString()}.xlsx`);
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

      {/* Modal Cámara Web */}
      {camaraAbierta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#E60000]" />
                <h3 className="text-sm font-extrabold text-[#0a2958]">
                  Tomar Foto de Carta Autorizada
                </h3>
              </div>
              <button
                type="button"
                onClick={cerrarCamaraWeb}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {camaraError ? (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{camaraError}</span>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden bg-slate-900 border border-slate-300 aspect-video flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={cerrarCamaraWeb}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              {!camaraError && (
                <button
                  type="button"
                  onClick={capturarDesdeCamaraWeb}
                  className="px-5 py-2 rounded-xl bg-[#0a2958] hover:bg-[#0d346e] text-white text-xs font-extrabold inline-flex items-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-[#E60000]" />
                  <span>Capturar Foto</span>
                </button>
              )}
            </div>
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
                <strong>Especiales Personal</strong>.
              </p>
            </div>

            {avisoPendienteScript && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs text-left flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  Guardado en respaldo local. Para escribir en la hoja <strong>Especiales Personal</strong>, el administrador debe actualizar el Apps Script e implementar una <strong>Nueva versión</strong>.
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
                <span className="text-slate-500">Cédula Beneficiario:</span>
                <span className="font-mono font-bold text-[#0a2958]">{primeraExitosa.cedula}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nombre:</span>
                <span className="font-bold text-slate-900 text-right">{primeraExitosa.nombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sede:</span>
                <span className="font-bold text-slate-900">{primeraExitosa.sede}</span>
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
              <div className="flex justify-between gap-3">
                <span className="text-slate-500 shrink-0">Notificado:</span>
                <span className="font-bold text-emerald-700 break-all text-right">
                  {primeraExitosa.notificado || primeraExitosa.estado || 'Registrada'}
                </span>
              </div>
              {primeraExitosa.observacion && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 block mb-0.5">Observación:</span>
                  <p className="text-slate-800 font-medium">{primeraExitosa.observacion}</p>
                </div>
              )}
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

      {/* Formulario Principal ESPECIALES PERSONAL */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0a2958]/10 flex items-center justify-center">
              <FilePlus2 className="w-5 h-5 text-[#E60000]" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#0a2958] uppercase tracking-wide">
                ESPECIALES PERSONAL
              </h2>
              <p className="text-[11px] text-slate-500">
                Solicitudes especiales por trabajador con carta autorizada
              </p>
            </div>
          </div>

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

        {!sheetsSupported || needsAppsScriptUpdate ? (
          <div className="mx-6 mt-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              La hoja <strong>Especiales Personal</strong> aún no está activa en el webhook de Google Apps Script
              {especialesPersonalSheetActual ? ` (${especialesPersonalSheetActual})` : ''}. Para sincronizar directamente con Google Drive, el administrador debe copiar el código actualizado desde <strong>Administración → Google Drive</strong>, ejecutar <code>autorizarEnvioCorreos</code> e implementar una <strong>Nueva versión</strong>.
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
          {/* 1. COLABORADOR POR CÉDULA (DESDE MAESTRO) */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#0a2958]" />
                <h3 className="text-sm font-extrabold text-[#0a2958] uppercase tracking-wider">
                  1. DATOS DEL COLABORADOR
                </h3>
              </div>

              {onRecargarMaestro && (
                <button
                  type="button"
                  disabled={sincronizandoMaestro}
                  onClick={async () => {
                    setSincronizandoMaestro(true);
                    try {
                      await onRecargarMaestro();
                    } finally {
                      setSincronizandoMaestro(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#0a2958]/20 bg-[#0a2958]/5 hover:bg-[#0a2958]/10 text-[#0a2958] text-[11px] font-bold cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3 h-3 ${sincronizandoMaestro ? 'animate-spin' : ''}`} />
                  <span>Sincronizar Maestro</span>
                </button>
              )}
            </div>

            {!maestroTieneCedulas && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Aún no se detectan números de <strong>Cédula</strong> cargados en el Maestro sincronizado. Complete la columna <strong>Cédula</strong> en la hoja <em>Maestro</em> de Drive (o importe la plantilla actualizada) y presione <strong>Sincronizar Maestro</strong>.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="ep-cedula"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  Cédula <span className="text-[#E60000]">*</span>
                </label>
                <input
                  id="ep-cedula"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={cedula}
                  onChange={(e) => {
                    const soloDigitos = e.target.value.replace(/\D/g, '');
                    setCedula(soloDigitos);
                    setErrores((prev) => {
                      const next = { ...prev };
                      delete next.cedula;
                      return next;
                    });
                  }}
                  placeholder="Digite el número de cédula"
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border font-mono font-bold outline-hidden ${
                    errores.cedula
                      ? 'border-rose-400 bg-rose-50/40 text-slate-900'
                      : trabajadorPorCedula
                      ? 'border-emerald-400 bg-emerald-50/30 text-[#0a2958]'
                      : 'border-slate-300 focus:border-[#0a2958] text-slate-900'
                  }`}
                />
                {errores.cedula && (
                  <p className="text-[11px] text-[#E60000] font-semibold mt-1">{errores.cedula}</p>
                )}
                {!errores.cedula && cedula && !trabajadorPorCedula && (
                  <p className="text-[11px] text-amber-700 font-semibold mt-1">
                    Cédula no encontrada en el Maestro actual.
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="ep-nombre"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  Nombre
                </label>
                <input
                  id="ep-nombre"
                  type="text"
                  value={nombreBeneficiario}
                  readOnly
                  tabIndex={-1}
                  placeholder="Se completa automáticamente"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-800 outline-hidden"
                />
              </div>

              <div>
                <label
                  htmlFor="ep-sede"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  Sede
                </label>
                <input
                  id="ep-sede"
                  type="text"
                  value={sedeBeneficiario}
                  readOnly
                  tabIndex={-1}
                  placeholder="Se completa automáticamente"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-bold text-[#0a2958] outline-hidden"
                />
              </div>
            </div>

            {trabajadorPorCedula && (
              <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Colaborador identificado: <strong>{trabajadorPorCedula.nombre}</strong> ·{' '}
                  {trabajadorPorCedula.sede} (Cód. {trabajadorPorCedula.codigo})
                </span>
              </div>
            )}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {PRODUCTOS_EP.map((prod) => {
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

            {/* Motivo */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-700">
                Motivo <span className="text-[#E60000]">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {opcionesMotivoVisibles.map((mot) => (
                  <button
                    key={mot}
                    type="button"
                    onClick={() => {
                      setMotivoSeleccionado(mot);
                      setMostrandoInputMotivo(false);
                      setErrores((prev) => {
                        const next = { ...prev };
                        delete next.motivo;
                        return next;
                      });
                    }}
                    className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      !mostrandoInputMotivo && motivoSeleccionado === mot
                        ? 'bg-[#0a2958] text-white border-[#0a2958] shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-[#0a2958]/40'
                    }`}
                  >
                    {mot}
                  </button>
                ))}
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
                  className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer ${
                    mostrandoInputMotivo
                      ? 'bg-[#E60000]/10 text-[#E60000] border-[#E60000]/40'
                      : 'bg-slate-50 text-slate-700 border-dashed border-slate-300 hover:border-[#0a2958]'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar otro motivo</span>
                </button>
              </div>

              {mostrandoInputMotivo && (
                <div className="flex flex-col sm:flex-row gap-2 max-w-md pt-1">
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
                    className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:border-[#0a2958] outline-hidden font-medium"
                  />
                  <button
                    type="button"
                    onClick={handleAgregarMotivoPersonalizado}
                    className="px-4 py-2 rounded-xl bg-[#0a2958] text-white text-xs font-bold hover:bg-[#0d346e] cursor-pointer"
                  >
                    Agregar
                  </button>
                </div>
              )}

              {errores.motivo && (
                <p className="text-[11px] text-[#E60000] font-semibold">{errores.motivo}</p>
              )}
            </div>

            {/* Fecha de Entrega & Semana calculada */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="ep-fecha-entrega"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  Fecha Entrega <span className="text-[#E60000]">*</span>
                </label>
                <input
                  id="ep-fecha-entrega"
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
                <div className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-extrabold text-[#E60000] flex items-center justify-between">
                  <span>Semana {semanaCalculada}</span>
                  <span className="text-[11px] font-medium text-slate-500">
                    {fechaEntrega ? formatDateSpanish(fechaEntrega) : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Foto Carta */}
            <div className="space-y-2.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <FileImage className="w-3.5 h-3.5 text-[#0a2958]" />
                <span>Foto Carta (carta autorizada)</span>
              </label>

              <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 space-y-3">
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

                  <button
                    type="button"
                    onClick={abrirCamaraWeb}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0a2958] hover:bg-[#0d346e] text-white text-xs font-bold shadow-xs cursor-pointer transition"
                  >
                    <Camera className="w-3.5 h-3.5 text-[#E60000]" />
                    <span>Cámara en vivo</span>
                  </button>
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
                    Puede adjuntar una imagen o PDF de la carta autorizada, o tomar la foto directamente desde su dispositivo o cámara web.
                  </p>
                )}
              </div>
            </div>

            {/* Observación */}
            <div>
              <label
                htmlFor="ep-observacion"
                className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                <span>Observación</span>
              </label>
              <textarea
                id="ep-observacion"
                rows={2}
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                placeholder="Escriba observaciones o detalles adicionales…"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:border-[#0a2958] outline-hidden font-medium resize-y"
              />
            </div>

            {/* Notificado */}
            <div>
              <label
                htmlFor="ep-notificado"
                className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5"
              >
                <Mail className="w-3.5 h-3.5 text-[#0a2958]" />
                <span>Notificado (correo electrónico)</span>
                <span className="text-[#E60000]">*</span>
              </label>
              <input
                id="ep-notificado"
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
                placeholder="Ej. correo1@mg-consultores.com, correo2@mg-consultores.com"
                className={`w-full px-3.5 py-2.5 text-xs rounded-xl border font-semibold outline-hidden ${
                  errores.correoNotificacion
                    ? 'border-rose-400 bg-rose-50/40 text-slate-900'
                    : 'border-slate-300 focus:border-[#0a2958] text-slate-800'
                }`}
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Puede ingresar varios correos separados por coma (<code className="font-mono font-bold text-slate-700">,</code>). Todos recibirán la notificación completa.
              </p>
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
                      : 'Registrar Especiales Personal'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Historial: Registros en Especiales Personal */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-[#0a2958]">
                Registros en Especiales Personal ({solicitudesFiltradas.length})
              </h3>
              <p className="text-xs text-slate-500">
                Mostrando <strong className="text-slate-700">{solicitudesFiltradas.length}</strong> de{' '}
                <strong className="text-slate-700">{solicitudesEspecialesPersonal.length}</strong> registros · Total:{' '}
                <strong className="font-mono tabular-nums text-[#0a2958]">
                  {totalRamosFiltrados} ramos
                </strong>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onRecargarEspecialPersonal && (
                <button
                  type="button"
                  disabled={recargandoTabla}
                  onClick={async () => {
                    setRecargandoTabla(true);
                    try {
                      await onRecargarEspecialPersonal();
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
                placeholder="Buscar por ID, usuario, cédula, nombre, sede, motivo o correo…"
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-[#0a2958] outline-hidden font-medium"
              />
            </div>

            <div className="flex items-center gap-2">
              <label
                htmlFor="filtro-semana-ep"
                className="text-xs font-bold text-slate-500 shrink-0"
              >
                Semana:
              </label>
              <select
                id="filtro-semana-ep"
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
                <th className="py-2.5 px-3">Cédula</th>
                <th className="py-2.5 px-3">Nombre</th>
                <th className="py-2.5 px-3">Sede</th>
                <th className="py-2.5 px-3">Producto</th>
                <th className="py-2.5 px-3 text-right">Cantidad</th>
                <th className="py-2.5 px-3">Motivo</th>
                <th className="py-2.5 px-3">Semana</th>
                <th className="py-2.5 px-3">Fecha Entrega</th>
                <th className="py-2.5 px-3">Observación</th>
                <th className="py-2.5 px-3">Foto Carta</th>
                <th className="py-2.5 px-3">Notificado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {solicitudesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-8 text-center text-slate-400">
                    {solicitudesEspecialesPersonal.length === 0
                      ? 'No hay registros en Especiales Personal todavía.'
                      : 'No hay registros que coincidan con los filtros seleccionados.'}
                  </td>
                </tr>
              ) : (
                solicitudesFiltradas.map((s, idx) => {
                  const notificadoMostrar = s.notificado || s.estado || 'Registrada';
                  return (
                    <tr key={`${s.id}-${s.cedula}-${idx}`} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#0a2958] whitespace-nowrap">
                        {s.id}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">{s.fechaSolicitud}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-700">{s.usuario}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-[#0a2958]">
                        {s.cedula}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{s.nombre}</td>
                      <td className="py-2.5 px-3 font-bold whitespace-nowrap">{s.sede}</td>
                      <td className="py-2.5 px-3 font-semibold">{s.producto}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-[#0a2958]">
                        {s.cantidad}
                      </td>
                      <td className="py-2.5 px-3">{s.motivo}</td>
                      <td className="py-2.5 px-3 font-bold text-[#E60000]">
                        {s.semana ||
                          (s.fechaEntrega ? String(getISOWeekNumber(s.fechaEntrega)) : '—')}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">{s.fechaEntrega}</td>
                      <td className="py-2.5 px-3 max-w-xs truncate" title={s.observacion}>
                        {s.observacion || '—'}
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
