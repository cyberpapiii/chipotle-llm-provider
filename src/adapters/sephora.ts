import { Bot } from './types';

export const sephora: Bot = {
  model: 'beauty-chat-1',
  name: 'Sephora AI Beauty Chat',
  owned: 'sephora',
  source: 'https://www.sephora.com/beauty/ai-beauty-chat',
  status: 'relay adapter wired; public page is access-controlled in this environment',
  note: 'Sephora returned an access-denied page during probing; use an authorized AI Beauty Chat adapter.',
  env: 'SEPHORA_AI_BEAUTY_CHAT_BASE_URL',
  key: 'SEPHORA_AI_BEAUTY_CHAT_API_KEY',
};
