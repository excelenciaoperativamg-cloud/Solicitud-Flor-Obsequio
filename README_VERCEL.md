# Guía de Despliegue en Vercel - Flor de Obsequio (MG Consultores S.A.S.)

El proyecto ya está completamente configurado y optimizado para desplegarse en **Vercel** con un solo clic.

---

## 🚀 Arquitectura en Vercel

1. **Frontend (Vite + React SPA):**
   - Vercel compila la aplicación con `npm run build` (`vite build`).
   - Los archivos estáticos se publican en el CDN global de Vercel desde la carpeta `dist/`.

2. **Backend API (Vercel Serverless Functions):**
   - El archivo `vercel.json` reescribe las rutas `/api/*` hacia las funciones Serverless en `/api/index.ts` y `/api/[...all].ts`.
   - Manejador con tolerancia a sistemas de archivos de solo lectura (`/tmp` fallback).
   - Envío directo y bidireccional a la hoja de Google Drive vía el Webhook de Google Apps Script.

---

## 📋 Pasos para desplegar en Vercel

### Opción 1: Desde GitHub (Recomendada)
1. Suba este proyecto a un repositorio de **GitHub**.
2. Ingrese a [vercel.com](https://vercel.com/) e inicie sesión.
3. Haga clic en **"Add New..." > "Project"**.
4. Seleccione su repositorio de GitHub.
5. Vercel detectará automáticamente:
   - **Framework Preset:** `Vite`
   - **Build Command:** `vite build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
6. *(Opcional)* En la sección **Environment Variables**, puede configurar:
   - `GOOGLE_APPS_SCRIPT_WEBHOOK_URL`: `https://script.google.com/macros/s/AKfycbyombeZp7panywXAoIq8Q0cSjliwnOoPt3lUlH4R-h8YAoOvsCZNZrW7shziRJl92E7/exec`
   - `SPREADSHEET_URL`: `https://docs.google.com/spreadsheets/d/1ecAKLTKJ-qrIWMGI5Rk1SpxhlTpfY6k5Gkyl4b5efzA/edit`
7. Haga clic en **"Deploy"**. En menos de 1 minuto su aplicación estará publicada con dominio HTTPS `.vercel.app`.

### Opción 2: Usando Vercel CLI
Si prefiere desplegar desde la terminal de su computadora:
```bash
npm i -g vercel
vercel
```
Siga las instrucciones en pantalla aceptando los valores por defecto configurados en `vercel.json`.

---

## 🔒 Persistencia y Google Drive
- Todas las solicitudes registradas se sincronizan automáticamente con la pestaña `Solicitudes` de su archivo oficial de Google Drive (`Solicitud Flor Obsequio`).
- El Maestro de Trabajadores contiene los 2.385 trabajadores cargados y continúa sincronizándose directamente con la hoja.
