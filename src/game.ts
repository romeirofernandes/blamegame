import { drawCards, getDeck, sampleCards, type Card } from './decks';
import { customDeckDetails, type CustomDeck, type CustomDeckDetails } from './customDeck';
import { validatePlayerAvatar } from './avatar';
import { DITHER_AVATAR_VARIANT_COUNT } from './dither-avatar';

export type Mode = 'anonymous' | 'named';
type Phase = 'lobby' | 'vote' | 'reveal' | 'recap';
export const LEGACY_ROUND_COUNT = 5;
export const MIN_ROUNDS = 1;
export type Player = {
  id: string;
  name: string;
  color: number;
  avatar?: string;
  avatarSeed?: string;
  avatarVariant?: number;
};
type Submission = { kind: 'pick' | 'write'; value: string } | { kind: 'pass' };
type Result = {
  picks: { playerId: string; count: number; voters?: string[] }[];
  answers: { text: string; author?: string }[];
};
type RecapRound = {
  question: string;
  leaders: string[];
  kind?: Card['kind'];
  leaderVotes?: number;
  responseCount?: number;
  passCount?: number;
  answers?: { text: string; author?: string }[];
};
type Round = { card: Card; submissions: Map<string, Submission> };
export type Room = {
  code: string;
  host: string;
  deckId: string;
  customDeck?: CustomDeckDetails;
  mode: Mode;
  allowSelfVote: boolean;
  totalRounds?: number;
  cards?: Card[];
  phase: Phase;
  players: Player[];
  rounds: Round[];
};

export type RoomView = {
  code: string;
  me: string;
  host: string;
  deckId: string;
  customDeck?: CustomDeckDetails;
  mode: Mode;
  phase: Phase;
  players: (Player & { online: boolean })[];
  round: number;
  total: number;
  card?: Card;
  submitted: number;
  hasSubmitted: boolean;
  allowSelfVote: boolean;
  canReveal: boolean;
  result?: Result;
  recap?: RecapRound[];
};

export type Action =
  | { type: 'start' | 'reveal' | 'next' }
  | { type: 'submit'; round: number; submission: Submission };

export type Command = Action
  | {
    type: 'create'; name: string; deckId: string; mode: Mode; token: string; customDeck?: CustomDeck;
    allowSelfVote?: boolean; avatar?: string; avatarSeed?: string; avatarVariant?: number; roundCount?: number;
  }
  | { type: 'join'; name: string; code: string; token: string; avatar?: string; avatarSeed?: string; avatarVariant?: number }
  | { type: 'resume'; code: string; token: string }
  | { type: 'leave' };
export type Message =
  | { type: 'state'; room: RoomView }
  | { type: 'error'; message: string; reset?: boolean; retryCreate?: boolean };

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;

export function createRoom(
  code: string,
  id: string,
  name: string,
  deckId: string,
  mode: Mode,
  allowSelfVote = false,
  avatar?: string,
  avatarVariant?: number,
  avatarSeed?: string,
  roundCount?: number,
  random: () => number = Math.random,
  customDeck?: CustomDeck,
): Room {
  const totalRounds = roundCount ?? LEGACY_ROUND_COUNT;
  const room: Room = {
    code, host: id, deckId, mode, allowSelfVote, totalRounds,
    ...(customDeck && { customDeck: customDeckDetails(customDeck) }),
    cards: customDeck ? sampleCards(customDeck.cards, totalRounds, random) : roundCount === undefined
      ? getDeck(deckId)!.cards.slice(0, totalRounds)
      : drawCards(deckId, roundCount, random),
    phase: 'lobby', players: [], rounds: [],
  };
  addPlayer(room, id, name, avatar, avatarVariant, avatarSeed);
  return room;
}

