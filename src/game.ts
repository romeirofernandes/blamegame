import { drawCards, getDeck, sampleCards, type Card } from './decks';
import { customDeckDetails, type CustomDeck, type CustomDeckDetails } from './customDeck';
import { validatePlayerAvatar } from './avatar';
import { ditherAvatar, DITHER_AVATAR_VARIANT_COUNT } from './dither-avatar';

export type Mode = 'anonymous' | 'named';
export type Phase = 'lobby' | 'answer' | 'vote' | 'reveal' | 'recap';
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
export type Submission = { kind: 'pick' | 'write' | 'answer-vote'; value: string } | { kind: 'pass' | 'answer-vote-pass' };
type AnswerOption = { id: string; text: string; author: string };
type AnswerResult = { id?: string; text: string; author?: string; count?: number; voters?: string[] };
type Result = {
  picks: { playerId: string; count: number; voters?: string[] }[];
  answers: AnswerResult[];
};
type RecapRound = {
  question: string;
  leaders: string[];
  kind?: Card['kind'];
  leaderVotes?: number;
  responseCount?: number;
  passCount?: number;
  answers?: AnswerResult[];
};
type Round = {
  card: Card;
  submissions: Map<string, Submission>;
  answerOptions?: AnswerOption[];
  answerVotes?: Map<string, string>;
};
export type Room = {
  code: string;
  host: string;
  deckId: string;
  customDeck?: CustomDeckDetails;
  mode: Mode;
  allowSelfVote: boolean;
  allowPass?: boolean;
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
  allowPass: boolean;
  canReveal: boolean;
  answerOptions?: { id: string; text: string; isOwn: boolean }[];
  result?: Result;
  recap?: RecapRound[];
};

export type Action =
  | { type: 'start' | 'reveal' | 'next' }
  | { type: 'submit'; round: number; submission: Submission };

export type Command = Action
  | {
    type: 'create'; name: string; deckId: string; mode: Mode; token: string; customDeck?: CustomDeck;
    allowSelfVote?: boolean; allowPass?: boolean; avatar?: string; avatarSeed?: string; avatarVariant?: number; avatarCustom?: boolean; roundCount?: number;
  }
  | { type: 'join'; name: string; code: string; token: string; avatar?: string; avatarSeed?: string; avatarVariant?: number; avatarCustom?: boolean }
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
  avatarCustom = false,
  allowPass = false,
): Room {
  const totalRounds = roundCount ?? LEGACY_ROUND_COUNT;
  const room: Room = {
    code, host: id, deckId, mode, allowSelfVote, allowPass, totalRounds,
    ...(customDeck && { customDeck: customDeckDetails(customDeck) }),
    cards: customDeck ? sampleCards(customDeck.cards, totalRounds, random) : roundCount === undefined
      ? getDeck(deckId)!.cards.slice(0, totalRounds)
      : drawCards(deckId, roundCount, random),
    phase: 'lobby', players: [], rounds: [],
  };
  addPlayer(room, id, name, avatar, avatarVariant, avatarSeed, avatarCustom);
  return room;
}

export function addPlayer(
  room: Room,
  id: string,
  value: string,
  avatar?: string,
  avatarVariant?: number,
  avatarSeed?: string,
  avatarCustom = false,
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
  const preferredSeed = validAvatarSeed ?? id;
  const preferredVariant = validAvatarVariant ?? 0;
  const generatedAvatar = avatarCustom
    ? { seed: preferredSeed, variant: preferredVariant }
    : uniqueGeneratedAvatar(room, preferredSeed, preferredVariant);
  room.players.push({
    id, name, color: room.players.length % 6,
    ...(playerAvatar ? { avatar: playerAvatar } : {}),
    ...(generatedAvatar.seed !== id || validAvatarSeed || avatarCustom ? { avatarSeed: generatedAvatar.seed } : {}),
    ...(generatedAvatar.variant !== 0 || validAvatarVariant !== undefined || avatarCustom
      ? { avatarVariant: generatedAvatar.variant }
      : {}),
  });
}

function renderedAvatarKey(seed: string, variant: number) {
  const { fill, stroke, path } = ditherAvatar(seed, variant);
  return `${fill}:${stroke}:${path}`;
}

