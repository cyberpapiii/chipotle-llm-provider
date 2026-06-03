const child = require('child_process');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function json(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(`${url} returned ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  const adapter = child.spawn(process.execPath, ['examples/openai-compatible-adapter.js'], {
    env: { ...process.env, PORT: '3101', ADAPTER_NAME: 'magic-apron' },
    stdio: 'pipe',
  });

  const proxy = child.spawn(process.execPath, ['dist/index.js'], {
    env: {
      ...process.env,
      PORT: '3102',
      HOME_DEPOT_MAGIC_APRON_BASE_URL: 'http://localhost:3101/v1',
    },
    stdio: 'pipe',
  });

  try {
    await wait(1000);

    const health = await json('http://localhost:3102/health');
    if (health.adapters.total !== 7) throw new Error(`Expected 7 adapters, got ${health.adapters.total}`);
    if (health.adapters.configured !== 2) throw new Error(`Expected 2 configured adapters, got ${health.adapters.configured}`);
    if (health.adapters.pending !== 5) throw new Error(`Expected 5 pending adapters, got ${health.adapters.pending}`);

    const adapters = await json('http://localhost:3102/v1/retail/adapters');
    const depot = adapters.data.find((item) => item.model === 'magic-apron-1');
    if (!depot?.configured) throw new Error('Magic Apron adapter was not reported configured');
    if (!depot.surfaces?.length) throw new Error('Magic Apron adapter did not report discovered public surfaces');
    if (!depot.note) throw new Error('Magic Apron adapter did not report implementation note');

    const chat = await json('http://localhost:3102/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'magic-apron-1',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    });

    const text = chat.choices?.[0]?.message?.content;
    if (text !== 'magic-apron received: hello') throw new Error(`Unexpected relay response: ${text}`);
  } finally {
    proxy.kill();
    adapter.kill();
  }

  console.log('verified retail runtime relay');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
