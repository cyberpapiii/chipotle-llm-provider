# chipotle-llm-provider

OpenAI-compatible LLM proxy backed by Chipotle's "Pepper" AI chatbot ([IPsoft Amelia](https://www.ipsoft.com/amelia/)).
It also exposes the requested retail chatbot model IDs so researched adapters can be plugged in without touching OpenCode again.

Point any OpenAI SDK at `http://localhost:3000` and use Chipotle's AI as a free LLM provider.

---

## Quick Start

```bash
npm install
npm run dev
```

```bash
# Test it
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "pepper-1",
    "messages": [{"role": "user", "content": "What can you help me with?"}]
  }'
```

Use with any OpenAI SDK:

```python
import openai
client = openai.OpenAI(base_url="http://localhost:3000/v1", api_key="not-needed")
resp = client.chat.completions.create(
    model="pepper-1",
    messages=[{"role": "user", "content": "Hello"}]
)
print(resp.choices[0].message.content)
```

```typescript
import OpenAI from 'openai';
const client = new OpenAI({ baseURL: 'http://localhost:3000/v1', apiKey: 'not-needed' });
const resp = await client.chat.completions.create({
  model: 'pepper-1',
  messages: [{ role: 'user', content: 'Hello' }],
});
console.log(resp.choices[0].message.content);
```

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check, returns pool size and adapter counts |
| GET | `/v1/models` | List available retail bot models |
| GET | `/v1/retail/adapters` | List adapter configuration status |
| POST | `/v1/chat/completions` | Chat completions (streaming + non-streaming) |

## Retail Bot Models

| Brand | Bot | Model | Adapter env var |
|-------|-----|-------|-----------------|
| Chipotle | Pepper | `pepper-1` | Built in |
| Home Depot | Magic Apron beta | `magic-apron-1` | `HOME_DEPOT_MAGIC_APRON_BASE_URL` |
| Sephora | AI Beauty Chat | `beauty-chat-1` | `SEPHORA_AI_BEAUTY_CHAT_BASE_URL` |
| Nordstrom | Rosie | `rosie-1` | `NORDSTROM_ROSIE_BASE_URL` |
| Lowe's | Mylow | `mylow-1` | `LOWES_MYLOW_BASE_URL` |
| IKEA | Billie | `billie-1` | `IKEA_BILLIE_BASE_URL` |
| Expedia | Virtual Agent | `virtual-agent-1` | `EXPEDIA_VIRTUAL_AGENT_BASE_URL` |

The non-Chipotle adapters expect an authorized OpenAI-compatible `/v1` endpoint. Example:

```bash
export HOME_DEPOT_MAGIC_APRON_BASE_URL=http://localhost:3101/v1
export HOME_DEPOT_MAGIC_APRON_API_KEY=optional

curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "magic-apron-1",
    "messages": [{"role": "user", "content": "What can you help me with?"}]
  }'
```

If an adapter env var is unset, the proxy returns a clear server error telling contributors which endpoint needs to be configured.

Check adapter readiness:

```bash
curl http://localhost:3000/v1/retail/adapters
```

### Adapter Contract

Each non-Chipotle bot adapter should expose an OpenAI-compatible endpoint:

- `POST /v1/chat/completions`
- Accepts `{ model, messages, stream? }`
- Returns `choices[0].message.content`
- May optionally support `GET /v1/models`

Start from `examples/openai-compatible-adapter.js`:

```bash
PORT=3101 ADAPTER_NAME=magic-apron node examples/openai-compatible-adapter.js
HOME_DEPOT_MAGIC_APRON_BASE_URL=http://localhost:3101/v1 npm run dev
```

Then replace the template `chat()` function with an authorized call to the researched bot endpoint.

### Public Surfaces Found

These are the public pages and widget assets discovered during implementation. They are tracked as metadata in `/v1/retail/adapters`, but the proxy does not replay browser cookies, one-time session tokens, or bot-protection artifacts.