function uniqueGeneratedAvatar(room: Room, seed: string, preferredVariant: number) {
  const occupied = new Set(room.players.map((player) =>
    renderedAvatarKey(player.avatarSeed ?? player.id, player.avatarVariant ?? 0)));

  for (let attempt = 0; ; attempt++) {
    const candidateSeed = attempt === 0 ? seed : `${seed}:${attempt}`;
    for (let offset = 0; offset < DITHER_AVATAR_VARIANT_COUNT; offset++) {
      const variant = (preferredVariant + offset) % DITHER_AVATAR_VARIANT_COUNT;
      if (!occupied.has(renderedAvatarKey(candidateSeed, variant))) return { seed: candidateSeed, variant };
    }
  }
}

function beginRound(room: Room) {
  const card = (room.cards ?? getDeck(room.deckId)!.cards.slice(0, totalRounds(room)))[room.rounds.length];
  const spotlight = room.players[room.rounds.length % room.players.length];
  room.rounds.push({
    card: { ...card, question: card.question.replace('{player}', () => spotlight.name) },
    submissions: new Map(),
  });
  room.phase = card.kind === 'write' ? 'answer' : 'vote';
}

function totalRounds(room: Room) {
  return room.totalRounds ?? room.cards?.length ?? LEGACY_ROUND_COUNT;
}

function allowsPass(room: Room) {
  // Rooms saved before passing became configurable keep their previous behavior.
  return room.allowPass ?? true;
}

function makeAnswerOptions(round: Round) {
  const usedIds = new Set<string>();
  round.answerOptions = [...round.submissions.entries()]
    .flatMap(([author, submission]) => submission.kind === 'write' ? [{ author, text: submission.value }] : [])
    .map(({ author, text }) => {
      const baseId = Math.random().toString(36).slice(2, 14) || '0';
      let id = baseId;
      for (let suffix = 1; usedIds.has(id); suffix++) id = `${baseId}-${suffix}`;
      usedIds.add(id);
      return { id, text, author };
    })
    .sort((a, b) => a.text.localeCompare(b.text) || a.id.localeCompare(b.id));
  round.answerVotes = new Map();
}

function allSubmitted(room: Room, submissions: Map<string, unknown>) {
  return submissions.size >= room.players.length;
}

function canRevealRound(room: Room, round: Round | undefined, online?: ReadonlySet<string>) {
  if (!round) return false;
  const disconnected = online !== undefined && room.players.some((player) => !online.has(player.id));
  if (room.phase === 'answer') return disconnected;
  if (room.phase !== 'vote') return false;
  if (round.answerOptions) {
    const blocked = !allowsPass(room) && (round.answerOptions.length === 0 || room.players.some((player) =>
      !room.allowSelfVote && round.answerOptions!.every((option) => option.author === player.id)));
    return disconnected || blocked;
  }
  return round.submissions.size > 0 || disconnected;
}

