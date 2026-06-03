import { Bot } from './types';

export const chipotle: Bot = {
  model: 'pepper-1',
  name: 'Chipotle Pepper',
  owned: 'chipotle',
  source: 'https://amelia.chipotle.com/Amelia/ui/chipotle/chat?embed=iframe',
  status: 'built-in Amelia adapter',
  surfaces: [
    'https://amelia.chipotle.com/Amelia/api/init',
    'https://amelia.chipotle.com/Amelia/api/sock/info',
  ],
};