| Brand | Public evidence | Implementation note |
|-------|-----------------|---------------------|
| Home Depot | Magic Apron loader plus Sprinklr widget bootstrap | Browser load creates anonymous Sprinklr credentials; wire a local authorized adapter instead of hardcoding captured tokens |
| Sephora | AI Beauty Chat landing page | Page was access-controlled from this environment |
| Nordstrom | Sierra embed plus Dialogflow/Sierra APIs | Public widget creates guest commerce sessions in-browser; server bridge should generate its own authorized session |
| Lowe's | Mylow page and chat invite assets | Browser probes can hit access controls; keep Mylow behind a local authorized adapter |
| IKEA | Customer-service knowledge bundle and guest token endpoint | Current evidence is FAQ/search plus guest token bootstrap, not a stable Billie completion API |
| Expedia | VAC adapter and VirtualAgentControl assets | Headless probes hit bot protection; use an authorized VAC bridge |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port to listen on |
| `MAX_POOL_SIZE` | `5` | Max Amelia WS sessions to keep alive |
| `HOME_DEPOT_MAGIC_APRON_BASE_URL` | unset | Authorized OpenAI-compatible `/v1` endpoint for Magic Apron |
| `SEPHORA_AI_BEAUTY_CHAT_BASE_URL` | unset | Authorized OpenAI-compatible `/v1` endpoint for AI Beauty Chat |
| `NORDSTROM_ROSIE_BASE_URL` | unset | Authorized OpenAI-compatible `/v1` endpoint for Rosie |
| `LOWES_MYLOW_BASE_URL` | unset | Authorized OpenAI-compatible `/v1` endpoint for Mylow |
| `IKEA_BILLIE_BASE_URL` | unset | Authorized OpenAI-compatible `/v1` endpoint for Billie |
| `EXPEDIA_VIRTUAL_AGENT_BASE_URL` | unset | Authorized OpenAI-compatible `/v1` endpoint for Expedia Virtual Agent |

---

## Build & Run

```bash
# Development (live reload)
npm run dev:watch

# Production build
npm run build
npm start

# Docker (example)
docker build -t chipotle-llm-provider .
docker run -p 3000:3000 chipotle-llm-provider
```

---

## Technical Research: Chipotle Pepper AI Reverse Engineering

Everything below was reverse-engineered from `amelia.chipotle.com` via browser DevTools, network inspection, and JS bundle analysis.

---

### Platform

Chipotle's "Pepper" chatbot is powered by **[IPsoft Amelia](https://www.ipsoft.com/amelia/)**, a commercial enterprise conversational AI platform. It is NOT a custom-built system.

- **Chat UI URL:** `https://amelia.chipotle.com/Amelia/ui/chipotle/chat?embed=iframe`
- **Iframe src on chipotle.com:** embedded at `https://www.chipotle.com/contact-us` via `<iframe class="amelia-chat-overlay-iframe">`
- **API base:** `https://amelia.chipotle.com/Amelia/api/`
- **JS bundle:** `https://amelia.chipotle.com/Amelia/ui/chipotle/4/ms16635505704/assets/index-DigazbTy.js` (711KB minified)

---

### Authentication & Session

**No login required.** The system creates anonymous sessions automatically.

#### Step 1: Init

```
GET https://amelia.chipotle.com/Amelia/api/init
```

Response:
```json
{
  "loggedIn": true,
  "csrfToken": "<csrf-token>",
  "user": {
    "userId": "<anonymous-user-id>",
    "email": "anon-<anonymous-user-id>@anonymous-amelia.ipsoft.com",
    "name": "Anonymous User",
    "anonymous": true,
    "agent": false,
    "availability": "OFFLINE",
    "primaryDomainId": null,
    "defaultConversationDomainId": "<domain-id>",
    "preferredThemeId": null,
    "passwordChangeAllowed": false,
    "aiOpsEnabled": false,
    "previousLoginTs": null
  },
  "domainAuthorities": {
    "<domain-id>": [
      "AUTHORITY_USER",
      "AUTHORITY_CONVERSATION_START"
    ]
  },
  "globalAuthorities": []
}
```

Key values:
- `csrfToken` — sent as `X-CSRF-TOKEN` header on all subsequent requests
- `userId` — your anonymous user identity
- `domainId` — the conversation domain ID returned by `/init`
- Session cookie is set by the server (required, `cookie_needed: true`)

