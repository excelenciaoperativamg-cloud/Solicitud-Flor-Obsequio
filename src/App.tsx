/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Navbar } from './components/Navbar';
import { SolicitudForm } from './components/SolicitudForm';
import { SolicitudIntExtForm } from './components/SolicitudIntExtForm';
import { EspecialesPersonalForm } from './components/EspecialesPersonalForm';
import { SolicitudComunidadForm } from './components/SolicitudComunidadForm';
import { IngresosSeleccionForm } from './components/IngresosSeleccionForm';
import { ObsequioVisitantesForm } from './components/ObsequioVisitantesForm';
import { SolicitudesTable } from './components/SolicitudesTable';
import { MaestroTrabajadores } from './components/MaestroTrabajadores';
import { PermisosFormulariosPanel } from './components/PermisosFormulariosPanel';
import { LoginCodigo } from './components/LoginCodigo';
import { DriveConfigModal } from './components/DriveConfigModal';
import { SidebarNavegacion, TabNavegacion } from './components/SidebarNavegacion';
import {
  SolicitudFlor,
  SolicitudIntExt,
  EspecialPersonal,
  SolicitudComunidad,
  IngresoSeleccion,
  ObsequioVisitante,
  TrabajadorMaestro,
  FormularioPermisoKey,
  PermisosFormulariosMap,
} from './types';
import {
  TRABAJADORES_INICIALES,
} from './data/initialData';
import {
  initAuth,
  getAccessToken,
} from './services/firebaseAuth';
import {
  fetchSolicitudesApi,
  createSolicitudApi,
  fetchSolicitudesIntExtApi,
  createSolicitudIntExtApi,
  fetchEspecialesPersonalApi,
  createEspecialesPersonalApi,
  updateEstadoEspecialPersonalApi,
  EstadoEspecialPersonal,
  fetchSolicitudComunidadApi,
  createSolicitudComunidadApi,
  fetchIngresosSeleccionApi,
  createIngresosSeleccionApi,
  fetchObsequioVisitantesApi,
  createObsequioVisitantesApi,
  fetchPermisosFormulariosApi,
  savePermisosFormulariosApi,
  restoreDefaultPermisosApi,
  getPermisosLocalCache,
  fetchMaestroApi,
  fetchMaestroConEstadoApi,
  getMaestroLocalCache,
  addTrabajadorApi,
  importMaestroBulkApi,
  getDriveConfigApi,
  updateDriveConfigApi,
  testDriveWebhookApi,
  syncMaestroFromDriveApi,
  DriveConfig,
  EmailNotificationResult,
} from './services/apiClient';
import {
  getOrCreateSpreadsheet,
  fetchMaestroFromDrive,
} from './services/googleDriveSheets';
import {
  esAdministradorSistema,
  puedeVerHojaMaestro,
  puedeVerSolicitudPersonal,
  puedeVerResumenSolicitud,
  puedeVerSolicitudIntExt,
  puedeVerEspecialesPersonal,
  puedeVerSolicitudComunidad,
  puedeVerIngresosSeleccion,
  puedeVerObsequioVisitantes,
  setPermisosFormulariosCache,
} from './utils/roles';

