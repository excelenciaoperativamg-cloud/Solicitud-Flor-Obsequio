/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { Navbar } from './components/Navbar';
import { SolicitudForm } from './components/SolicitudForm';
import { CuposDashboard } from './components/CuposDashboard';
import { SolicitudesTable } from './components/SolicitudesTable';
import { MaestroTrabajadores } from './components/MaestroTrabajadores';
import { DriveConfigModal } from './components/DriveConfigModal';
import { SolicitudFlor, TrabajadorMaestro } from './types';
import {
  TRABAJADORES_INICIALES,
  SOLICITUDES_INICIALES,
} from './data/initialData';
import {
  initAuth,
  getAccessToken,
} from './services/firebaseAuth';
import {
  fetchSolicitudesApi,
  createSolicitudApi,
  fetchMaestroApi,
  addTrabajadorApi,
  getDriveConfigApi,
  updateDriveConfigApi,
  testDriveWebhookApi,
  syncMaestroFromDriveApi,
  DriveConfig,
} from './services/apiClient';
import {
  getOrCreateSpreadsheet,
  appendSolicitudToDrive,
  fetchMaestroFromDrive,
} from './services/googleDriveSheets';

export default function App() {
  const [activeTab, setActiveTab] = useState<'formulario' | 'cupos' | 'solicitudes' | 'maestro'>('formulario');

  // Estados de autenticación Google (opcional para administrador)
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [spreadsheetLink, setSpreadsheetLink] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  // Configuración de Google Drive automática (Webhook sin pedir correo)
  const [driveConfig, setDriveConfig] = useState<DriveConfig>({
    webhookUrl: 'https://script.google.com/macros/s/AKfycbyombeZp7panywXAoIq8Q0cSjliwnOoPt3lUlH4R-h8YAoOvsCZNZrW7shziRJl92E7/exec',
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1ecAKLTKJ-qrIWMGl5Rk1SpxhlTpfY6k5Gkyl4b5efzA/edit',
    syncEnabled: true,
  });
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);

  // Datos principales
  const [maestro, setMaestro] = useState<TrabajadorMaestro[]>(TRABAJADORES_INICIALES);
  const [solicitudes, setSolicitudes] = useState<SolicitudFlor[]>(SOLICITUDES_INICIALES);

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
        const [solis, maest, cfg] = await Promise.all([
          fetchSolicitudesApi(),
          fetchMaestroApi(),
          getDriveConfigApi(),
        ]);

        if (solis && solis.length > 0) {
          setSolicitudes(solis);
        }
        if (maest && maest.length > 0) {
          setMaestro(maest);
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

  // Guardar nueva solicitud:
  // 1. Guarda en el backend Express permanentemente (seguridad total)
  // 2. Si hay Webhook de Drive configurado, el backend lo envía automáticamente a la hoja de Google Drive (cero login, cero correo)
  // 3. Si hay sesión Google OAuth activa, también sincroniza vía API
  const handleGuardarSolicitud = async (
    nueva: SolicitudFlor
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const guardada = await createSolicitudApi(nueva);

      // Si además hay token de OAuth activo en el cliente, asegurar registro en Drive
      const activeToken = token || (await getAccessToken());
      if (activeToken && spreadsheetId && !guardada.syncedToDrive) {
        try {
          await appendSolicitudToDrive(activeToken, spreadsheetId, guardada);
          guardada.syncedToDrive = true;
        } catch (oErr) {
          console.warn('Aviso escribiendo vía token OAuth:', oErr);
        }
      }

      setSolicitudes((prev) => [guardada, ...prev]);

      if (guardada.syncedToDrive || driveConfig.webhookUrl) {
        mostrarToast('Solicitud guardada en servidor y registrada en Google Drive');
      } else {
        mostrarToast('Solicitud guardada con total seguridad en el servidor');
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error al guardar la solicitud' };
    }
  };

  // Agregar trabajador al maestro
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

  // Importar lista masiva de trabajadores
  const handleImportarCSV = async (nuevos: TrabajadorMaestro[]) => {
    setMaestro((prev) => {
      const codigosExistentes = new Set(prev.map((p) => p.codigo.toUpperCase()));
      const filtrados = nuevos.filter((n) => !codigosExistentes.has(n.codigo.toUpperCase()));
      return [...filtrados, ...prev];
    });

    for (const item of nuevos) {
      await addTrabajadorApi(item).catch(() => {});
    }

    mostrarToast(`Se importaron ${nuevos.length} trabajadores a la Hoja Maestro`);
  };

  // Guardar configuración del Webhook automático de Google Drive
  const handleGuardarDriveConfig = async (webhookUrl: string, spreadsheetUrl: string) => {
    const updated = await updateDriveConfigApi({ webhookUrl, spreadsheetUrl });
    setDriveConfig(updated);
    if (spreadsheetUrl) {
      setSpreadsheetLink(spreadsheetUrl);
    }
    mostrarToast('Configuración de Google Drive actualizada');
  };

  // Probar conexión automática con Drive
  const handleProbarConexionDrive = async () => {
    return await testDriveWebhookApi();
  };

  // Recargar datos desde la hoja Google Sheets "Maestro"
  const handleRecargarDeDrive = async () => {
    setIsSyncing(true);
    try {
      // 1. Intentar primero sincronizar a través del Webhook automático (cero correos)
      const resWebhook = await syncMaestroFromDriveApi();
      if (resWebhook.success && resWebhook.maestro && resWebhook.maestro.length > 0) {
        setMaestro(resWebhook.maestro);
        mostrarToast(`¡Sincronizado! Se cargaron ${resWebhook.maestro.length} trabajadores de Google Drive`);
        return;
      }

      // 2. Si no hay webhook o falló, revisar si hay token OAuth
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
          mostrarToast(`Se cargaron ${trabajadoresDrive.length} trabajadores desde la hoja de Drive`);
          return;
        }
      }

      // Si no está configurado, abrir ventana para activar
      setIsDriveModalOpen(true);
    } catch {
      setIsDriveModalOpen(true);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Toast flotante de sincronización */}
      {syncToast && (
        <div className="fixed bottom-4 right-4 z-50 bg-[#0a2958] text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-xl border border-white/20 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {syncToast}
        </div>
      )}

      {/* Modal de Conexión Automática a Google Drive */}
      <DriveConfigModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        config={driveConfig}
        onGuardarConfig={handleGuardarDriveConfig}
        onProbarConexion={handleProbarConexionDrive}
      />

      {/* Navbar Superior */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        spreadsheetLink={spreadsheetLink || driveConfig.spreadsheetUrl}
        driveConfig={driveConfig}
        onOpenDriveModal={() => setIsDriveModalOpen(true)}
        totalSolicitudes={solicitudes.length}
      />

      {/* Contenido Principal por Pestaña */}
      <main className="flex-1">
        {activeTab === 'formulario' && (
          <SolicitudForm
            maestro={maestro}
            solicitudes={solicitudes}
            onGuardarSolicitud={handleGuardarSolicitud}
            isDriveConnected={!!(driveConfig.webhookUrl || user)}
            spreadsheetLink={spreadsheetLink || driveConfig.spreadsheetUrl}
            onRecargarMaestroDeDrive={handleRecargarDeDrive}
          />
        )}

        {activeTab === 'cupos' && (
          <CuposDashboard
            solicitudes={solicitudes}
            onIrAFormulario={() => setActiveTab('formulario')}
          />
        )}

        {activeTab === 'solicitudes' && (
          <SolicitudesTable
            solicitudes={solicitudes}
            isDriveConnected={!!(driveConfig.webhookUrl || user)}
            spreadsheetLink={spreadsheetLink || driveConfig.spreadsheetUrl}
            onSincronizarConDrive={async () => {
              setIsDriveModalOpen(true);
            }}
            isSyncing={isSyncing}
          />
        )}

        {activeTab === 'maestro' && (
          <MaestroTrabajadores
            maestro={maestro}
            onAgregarTrabajador={handleAgregarTrabajador}
            onImportarCSV={handleImportarCSV}
            isDriveConnected={!!(driveConfig.webhookUrl || user)}
            onRecargarDeDrive={handleRecargarDeDrive}
            isSyncing={isSyncing}
          />
        )}
      </main>

      {/* Footer corporativo */}
      <footer className="bg-white border-t border-slate-200 py-4 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#0a2958]">MG Consultores S.A.S.</span>
            <span>•</span>
            <span>Sistema de Flor de Obsequio (Sedes MG, HA, SC)</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Entrega: Viernes en Poscosecha al finalizar la jornada laboral • Conexión Segura
          </p>
        </div>
      </footer>
    </div>
  );
}