---

### Transport: SockJS + STOMP

All messaging uses **SockJS** (WebSocket with HTTP fallback) carrying **STOMP** protocol frames.

#### Step 2: SockJS Probe

```
GET https://amelia.chipotle.com/Amelia/api/sock/info?t={timestamp}
```

Response:
```json
{
  "entropy": -1334223028,
  "origins": ["*:*"],
  "cookie_needed": true,
  "websocket": true
}
```

#### Step 3: WebSocket Connection

SockJS WebSocket URL pattern:
```
wss://amelia.chipotle.com/Amelia/api/sock/{server_id}/{session_id}/websocket
```

Where:
- `server_id` — 3-digit random number (e.g. `042`)
- `session_id` — 8-char random alphanumeric string (e.g. `ab12cd34`)

Example:
```
wss://amelia.chipotle.com/Amelia/api/sock/042/ab12cd34ef56gh78/websocket
```

Required headers:
```
Cookie: <session cookie from /init>
Origin: https://amelia.chipotle.com
```

---

### SockJS Frame Format

SockJS wraps all STOMP frames in its own envelope:

| Frame | Meaning |
|-------|---------|
| `o` | Socket opened (server sends this first) |
| `h` | Heartbeat (ignore) |
| `a["{...}"]` | Message array — JSON array of STOMP frame strings |
| `c[code,"reason"]` | Close |

To **send** a STOMP frame, wrap it:
```javascript
ws.send(JSON.stringify([stompFrame]))
// e.g.: ws.send('["CONNECT\\naccept-version:1.1\\n\\n\\0"]')
```

Received messages look like:
```
a["MESSAGE\ndestination:/queue/session.abc123\n\n{...}\0"]
```

---

### STOMP Protocol Flow

#### Step 4: CONNECT

After receiving SockJS `o` (open), send:

```
CONNECT
accept-version:1.1,1.0
heart-beat:10000,10000
X-CSRF-TOKEN:{csrfToken}

\0
```

Server responds with:
```
CONNECTED
version:1.1
heart-beat:0,0

\0
```

#### Step 5: SUBSCRIBE

Subscribe to your personal message queue:
```
SUBSCRIBE
destination:/queue/session.{userId}
id:sub-0

\0
```

Also subscribe to:
```
SUBSCRIBE
destination:/user/queue/session
id:sub-1

\0
```

#### Step 6: SEND (send a message)

```
SEND
destination:/app/send
content-type:application/json
content-length:{len}

{"message":"your text here","domainCode":"chipotle","conversationId":null,"type":"text"}\0
```

Payload fields:
| Field | Type | Description |
|-------|------|-------------|
| `message` | string | The user's text |
| `domainCode` | string | Always `"chipotle"` |
| `conversationId` | string\|null | Conversation ID (null for new) |
| `type` | string | Always `"text"` |

#### Step 7: Receive Response

Response arrives as a STOMP `MESSAGE` frame on `/queue/session.{userId}`:

```
MESSAGE
destination:/queue/session.{userId}
subscription:sub-0
content-type:application/json

{"type":"message","body":{"text":"How can I help you?", ...}}\0
```

---

### Full REST API Surface

Discovered from `/Amelia/api/` patterns in the JS bundle and network inspection:

```
GET  /Amelia/api/init                              Session bootstrap (no auth)
GET  /Amelia/api/httpSession/check                 Check existing HTTP session
GET  /Amelia/api/sock/info?t={timestamp}           SockJS transport probe
WS   /Amelia/api/sock/{server}/{session}/websocket SockJS WebSocket endpoint
GET  /Amelia/api/loginauthsystems                  Available auth systems
POST /Amelia/api/login                             Login (not needed for anon)
POST /Amelia/api/logout                            Logout
POST /Amelia/api/conversations/new                 Start new conversation (403 without session)
GET  /Amelia/api/conversations/{id}                Get conversation by ID
POST /Amelia/api/conversations/close/{id}          Close conversation
GET  /Amelia/api/semnet/response/detail?faqD=...   FAQ response detail
POST /Amelia/api/cm/upload                         Content management upload
GET  /Amelia/api/cm/download/{id}                  Content management download
GET  /Amelia/api/avatar/image/{id}                 Avatar image
```

