# pagina_p34 — App móvil (Android)

App móvil para el repartidor automático de cartas ESP32.
Envoltorio **Capacitor** de la web app `pagina_p34`.

## Qué cambia respecto a la web

- Bluetooth **nativo** (no Web Bluetooth) usando `@capacitor-community/bluetooth-le`
- Funciona en Android (iOS requeriría pasos extra, no incluido por ahora)
- Mismo UI, mismo protocolo contra el firmware ESP32
- Modo simulado sigue funcionando para pruebas sin hardware

## Prerequisitos

1. **Node.js 18 o superior** — https://nodejs.org (incluye npm)
2. **Android Studio** — https://developer.android.com/studio
3. **JDK 17 o superior** — viene con Android Studio
4. **Android SDK** — Android Studio te guía en la instalación

Verificá que todo esté bien:

```bash
node --version
```

```bash
npm --version
```

```bash
java --version
```

## Setup inicial (una vez)

```bash
cd D:\Codigo_claude\pagina_p34_mobile
```

```bash
npm install
```

```bash
npx cap add android
```

```bash
npx cap sync android
```

## Abrir en Android Studio

```bash
npx cap open android
```

Desde Android Studio:
- Enchufá el celular con **Depuración USB** activa, o
- Arrancá un emulador Android
- Presioná **Run** (▶)

La primera compilación puede tardar varios minutos (Gradle descargando dependencias).

## Flujo diario

Si editás algo en `www/` (HTML, JS, CSS):

```bash
npx cap sync android
```

Y después Run de nuevo desde Android Studio.

## Probar en PC sin compilar

Abrí `www/index.html` directo en Chrome/Edge. Usa Web Bluetooth del navegador.
El toggle **Modo simulado** no requiere BLE — útil para probar la UI.

## Permisos Android

El plugin `@capacitor-community/bluetooth-le` agrega automáticamente al
`AndroidManifest.xml`:

- `BLUETOOTH`
- `BLUETOOTH_ADMIN`
- `BLUETOOTH_SCAN`
- `BLUETOOTH_CONNECT`
- `ACCESS_FINE_LOCATION` (Android 11 y anteriores)

En la primera corrida, Android pide permiso de Bluetooth y ubicación — hay que aceptar.

## Estructura

```
pagina_p34_mobile/
├── www/                      Código web (lo que se empaqueta en la app)
│   ├── index.html            UI principal (patcheada para usar window.BLE)
│   └── ble.js                Abstracción BLE: Web Bluetooth + plugin Capacitor
├── android/                  Generado por Capacitor (no editar a mano)
├── capacitor.config.json     Config principal
├── package.json              Dependencias npm
└── README.md                 Este archivo
```

## Archivos clave

| Archivo | Rol |
|---------|-----|
| `www/index.html` | UI — misma lógica que la web, pero llama `window.BLE.connect/send/disconnect` |
| `www/ble.js` | Detecta plataforma y usa Web Bluetooth (en PC) o el plugin nativo (en Android) |

## Build de APK para distribución

### Opción A — GitHub Actions (cloud, recomendado)

El workflow `.github/workflows/android-build.yml` compila el APK en cada push a main/master.

1. Subí el proyecto a GitHub (ver sección siguiente).
2. Cada push dispara el workflow. Tarda ~5 min.
3. Entrás al repo en GitHub → pestaña **Actions** → último run → Artifacts → `pagina_p34-debug-apk`.
4. Bajás el zip, extraés el `.apk`, lo pasás al celular (USB, WhatsApp, Drive) y lo instalás.

Para disparar manualmente sin push: GitHub → Actions → Android APK build → **Run workflow**.

### Opción B — Android Studio

Desde Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
El APK sale en `android/app/build/outputs/apk/debug/app-debug.apk`.

Para release firmado necesitás keystore: **Build → Generate Signed Bundle / APK**.

### Opción C — Command line (Gradle sin IDE)

```bash
cd android
./gradlew assembleDebug
```

El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`.

## Subir el proyecto a GitHub (primera vez)

```bash
cd D:\Codigo_claude\pagina_p34_mobile
```

```bash
git init -b main
```

```bash
git add .
```

```bash
git commit -m "Initial commit: Capacitor wrapper for pagina_p34"
```

Ahora creá un repo nuevo en https://github.com/new (ej. `pagina_p34_mobile`), **sin README/gitignore/license** (vacío). Después:

```bash
git remote add origin https://github.com/<TU_USUARIO>/pagina_p34_mobile.git
```

```bash
git push -u origin main
```

Cuando pushees, GitHub te pide login (abre browser una vez y guarda credenciales).

## Para subir cambios después

```bash
git add .
git commit -m "describe el cambio"
git push
```

Cada push dispara el workflow y genera APK nuevo en Actions.

## Troubleshooting

- **Gradle falla al bajar dependencias**: chequear conexión y proxy.
- **Dispositivo no aparece en la lista BLE**: verificá que el ESP32 esté encendido,
  publicando el servicio `0000ffe0-...` y con nombre que empieza con `ESP32`.
- **Permisos rechazados**: ir a **Ajustes de Android → Apps → Mesa BLE → Permisos** y habilitar.
- **La web en Chrome no conecta**: Chrome requiere HTTPS o `localhost` para Web Bluetooth.
  Servir con `npx http-server www -S` o similar, o abrir el archivo con `file://` (depende del browser).
