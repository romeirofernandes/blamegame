import type { Card } from './decks';

export const CUSTOM_DECK_ID = 'custom';
export const MAX_CUSTOM_PROMPTS = 16;
export const MAX_CUSTOM_PROMPT_LENGTH = 120;
export const CUSTOM_COVERS = {
  'group-chat': 'Chat bubbles',
  chaos: 'Dice',
  'soft-launch': 'Heart',
  'shared-holiday': 'Travel',
  'fake-jobs': 'Briefcase',
  spotlight: 'Spotlight',
  camera: 'Instant camera',
  cherries: 'Cherries',
  ufo: 'UFO',
  microphone: 'Microphone',
  takeout: 'Takeout',
  controller: 'Game controller',
  'compass-map': 'Map and compass',
  'party-tickets': 'Party tickets',
} as const;

export type CustomDeckDetails = { name: string; cover: keyof typeof CUSTOM_COVERS };
export type CustomDeck = CustomDeckDetails & { cards: Card[] };

export function customDeckDetails({ name, cover }: CustomDeck): CustomDeckDetails {
  return { name, cover };
}

export function parseCustomDeck(value: unknown): CustomDeck | null {
  if (!value || typeof value !== 'object') return null;
  const { name, cover, cards } = value as Partial<CustomDeck>;
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 40 ||
      typeof cover !== 'string' || !Object.hasOwn(CUSTOM_COVERS, cover) ||
      !Array.isArray(cards) || cards.length < 1 || cards.length > MAX_CUSTOM_PROMPTS) return null;

  const prompts: Card[] = [];
  const seen = new Set<string>();
  for (const card of cards) {
    if (!card || (card.kind !== 'pick' && card.kind !== 'write') || typeof card.question !== 'string') return null;
    const question = card.question.trim();
    const key = question.toLowerCase();
    if (!question || question.length > MAX_CUSTOM_PROMPT_LENGTH || seen.has(key) || /[\u0000-\u001f]/.test(question)) return null;
    seen.add(key);
    prompts.push({ kind: card.kind, question });
  }
  return { name: name.trim(), cover, cards: prompts };
}
