/**
 * server/scale.js — BLE scale manager
 *
 * Strategy:
 *   1. Try @stoprocent/noble (Node.js native BLE — best on Linux).
 *   2. If noble is unavailable, unsupported, or crashes → automatically spawn
 *      scale_daemon.py as a subprocess (requires Python 3.10+ + etekcity lib).
 *
 * Emits:
 *   'reading'  {weight_kg, detergent_ml, load_level, stable, source}
 *              → every stable measurement while the user is on the scale
 *   'weight'   {weight_kg, detergent_ml, load_level, stable, source}
 *              → final settled reading (SETTLE_MS after last reading)
 *   'status'   {scanning, source, error?}
 *              → state changes
 *
 * Usage:
 *   import { scaleManager } from './scale.js';
 *   scaleManager.start(address);
 *   scaleManager.on('weight', (data) => console.log(data));
 *   scaleManager.stop();
 */

import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SCALE_NAME   = 'Etekcity Smart Fitness Scale';
const NOTIFY_UUID  = 'fff1';   // noble shortens 0000fff1-0000-1000-8000-00805f9b34fb
const SETTLE_MS    = 5_000;

// ── Detergent dose calculator ─────────────────────────────────
function calcDetergent(kg) {
  if (kg <= 2.0) return { detergent_ml: 20, load_level: 'light' };
  if (kg <= 4.5) return { detergent_ml: 35, load_level: 'normal' };
  if (kg <= 7.0) return { detergent_ml: 50, load_level: 'medium' };
  if (kg <= 9.0) return { detergent_ml: 65, load_level: 'heavy' };
  return { detergent_ml: 80, load_level: 'max' };
}

// ── ESF-551 BLE payload parser ────────────────────────────────
// Protocol reverse-engineered from etekcity_esf551_ble Python lib:
//   bytes 0-1  : magic a5 02
//   bytes 3-4  : 10 00
//   bytes 6-9  : 01 61 a1 00
//   bytes 10-12: weight (little-endian 3-byte int, divide by 1000 → kg)
//   byte 19    : 1 = stable, 0 = unstable (still settling)
function parsePayload(buf) {
  if (buf.length !== 22)                            return null;
  if (buf[0] !== 0xa5 || buf[1] !== 0x02)          return null;
  if (buf[3] !== 0x10 || buf[4] !== 0x00)          return null;
  if (buf[6] !== 0x01 || buf[7] !== 0x61 ||
      buf[8] !== 0xa1 || buf[9] !== 0x00)          return null;
  if (buf[19] !== 1)                                return null; // not stable yet
  const raw = buf[10] | (buf[11] << 8) | (buf[12] << 16);
  return Math.round(raw) / 1000; // kg
}

// ── Python binary location ────────────────────────────────────
function findPython() {
  return process.platform === 'darwin'
    ? '/opt/homebrew/bin/python3'   // macOS Homebrew Python 3.10+
    : 'python3';                    // Linux: assumes python3 in PATH
}

// ─────────────────────────────────────────────────────────────
class ScaleManager extends EventEmitter {
  constructor() {
    super();
    this._address     = null;
    this._scanning    = false;
    this._source      = null;     // 'noble' | 'python'
    this._nobleFailed = false;
    this._noble       = null;
    this._peripheral  = null;
    this._pythonProc  = null;
    this._settleTimer = null;
    this._lastKg      = null;
  }

  // ── Public API ──────────────────────────────────────────────

  /** Start scanning. Safe to call multiple times. */
  start(address) {
    if (this._scanning) return;
    this._address  = address;
    this._scanning = true;
    this._tryNoble();
  }

  /** Stop everything. */
  stop() {
    this._scanning = false;
    clearTimeout(this._settleTimer);
    this._stopNoble();
    this._stopPython();
    this.emit('status', { scanning: false, source: null });
  }

  get scanning()  { return this._scanning; }
  get source()    { return this._source; }
  get lastWeight(){ return this._lastKg; }

  // ── Internal: settle logic ──────────────────────────────────

  _onReading(kg, source) {
    this._lastKg = kg;
    this._source = source;

    // Emit live intermediate reading
    this.emit('reading', { weight_kg: kg, ...calcDetergent(kg), stable: true, source });

    // Reset settle timer — emit final 'weight' event SETTLE_MS after last reading
    clearTimeout(this._settleTimer);
    this._settleTimer = setTimeout(() => {
      this.emit('weight', {
        weight_kg:   this._lastKg,
        ...calcDetergent(this._lastKg),
        stable: true,
        source,
      });
    }, SETTLE_MS);
  }

  // ── Noble path ──────────────────────────────────────────────

  async _tryNoble() {
    if (this._nobleFailed) {
      this._startPython();
      return;
    }

    console.log('[scale] trying noble (Node.js native BLE)...');
    try {
      const { withBindings } = await import('@stoprocent/noble');
      const noble = withBindings('default');
      this._noble = noble;

      // Wait for adapter to be ready (10 s timeout)
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('noble state timeout')), 10_000);

