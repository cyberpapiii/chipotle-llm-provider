import { Bot } from './types';

export const expedia: Bot = {
  model: 'virtual-agent-1',
  name: 'Expedia Virtual Agent',
  owned: 'expedia',
  source: 'https://www.expedia.com/lp/b/getintouch',
  status: 'relay adapter wired; public VAC assets found, chat path still needs authorized endpoint',
  surfaces: [
    'https://vacadapter.vap.expedia.com/current/vacClientAdapter.js',
    'https://vap.expedia.com/vacservice/public/partners/expedia/virtualagentcontrols/default_vac/getScript',
    'https://vac.vap.expedia.com/3.108.0/virtualAgentControl.js',
  ],
  note: 'Headless probes hit bot protection; use an authorized VAC bridge instead of replaying browser session config.',
  env: 'EXPEDIA_VIRTUAL_AGENT_BASE_URL',
  key: 'EXPEDIA_VIRTUAL_AGENT_API_KEY',
};
