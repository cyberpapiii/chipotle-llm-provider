import { Bot } from './types';

export const nordstrom: Bot = {
  model: 'rosie-1',
  name: 'Nordstrom Rosie',
  owned: 'nordstrom',
  source: 'https://www.nordstrom.com/browse/customer-service',
  status: 'relay adapter wired; public Sierra widget found, chat path still needs authorized endpoint',
  surfaces: [
    'https://sierra.chat/agent/jLEWNgABmXdCXoEBmXdCXtwCJteLCGTO2cko6X0ucgQ/embed',
    'https://sierra.chat/-/api/graphql',
    'https://agenticapplications.googleapis.com/v1/sales:retrieveConfig',
  ],
  note: 'The public widget creates guest commerce sessions in-browser; server adapter should generate its own authorized session.',
  env: 'NORDSTROM_ROSIE_BASE_URL',
  key: 'NORDSTROM_ROSIE_API_KEY',
};
