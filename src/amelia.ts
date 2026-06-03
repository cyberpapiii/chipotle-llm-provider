/**
 * Amelia (IPsoft) client for Chipotle's Pepper chatbot.
 *
 * Protocol reverse-engineered from amelia.chipotle.com:
 *
 * 1. GET /Amelia/api/init          → anonymous session + csrfToken + domainId
 * 2. GET /Amelia/api/sock/info     → SockJS transport probe
 * 3. WebSocket /Amelia/api/sock/{server}/{session}/websocket  (SockJS)
 * 4. STOMP CONNECT over SockJS
 * 5. STOMP SUBSCRIBE /queue/session.{sessionId}
 * 6. STOMP SEND /app/send  body: JSON { message, conversationId, domainCode }
 * 7. Receive STOMP MESSAGE on /queue/session.{sessionId}
 *
 * SockJS frame format:
 *   o           → open (server sends on connect)
 *   a["{...}"]  → array of JSON-encoded strings (messages)
 *   h           → heartbeat
 *   c[code,"reason"] → close
 *
 * STOMP frame format (inside SockJS a[] payload):
 *   COMMAND\nheader:value\n\nbody\0
 */

import WebSocket from 'ws';
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { v4 as uuidv4 } from 'uuid';

const BASE_URL = 'https://amelia.chipotle.com';
const DOMAIN_CODE = 'chipotle';
const DOMAIN_ID = '23700760-e1e5-4c3c-931d-8804e29a6775';

// SockJS server/session IDs (arbitrary, just need to look valid)
function randomServerId(): string {
  return String(Math.floor(Math.random() * 1000)).padStart(3, '0');
}
function randomSessionId(): string {
  return Array.from({ length: 8 }, () =>
    Math.random().toString(36).substring(2, 6)
  ).join('');
}

interface InitResponse {
  loggedIn: boolean;
  csrfToken: string;
  user: {
    userId: string;
    anonymous: boolean;
  };
}

interface AmeliaSession {
  csrfToken: string;
  userId: string;
  cookieHeader: string;
  conversationId: string | null;
}

export class AmeliaClient {
  private jar: CookieJar;
  private http: ReturnType<typeof wrapper>;
  private session: AmeliaSession | null = null;
  private ws: WebSocket | null = null;
  private subscriptionId = 'sub-0';
  private messageCallbacks: Map<string, (msg: string) => void> = new Map();
  private connected = false;
  private stompConnected = false;
  private pendingMessages: string[] = [];

