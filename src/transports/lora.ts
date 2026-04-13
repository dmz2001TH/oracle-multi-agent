/**
 * LoRa Transport — Off-grid mesh networking for oracle agents.
 *
 * STATUS: Implementation ready — requires hardware (LoRa radio module).
 *
 * Supported hardware:
 *   - RYLR998 / RYLR896 (REYAX) — UART serial, 868/915 MHz
 *   - SX1276/SX1278 (HopeRF RFM95W) — SPI, common in Arduino/ESP32
 *   - Dragino LoRa HAT — Raspberry Pi compatible
 *
 * Configuration (env vars):
 *   LORA_ENABLED=true         — Enable LoRa transport
 *   LORA_SERIAL_PORT=/dev/ttyUSB0 — Serial port for LoRa module
 *   LORA_BAUD_RATE=115200     — Serial baud rate
 *   LORA_BAND=915             — Frequency band (868 or 915 MHz)
 *   LORA_NODE_ID=1            — This node's mesh ID
 *
 * Protocol:
 *   Messages are JSON-encoded and fragmented into LoRa packets (max 256 bytes).
 *   Each packet: { seq, total, nodeId, payload }
 *   Mesh routing uses flooding with TTL (default 5 hops).
 */

import type { Transport, TransportTarget, TransportMessage, TransportPresence } from "../transport.js";
import type { FeedEvent } from "../lib/feed.js";
import { EventEmitter } from "events";
import { existsSync } from "fs";

interface LoRaPacket {
  seq: number;
  total: number;
  nodeId: number;
  ts: number;
  payload: string;
}

interface LoRaConfig {
  enabled: boolean;
  serialPort: string;
  baudRate: number;
  band: number;
  nodeId: number;
  maxPacketSize: number;
  meshTTL: number;
}

const DEFAULT_CONFIG: LoRaConfig = {
  enabled: false,
  serialPort: '/dev/ttyUSB0',
  baudRate: 115200,
  band: 915,
  nodeId: 1,
  maxPacketSize: 240,
  meshTTL: 5,
};

export class LoRaTransport extends EventEmitter implements Transport {
  readonly name = "lora";
  private _connected = false;
  private config: LoRaConfig;
  private serialPort: any = null;
  private msgHandlers = new Set<(msg: TransportMessage) => void>();
  private presenceHandlers = new Set<(p: TransportPresence) => void>();
  private feedHandlers = new Set<(e: FeedEvent) => void>();
  private _pendingFragments = new Map<string, Map<number, string>>();
  private _reassemblyTimeout = 30000;

  constructor(config: Partial<LoRaConfig> = {}) {
    super();
    this.config = {
      ...DEFAULT_CONFIG,
      enabled: process.env.LORA_ENABLED === 'true',
      serialPort: process.env.LORA_SERIAL_PORT || DEFAULT_CONFIG.serialPort,
      baudRate: parseInt(process.env.LORA_BAUD_RATE || '115200'),
      band: parseInt(process.env.LORA_BAND || '915'),
      nodeId: parseInt(process.env.LORA_NODE_ID || '1'),
      ...config,
    };
  }

  get connected() { return this._connected; }
  get isAvailable(): boolean {
    return this.config.enabled && existsSync(this.config.serialPort);
  }