function combinarMaestroLista(
  base: TrabajadorMaestro[],
  actualizados: TrabajadorMaestro[]
): TrabajadorMaestro[] {
  const mapa = new Map<string, TrabajadorMaestro>();
  for (const t of base) {
    mapa.set(t.codigo.trim().toUpperCase(), t);
  }
  for (const t of actualizados) {
    mapa.set(t.codigo.trim().toUpperCase(), t);
  }
  return Array.from(mapa.values());
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabNavegacion>('formulario');
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);

  // Estados de autenticación Google (opcional para administrador)
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [spreadsheetLink, setSpreadsheetLink] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);

  // Configuración de Google Drive automática (Webhook sin pedir correo)
  const [driveConfig, setDriveConfig] = useState<DriveConfig>({
    webhookUrl: 'https://script.google.com/macros/s/AKfycbyombeZp7panywXAoIq8Q0cSjliwnOoPt3lUlH4R-h8YAoOvsCZNZrW7shziRJl92E7/exec',
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1ecAKLTKJ-qrIWMGI5Rk1SpxhlTpfY6k5Gkyl4b5efzA/edit',
    syncEnabled: true,
  });
  const [sesion, setSesion] = useState<TrabajadorMaestro | null>(null);

  // Datos principales (siembra inmediata con caché local del último maestro sincronizado)
  const [maestro, setMaestro] = useState<TrabajadorMaestro[]>(() =>
    combinarMaestroLista(TRABAJADORES_INICIALES, getMaestroLocalCache())
  );
  const [sincronizandoMaestroInicial, setSincronizandoMaestroInicial] = useState<boolean>(true);
  const [maestroSincronizadoDrive, setMaestroSincronizadoDrive] = useState<boolean>(false);
  const maestroSyncInFlightRef = React.useRef<Promise<TrabajadorMaestro[]> | null>(null);

  const [solicitudes, setSolicitudes] = useState<SolicitudFlor[]>([]);
  const [solicitudesIntExt, setSolicitudesIntExt] = useState<SolicitudIntExt[]>([]);
  const [intExtSheetsSupported, setIntExtSheetsSupported] = useState<boolean>(true);
  const [intExtEmailSupported, setIntExtEmailSupported] = useState<boolean>(true);
  const [intExtSheetActual, setIntExtSheetActual] = useState<string>('');
  const [intExtSheetMismatch, setIntExtSheetMismatch] = useState<boolean>(false);

  const [solicitudesEspecialesPersonal, setSolicitudesEspecialesPersonal] = useState<EspecialPersonal[]>([]);
  const [epSheetsSupported, setEpSheetsSupported] = useState<boolean>(true);
  const [epEmailSupported, setEpEmailSupported] = useState<boolean>(true);
  const [epSheetActual, setEpSheetActual] = useState<string>('');
  const [epNeedsAppsScriptUpdate, setEpNeedsAppsScriptUpdate] = useState<boolean>(false);

  const [solicitudesComunidad, setSolicitudesComunidad] = useState<SolicitudComunidad[]>([]);
  const [scSheetsSupported, setScSheetsSupported] = useState<boolean>(true);
  const [scEmailSupported, setScEmailSupported] = useState<boolean>(true);
  const [scSheetActual, setScSheetActual] = useState<string>('');
  const [scNeedsAppsScriptUpdate, setScNeedsAppsScriptUpdate] = useState<boolean>(false);

  const [ingresosSeleccion, setIngresosSeleccion] = useState<IngresoSeleccion[]>([]);
  const [isSheetsSupported, setIsSheetsSupported] = useState<boolean>(true);
  const [isEmailSupported, setIsEmailSupported] = useState<boolean>(true);
  const [isSheetActual, setIsSheetActual] = useState<string>('');
  const [isNeedsAppsScriptUpdate, setIsNeedsAppsScriptUpdate] = useState<boolean>(false);

  const [obsequioVisitantes, setObsequioVisitantes] = useState<ObsequioVisitante[]>([]);
  const [ovSheetsSupported, setOvSheetsSupported] = useState<boolean>(true);
  const [ovEmailSupported, setOvEmailSupported] = useState<boolean>(true);
  const [ovSheetActual, setOvSheetActual] = useState<string>('');
  const [ovNeedsAppsScriptUpdate, setOvNeedsAppsScriptUpdate] = useState<boolean>(false);

  const [permisosFormularios, setPermisosFormularios] = useState<PermisosFormulariosMap>(() => {
    const inicial = getPermisosLocalCache();
    setPermisosFormulariosCache(inicial);
    return inicial;
  });
  const [permisosSheetsSupported, setPermisosSheetsSupported] = useState<boolean>(false);
  const [permisosNeedsAppsScriptUpdate, setPermisosNeedsAppsScriptUpdate] = useState<boolean>(false);

  const esAdminSistema = esAdministradorSistema(sesion);
  const puedeVerMaestro = puedeVerHojaMaestro(sesion);
  const puedeVerPersonal = puedeVerSolicitudPersonal(sesion, permisosFormularios);
  const puedeVerResumen = puedeVerResumenSolicitud(sesion, permisosFormularios);
  const puedeVerIntExt = puedeVerSolicitudIntExt(sesion, permisosFormularios);
  const puedeVerEp = puedeVerEspecialesPersonal(sesion, permisosFormularios);
  const puedeVerComunidad = puedeVerSolicitudComunidad(sesion, permisosFormularios);
  const puedeVerIngresos = puedeVerIngresosSeleccion(sesion, permisosFormularios);
  const puedeVerVisitantes = puedeVerObsequioVisitantes(sesion, permisosFormularios);

  const obtenerPrimeraTabPermitida = React.useCallback((): TabNavegacion => {
    if (puedeVerPersonal) return 'formulario';
    if (puedeVerEp) return 'especiales-personal';
    if (puedeVerIntExt) return 'int-ext';
    if (puedeVerIngresos) return 'ingresos-seleccion';
    if (puedeVerVisitantes) return 'obsequio-visitantes';
    if (puedeVerComunidad) return 'solicitud-comunidad';
    if (puedeVerResumen) return 'solicitudes';
    return 'formulario';
  }, [
    puedeVerPersonal,
    puedeVerEp,
    puedeVerIntExt,
    puedeVerComunidad,
    puedeVerIngresos,
    puedeVerVisitantes,
    puedeVerResumen,
  ]);

  // Mantener actualizada la sesión activa (cargo/sede/cédula) cada vez que se sincroniza el Maestro
  useEffect(() => {
    if (!sesion || maestro.length === 0) return;
    const codigoSesion = sesion.codigo.trim().toUpperCase();
    const actualizado = maestro.find(
      (t) => t.codigo.trim().toUpperCase() === codigoSesion
    );
    if (!actualizado) return;
    if (
      actualizado.nombre !== sesion.nombre ||
      (actualizado.cargo || '') !== (sesion.cargo || '') ||
      actualizado.sede !== sesion.sede ||
      (actualizado.area || '') !== (sesion.area || '') ||
      (actualizado.cedula || '') !== (sesion.cedula || '')
    ) {
      setSesion(actualizado);
    }
  }, [maestro, sesion]);

  // Redirigir a la primera pestaña permitida si el usuario no tiene permiso para la pestaña actual
  useEffect(() => {
    if (!sesion) return;
    const tienePermisoActual =
      (activeTab === 'formulario' && puedeVerPersonal) ||
      (activeTab === 'int-ext' && puedeVerIntExt) ||
      (activeTab === 'especiales-personal' && puedeVerEp) ||
      (activeTab === 'solicitud-comunidad' && puedeVerComunidad) ||
      (activeTab === 'ingresos-seleccion' && puedeVerIngresos) ||
      (activeTab === 'obsequio-visitantes' && puedeVerVisitantes) ||
      (activeTab === 'solicitudes' && puedeVerResumen) ||
      (activeTab === 'maestro' && puedeVerMaestro) ||
      (activeTab === 'permisos' && esAdminSistema);

    if (!tienePermisoActual) {
      const destino = obtenerPrimeraTabPermitida();
      if (destino !== activeTab) {
        setActiveTab(destino);
      }
    }
  }, [
    sesion,
    esAdminSistema,
    puedeVerPersonal,
    puedeVerResumen,
    puedeVerMaestro,
    puedeVerIntExt,
    puedeVerEp,
    puedeVerComunidad,
    puedeVerIngresos,
    puedeVerVisitantes,
    activeTab,
    obtenerPrimeraTabPermitida,
  ]);

  // Mostrar toast temporal
  const mostrarToast = (mensaje: string) => {
    setSyncToast(mensaje);
    setTimeout(() => {
      setSyncToast(null);
    }, 4500);
  };

  // Sincronización deduplicada y prioritaria del Maestro
  const sincronizarMaestroPrioritario = React.useCallback(async (): Promise<TrabajadorMaestro[]> => {
    if (maestroSyncInFlightRef.current) {
      return maestroSyncInFlightRef.current;
    }

    const promesa = (async () => {
      setSincronizandoMaestroInicial(true);
      try {
        const res = await fetchMaestroConEstadoApi();
        if (res.maestro && res.maestro.length > 0) {
          const combinado = combinarMaestroLista(TRABAJADORES_INICIALES, res.maestro);
          setMaestro(combinado);
          if (res.source === 'sheets') {
            setMaestroSincronizadoDrive(true);
          }
          return combinado;
        }
        return combinarMaestroLista(TRABAJADORES_INICIALES, getMaestroLocalCache());
      } catch {
        return combinarMaestroLista(TRABAJADORES_INICIALES, getMaestroLocalCache());
      } finally {
        setSincronizandoMaestroInicial(false);
        maestroSyncInFlightRef.current = null;
      }
    })();

    maestroSyncInFlightRef.current = promesa;
    return promesa;
  }, []);

  // Cargar Maestro primero (evita saturar Apps Script) y luego cargar las hojas operativas
  useEffect(() => {
    let cancelado = false;

    const cargarDatosIniciales = async () => {
      try {
        await Promise.all([
          sincronizarMaestroPrioritario(),
          fetchPermisosFormulariosApi().then((permRes) => {
            if (!cancelado && permRes?.permisos) {
              setPermisosFormulariosCache(permRes.permisos);
              setPermisosFormularios(permRes.permisos);
              setPermisosSheetsSupported(!!permRes.sheetsSupported);
              setPermisosNeedsAppsScriptUpdate(!!permRes.needsAppsScriptUpdate);
            }
          }),
          getDriveConfigApi().then((cfg) => {
            if (!cancelado && cfg) {
              setDriveConfig(cfg);
              if (cfg.spreadsheetUrl) {
                setSpreadsheetLink(cfg.spreadsheetUrl);
              }
            }
          }),
        ]);

        if (cancelado) return;

        const [solis, intExtRes, epRes, scRes, isRes, ovRes] = await Promise.all([
          fetchSolicitudesApi(),
          fetchSolicitudesIntExtApi(),
          fetchEspecialesPersonalApi(),
          fetchSolicitudComunidadApi(),
          fetchIngresosSeleccionApi(),
          fetchObsequioVisitantesApi(),
        ]);

        if (cancelado) return;

        if (Array.isArray(solis)) {
          setSolicitudes(solis);
        }
        if (intExtRes && Array.isArray(intExtRes.solicitudes)) {
          setSolicitudesIntExt(intExtRes.solicitudes);
          setIntExtSheetsSupported(intExtRes.sheetsSupported || intExtRes.source === 'sheets');
          setIntExtEmailSupported(!!intExtRes.supportsEmailNotification);
          setIntExtSheetActual(intExtRes.intExtSheetName || '');
          setIntExtSheetMismatch(!!intExtRes.needsAppsScriptSheetUpdate);
        }
        if (epRes && Array.isArray(epRes.solicitudes)) {
          setSolicitudesEspecialesPersonal(epRes.solicitudes);
          setEpSheetsSupported(epRes.sheetsSupported || epRes.source === 'sheets');
          setEpEmailSupported(!!epRes.supportsEmailNotification);
          setEpSheetActual(epRes.especialesPersonalSheetName || '');
          setEpNeedsAppsScriptUpdate(!!epRes.needsAppsScriptUpdate);
        }
        if (scRes && Array.isArray(scRes.solicitudes)) {
          setSolicitudesComunidad(scRes.solicitudes);
          setScSheetsSupported(scRes.sheetsSupported || scRes.source === 'sheets');
          setScEmailSupported(!!scRes.supportsEmailNotification);
          setScSheetActual(scRes.solicitudComunidadSheetName || '');
          setScNeedsAppsScriptUpdate(!!scRes.needsAppsScriptUpdate);
        }
        if (isRes && Array.isArray(isRes.solicitudes)) {
          setIngresosSeleccion(isRes.solicitudes);
          setIsSheetsSupported(isRes.sheetsSupported || isRes.source === 'sheets');
          setIsEmailSupported(!!isRes.supportsEmailNotification);
          setIsSheetActual(isRes.ingresosSeleccionSheetName || '');
          setIsNeedsAppsScriptUpdate(!!isRes.needsAppsScriptUpdate);
        }
        if (ovRes && Array.isArray(ovRes.solicitudes)) {
          setObsequioVisitantes(ovRes.solicitudes);
          setOvSheetsSupported(ovRes.sheetsSupported || ovRes.source === 'sheets');
          setOvEmailSupported(!!ovRes.supportsEmailNotification);
          setOvSheetActual(ovRes.obsequioVisitantesSheetName || '');
          setOvNeedsAppsScriptUpdate(!!ovRes.needsAppsScriptUpdate);
        }
      } catch (e) {
        console.warn('Carga inicial desde servidor:', e);
      }
    };

    cargarDatosIniciales();
    return () => {
      cancelado = true;
    };
  }, [sincronizarMaestroPrioritario]);

  // Sincronización automática del Maestro al ingresar a Especiales Personal o Maestro
  useEffect(() => {
    if (!sesion) return;
    if (activeTab !== 'especiales-personal' && activeTab !== 'maestro') return;
    let cancelado = false;
    fetchMaestroApi()
      .then((maest) => {
        if (cancelado || !maest || maest.length === 0) return;
        setMaestro(combinarMaestroLista(TRABAJADORES_INICIALES, maest));
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [sesion, activeTab]);

  // Escuchar estado de auth Google si el administrador se autenticó
  useEffect(() => {
    const unsubscribe = initAuth(
      async (currentUser, currentToken) => {
        setUser(currentUser);
        setToken(currentToken);
        if (currentToken) {
          try {
            const fileInfo = await getOrCreateSpreadsheet(currentToken, maestro);
            setSpreadsheetId(fileInfo.id);
            setSpreadsheetLink(fileInfo.webViewLink || `https://docs.google.com/spreadsheets/d/${fileInfo.id}/edit`);
          } catch (e) {
            console.warn('OAuth sync check:', e);
          }
        }
      },
      () => {
        setUser(null);
        setToken(null);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [maestro]);

  const handleGuardarSolicitud = async (
    nueva: SolicitudFlor
  ): Promise<{ success: boolean; error?: string; solicitud?: SolicitudFlor }> => {
    try {
      const guardada = await createSolicitudApi(nueva);
      setSolicitudes((prev) => [guardada, ...prev.filter((s) => s.id !== guardada.id)]);
      mostrarToast('Solicitud registrada en la hoja Solicitudes');
      return { success: true, solicitud: guardada };
    } catch (err: any) {
      try {
        const frescas = await fetchSolicitudesApi();
        if (Array.isArray(frescas)) {
          setSolicitudes(frescas);
        }
      } catch {}
      return { success: false, error: err.message || 'Error al guardar la solicitud' };
    }
  };

  const handleGuardarSolicitudIntExt = async (
    nuevaOLista: SolicitudIntExt | SolicitudIntExt[],
    correoNotificacion?: string
  ): Promise<{
    success: boolean;
    error?: string;
    solicitud?: SolicitudIntExt;
    solicitudes?: SolicitudIntExt[];
    pendingAppsScriptUpdate?: boolean;
    intExtSheetName?: string;
    needsAppsScriptSheetUpdate?: boolean;
    emailNotification?: EmailNotificationResult;
  }> => {
    try {
      const res = await createSolicitudIntExtApi(nuevaOLista, correoNotificacion);
      const guardadas = res.solicitudes.length > 0 ? res.solicitudes : [res.solicitud];
      const idsGuardados = new Set(guardadas.map((g) => g.id));
      setSolicitudesIntExt((prev) => [
        ...guardadas,
        ...prev.filter((s) => !idsGuardados.has(s.id)),
      ]);
      const total = guardadas.length;
      setIntExtSheetActual(res.intExtSheetName || '');
      setIntExtSheetMismatch(!!res.needsAppsScriptSheetUpdate);
      if (typeof res.supportsEmailNotification === 'boolean') {
        setIntExtEmailSupported(res.supportsEmailNotification);
      }

      if (res.pendingAppsScriptUpdate) {
        setIntExtSheetsSupported(false);
        mostrarToast(
          total > 1
            ? `${total} registros guardados en respaldo local (requiere actualizar Apps Script)`
            : 'Guardado en respaldo local (requiere actualizar Apps Script)'
        );
      } else if (res.needsAppsScriptSheetUpdate) {
        setIntExtSheetsSupported(true);
        mostrarToast(
          'Actualice el script en Google Drive (Nueva versión) para escribir directamente en Especiales Empresa'
        );
      } else if (res.emailNotification?.requested && res.emailNotification.sent) {
        setIntExtSheetsSupported(true);
        mostrarToast(
          total > 1
            ? `${total} registros guardados y notificación enviada a ${res.emailNotification.to}`
            : `Solicitud registrada y notificación enviada a ${res.emailNotification.to}`
        );
      } else if (res.emailNotification?.requested && !res.emailNotification.sent) {
        setIntExtSheetsSupported(true);
        mostrarToast(
          total > 1
            ? `${total} registros guardados en Especiales Empresa (notificación por correo pendiente)`
            : 'Solicitud registrada en Especiales Empresa (notificación por correo pendiente)'
        );
      } else {
        setIntExtSheetsSupported(true);
        mostrarToast(
          total > 1
            ? `${total} registros guardados en la hoja Especiales Empresa`
            : 'Solicitud registrada en la hoja Especiales Empresa'
        );
      }
      return {
        success: true,
        solicitud: guardadas[0],
        solicitudes: guardadas,
        pendingAppsScriptUpdate: res.pendingAppsScriptUpdate,
        intExtSheetName: res.intExtSheetName,
        needsAppsScriptSheetUpdate: res.needsAppsScriptSheetUpdate,
        emailNotification: res.emailNotification,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error al guardar en Especiales Empresa' };
    }
  };

  const handleRecargarIntExt = async () => {
    const res = await fetchSolicitudesIntExtApi();
    setSolicitudesIntExt(res.solicitudes || []);
    setIntExtSheetsSupported(res.sheetsSupported || res.source === 'sheets');
    setIntExtEmailSupported(!!res.supportsEmailNotification);
    setIntExtSheetActual(res.intExtSheetName || '');
    setIntExtSheetMismatch(!!res.needsAppsScriptSheetUpdate);
  };

  const handleGuardarEspecialPersonal = async (
    nuevaOLista: EspecialPersonal | EspecialPersonal[],
    correoNotificacion?: string,
    fotoCarta?: { base64: string; mimeType: string; fileName: string } | null
  ): Promise<{
    success: boolean;
    error?: string;
    solicitud?: EspecialPersonal;
    solicitudes?: EspecialPersonal[];
    pendingAppsScriptUpdate?: boolean;
    especialesPersonalSheetName?: string;
    needsAppsScriptUpdate?: boolean;
    fotoCartaDriveError?: string;
    emailNotification?: EmailNotificationResult;
  }> => {
    try {
      const res = await createEspecialesPersonalApi(nuevaOLista, correoNotificacion, fotoCarta);
      const guardadas = res.solicitudes.length > 0 ? res.solicitudes : [res.solicitud];
      const idsGuardados = new Set(guardadas.map((g) => g.id));
      setSolicitudesEspecialesPersonal((prev) => [
        ...guardadas,
        ...prev.filter((s) => !idsGuardados.has(s.id)),
      ]);
      const total = guardadas.length;
      setEpSheetActual(res.especialesPersonalSheetName || '');
      setEpNeedsAppsScriptUpdate(!!res.needsAppsScriptUpdate);
      if (typeof res.supportsEmailNotification === 'boolean') {
        setEpEmailSupported(res.supportsEmailNotification);
      }

      if (res.pendingAppsScriptUpdate || res.needsAppsScriptUpdate) {
        setEpSheetsSupported(!res.pendingAppsScriptUpdate);
        mostrarToast(
          total > 1
            ? `${total} registros guardados en respaldo local (actualice Apps Script para Especiales Personal)`
            : 'Guardado en respaldo local (actualice Apps Script para Especiales Personal)'
        );
      } else if (res.emailNotification?.requested && res.emailNotification.sent) {
        setEpSheetsSupported(true);
        mostrarToast(
          total > 1
            ? `${total} registros guardados en Especiales Personal y notificación enviada a ${res.emailNotification.to}`
            : `Solicitud guardada en Especiales Personal y notificación enviada a ${res.emailNotification.to}`
        );
      } else if (res.emailNotification?.requested && !res.emailNotification.sent) {
        setEpSheetsSupported(true);
        mostrarToast(
          total > 1
            ? `${total} registros guardados en Especiales Personal (notificación por correo pendiente)`
            : 'Solicitud guardada en Especiales Personal (notificación por correo pendiente)'
        );
      } else {
        setEpSheetsSupported(true);
        mostrarToast(
          total > 1
            ? `${total} registros guardados en la hoja Especiales Personal`
            : 'Solicitud registrada en la hoja Especiales Personal'
        );
      }

      return {
        success: true,
        solicitud: guardadas[0],
        solicitudes: guardadas,
        pendingAppsScriptUpdate: res.pendingAppsScriptUpdate,
        especialesPersonalSheetName: res.especialesPersonalSheetName,
        needsAppsScriptUpdate: res.needsAppsScriptUpdate,
        fotoCartaDriveError: res.fotoCartaDriveError,
        emailNotification: res.emailNotification,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Error al guardar en Especiales Personal',
      };
    }
  };

  const handleRecargarEspecialPersonal = async () => {
    const res = await fetchEspecialesPersonalApi();
    setSolicitudesEspecialesPersonal(res.solicitudes || []);
    setEpSheetsSupported(res.sheetsSupported || res.source === 'sheets');
    setEpEmailSupported(!!res.supportsEmailNotification);
    setEpSheetActual(res.especialesPersonalSheetName || '');
    setEpNeedsAppsScriptUpdate(!!res.needsAppsScriptUpdate);
  };

  const handleActualizarEstadoEspecialPersonal = async (
    id: string,
    estado: EstadoEspecialPersonal
  ): Promise<{
    success: boolean;
    error?: string;
    pendingAppsScriptUpdate?: boolean;
  }> => {
    if (!sesion) {
      return { success: false, error: 'No hay sesión activa.' };
    }
    try {
      const res = await updateEstadoEspecialPersonalApi({
        id,
        estado,
        usuarioCodigo: sesion.codigo || '',
        usuarioCargo: sesion.cargo || '',
        usuarioNombre: sesion.nombre || '',
      });
      if (res.solicitudes && res.solicitudes.length > 0) {
        setSolicitudesEspecialesPersonal(res.solicitudes);
      } else {
        setSolicitudesEspecialesPersonal((prev) =>
          prev.map((item) =>
            String(item.id || '').trim().toUpperCase() === id.trim().toUpperCase()
              ? { ...item, estado }
              : item
          )
        );
      }
      mostrarToast(
        res.pendingAppsScriptUpdate
          ? `Estado de ${id} actualizado a ${estado} en respaldo local (actualice Apps Script para sincronizar con Sheets).`
          : `Estado de ${id} actualizado a ${estado}.`
      );
      return {
        success: true,
        pendingAppsScriptUpdate: res.pendingAppsScriptUpdate,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'No se pudo actualizar el estado de la solicitud.',
      };
    }
  };

  const handleGuardarSolicitudComunidad = async (
    nuevaOLista: SolicitudComunidad | SolicitudComunidad[],
    correoNotificacion?: string,
    fotoCarta?: { base64: string; mimeType: string; fileName: string } | null
  ): Promise<{
    success: boolean;
    error?: string;
    solicitud?: SolicitudComunidad;
    solicitudes?: SolicitudComunidad[];
    pendingAppsScriptUpdate?: boolean;
    solicitudComunidadSheetName?: string;
    needsAppsScriptUpdate?: boolean;
    fotoCartaDriveError?: string;
    emailNotification?: EmailNotificationResult;
  }> => {
    try {
      const res = await createSolicitudComunidadApi(nuevaOLista, correoNotificacion, fotoCarta);
      const guardadas = res.solicitudes.length > 0 ? res.solicitudes : [res.solicitud];
      const idsGuardados = new Set(guardadas.map((g) => g.id));
      setSolicitudesComunidad((prev) => [
        ...guardadas,
        ...prev.filter((s) => !idsGuardados.has(s.id)),
      ]);
      const total = guardadas.length;
      setScSheetActual(res.solicitudComunidadSheetName || '');
      setScNeedsAppsScriptUpdate(!!res.needsAppsScriptUpdate);
      if (typeof res.supportsEmailNotification === 'boolean') {
        setScEmailSupported(res.supportsEmailNotification);
      }

      if (res.pendingAppsScriptUpdate || res.needsAppsScriptUpdate) {
        setScSheetsSupported(!res.pendingAppsScriptUpdate);
        mostrarToast(
          total > 1
            ? `${total} registros guardados en respaldo local (actualice Apps Script para Solicitud Comunidad)`
            : 'Guardado en respaldo local (actualice Apps Script para Solicitud Comunidad)'
        );
      } else if (res.emailNotification?.requested && res.emailNotification.sent) {
        setScSheetsSupported(true);
        mostrarToast(
          total > 1
            ? `${total} registros guardados en Solicitud Comunidad y notificación enviada a ${res.emailNotification.to}`
            : `Solicitud guardada en Solicitud Comunidad y notificación enviada a ${res.emailNotification.to}`
        );
      } else if (res.emailNotification?.requested && !res.emailNotification.sent) {
        setScSheetsSupported(true);
        mostrarToast(
          total > 1
            ? `${total} registros guardados en Solicitud Comunidad (notificación por correo pendiente)`
            : 'Solicitud guardada en Solicitud Comunidad (notificación por correo pendiente)'
        );
      } else {
        setScSheetsSupported(true);
        mostrarToast(
          total > 1
            ? `${total} registros guardados en la hoja Solicitud Comunidad`
            : 'Solicitud registrada en la hoja Solicitud Comunidad'
        );
      }

      return {
        success: true,
        solicitud: guardadas[0],
        solicitudes: guardadas,
        pendingAppsScriptUpdate: res.pendingAppsScriptUpdate,
        solicitudComunidadSheetName: res.solicitudComunidadSheetName,
        needsAppsScriptUpdate: res.needsAppsScriptUpdate,
        fotoCartaDriveError: res.fotoCartaDriveError,
        emailNotification: res.emailNotification,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Error al guardar en Solicitud Comunidad',
      };
    }
  };

  const handleRecargarSolicitudComunidad = async () => {
    const res = await fetchSolicitudComunidadApi();
    setSolicitudesComunidad(res.solicitudes || []);
    setScSheetsSupported(res.sheetsSupported || res.source === 'sheets');
    setScEmailSupported(!!res.supportsEmailNotification);
    setScSheetActual(res.solicitudComunidadSheetName || '');
    setScNeedsAppsScriptUpdate(!!res.needsAppsScriptUpdate);
  };

  const handleGuardarIngresoSeleccion = async (
    nuevaOLista: IngresoSeleccion | IngresoSeleccion[],
    correoNotificacion?: string
  ): Promise<{
    success: boolean;
    error?: string;
    solicitud?: IngresoSeleccion;
    solicitudes?: IngresoSeleccion[];
    pendingAppsScriptUpdate?: boolean;
    ingresosSeleccionSheetName?: string;
    needsAppsScriptUpdate?: boolean;
    emailNotification?: EmailNotificationResult;
  }> => {
    try {
      const res = await createIngresosSeleccionApi(nuevaOLista, correoNotificacion);
      const guardadas = res.solicitudes.length > 0 ? res.solicitudes : [res.solicitud];
      const idsGuardados = new Set(guardadas.map((g) => g.id));
      setIngresosSeleccion((prev) => [
        ...guardadas,
        ...prev.filter((s) => !idsGuardados.has(s.id)),
      ]);
      const total = guardadas.length;
      setIsSheetActual(res.ingresosSeleccionSheetName || '');
      setIsNeedsAppsScriptUpdate(!!res.needsAppsScriptUpdate);
      if (typeof res.supportsEmailNotification === 'boolean') {
        setIsEmailSupported(res.supportsEmailNotification);
      }

      if (res.pendingAppsScriptUpdate || res.needsAppsScriptUpdate) {
        setIsSheetsSupported(!res.pendingAppsScriptUpdate);
        mostrarToast(
          total > 1
            ? `${total} registros guardados en respaldo local (actualice Apps Script para Ingresos Selección)`
            : 'Guardado en respaldo local (actualice Apps Script para Ingresos Selección)'
        );
      } else if (res.emailNotification?.requested && res.emailNotification.sent) {
        setIsSheetsSupported(true);
        mostrarToast(
          total > 1
            ? `${total} registros guardados en Ingresos Selección y notificación enviada a ${res.emailNotification.to}`
            : `Solicitud guardada en Ingresos Selección y notificación enviada a ${res.emailNotification.to}`
        );
      } else if (res.emailNotification?.requested && !res.emailNotification.sent) {
        setIsSheetsSupported(true);
        mostrarToast(
          total > 1
            ? `${total} registros guardados en Ingresos Selección (notificación por correo pendiente)`
            : 'Solicitud guardada en Ingresos Selección (notificación por correo pendiente)'
        );
      } else {
        setIsSheetsSupported(true);
        mostrarToast(
          total > 1
            ? `${total} registros guardados en la hoja Ingresos Selección`
            : 'Solicitud registrada en la hoja Ingresos Selección'
        );
      }

      return {
        success: true,
        solicitud: guardadas[0],
        solicitudes: guardadas,
        pendingAppsScriptUpdate: res.pendingAppsScriptUpdate,
        ingresosSeleccionSheetName: res.ingresosSeleccionSheetName,
        needsAppsScriptUpdate: res.needsAppsScriptUpdate,
        emailNotification: res.emailNotification,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Error al guardar en Ingresos Selección',
      };
    }
  };

  const handleRecargarIngresosSeleccion = async () => {
    const res = await fetchIngresosSeleccionApi();
    setIngresosSeleccion(res.solicitudes || []);
    setIsSheetsSupported(res.sheetsSupported || res.source === 'sheets');
    setIsEmailSupported(!!res.supportsEmailNotification);
    setIsSheetActual(res.ingresosSeleccionSheetName || '');
    setIsNeedsAppsScriptUpdate(!!res.needsAppsScriptUpdate);
  };

  const handleGuardarObsequioVisitante = async (
    nuevaOLista: ObsequioVisitante | ObsequioVisitante[],
    correoNotificacion?: string
  ): Promise<{
    success: boolean;
    error?: string;
    solicitud?: ObsequioVisitante;
    solicitudes?: ObsequioVisitante[];
    pendingAppsScriptUpdate?: boolean;
    obsequioVisitantesSheetName?: string;
    needsAppsScriptUpdate?: boolean;
    emailNotification?: EmailNotificationResult;
  }> => {
    try {
      const res = await createObsequioVisitantesApi(nuevaOLista, correoNotificacion);
      const guardadas = res.solicitudes.length > 0 ? res.solicitudes : [res.solicitud];
      const idsGuardados = new Set(guardadas.map((g) => g.id));
      setObsequioVisitantes((prev) => [
        ...guardadas,
        ...prev.filter((s) => !idsGuardados.has(s.id)),
      ]);
      const total = guardadas.length;
      setOvSheetActual(res.obsequioVisitantesSheetName || '');
      setOvNeedsAppsScriptUpdate(!!res.needsAppsScriptUpdate);
      if (typeof res.supportsEmailNotification === 'boolean') {
        setOvEmailSupported(res.supportsEmailNotification);
      }

      if (res.pendingAppsScriptUpdate || res.needsAppsScriptUpdate) {
        setOvSheetsSupported(!res.pendingAppsScriptUpdate);
        mostrarToast(
          total > 1
            ? `${total} registros guardados en respaldo local (actualice Apps Script para Obsequio Visitantes)`
            : 'Guardado en respaldo local (actualice Apps Script para Obsequio Visitantes)'
        );
      } else if (res.emailNotification?.requested && res.emailNotification.sent) {
        setOvSheetsSupported(true);
        mostrarToast(
          total > 1
            ? `${total} registros guardados en Obsequio Visitantes y notificación enviada a ${res.emailNotification.to}`
            : `Solicitud guardada en Obsequio Visitantes y notificación enviada a ${res.emailNotification.to}`
        );
      } else if (res.emailNotification?.requested && !res.emailNotification.sent) {
        setOvSheetsSupported(true);
        mostrarToast(
          total > 1
            ? `${total} registros guardados en Obsequio Visitantes (notificación por correo pendiente)`
            : 'Solicitud guardada en Obsequio Visitantes (notificación por correo pendiente)'
        );
      } else {
        setOvSheetsSupported(true);
        mostrarToast(
          total > 1
            ? `${total} registros guardados en la hoja Obsequio Visitantes`
            : 'Solicitud registrada en la hoja Obsequio Visitantes'
        );
      }

      return {
        success: true,
        solicitud: guardadas[0],
        solicitudes: guardadas,
        pendingAppsScriptUpdate: res.pendingAppsScriptUpdate,
        obsequioVisitantesSheetName: res.obsequioVisitantesSheetName,
        needsAppsScriptUpdate: res.needsAppsScriptUpdate,
        emailNotification: res.emailNotification,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Error al guardar en Obsequio Visitantes',
      };
    }
  };

  const handleRecargarObsequioVisitantes = async () => {
    const res = await fetchObsequioVisitantesApi();
    setObsequioVisitantes(res.solicitudes || []);
    setOvSheetsSupported(res.sheetsSupported || res.source === 'sheets');
    setOvEmailSupported(!!res.supportsEmailNotification);
    setOvSheetActual(res.obsequioVisitantesSheetName || '');
    setOvNeedsAppsScriptUpdate(!!res.needsAppsScriptUpdate);
  };

  const handleGuardarPermisos = async (
    nuevosPermisos: PermisosFormulariosMap
  ): Promise<{
    success: boolean;
    error?: string;
    syncedToDrive?: boolean;
    pendingAppsScriptUpdate?: boolean;
  }> => {
    if (!sesion) {
      return { success: false, error: 'No hay sesión activa.' };
    }
    try {
      const res = await savePermisosFormulariosApi({
        permisos: nuevosPermisos,
        usuarioCodigo: sesion.codigo,
        usuarioCargo: sesion.cargo || '',
        usuarioNombre: sesion.nombre,
      });
      setPermisosFormulariosCache(res.permisos);
      setPermisosFormularios(res.permisos);
      setPermisosNeedsAppsScriptUpdate(res.pendingAppsScriptUpdate);
      setPermisosSheetsSupported(!res.pendingAppsScriptUpdate);
      mostrarToast(
        res.syncedToDrive
          ? 'Permisos de formularios guardados y sincronizados con Google Drive'
          : 'Permisos de formularios actualizados correctamente'
      );
      return {
        success: true,
        syncedToDrive: res.syncedToDrive,
        pendingAppsScriptUpdate: res.pendingAppsScriptUpdate,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Error al guardar los permisos',
      };
    }
  };

  const handleRestaurarPermisosDefecto = async (
    formKey?: FormularioPermisoKey
  ): Promise<{ success: boolean; error?: string }> => {
    if (!sesion) {
      return { success: false, error: 'No hay sesión activa.' };
    }
    try {
      const res = await restoreDefaultPermisosApi({
        formKey,
        usuarioCodigo: sesion.codigo,
        usuarioCargo: sesion.cargo || '',
        usuarioNombre: sesion.nombre,
      });
      setPermisosFormulariosCache(res.permisos);
      setPermisosFormularios(res.permisos);
      setPermisosNeedsAppsScriptUpdate(res.pendingAppsScriptUpdate);
      setPermisosSheetsSupported(!res.pendingAppsScriptUpdate);
      mostrarToast('Permisos restaurados a su configuración por defecto');
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'No se pudieron restaurar los permisos',
      };
    }
  };

  const handleRecargarMaestroSilencioso = async () => {
    const maest = await fetchMaestroApi();
    if (maest && maest.length > 0) {
      const mapa = new Map<string, TrabajadorMaestro>();
      for (const t of TRABAJADORES_INICIALES) {
        mapa.set(t.codigo.trim().toUpperCase(), t);
      }
      for (const t of maest) {
        mapa.set(t.codigo.trim().toUpperCase(), t);
      }
      setMaestro(Array.from(mapa.values()));
      mostrarToast(`Maestro sincronizado (${maest.length} registros)`);
    }
  };

  const handleAgregarTrabajador = async (nuevo: TrabajadorMaestro) => {
    try {
      const updated = await addTrabajadorApi(nuevo);
      if (updated && updated.length > 0) {
        setMaestro(updated);
      } else {
        setMaestro((prev) => [nuevo, ...prev]);
      }
      mostrarToast(`Trabajador ${nuevo.nombre} agregado al Maestro de forma segura`);
    } catch {
      setMaestro((prev) => [nuevo, ...prev]);
      mostrarToast(`Trabajador ${nuevo.nombre} agregado`);
    }
  };

  const handleImportarCSV = async (nuevos: TrabajadorMaestro[]) => {
    setMaestro((prev) => {
      const mapa = new Map<string, TrabajadorMaestro>();
      for (const p of prev) mapa.set(p.codigo.trim().toUpperCase(), p);
      for (const n of nuevos) mapa.set(n.codigo.trim().toUpperCase(), n);
      return Array.from(mapa.values());
    });

    const updated = await importMaestroBulkApi(nuevos);
    if (updated && updated.length > 0) {
      setMaestro(updated);
    }

    mostrarToast(`Se importaron ${nuevos.length} trabajadores a la Hoja Maestro`);
  };

  const handleGuardarDriveConfig = async (webhookUrl: string, spreadsheetUrl: string) => {
    const updated = await updateDriveConfigApi({ webhookUrl, spreadsheetUrl });
    setDriveConfig(updated);
    if (spreadsheetUrl) {
      setSpreadsheetLink(spreadsheetUrl);
    }
    mostrarToast('Configuración de Google Drive actualizada');
  };

  const handleProbarConexionDrive = async (targetUrl?: string) => {
    return await testDriveWebhookApi(targetUrl);
  };

  const handleRecargarDeDrive = async () => {
    setIsSyncing(true);
    try {
      const resWebhook = await syncMaestroFromDriveApi();
      if (resWebhook.success && resWebhook.maestro && resWebhook.maestro.length > 0) {
        setMaestro(resWebhook.maestro);
        mostrarToast(`¡Sincronizado! Se cargaron ${resWebhook.maestro.length} trabajadores de Google Drive`);
        return;
      }

      const activeToken = token || (await getAccessToken());
      if (activeToken && spreadsheetId) {
        const trabajadoresDrive = await fetchMaestroFromDrive(activeToken, spreadsheetId);
        if (trabajadoresDrive.length > 0) {
          setMaestro((prev) => {
            const mapa = new Map<string, TrabajadorMaestro>();
            prev.forEach((t) => mapa.set(t.codigo.trim().toUpperCase(), t));
            trabajadoresDrive.forEach((t) => mapa.set(t.codigo.trim().toUpperCase(), t));
            return Array.from(mapa.values());
          });
          await importMaestroBulkApi(trabajadoresDrive);
          mostrarToast(`Se cargaron ${trabajadoresDrive.length} trabajadores desde la hoja de Drive`);
          return;
        }
      }

      if (resWebhook.error) {
        mostrarToast(resWebhook.error);
      }
      setIsDriveModalOpen(true);
    } catch {
      setIsDriveModalOpen(true);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSetActiveTab = (tab: TabNavegacion) => {
    if (tab === 'formulario' && !puedeVerPersonal) {
      setActiveTab(obtenerPrimeraTabPermitida());
      return;
    }
    if (tab === 'int-ext' && !puedeVerIntExt) {
      setActiveTab(obtenerPrimeraTabPermitida());
      return;
    }
    if (tab === 'especiales-personal' && !puedeVerEp) {
      setActiveTab(obtenerPrimeraTabPermitida());
      return;
    }
    if (tab === 'solicitud-comunidad' && !puedeVerComunidad) {
      setActiveTab(obtenerPrimeraTabPermitida());
      return;
    }
    if (tab === 'ingresos-seleccion' && !puedeVerIngresos) {
      setActiveTab(obtenerPrimeraTabPermitida());
      return;
    }
    if (tab === 'obsequio-visitantes' && !puedeVerVisitantes) {
      setActiveTab(obtenerPrimeraTabPermitida());
      return;
    }
    if (tab === 'solicitudes' && !puedeVerResumen) {
      setActiveTab(obtenerPrimeraTabPermitida());
      return;
    }
    if (tab === 'maestro' && !puedeVerMaestro) {
      setActiveTab(obtenerPrimeraTabPermitida());
      return;
    }
    if (tab === 'permisos' && !esAdminSistema) {
      setActiveTab(obtenerPrimeraTabPermitida());
      return;
    }
    setActiveTab(tab);
  };

  const handleCerrarSesion = () => {
    setSesion(null);
    setMenuMovilAbierto(false);
    setActiveTab('formulario');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex font-sans">
      {syncToast && (
        <div className="fixed bottom-4 right-4 z-50 bg-[#0a2958] text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-xl border border-white/20 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {syncToast}
        </div>
      )}

      <DriveConfigModal
        isOpen={isDriveModalOpen && esAdminSistema}
        onClose={() => setIsDriveModalOpen(false)}
        config={driveConfig}
        onGuardarConfig={handleGuardarDriveConfig}
        onProbarConexion={handleProbarConexionDrive}
      />

      {/* Menú lateral izquierdo fijo (visible al iniciar sesión) */}
      {sesion && (
        <SidebarNavegacion
          activeTab={activeTab}
          onSelectTab={handleSetActiveTab}
          sesion={sesion}
          onCerrarSesion={handleCerrarSesion}
          totalSolicitudes={solicitudes.length}
          permisosFormularios={permisosFormularios}
          driveConfig={driveConfig}
          userGoogleConnected={!!user}
          onOpenDriveModal={() => {
            if (esAdminSistema) setIsDriveModalOpen(true);
          }}
          abiertoMovil={menuMovilAbierto}
          onCerrarMovil={() => setMenuMovilAbierto(false)}
        />
      )}

      {/* Área principal a la derecha del menú lateral */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <Navbar
          activeTab={activeTab}
          user={user}
          driveConfig={driveConfig}
          onOpenDriveModal={() => {
            if (esAdminSistema) setIsDriveModalOpen(true);
          }}
          sesion={sesion}
          onToggleMenuMovil={() => setMenuMovilAbierto((prev) => !prev)}
        />

        <main className="flex-1 min-w-0">
          {!sesion ? (
            <LoginCodigo
              maestro={maestro}
              cargando={maestro.length === 0}
              sincronizando={sincronizandoMaestroInicial}
              maestroSincronizado={maestroSincronizadoDrive}
              onRefrescarMaestro={sincronizarMaestroPrioritario}
              onIngresar={(t) => {
                setSesion(t);
                setMenuMovilAbierto(typeof window !== 'undefined' ? window.innerWidth < 1024 : false);
                setActiveTab('formulario');
                if (!maestroSincronizadoDrive) {
                  sincronizarMaestroPrioritario().catch(() => {});
                }
              }}
            />
          ) : (
            <>
              {puedeVerPersonal && activeTab === 'formulario' && (
                <SolicitudForm
                  maestro={maestro}
                  solicitudes={solicitudes}
                  onGuardarSolicitud={handleGuardarSolicitud}
                  isDriveConnected={esAdminSistema && !!driveConfig.webhookUrl}
                  spreadsheetLink={esAdminSistema ? spreadsheetLink || driveConfig.spreadsheetUrl : null}
                  onRecargarMaestroDeDrive={esAdminSistema ? handleRecargarDeDrive : undefined}
                  sesion={sesion}
                  onCerrarSesion={handleCerrarSesion}
                />
              )}

              {puedeVerIntExt && activeTab === 'int-ext' && (
                <SolicitudIntExtForm
                  sesion={sesion}
                  solicitudesIntExt={solicitudesIntExt}
                  sheetsSupported={intExtSheetsSupported}
                  emailSupported={intExtEmailSupported}
                  intExtSheetActual={intExtSheetActual}
                  needsAppsScriptSheetUpdate={intExtSheetMismatch}
                  onGuardarSolicitudIntExt={handleGuardarSolicitudIntExt}
                  onRecargarIntExt={handleRecargarIntExt}
                  onCerrarSesion={handleCerrarSesion}
                />
              )}

              {puedeVerEp && activeTab === 'especiales-personal' && (
                <EspecialesPersonalForm
                  sesion={sesion}
                  maestro={maestro}
                  solicitudesEspecialesPersonal={solicitudesEspecialesPersonal}
                  sheetsSupported={epSheetsSupported}
                  emailSupported={epEmailSupported}
                  especialesPersonalSheetActual={epSheetActual}
                  needsAppsScriptUpdate={epNeedsAppsScriptUpdate}
                  onGuardarEspecialPersonal={handleGuardarEspecialPersonal}
                  onRecargarEspecialPersonal={handleRecargarEspecialPersonal}
                  onActualizarEstadoEspecialPersonal={handleActualizarEstadoEspecialPersonal}
                  onRecargarMaestro={handleRecargarMaestroSilencioso}
                  onCerrarSesion={handleCerrarSesion}
                />
              )}

              {puedeVerComunidad && activeTab === 'solicitud-comunidad' && (
                <SolicitudComunidadForm
                  sesion={sesion}
                  solicitudesComunidad={solicitudesComunidad}
                  sheetsSupported={scSheetsSupported}
                  emailSupported={scEmailSupported}
                  solicitudComunidadSheetActual={scSheetActual}
                  needsAppsScriptUpdate={scNeedsAppsScriptUpdate}
                  onGuardarSolicitudComunidad={handleGuardarSolicitudComunidad}
                  onRecargarSolicitudComunidad={handleRecargarSolicitudComunidad}
                  onCerrarSesion={handleCerrarSesion}
                />
              )}

              {puedeVerIngresos && activeTab === 'ingresos-seleccion' && (
                <IngresosSeleccionForm
                  sesion={sesion}
                  ingresosSeleccion={ingresosSeleccion}
                  sheetsSupported={isSheetsSupported}
                  emailSupported={isEmailSupported}
                  ingresosSeleccionSheetActual={isSheetActual}
                  needsAppsScriptUpdate={isNeedsAppsScriptUpdate}
                  onGuardarIngresoSeleccion={handleGuardarIngresoSeleccion}
                  onRecargarIngresosSeleccion={handleRecargarIngresosSeleccion}
                  onCerrarSesion={handleCerrarSesion}
                />
              )}

              {puedeVerVisitantes && activeTab === 'obsequio-visitantes' && (
                <ObsequioVisitantesForm
                  sesion={sesion}
                  obsequioVisitantes={obsequioVisitantes}
                  sheetsSupported={ovSheetsSupported}
                  emailSupported={ovEmailSupported}
                  obsequioVisitantesSheetActual={ovSheetActual}
                  needsAppsScriptUpdate={ovNeedsAppsScriptUpdate}
                  onGuardarObsequioVisitante={handleGuardarObsequioVisitante}
                  onRecargarObsequioVisitantes={handleRecargarObsequioVisitantes}
                  onCerrarSesion={handleCerrarSesion}
                />
              )}

              {puedeVerResumen && activeTab === 'solicitudes' && (
                <SolicitudesTable
                  solicitudes={solicitudes}
                  isDriveConnected={esAdminSistema && !!(driveConfig.webhookUrl || user)}
                  spreadsheetLink={esAdminSistema ? spreadsheetLink || driveConfig.spreadsheetUrl : null}
                  onSincronizarConDrive={async () => {
                    if (esAdminSistema) setIsDriveModalOpen(true);
                  }}
                  isSyncing={isSyncing}
                />
              )}

              {puedeVerMaestro && activeTab === 'maestro' && (
                <MaestroTrabajadores
                  maestro={maestro}
                  onAgregarTrabajador={handleAgregarTrabajador}
                  onImportarCSV={handleImportarCSV}
                  isDriveConnected={!!(driveConfig.webhookUrl || user)}
                  onRecargarDeDrive={handleRecargarDeDrive}
                  isSyncing={isSyncing}
                />
              )}

              {esAdminSistema && activeTab === 'permisos' && (
                <PermisosFormulariosPanel
                  sesion={sesion}
                  maestro={maestro}
                  permisos={permisosFormularios}
                  sheetsSupported={permisosSheetsSupported}
                  needsAppsScriptUpdate={permisosNeedsAppsScriptUpdate}
                  onGuardarPermisos={handleGuardarPermisos}
                  onRestaurarDefecto={handleRestaurarPermisosDefecto}
                />
              )}
            </>
          )}
        </main>

        <footer className="bg-white border-t border-slate-200 py-3.5 px-4 sm:px-6 text-xs text-slate-500">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#0a2958]">MG Consultores S.A.S.</span>
              <span>•</span>
              <span>Sistema de Flor de Obsequio (Sedes MG, HA, SC)</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
