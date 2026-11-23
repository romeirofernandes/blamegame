import type { CustomDeckDetails } from './customDeck';

export const deckArt: Record<CustomDeckDetails['cover'], number> = {
  'group-chat': require('../assets/deck-art/group-chat.png'),
  chaos: require('../assets/deck-art/chaos.png'),
  'soft-launch': require('../assets/deck-art/soft-launch.png'),
  'shared-holiday': require('../assets/deck-art/shared-holiday.png'),
  'fake-jobs': require('../assets/deck-art/fake-jobs.png'),
  camera: require('../assets/deck-art/camera.png'),
  cherries: require('../assets/deck-art/cherries.png'),
  ufo: require('../assets/deck-art/ufo.png'),
  microphone: require('../assets/deck-art/microphone.png'),
  takeout: require('../assets/deck-art/takeout.png'),
  controller: require('../assets/deck-art/controller.png'),
  'compass-map': require('../assets/deck-art/compass-map.png'),
  'party-tickets': require('../assets/deck-art/party-tickets.png'),
  spotlight: require('../assets/deck-art/spotlight.png'),
};

export function getDeckArt(id: string) {
  return Object.hasOwn(deckArt, id) ? deckArt[id as keyof typeof deckArt] : undefined;
}
