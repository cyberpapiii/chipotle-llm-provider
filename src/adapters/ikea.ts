import { Bot } from './types';

export const ikea: Bot = {
  model: 'billie-1',
  name: 'IKEA Billie',
  owned: 'ikea',
  source: 'https://www.ikea.com/es/en/customer-service/knowledge/articles/d08bgee0-1g7d-4965-94d6-ec41e68690ce.html',
  status: 'relay adapter wired; public FAQ/search assets found, chat path still needs authorized endpoint',
  surfaces: [
    'https://www.ikea.com/global/assets/customer-service/knowledge/searchBundle.mc7upui27z.js',
    'https://api.ingka.ikea.com/guest/token',
  ],
  note: 'Current public evidence is FAQ/search plus guest token bootstrap, not a stable Billie completion API.',
  env: 'IKEA_BILLIE_BASE_URL',
  key: 'IKEA_BILLIE_API_KEY',
};
