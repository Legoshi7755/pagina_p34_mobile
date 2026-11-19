/*
 * Abstraccion BLE unificada.
 *
 * Funciona en el navegador (Web Bluetooth) y dentro de una app Capacitor
 * Android/iOS (via @capacitor-community/bluetooth-le). Detecta el entorno
 * y usa la API correspondiente. La UI solo conoce esta interfaz.
 *
 * Expone window.BLE:
 *   BLE.isAvailable()   -> bool
 *   BLE.isConnected()   -> bool
 *   BLE.connect({onData, onDisconnect, onLog}) -> {name, id}
 *   BLE.send(string)    -> Promise<void>
 *   BLE.disconnect()    -> Promise<void>
 */
(function () {
  'use strict';

  var SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
  var CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

  function hasCapacitor() {
    return !!(window.Capacitor
      && typeof window.Capacitor.isNativePlatform === 'function'
      && window.Capacitor.isNativePlatform()
      && window.Capacitor.Plugins
      && window.Capacitor.Plugins.BluetoothLe);
  }

  var state = {
    mode: null,
    connected: false,
    device: null,
    characteristic: null,
    deviceId: null,
    onData: null,
    onDisconnect: null,
    onLog: null
  };

  function log(msg) {
    if (state.onLog) {
      try { state.onLog(msg); } catch (_) {}
    }
  }

  function bytesToBase64(bytes) {
    var bin = '';
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }

  function base64ToBytes(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function isAvailable() {
    return hasCapacitor() || !!navigator.bluetooth;
  }

  function isConnected() {
    return state.connected;
  }

  async function connect(opts) {
    opts = opts || {};
    state.onData = opts.onData || null;
    state.onDisconnect = opts.onDisconnect || null;
    state.onLog = opts.onLog || null;

    if (hasCapacitor()) {
      state.mode = 'cap';
      return connectCapacitor();
    }
    if (navigator.bluetooth) {
      state.mode = 'web';
      return connectWeb();
    }
    throw new Error('Bluetooth no soportado en este entorno');
  }

  /* ---------- Web Bluetooth ---------- */

  async function connectWeb() {
    var device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [SERVICE_UUID]
    });
    log('Dispositivo seleccionado: ' + (device.name || 'Sin nombre') + '. Conectando...');
    device.addEventListener('gattserverdisconnected', onWebDisconnected);

    var server = await device.gatt.connect();
    log('GATT conectado. Solicitando servicio principal...');

    var service = await server.getPrimaryService(SERVICE_UUID);
    var characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
    log('Canal vinculado. Esperando transmisiones.');

    await characteristic.startNotifications();
    characteristic.addEventListener('characteristicvaluechanged', onWebNotify);

    state.device = device;
    state.characteristic = characteristic;
    state.connected = true;
    return { name: device.name || 'ESP32', id: device.id };
  }

  function onWebDisconnected() {
    state.connected = false;
    state.device = null;
    state.characteristic = null;
    if (state.onDisconnect) {
      try { state.onDisconnect(); } catch (_) {}
    }
  }

  function onWebNotify(event) {
    try {
      var text = new TextDecoder('utf-8').decode(event.target.value);
      if (state.onData) state.onData(text);
    } catch (_) {}
  }

  /* ---------- Capacitor (plugin nativo) ---------- */

  function cap() { return window.Capacitor.Plugins.BluetoothLe; }

  async function connectCapacitor() {
    var ble = cap();
    await ble.initialize({ androidNeverForLocation: true });
    log('Scanner inicializado. Buscando dispositivos...');

    var dev = await ble.requestDevice({ optionalServices: [SERVICE_UUID] });
    log('Dispositivo seleccionado: ' + (dev.name || 'Sin nombre') + ' (' + dev.deviceId + '). Conectando...');

    await ble.connect({ deviceId: dev.deviceId });
    log('GATT conectado. Suscribiendo notificaciones...');

    var evName = 'notification|' + dev.deviceId + '|' + SERVICE_UUID + '|' + CHARACTERISTIC_UUID;
    await ble.addListener(evName, function (data) {
      try {
        var bytes = base64ToBytes(data.value);
        var text = new TextDecoder('utf-8').decode(bytes);
        if (state.onData) state.onData(text);
      } catch (_) {}
    });
    await ble.startNotifications({
      deviceId: dev.deviceId,
      service: SERVICE_UUID,
      characteristic: CHARACTERISTIC_UUID
    });

    await ble.addListener('disconnected|' + dev.deviceId, function () {
      state.connected = false;
      state.deviceId = null;
      if (state.onDisconnect) {
        try { state.onDisconnect(); } catch (_) {}
      }
    });

    log('Canal vinculado. Esperando transmisiones.');
    state.deviceId = dev.deviceId;
    state.connected = true;
    return { name: dev.name || 'ESP32', id: dev.deviceId };
  }

  /* ---------- API unificada ---------- */

  async function send(text) {
    if (!state.connected) throw new Error('No conectado');
    var bytes = new TextEncoder().encode(text);
    if (state.mode === 'cap') {
      await cap().write({
        deviceId: state.deviceId,
        service: SERVICE_UUID,
        characteristic: CHARACTERISTIC_UUID,
        value: bytesToBase64(bytes)
      });
    } else {
      await state.characteristic.writeValue(bytes);
    }
  }

  async function disconnect() {
    try {
      if (state.mode === 'cap' && state.deviceId) {
        await cap().disconnect({ deviceId: state.deviceId });
      } else if (state.device && state.device.gatt && state.device.gatt.connected) {
        state.device.gatt.disconnect();
      }
    } finally {
      state.connected = false;
    }
  }

  window.BLE = {
    isAvailable: isAvailable,
    isConnected: isConnected,
    connect: connect,
    send: send,
    disconnect: disconnect,
    SERVICE_UUID: SERVICE_UUID,
    CHARACTERISTIC_UUID: CHARACTERISTIC_UUID
  };
})();
