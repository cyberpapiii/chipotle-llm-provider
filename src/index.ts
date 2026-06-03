/**
 * chipotle-llm-provider
 *
 * OpenAI-compatible HTTP API backed by Chipotle's Pepper AI chatbot (IPsoft Amelia).
 * Drop-in replacement for any OpenAI client — just point baseURL here.
 *
 * Endpoints:
 *   GET  /v1/models                     → list available "models"
 *   POST /v1/chat/completions           → chat (streaming + non-streaming)
 *   GET  /health                        → health check
 */

import express, { Request, Response } from 'express';
import { AmeliaClient } from './amelia';
import { bot, bots, count, relay, status, text, type ChatCompletionRequest } from './retail';

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT ?? 3000;

// Pool of Amelia clients — one per concurrent session
const clientPool: AmeliaClient[] = [];
const MAX_POOL_SIZE = parseInt(process.env.MAX_POOL_SIZE ?? '5', 10);

async function getClient(): Promise<AmeliaClient> {
  if (clientPool.length > 0) {
    return clientPool.pop()!;
  }
  const client = new AmeliaClient();
  await client.init();
  await client.connect();
  return client;
}

async function releaseClient(client: AmeliaClient): Promise<void> {
  if (clientPool.length < MAX_POOL_SIZE) {
    clientPool.push(client);
  } else {
    await client.close();
  }
}

async function pepper(prompt: string): Promise<string> {
  const client = await getClient();
  try {
    const msg = await client.chat(prompt);
    await releaseClient(client);
    return msg;
  } catch (err) {
    await client.close().catch(() => {});
    throw err;
  }
}

// ─── GET /health ─────────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  const adapters = status();
  res.json({
    status: 'ok',
    poolSize: clientPool.length,
    adapters: {
      total: adapters.length,
      configured: adapters.filter((item) => item.configured).length,
      pending: adapters.filter((item) => !item.configured).length,
    },
  });
});

app.get('/v1/retail/adapters', (_req: Request, res: Response) => {
  res.json({ object: 'list', data: status() });
});

// ─── GET /v1/models ──────────────────────────────────────────────────────────

app.get('/v1/models', (_req: Request, res: Response) => {
  res.json({
    object: 'list',
    data: bots.map((item) => ({
      id: item.model,
      object: 'model',
      created: 1700000000,
      owned_by: item.owned,
      permission: [],
      root: item.model,
      parent: null,
    })),
  });
});

// ─── POST /v1/chat/completions ───────────────────────────────────────────────

app.post('/v1/chat/completions', async (req: Request, res: Response) => {
  const body = req.body as ChatCompletionRequest;
  const { messages, stream = false } = body;
  const cfg = bot(body.model);

  if (!cfg) {
    res.status(404).json({ error: { message: `Unknown model: ${body.model}`, type: 'model_not_found' } });
    return;
  }

  // Extract the last user message
  const userMessages = messages.filter((m) => m.role === 'user');
  const lastUser = userMessages[userMessages.length - 1];

  if (!lastUser) {
    res.status(400).json({ error: 'No user message provided' });
    return;
  }

  const prompt = text(body);

  const requestId = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);

  try {
    const responseText = cfg.model === 'pepper-1'
      ? await pepper(prompt)
      : await relay(cfg, body);

    if (stream) {
      // SSE streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const chunk = {
        id: requestId,
        object: 'chat.completion.chunk',
        created,
        model: cfg.model,
        choices: [
          {
            index: 0,
            delta: { role: 'assistant', content: responseText },
            finish_reason: null,
          },
        ],
      };

      res.write(`data: ${JSON.stringify(chunk)}\n\n`);

      const done = {
        id: requestId,
        object: 'chat.completion.chunk',
        created,
        model: cfg.model,
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      };

      res.write(`data: ${JSON.stringify(done)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      res.json({
        id: requestId,
        object: 'chat.completion',
        created,
        model: cfg.model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: responseText,
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: count(prompt),
          completion_tokens: count(responseText),
          total_tokens: count(prompt) + count(responseText),
        },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Chat error:', message);
    res.status(500).json({ error: { message, type: 'server_error' } });
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`chipotle-llm-provider running on http://localhost:${PORT}`);
  console.log(`OpenAI-compatible endpoint: http://localhost:${PORT}/v1/chat/completions`);
});

export default app;
