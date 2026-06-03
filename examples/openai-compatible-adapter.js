const http = require('http');

const port = Number(process.env.PORT || 3101);
const name = process.env.ADAPTER_NAME || 'retail-adapter';

function text(body) {
  const msg = body.messages.filter((item) => item.role === 'user').at(-1);
  if (!msg) throw new Error('No user message provided');
  return msg.content;
}

async function chat(prompt) {
  // Replace this with an authorized call to a researched chatbot endpoint.
  return `${name} received: ${prompt}`;
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/v1/models') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ object: 'list', data: [] }));
    return;
  }

  if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
    res.writeHead(404);
    res.end();
    return;
  }

  let raw = '';
  req.on('data', (part) => raw += part);
  req.on('end', async () => {
    try {
      const body = JSON.parse(raw);
      const msg = await chat(text(body));
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: body.model,
        choices: [{ index: 0, message: { role: 'assistant', content: msg }, finish_reason: 'stop' }],
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: err instanceof Error ? err.message : String(err) } }));
    }
  });
});

server.listen(port, () => {
  console.log(`${name} listening on http://localhost:${port}/v1`);
});
