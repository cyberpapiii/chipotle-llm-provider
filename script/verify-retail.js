const { bots } = require('../dist/retail');
const fs = require('fs');

const want = {
  'pepper-1': undefined,
  'magic-apron-1': 'HOME_DEPOT_MAGIC_APRON_BASE_URL',
  'beauty-chat-1': 'SEPHORA_AI_BEAUTY_CHAT_BASE_URL',
  'rosie-1': 'NORDSTROM_ROSIE_BASE_URL',
  'mylow-1': 'LOWES_MYLOW_BASE_URL',
  'billie-1': 'IKEA_BILLIE_BASE_URL',
  'virtual-agent-1': 'EXPEDIA_VIRTUAL_AGENT_BASE_URL',
};

for (const [model, env] of Object.entries(want)) {
  const bot = bots.find((item) => item.model === model);
  if (!bot) throw new Error(`Missing model ${model}`);
  if (bot.env !== env) throw new Error(`${model} env mismatch: ${bot.env}`);
  if (!bot.source) throw new Error(`${model} missing source`);
  if (!bot.status) throw new Error(`${model} missing status`);
  if (model !== 'beauty-chat-1' && !bot.surfaces?.length) throw new Error(`${model} missing surfaces`);
}

const tmpl = fs.readFileSync('examples/openai-compatible-adapter.js', 'utf8');
if (!tmpl.includes('/v1/chat/completions')) throw new Error('Adapter example missing chat completions route');

const app = fs.readFileSync('dist/index.js', 'utf8');
if (!app.includes('/v1/retail/adapters')) throw new Error('Proxy missing adapter status endpoint');

const readme = fs.readFileSync('README.md', 'utf8');
if (!readme.includes('/v1/retail/adapters')) throw new Error('README missing adapter status endpoint');
if (!readme.includes('Public Surfaces Found')) throw new Error('README missing public surface notes');

console.log(`verified ${Object.keys(want).length} retail bot models`);