export function addPlayer(
  room: Room,
  id: string,
  value: string,
  avatar?: string,
  avatarVariant?: number,
  avatarSeed?: string,
) {
  const name = value.trim().replace(/\s+/g, ' ');
  if (room.phase !== 'lobby') throw new Error('This game has already started.');
  if (room.players.length >= MAX_PLAYERS) throw new Error('This room is full.');
  if (!name || name.length > 24) throw new Error('Use a name between 1 and 24 characters.');
  if (room.players.some((player) => player.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Someone already has that name.');
  }
  const playerAvatar = validatePlayerAvatar(avatar);
  const validAvatarVariant = typeof avatarVariant === 'number' && Number.isInteger(avatarVariant) &&
    avatarVariant >= 0 && avatarVariant < DITHER_AVATAR_VARIANT_COUNT ? avatarVariant : undefined;
  const validAvatarSeed = typeof avatarSeed === 'string' && /^[a-f\d]{32}$/i.test(avatarSeed)
    ? avatarSeed
    : undefined;
  room.players.push({
    id, name, color: room.players.length % 6,
    ...(playerAvatar ? { avatar: playerAvatar } : {}),
    ...(validAvatarSeed ? { avatarSeed: validAvatarSeed } : {}),
    ...(validAvatarVariant !== undefined ? { avatarVariant: validAvatarVariant } : {}),
  });
}

function beginRound(room: Room) {
  const card = (room.cards ?? getDeck(room.deckId)!.cards.slice(0, totalRounds(room)))[room.rounds.length];
  const spotlight = room.players[room.rounds.length % room.players.length];
  room.rounds.push({
    card: { ...card, question: card.question.replace('{player}', () => spotlight.name) },
    submissions: new Map(),
  });
  room.phase = 'vote';
}

function totalRounds(room: Room) {
  return room.totalRounds ?? room.cards?.length ?? LEGACY_ROUND_COUNT;
}

function canRevealRound(room: Room, round: Round | undefined, online?: ReadonlySet<string>) {
  return room.phase === 'vote' && !!round && (
    round.submissions.size > 0 || (online !== undefined && room.players.some((player) => !online.has(player.id)))
  );
}

export function applyAction(room: Room, playerId: string, action: Action, online?: ReadonlySet<string>) {
  if (!room.players.some((player) => player.id === playerId)) throw new Error('Join the room first.');
  const round = room.rounds.at(-1);
  if (action.type === 'submit') {
    if (room.phase !== 'vote' || !round || action.round !== room.rounds.length) {
      throw new Error('This round is closed.');
    }
    if (round.submissions.has(playerId)) return;
    const submission = action.submission;
    if (submission?.kind === 'pass') {
      round.submissions.set(playerId, { kind: 'pass' });
      return;
    }
    if (submission?.kind !== round.card.kind || typeof submission.value !== 'string') {
      throw new Error('Choose an answer or pass.');
    }
    const value = submission.value.trim();
    if (submission.kind === 'pick' && !room.players.some((player) => player.id === value)) {
      throw new Error('Choose someone in the room.');
    }
    if (submission.kind === 'pick' && !room.allowSelfVote && value === playerId) {
      throw new Error("You can't vote for yourself.");
    }
    if (submission.kind === 'write' && (!value || value.length > 120)) {
      throw new Error('Use between 1 and 120 characters.');
    }
    round.submissions.set(playerId, { kind: submission.kind, value });
    return;
  }
  if (room.host !== playerId) throw new Error('Only the host can do that.');
  if (action.type === 'start' && room.phase === 'lobby') {
    if (room.players.length < MIN_PLAYERS) throw new Error('You need at least 3 players.');
    beginRound(room);
    return;
  }
  if (action.type === 'reveal' && canRevealRound(room, round, online)) {
    room.phase = 'reveal';
    return;
  }
  if (action.type === 'next' && room.phase === 'reveal') {
    if (room.rounds.length === totalRounds(room)) room.phase = 'recap';
    else beginRound(room);
    return;
  }
  throw new Error('That action is unavailable right now.');
}

function results(room: Room, round: Round): Result {
  const votes = new Map<string, string[]>();
  const answers: Result['answers'] = [];
  for (const [author, submission] of round.submissions) {
    if (submission.kind === 'pick') {
      const voters = votes.get(submission.value) ?? [];
      voters.push(author);
      votes.set(submission.value, voters);
    }
    if (submission.kind === 'write') {
      answers.push(room.mode === 'named' ? { text: submission.value, author } : { text: submission.value });
    }
  }
  if (room.mode === 'anonymous') answers.sort((a, b) => a.text.localeCompare(b.text));
  const picks = [...votes.entries()].map(([playerId, voters]) =>
    room.mode === 'named' ? { playerId, count: voters.length, voters } : { playerId, count: voters.length }
  );
  picks.sort((a, b) => b.count - a.count || a.playerId.localeCompare(b.playerId));
  return { picks, answers };
}

export function viewRoom(room: Room, me: string, onlinePlayerIds?: Iterable<string>): RoomView {
  const round = room.rounds.at(-1);
  const online = onlinePlayerIds ? new Set(onlinePlayerIds) : new Set(room.players.map((player) => player.id));
  return {
    code: room.code, me, host: room.host, mode: room.mode, phase: room.phase,
    // Older clients look up deckId locally. Send a built-in fallback alongside custom metadata.
    deckId: room.customDeck ? 'group-chat' : room.deckId,
    ...(room.customDeck && { customDeck: room.customDeck }),
    players: room.players.map((player) => ({ ...player, online: online.has(player.id) })),
    round: room.rounds.length, total: totalRounds(room),
    card: round?.card, submitted: round?.submissions.size ?? 0, hasSubmitted: round?.submissions.has(me) ?? false,
    allowSelfVote: room.allowSelfVote ?? false,
    canReveal: me === room.host && canRevealRound(room, round, online),
    result: room.phase === 'reveal' && round ? results(room, round) : undefined,
    recap: room.phase === 'recap' ? room.rounds.map((item) => {
      const result = results(room, item);
      const { picks } = result;
      const leaders = picks.filter((pick) => pick.count === picks[0]?.count);
      return {
        question: item.card.question,
        kind: item.card.kind,
        leaders: leaders.map((pick) => pick.playerId),
        ...(leaders.length ? { leaderVotes: leaders[0].count } : {}),
        responseCount: item.submissions.size,
        passCount: [...item.submissions.values()].filter((submission) => submission.kind === 'pass').length,
        ...(item.card.kind === 'write' ? { answers: result.answers } : {}),
      };
    }) : undefined,
  };
}