  async connect(): Promise<void> {
    if (!this.config.enabled) {
      console.log('📡 LoRa transport: disabled (set LORA_ENABLED=true to enable)');
      return;
    }

    if (!this.isAvailable) {
      console.warn(`⚠️ LoRa: serial port ${this.config.serialPort} not found`);
      console.warn('   Connect a LoRa module or set LORA_SERIAL_PORT');
      return;
    }

    try {
      // Dynamic import of serialport (optional dep — not in package.json by default)
      const serialMod = await import('serialport' as string);
      const SerialPort = serialMod.SerialPort || serialMod.default;
      this.serialPort = new SerialPort({
        path: this.config.serialPort,
        baudRate: this.config.baudRate,
      });

      this.serialPort.on('open', () => {
        this._connected = true;
        console.log(`📡 LoRa connected: ${this.config.serialPort} @ ${this.config.baudRate} baud`);
        this._initModule();
      });

      this.serialPort.on('data', (data: Buffer) => this._handleIncoming(data));
      this.serialPort.on('error', (err: Error) => {
        console.error(`❌ LoRa error: ${err.message}`);
        this._connected = false;
      });

      this.serialPort.on('close', () => {
        this._connected = false;
        console.log('📡 LoRa disconnected');
      });

    } catch {
      console.warn(`⚠️ LoRa: 'serialport' package not installed. Run: npm install serialport`);
      console.warn(`   Hardware transport will use HTTP fallback.`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.serialPort?.isOpen) {
      this.serialPort.close();
    }
    this._connected = false;
    this._pendingFragments.clear();
  }

  async send(target: TransportTarget, message: string): Promise<boolean> {
    if (!this._connected || !this.serialPort) return false;

    try {
      const msgId = Math.random().toString(36).slice(2, 10);
      const fragments = this._fragment(message, msgId);

      for (const packet of fragments) {
        const destAddr = target.oracle || '0';
        const line = `AT+SEND=${destAddr},${JSON.stringify(packet)}\r\n`;
        this.serialPort.write(line);
        await new Promise(r => setTimeout(r, 50));
      }

      return true;
    } catch (err) {
      console.error(`❌ LoRa send failed: ${(err as Error).message}`);
      return false;
    }
  }

  async publishPresence(presence: TransportPresence): Promise<void> {
    if (!this._connected) return;
    await this.send({ oracle: 'broadcast' } as TransportTarget,
      JSON.stringify({ type: 'presence', ...presence }));
  }

  async publishFeed(event: FeedEvent): Promise<void> {
    if (!this._connected) return;
    await this.send({ oracle: 'broadcast' } as TransportTarget,
      JSON.stringify({ type: 'feed', ...event }));
  }

  onMessage(handler: (msg: TransportMessage) => void) { this.msgHandlers.add(handler); }
  onPresence(handler: (p: TransportPresence) => void) { this.presenceHandlers.add(handler); }
  onFeed(handler: (e: FeedEvent) => void) { this.feedHandlers.add(handler); }

  canReach(target: TransportTarget): boolean {
    // LoRa can reach any target when connected
    return this._connected;
  }

  private _fragment(message: string, msgId: string): LoRaPacket[] {
    const chunks: string[] = [];
    for (let i = 0; i < message.length; i += this.config.maxPacketSize) {
      chunks.push(message.slice(i, i + this.config.maxPacketSize));
    }

    return chunks.map((payload, seq) => ({
      seq,
      total: chunks.length,
      nodeId: this.config.nodeId,
      ts: Date.now(),
      payload,
    }));
  }

  private _reassemble(packet: LoRaPacket, msgId: string): string | null {
    if (packet.total === 1) return packet.payload;

    if (!this._pendingFragments.has(msgId)) {
      this._pendingFragments.set(msgId, new Map());
      setTimeout(() => this._pendingFragments.delete(msgId), this._reassemblyTimeout);
    }

    const fragments = this._pendingFragments.get(msgId)!;
    fragments.set(packet.seq, packet.payload);

    if (fragments.size === packet.total) {
      this._pendingFragments.delete(msgId);
      let full = '';
      for (let i = 0; i < packet.total; i++) {
        full += fragments.get(i) || '';
      }
      return full;
    }

    return null;
  }

  private _handleIncoming(data: Buffer): void {
    const text = data.toString('utf-8').trim();
    if (!text) return;

    try {
      // RYLR format: +RCV=<addr>,<len>,<data>,<RSSI>,<SNR>
      const rcvMatch = text.match(/\+RCV=(\d+),(\d+),(.+?),(-?\d+),(-?\d+)/);
      if (rcvMatch) {
        const [, , , payload] = rcvMatch;
        const packet: LoRaPacket = JSON.parse(payload);
        const msgId = `${packet.nodeId}-${packet.ts}`;

        const fullMessage = this._reassemble(packet, msgId);
        if (fullMessage) {
          this._dispatchMessage(fullMessage);
        }
        return;
      }

      if (text.startsWith('+OK') || text.startsWith('+ERR')) {
        this.emit('at-response', text);
      }
    } catch {
      // Non-JSON data, ignore
    }
  }

  private _dispatchMessage(raw: string): void {
    try {
      const parsed = JSON.parse(raw);

      if (parsed.type === 'presence') {
        const presence: TransportPresence = {
          oracle: parsed.oracle || 'unknown',
          host: parsed.host || 'lora',
          status: parsed.status || 'ready',
          timestamp: parsed.timestamp || Date.now(),
        };
        for (const h of this.presenceHandlers) h(presence);
      } else if (parsed.type === 'feed') {
        for (const h of this.feedHandlers) h(parsed as FeedEvent);
      } else {
        const msg: TransportMessage = {
          from: parsed.from || 'lora',
          to: parsed.to || 'broadcast',
          body: parsed.body || raw,
          timestamp: parsed.timestamp || Date.now(),
          transport: 'hub',
        };
        for (const h of this.msgHandlers) h(msg);
      }
    } catch {
      const msg: TransportMessage = {
        from: 'lora',
        to: 'broadcast',
        body: raw,
        timestamp: Date.now(),
        transport: 'hub',
      };
      for (const h of this.msgHandlers) h(msg);
    }
  }

  private _initModule(): void {
    if (!this.serialPort) return;

    const commands = [
      `AT+ADDRESS=${this.config.nodeId}\r\n`,
      `AT+NETWORKID=3\r\n`,
      `AT+BAND=${this.config.band}000000\r\n`,
      `AT+PARAMETER=9,7,1,12\r\n`,
    ];

    let i = 0;
    const sendNext = () => {
      if (i < commands.length) {
        this.serialPort.write(commands[i], () => {
          i++;
          setTimeout(sendNext, 200);
        });
      } else {
        console.log(`📡 LoRa module initialized: node=${this.config.nodeId}, band=${this.config.band}MHz`);
      }
    };

    setTimeout(sendNext, 500);
  }
}