---

### Domain Configuration

From `GET /Amelia/api/init` extended response:

```
Domain name:    chipotle
Domain ID:      <domain-id>
Login required: false
Avatar system:  Uneeq
Session timeout: 15 minutes
Anonymous access: enabled
Supported languages: English, French, Spanish, German, Italian, Japanese, Arabic, Swedish, Portuguese, and others
```

---

### Config File

`GET https://amelia.chipotle.com/Amelia/ui/chipotle/4/ms16635505704/config.json`

Notable config fields:
- `domainCode: "chipotle"`
- `allowDefaultDomain: true`
- `transmitUserAgent: true`
- `supportsRejoin: true`
- `microphoneEnabled: false`
- Chat header and footer hidden (Amelia branding suppressed)
- BPN select data value: enabled
- Theme: dark default

---

### STOMP Frame Structure Reference

```
COMMAND\n
header1:value1\n
header2:value2\n
\n
body\0
```

- Headers and body separated by blank line (`\n\n`)
- Frame terminated by null byte (`\0`)
- Inside SockJS: JSON-encoded inside `a["..."]` array

---

### Session Lifecycle

```
Client                          amelia.chipotle.com
  |                                     |
  |--- GET /Amelia/api/init ----------->|
  |<-- 200 {csrfToken, userId, ...} ----|
  |                                     |
  |--- GET /Amelia/api/sock/info ------->|
  |<-- 200 {websocket:true, ...} -------|
  |                                     |
  |=== WSS /Amelia/api/sock/042/xxxx/websocket ===>|
  |<-- o (SockJS open) -----------------|
  |--- a["CONNECT\n..."] ------------->|
  |<-- a["CONNECTED\n..."] ------------|
  |--- a["SUBSCRIBE\n/queue/session.{id}"] --->|
  |                                     |
  |--- a["SEND\n/app/send\n\n{msg}"] -->|
  |<-- a["MESSAGE\n\n{response}"] ------|
  |                                     |
```

---

### Notes for Implementors

1. **Cookie is mandatory** — `cookie_needed: true` in SockJS probe. The `Set-Cookie` from `/init` must be sent with the WS upgrade request.

2. **CSRF token** — Always include `X-CSRF-TOKEN: {token}` from `/init` in the STOMP CONNECT frame headers.

3. **Session timeout** — 15 minutes idle. Re-init and reconnect when session expires.

4. **Rate limiting** — Not observed during testing, but anonymous session recycling (fresh `/init` per request) avoids any per-session limits.

5. **SockJS fallback** — If WebSocket is unavailable, SockJS also supports XHR-streaming and long-polling at:
   - `https://amelia.chipotle.com/Amelia/api/sock/{server}/{session}/xhr_streaming`
   - `https://amelia.chipotle.com/Amelia/api/sock/{server}/{session}/xhr`

6. **Response format** — Amelia responses are domain-specific. "Pepper" only answers Chipotle-related questions. Off-topic queries return: `"I can't provide an answer for that at this time."`

7. **conversationId** — Pass `null` to start fresh, or reuse a conversation ID for context continuity.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                chipotle-llm-provider                     │
│                                                          │
│  OpenAI Client                                           │
│  POST /v1/chat/completions                               │
│         │                                                │
│         ▼                                                │
│  ┌─────────────┐    ┌─────────────────────────────────┐ │
│  │   Express   │    │        AmeliaClient Pool         │ │
│  │   HTTP API  │───▶│  (up to MAX_POOL_SIZE sessions)  │ │
│  └─────────────┘    │                                  │ │
│                     │  - GET /Amelia/api/init           │ │
│                     │  - WSS SockJS/STOMP connection   │ │
│                     │  - STOMP SEND /app/send           │ │
│                     │  - STOMP recv /queue/session.*   │ │
│                     └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
                  amelia.chipotle.com
                  (IPsoft Amelia platform)
```

---

## License

MIT — do whatever you want, Chipotle pays the inference bill.
