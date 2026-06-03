import { Bot } from './types';

export const depot: Bot = {
  model: 'magic-apron-1',
  name: 'Home Depot Magic Apron',
  owned: 'home-depot',
  source: 'https://ir.homedepot.com/news-releases/2025/03-06-2025-130241718',
  status: 'relay adapter wired; public Magic Apron assets found, chat path still needs authorized endpoint',
  surfaces: [
    'https://assets.thdstatic.com/magic-apron/v3.1.1/magic-apron-loader.js',
    'https://assets.thdstatic.com/magic-apron/v3.1.1/DynamicAssistant.BZOovZpb8_Wg9BxJCJNT.js',
    'https://prod2-live-chat.sprinklr.com/api/livechat/handshake/widget/65d48a332e1cd41a769de5c1_app_100699388',
  ],
  note: 'Browser load creates transient anonymous Sprinklr credentials; do not hardcode captured tokens.',
  env: 'HOME_DEPOT_MAGIC_APRON_BASE_URL',
  key: 'HOME_DEPOT_MAGIC_APRON_API_KEY',
};