        const onState = (state) => {
          if (state === 'poweredOn') {
            clearTimeout(t);
            noble.removeListener('stateChange', onState);
            resolve();
          } else if (state === 'unsupported' || state === 'unauthorized' || state === 'poweredOff') {
            clearTimeout(t);
            noble.removeListener('stateChange', onState);
            reject(new Error(`noble state: ${state}`));
          }
        };

        if (noble.state === 'poweredOn') { clearTimeout(t); resolve(); return; }
        noble.on('stateChange', onState);
      });

      this._listenNoble(noble);
      await noble.startScanningAsync([], true /* allow duplicates */);

      console.log('[scale] noble scanning for scale...');
      this.emit('status', { scanning: true, source: 'noble' });

    } catch (err) {
      console.warn(`[scale] noble unavailable (${err.message}) → falling back to Python`);
      this._nobleFailed = true;
      this._noble = null;
      this._startPython();
    }
  }

  _listenNoble(noble) {
    noble.on('discover', async (peripheral) => {
      const name = peripheral.advertisement?.localName ?? '';
      if (name !== SCALE_NAME) return;

      console.log(`[scale] noble found: ${name} @ ${peripheral.address}`);

      try {
        await noble.stopScanningAsync().catch(() => {});
        this._peripheral = peripheral;
        await peripheral.connectAsync();

        // Discover fff0 service → fff1 characteristic
        const { characteristics } = await peripheral
          .discoverSomeServicesAndCharacteristicsAsync(['fff0'], [NOTIFY_UUID]);

        if (!characteristics.length) throw new Error('fff1 characteristic not found');

        const notifyChar = characteristics[0];
        notifyChar.on('data', (buf) => {
          const kg = parsePayload(buf);
          if (kg !== null) this._onReading(kg, 'noble');
        });
        await notifyChar.subscribeAsync();
        console.log('[scale] noble subscribed to weight notifications');

        // On disconnect → rescan
        peripheral.once('disconnect', () => {
          console.log('[scale] scale disconnected, restarting noble scan in 2s...');
          this._peripheral = null;
          if (this._scanning) {
            setTimeout(() => noble.startScanningAsync([], true).catch((e) =>
              console.error('[scale] noble rescan error:', e.message)), 2_000);
          }
        });

      } catch (err) {
        console.error('[scale] noble connect failed:', err.message);
        this._nobleFailed = true;
        this._stopNoble();
        // Fallback to Python
        if (this._scanning) this._startPython();
      }
    });
  }

  _stopNoble() {
    if (!this._noble) return;
    try { this._noble.stopScanning(); } catch (_e) { /* ignore */ }
    try { this._peripheral?.disconnect(); } catch (_e) { /* ignore */ }
    this._noble      = null;
    this._peripheral = null;
  }

  // ── Python fallback path ────────────────────────────────────

  _startPython() {
    if (this._pythonProc) return; // already running

    const python     = findPython();
    const script     = join(__dirname, 'scale_daemon.py');
    const address    = this._address ?? 'F8E3507D-5030-FE6E-8687-62F94171F87B';

    console.log(`[scale] spawning Python daemon: ${python} ${script} ${address}`);

    this._pythonProc = spawn(python, [script, address], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this._source = 'python';
    this.emit('status', { scanning: true, source: 'python' });

    let lineBuf = '';
    this._pythonProc.stdout.on('data', (chunk) => {
      lineBuf += chunk.toString();
      const lines = lineBuf.split('\n');
      lineBuf = lines.pop(); // keep incomplete last line
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const data = JSON.parse(trimmed);
          if (typeof data.weight_kg === 'number') {
            this._onReading(data.weight_kg, 'python');
          }
        } catch (_) {
          console.warn('[scale/py] unparseable stdout:', trimmed);
        }
      }
    });

    this._pythonProc.stderr.on('data', (d) =>
      process.stdout.write(`[scale/py] ${d.toString()}`));

    this._pythonProc.on('error', (err) => {
      console.error('[scale] Python spawn error:', err.message);
      this._pythonProc = null;
      this.emit('status', { scanning: false, source: null, error: err.message });
    });

    this._pythonProc.on('exit', (code, signal) => {
      console.log(`[scale] Python daemon exited (code=${code}, signal=${signal})`);
      this._pythonProc = null;
      if (this._scanning) {
        console.log('[scale] restarting Python daemon in 3s...');
        setTimeout(() => this._startPython(), 3_000);
      }
    });
  }

  _stopPython() {
    if (!this._pythonProc) return;
    this._pythonProc.kill('SIGTERM');
    this._pythonProc = null;
  }
}

// Singleton — shared across all SSE clients
export const scaleManager = new ScaleManager();
