import { chipotle } from './adapters/chipotle';
import { depot } from './adapters/home-depot';
import { sephora } from './adapters/sephora';
import { nordstrom } from './adapters/nordstrom';
import { lowes } from './adapters/lowes';
import { ikea } from './adapters/ikea';
import { expedia } from './adapters/expedia';
import { Bot, ChatCompletionRequest } from './adapters/types';

export const bots: Bot[] = [
  chipotle,
  depot,
  sephora,
  nordstrom,
  lowes,
  ikea,
  expedia,
];

export type { Bot, ChatCompletionRequest };

export function bot(model: string): Bot | undefined {
  return bots.find((item) => item.model === model);
}

export function configured(cfg: Bot): boolean {
  if (!cfg.env) return true;
  return Boolean(process.env[cfg.env]);
}

export function status() {
  return bots.map((item) => ({
    model: item.model,
    name: item.name,
    owned_by: item.owned,
    source: item.source,
    status: item.status,
    surfaces: item.surfaces ?? [],
    note: item.note ?? null,
    configured: configured(item),
    env: item.env ?? null,
    key: item.key ?? null,
  }));
}

export function text(body: ChatCompletionRequest): string {
  const msg = body.messages.filter((item) => item.role === 'user').at(-1);
  const sys = body.messages.find((item) => item.role === 'system');
  if (!msg) throw new Error('No user message provided');
  if (sys) return `${sys.content}\n\n${msg.content}`;
  return msg.content;
}

export function count(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

export async function relay(cfg: Bot, body: ChatCompletionRequest): Promise<string> {
  if (!cfg.env) throw new Error(`${cfg.name} is built in and does not use relay()`);

  const base = process.env[cfg.env];
  if (!base) {
    const found = cfg.surfaces?.length
      ? ` Public surfaces found: ${cfg.surfaces.join(', ')}.`
      : '';
    const note = cfg.note ? ` ${cfg.note}` : '';
    throw new Error(
      `${cfg.name} needs ${cfg.env} pointing at an authorized OpenAI-compatible /v1 endpoint before it can run.${found}${note}`,
    );
  }

  const url = new URL('chat/completions', base.endsWith('/') ? base : `${base}/`);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const key = cfg.key ? process.env[cfg.key] : undefined;
  if (key) headers.Authorization = `Bearer ${key}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...body,
      model: cfg.model,
      stream: false,
    }),
  });

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string }; text?: string }>;
    error?: { message?: string };
  };

  if (!res.ok) throw new Error(data.error?.message ?? `${cfg.name} returned HTTP ${res.status}`);

  const msg = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text;
  if (!msg) throw new Error(`${cfg.name} returned no completion text`);
  return msg;
}
