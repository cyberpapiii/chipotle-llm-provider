import { Bot } from './types';

export const lowes: Bot = {
  model: 'mylow-1',
  name: "Lowe's Mylow",
  owned: 'lowes',
  source: 'https://www.lowes.com/ai',
  status: 'relay adapter wired; public Mylow page asset found, chat path still needs authorized endpoint',
  surfaces: [
    'https://www.lowescdn.com/global-header-footer/search/session-ai.f1e2f63d.js',
    'https://www.lowescdn.com/luca-client/8ed72023f89/build-chat-invite/load-chat-invite.min.js',
  ],
  note: 'Browser probes can hit access controls; keep Mylow behind a local authorized adapter.',
  env: 'LOWES_MYLOW_BASE_URL',
  key: 'LOWES_MYLOW_API_KEY',
};