  constructor() {
    this.jar = new CookieJar();
    this.http = wrapper(
      axios.create({
        baseURL: BASE_URL,
        withCredentials: true,
        jar: this.jar,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          Origin: BASE_URL,
          Referer: `${BASE_URL}/Amelia/ui/chipotle/chat?embed=iframe`,
        },
      })
    );
  }

  /**
   * Initialize anonymous session via /Amelia/api/init
   */
  async init(): Promise<void> {
    const res = await this.http.get<InitResponse>('/Amelia/api/init');
    const { csrfToken, user } = res.data;

    // Get Set-Cookie from response
    const cookies = await this.jar.getCookieString(BASE_URL);

    this.session = {
      csrfToken,
      userId: user.userId,
      cookieHeader: cookies,
      conversationId: null,
    };

    // Update http defaults with csrf token
    this.http.defaults.headers.common['X-CSRF-TOKEN'] = csrfToken;
    this.http.defaults.headers.common['Cookie'] = cookies;
  }

  /**
   * Connect to SockJS/STOMP WebSocket
   */
  async connect(): Promise<void> {
    if (!this.session) throw new Error('Call init() first');

    const server = randomServerId();
    const sessionId = randomSessionId();
    const wsUrl = `wss://amelia.chipotle.com/Amelia/api/sock/${server}/${sessionId}/websocket`;

    const cookies = await this.jar.getCookieString(BASE_URL);

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl, {
        headers: {
          Cookie: cookies,
          Origin: BASE_URL,
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      const timeout = setTimeout(() => reject(new Error('WS connect timeout')), 10000);

      this.ws.on('open', () => {
        this.connected = true;
      });

      this.ws.on('message', (raw: Buffer | string) => {
        const data = raw.toString();
        this.handleSockJSFrame(data, resolve, reject, timeout);
      });

      this.ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      this.ws.on('close', () => {
        this.connected = false;
        this.stompConnected = false;
      });
    });
  }

  private handleSockJSFrame(
    frame: string,
    resolveConnect: () => void,
    rejectConnect: (e: Error) => void,
    timeout: NodeJS.Timeout
  ): void {
    if (frame === 'o') {
      // SockJS open → send STOMP CONNECT
      this.sendSockJS(this.buildStompConnect());
      return;
    }

    if (frame === 'h') return; // heartbeat

    if (frame.startsWith('a')) {
      // SockJS message array: a["STOMP_FRAME"]
      try {
        const arr = JSON.parse(frame.slice(1)) as string[];
        for (const msg of arr) {
          this.handleStompFrame(msg, resolveConnect, rejectConnect, timeout);
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  private handleStompFrame(
    frame: string,
    resolveConnect: () => void,
    rejectConnect: (e: Error) => void,
    timeout: NodeJS.Timeout
  ): void {
    const command = frame.split('\n')[0];

    if (command === 'CONNECTED') {
      this.stompConnected = true;
      // Subscribe to our personal queue
      const sessionSuffix = this.session!.userId.substring(0, 8);
      this.sendSockJS(
        this.buildStompSubscribe(`/queue/session.${this.session!.userId}`, this.subscriptionId)
      );
      // Also subscribe to shorter form
      this.sendSockJS(
        this.buildStompSubscribe(`/user/queue/session`, 'sub-1')
      );
      clearTimeout(timeout);
      resolveConnect();
      return;
    }

    if (command === 'MESSAGE') {
      this.handleStompMessage(frame);
      return;
    }

    if (command === 'ERROR') {
      clearTimeout(timeout);
      rejectConnect(new Error(`STOMP ERROR: ${frame}`));
    }
  }

  private handleStompMessage(frame: string): void {
    // Parse STOMP MESSAGE frame
    const nullIdx = frame.indexOf('\0');
    const headerSection = frame.substring(0, nullIdx !== -1 ? nullIdx : frame.length);
    const lines = headerSection.split('\n');

    let body = '';
    const bodyStart = frame.indexOf('\n\n');
    if (bodyStart !== -1) {
      body = frame.substring(bodyStart + 2).replace(/\0$/, '');
    }

    if (!body) return;

    try {
      const parsed = JSON.parse(body);
      this.dispatchMessage(parsed);
    } catch {
      // plain text response
      this.dispatchMessage({ text: body });
    }
  }

  private dispatchMessage(parsed: Record<string, unknown>): void {
    // Amelia response envelope: { type, body: { text, ... } }
    let text = '';
    if (parsed.type === 'message' && parsed.body) {
      const body = parsed.body as Record<string, unknown>;
      text = (body.text as string) || JSON.stringify(body);
    } else if (parsed.text) {
      text = parsed.text as string;
    } else if (parsed.message) {
      text = parsed.message as string;
    } else {
      text = JSON.stringify(parsed);
    }

    // Notify all pending callbacks
    for (const [id, cb] of this.messageCallbacks.entries()) {
      cb(text);
      this.messageCallbacks.delete(id);
    }
  }

  /**
   * Send a message and wait for response
   */
  async chat(message: string, timeoutMs = 15000): Promise<string> {
    if (!this.stompConnected) {
      await this.init();
      await this.connect();
    }

    const callbackId = uuidv4();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.messageCallbacks.delete(callbackId);
        reject(new Error('Response timeout'));
      }, timeoutMs);

      this.messageCallbacks.set(callbackId, (text) => {
        clearTimeout(timer);
        resolve(text);
      });

      // STOMP SEND to /app/send
      const payload = JSON.stringify({
        message,
        domainCode: DOMAIN_CODE,
        conversationId: this.session?.conversationId ?? null,
        type: 'text',
      });

      this.sendSockJS(this.buildStompSend('/app/send', payload));
    });
  }

  // ─── STOMP frame builders ──────────────────────────────────────────────────

  private buildStompConnect(): string {
    const csrfToken = this.session?.csrfToken ?? '';
    return `CONNECT\naccept-version:1.1,1.0\nheart-beat:10000,10000\nX-CSRF-TOKEN:${csrfToken}\n\n\0`;
  }

  private buildStompSubscribe(destination: string, id: string): string {
    return `SUBSCRIBE\ndestination:${destination}\nid:${id}\n\n\0`;
  }

  private buildStompSend(destination: string, body: string): string {
    return `SEND\ndestination:${destination}\ncontent-type:application/json\ncontent-length:${Buffer.byteLength(body)}\n\n${body}\0`;
  }

  private sendSockJS(stompFrame: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not open');
    }
    // SockJS wraps STOMP frames: ["STOMP_FRAME"]
    this.ws.send(JSON.stringify([stompFrame]));
  }

  async close(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.stompConnected = false;
    this.session = null;
  }
}
