import { decks } from './decks';

type DeckId = (typeof decks)[number]['id'];

export const deckArt: Record<DeckId, number> = {
  'group-chat': require('../assets/deck-art/group-chat.png'),
  chaos: require('../assets/deck-art/chaos.png'),
  'soft-launch': require('../assets/deck-art/soft-launch.png'),
  'shared-holiday': require('../assets/deck-art/shared-holiday.png'),
  'fake-jobs': require('../assets/deck-art/fake-jobs.png'),
  spotlight: require('../assets/deck-art/spotlight.png'),
};