export function applyAction(room: Room, playerId: string, action: Action, online?: ReadonlySet<string>) {
  if (!room.players.some((player) => player.id === playerId)) throw new Error('Join the room first.');
  const round = room.rounds.at(-1);
  if (action.type === 'submit') {
    if (!round || action.round !== room.rounds.length) {
      throw new Error('This round is closed.');
    }
    const submission = action.submission;

    if (room.phase === 'answer' && round.card.kind === 'write') {
      if (round.submissions.has(playerId)) return;
      if (submission?.kind === 'pass') {
        if (!allowsPass(room)) throw new Error('Passing is not allowed in this room.');
        round.submissions.set(playerId, { kind: 'pass' });
      } else if (submission?.kind === 'write' && typeof submission.value === 'string') {
        const value = submission.value.trim();
        if (!value || value.length > 120) throw new Error('Use between 1 and 120 characters.');
        round.submissions.set(playerId, { kind: 'write', value });
      } else {
        throw new Error('Write an answer or pass.');
      }
      if (allSubmitted(room, round.submissions)) {
        makeAnswerOptions(round);
        room.phase = round.answerOptions!.length ? 'vote' : 'reveal';
      }
      return;
    }

    if (room.phase !== 'vote') throw new Error('This round is closed.');

    if (round.card.kind === 'write' && round.answerOptions) {
      const votes = round.answerVotes ??= new Map();
      if (votes.has(playerId)) return;
      if (submission?.kind === 'answer-vote-pass') {
        if (!allowsPass(room)) throw new Error('Passing is not allowed in this room.');
        votes.set(playerId, '');
      } else if (submission?.kind === 'answer-vote' && typeof submission.value === 'string') {
        const option = round.answerOptions.find(({ id }) => id === submission.value);
        if (!option) throw new Error('Choose one of the answers.');
        if (!room.allowSelfVote && option.author === playerId) throw new Error("You can't vote for your own answer.");
        votes.set(playerId, option.id);
      } else {
        throw new Error('Choose an answer or skip voting.');
      }
      if (allSubmitted(room, votes)) room.phase = 'reveal';
      return;
    }

    // A saved write round without answerOptions is an in-progress legacy round.
    if (round.submissions.has(playerId)) return;
    if (submission?.kind === 'pass') {
      if (!allowsPass(room)) throw new Error('Passing is not allowed in this room.');
      round.submissions.set(playerId, { kind: 'pass' });
      if (allSubmitted(room, round.submissions)) room.phase = 'reveal';
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
    if (allSubmitted(room, round.submissions)) room.phase = 'reveal';
    return;
  }
  if (room.host !== playerId) throw new Error('Only the host can do that.');
  if (action.type === 'start' && room.phase === 'lobby') {
    if (room.players.length < MIN_PLAYERS) throw new Error('You need at least 3 players.');
    beginRound(room);
    return;
  }
  if (action.type === 'reveal' && canRevealRound(room, round, online)) {
    if (room.phase === 'answer' && round) {
      makeAnswerOptions(round);
      room.phase = round.answerOptions!.length ? 'vote' : 'reveal';
    } else {
      room.phase = 'reveal';
    }
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
  let answers: Result['answers'] = [];
  if (round.answerOptions) {
    answers = round.answerOptions.map((option) => {
      const voters = [...(round.answerVotes ?? new Map()).entries()]
        .filter(([, optionId]) => optionId === option.id)
        .map(([voter]) => voter);
      return { ...option, count: voters.length, voters };
    });
  }
  for (const [author, submission] of round.submissions) {
    if (submission.kind === 'pick') {
      const voters = votes.get(submission.value) ?? [];
      voters.push(author);
      votes.set(submission.value, voters);
    }
    if (submission.kind === 'write' && !round.answerOptions) {
      answers.push(room.mode === 'named' ? { text: submission.value, author } : { text: submission.value });
    }
  }
  if (room.mode === 'anonymous' && !round.answerOptions) answers.sort((a, b) => a.text.localeCompare(b.text));
  const picks = [...votes.entries()].map(([playerId, voters]) =>
    room.mode === 'named' ? { playerId, count: voters.length, voters } : { playerId, count: voters.length }
  );
  picks.sort((a, b) => b.count - a.count || a.playerId.localeCompare(b.playerId));
  return { picks, answers };
}

export function viewRoom(room: Room, me: string, onlinePlayerIds?: Iterable<string>): RoomView {
  const round = room.rounds.at(-1);
  const online = onlinePlayerIds ? new Set(onlinePlayerIds) : new Set(room.players.map((player) => player.id));
  const answerVoting = room.phase === 'vote' && !!round?.answerOptions;
  const activeSubmissions = answerVoting ? round?.answerVotes : round?.submissions;
  const submitted = activeSubmissions?.size ?? 0;
  const hasSubmitted = activeSubmissions?.has(me) ?? false;
  return {
    code: room.code, me, host: room.host, mode: room.mode, phase: room.phase,
    // Older clients look up deckId locally. Send a built-in fallback alongside custom metadata.
    deckId: room.customDeck ? 'group-chat' : room.deckId,
    ...(room.customDeck && { customDeck: room.customDeck }),
    players: room.players.map((player) => ({ ...player, online: online.has(player.id) })),
    round: room.rounds.length, total: totalRounds(room),
    card: round?.card, submitted, hasSubmitted,
    allowSelfVote: room.allowSelfVote ?? false,
    allowPass: allowsPass(room),
    canReveal: me === room.host && canRevealRound(room, round, online),
    ...(answerVoting && { answerOptions: round.answerOptions!.map(({ id, text, author }) => ({ id, text, isOwn: author === me })) }),
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
