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
import { SolicitudesTable } from './components/SolicitudesTable';
import { MaestroTrabajadores } from './components/MaestroTrabajadores';
import { LoginCodigo } from './components/LoginCodigo';
import { DriveConfigModal } from './components/DriveConfigModal';
import { SidebarNavegacion, TabNavegacion } from './components/SidebarNavegacion';
import { SolicitudFlor, SolicitudIntExt, EspecialPersonal, TrabajadorMaestro } from './types';
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
  fetchMaestroApi,
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
  puedeVerResumenSolicitud,
  puedeVerSolicitudIntExt,
  puedeVerEspecialesPersonal,
} from './utils/roles';

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

  // Datos principales
  const [maestro, setMaestro] = useState<TrabajadorMaestro[]>(TRABAJADORES_INICIALES);
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

  const esAdminSistema = esAdministradorSistema(sesion);
  const puedeVerMaestro = puedeVerHojaMaestro(sesion);
  const puedeVerResumen = puedeVerResumenSolicitud(sesion);
  const puedeVerIntExt = puedeVerSolicitudIntExt(sesion);
  const puedeVerEp = puedeVerEspecialesPersonal(sesion);

  // Redirigir al formulario si el usuario no tiene permiso para la pestaña actual
  useEffect(() => {
    if (!sesion) return;
    if (activeTab === 'int-ext' && !puedeVerIntExt) {
      setActiveTab('formulario');
    } else if (activeTab === 'especiales-personal' && !puedeVerEp) {
      setActiveTab('formulario');
    } else if (activeTab === 'solicitudes' && !puedeVerResumen) {
      setActiveTab('formulario');
    } else if (activeTab === 'maestro' && !puedeVerMaestro) {
      setActiveTab('formulario');
    }
  }, [sesion, puedeVerResumen, puedeVerMaestro, puedeVerIntExt, puedeVerEp, activeTab]);

  // Mostrar toast temporal
  const mostrarToast = (mensaje: string) => {
    setSyncToast(mensaje);
    setTimeout(() => {
      setSyncToast(null);
    }, 4500);
  };

  // Cargar datos persistentes del servidor al iniciar
  useEffect(() => {
    const cargarDatosIniciales = async () => {
      try {
        const [solis, intExtRes, epRes, maest, cfg] = await Promise.all([
          fetchSolicitudesApi(),
          fetchSolicitudesIntExtApi(),
          fetchEspecialesPersonalApi(),
          fetchMaestroApi(),
          getDriveConfigApi(),
        ]);

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
        if (maest && maest.length > 0) {
          const mapa = new Map<string, TrabajadorMaestro>();
          for (const t of TRABAJADORES_INICIALES) {
            mapa.set(t.codigo.trim().toUpperCase(), t);
          }
          for (const t of maest) {
            mapa.set(t.codigo.trim().toUpperCase(), t);
          }
          setMaestro(Array.from(mapa.values()));
        }
        if (cfg) {
          setDriveConfig(cfg);
          if (cfg.spreadsheetUrl) {
            setSpreadsheetLink(cfg.spreadsheetUrl);
          }
        }
      } catch (e) {
        console.warn('Carga inicial desde servidor:', e);
      }
    };

    cargarDatosIniciales();
  }, []);

  // Sincronización automática del Maestro al ingresar a Especiales Personal o Maestro
  useEffect(() => {
    if (!sesion) return;
    if (activeTab !== 'especiales-personal' && activeTab !== 'maestro') return;
    let cancelado = false;
    fetchMaestroApi()
      .then((maest) => {
        if (cancelado || !maest || maest.length === 0) return;
        const mapa = new Map<string, TrabajadorMaestro>();
        for (const t of TRABAJADORES_INICIALES) {
          mapa.set(t.codigo.trim().toUpperCase(), t);
        }
        for (const t of maest) {
          mapa.set(t.codigo.trim().toUpperCase(), t);
        }
        setMaestro(Array.from(mapa.values()));
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
    if (tab === 'int-ext' && !puedeVerIntExt) {
      setActiveTab('formulario');
      return;
    }
    if (tab === 'especiales-personal' && !puedeVerEp) {
      setActiveTab('formulario');
      return;
    }
    if (tab === 'solicitudes' && !puedeVerResumen) {
      setActiveTab('formulario');
      return;
    }
    if (tab === 'maestro' && !puedeVerMaestro) {
      setActiveTab('formulario');
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
              onIngresar={(t) => {
                setSesion(t);
                setMenuMovilAbierto(false);
                setActiveTab('formulario');
              }}
            />
          ) : (
            <>
              {activeTab === 'formulario' && (
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
                  onRecargarMaestro={handleRecargarMaestroSilencioso}
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
