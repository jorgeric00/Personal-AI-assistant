# LifeOS como app Android

La app Android guarda todos los datos **en el propio móvil**: no necesita servidor, ni cuenta, ni conexión a
internet. Usa la misma interfaz que la web, compilada en modo «app» (`npm run build:app`) y empaquetada con
Capacitor. Los datos están en una base de datos SQLite dentro del almacenamiento privado de la app.

## Qué funciona ya

| Parte | En la app |
| --- | --- |
| Hoy | ✅ Saludo, tareas y agenda de hoy, próximos recordatorios, hábitos de hoy y notas fijadas |
| Tareas y recordatorios | ✅ Todo: repetición, categorías, completar, posponer, calendario |
| Notas | ✅ Todo: etiquetas, búsqueda, fijar, favoritas, archivo, papelera (se vacía a los 30 días) y tareas relacionadas |
| Agenda | ✅ Actividades con categorías, repetición, estados, solapes, vistas de día, semana y mes. Los entrenos aparecerán cuando el entreno funcione en la app |
| Hábitos | ✅ Todo: diarios o unas veces por semana, marcar días, rachas y estadísticas |
| Ajustes | ✅ Nombre, idioma y apariencia |
| Avisos de tareas y recordatorios | ✅ Los programa el propio móvil, sin internet (ver abajo) |
| Avisos de agenda y hábitos | ❌ Aún no: en la app no se muestran esos campos (en la web sí funcionan) |
| Finanzas, entreno, alimentación, objetivos e informes | ❌ Aún no: no aparecen en la app |
| Copia de seguridad | ✅ Guardar y restaurar un archivo con todos los datos (ver abajo) |

Lo que todavía no está no aparece en la app, para no dejar nada a medias. Se irá añadiendo por partes.

## Copia de seguridad

Los datos solo están en el móvil: si desinstalas la app o borras sus datos desde los ajustes de Android, se pierden.
La copia automática de Android en la nube de Google está desactivada a propósito (`allowBackup="false"`), porque
subiría tus datos personales a un servicio externo sin que lo decidas tú.

En **Ajustes → Copia de seguridad**:

- **Guardar copia** crea un archivo `lifeos-copia-AAAA-MM-DD.lifeos` con todos los datos y abre el menú de compartir
  de Android para que elijas dónde guardarlo (Archivos, un ordenador, tu nube…). La app no lo envía a ningún sitio
  por su cuenta. El archivo no va cifrado: guárdalo en un sitio de confianza.
- **Restaurar una copia** sustituye todos los datos por los del archivo, después de confirmarlo. Si el archivo no es
  una copia de LifeOS o está dañado, no se cambia nada. Una copia de una versión anterior de la app se pone al día
  sola; una de una versión más nueva pide actualizar la app primero.

## Avisos

Los avisos de las tareas y recordatorios con «Aviso» los programa el propio móvil con notificaciones locales: no
pasan por ningún servidor y suenan aunque no haya internet.

- La primera vez que guardes algo con aviso, Android pedirá permiso para mostrar notificaciones. También se puede
  activar en **Ajustes → Notificaciones** de LifeOS.
- En Android 12 o posterior, el sistema puede retrasar los avisos unos minutos si LifeOS no tiene permiso de
  «Alarmas y recordatorios». Ajustes de LifeOS muestra un botón para concederlo cuando falta.
- Cada vez que abres la app o cambias algo se programan los avisos de los próximos 30 días (como mucho 200). Si
  pasas más de un mes sin abrir la app, los avisos posteriores no sonarán hasta que la vuelvas a abrir.
- Al tocar un aviso se abre la lista de tareas.

## Instalarla en el móvil

1. En el móvil, abre la página de la versión
   [«app»](https://github.com/jorgeric00/Personal-AI-assistant/releases/tag/app) del repositorio y descarga
   `lifeos.apk`. Esta versión se actualiza sola con cada cambio que llega a `main`.
2. Ábrelo. Android pedirá permiso para instalar apps de esa fuente (el navegador o «Archivos»): acéptalo solo para
   esta instalación.
3. Abre LifeOS. No pide iniciar sesión.

Para actualizar, descarga e instala el APK nuevo encima: se conservan los datos **siempre que esté firmado con la
misma clave** (ver abajo). Si Android dice que la app no se puede instalar porque entra en conflicto con la
existente, es que la firma ha cambiado.

## Firma del APK (una sola vez)

Android solo instala una actualización encima de la app si las dos están firmadas con la misma clave. Sin clave
configurada, la compilación usa una clave de depuración distinta en cada ejecución y para actualizar habría que
desinstalar (y perder los datos). Para que siempre se firme igual:

1. En un ordenador con Java, crea la clave y guarda bien el fichero y la contraseña (si se pierden, la siguiente
   versión no se podrá instalar encima):

   ```bash
   keytool -genkeypair -keystore lifeos.jks -alias lifeos -keyalg RSA -keysize 4096 -validity 36500
   base64 -w0 lifeos.jks > lifeos.jks.b64      # en macOS: base64 -i lifeos.jks -o lifeos.jks.b64
   ```

   Usa la misma contraseña para el almacén y para la clave.
2. En GitHub, en **Settings → Secrets and variables → Actions → New repository secret**, crea:
   - `ANDROID_KEYSTORE_BASE64` con el contenido de `lifeos.jks.b64`.
   - `ANDROID_KEYSTORE_PASSWORD` con la contraseña.

La clave nunca se guarda en el repositorio, que es público.

## Desarrollo

```bash
cd frontend
npm run build:app          # interfaz en modo app (VITE_LOCAL=true, ver .env.app)
npx cap sync android       # copia la interfaz al proyecto Android
npx cap open android       # abre Android Studio para ejecutarla en un emulador o en el móvil
```

También se puede probar en el navegador: `npm run build:app && npx vite preview`. Los datos se guardan en el
IndexedDB del navegador.

La API local (`frontend/src/local/`) responde a las mismas rutas que el servidor con la misma lógica, así que las
pantallas no cambian. Cada módulo se activa en `LOCAL_MODULES` (`frontend/src/platform.ts`) cuando está completo.
