import { getDeck, type Card } from './decks';

export type Mode = 'anonymous' | 'named';
type Phase = 'lobby' | 'vote' | 'reveal' | 'recap';
export type Player = { id: string; name: string; color: number };
type Submission = { kind: 'pick' | 'write'; value: string } | { kind: 'pass' };
type Result = {
  picks: { playerId: string; count: number; voters?: string[] }[];
  answers: { text: string; author?: string }[];
};
type Round = { card: Card; submissions: Map<string, Submission> };
export type Room = {
  code: string;
  host: string;
  deckId: string;
  mode: Mode;
  phase: Phase;
  players: Player[];
  rounds: Round[];
};

export type RoomView = {
  code: string;
  me: string;
  host: string;
  deckId: string;
  mode: Mode;
  phase: Phase;
  players: Player[];
  round: number;
  total: number;
  card?: Card;
  submitted: number;
  hasSubmitted: boolean;
  result?: Result;
  recap?: { question: string; leaders: string[] }[];
};

export type Action =
  | { type: 'start' | 'reveal' | 'next' }
  | { type: 'submit'; round: number; submission: Submission };

export type Command = Action
  | { type: 'create'; name: string; deckId: string; mode: Mode; token: string }
  | { type: 'join'; name: string; code: string; token: string }
  | { type: 'resume'; code: string; token: string }
  | { type: 'leave' };
export type Message =
  | { type: 'state'; room: RoomView }
  | { type: 'error'; message: string; reset?: boolean };

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;

export function createRoom(code: string, id: string, name: string, deckId: string, mode: Mode): Room {
  const room: Room = { code, host: id, deckId, mode, phase: 'lobby', players: [], rounds: [] };
  addPlayer(room, id, name);
  return room;
}

export function addPlayer(room: Room, id: string, value: string) {
  const name = value.trim().replace(/\s+/g, ' ');
  if (room.phase !== 'lobby') throw new Error('This game has already started.');
  if (room.players.length >= MAX_PLAYERS) throw new Error('This room is full.');
  if (!name || name.length > 24) throw new Error('Use a name between 1 and 24 characters.');
  if (room.players.some((player) => player.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Someone already has that name.');
  }
  room.players.push({ id, name, color: room.players.length % 6 });
}

function beginRound(room: Room) {
  const card = getDeck(room.deckId)!.cards[room.rounds.length];
  const spotlight = room.players[1 + (room.rounds.length % (room.players.length - 1))];
  room.rounds.push({
    card: { ...card, question: card.question.replace('{player}', () => spotlight.name) },
    submissions: new Map(),
  });
  room.phase = 'vote';
}

export function applyAction(room: Room, playerId: string, action: Action) {
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
  if (action.type === 'reveal' && room.phase === 'vote' && round?.submissions.size) {
    room.phase = 'reveal';
    return;
  }
  if (action.type === 'next' && room.phase === 'reveal') {
    if (room.rounds.length === getDeck(room.deckId)!.cards.length) room.phase = 'recap';
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

export function viewRoom(room: Room, me: string): RoomView {
  const round = room.rounds.at(-1);
  return {
    code: room.code, me, host: room.host, deckId: room.deckId, mode: room.mode, phase: room.phase,
    players: room.players, round: room.rounds.length, total: getDeck(room.deckId)!.cards.length,
    card: round?.card, submitted: round?.submissions.size ?? 0, hasSubmitted: round?.submissions.has(me) ?? false,
    result: room.phase === 'reveal' && round ? results(room, round) : undefined,
    recap: room.phase === 'recap' ? room.rounds.map((item) => {
      const { picks } = results(room, item);
      return {
        question: item.card.question,
        leaders: picks.filter((pick) => pick.count === picks[0]?.count).map((pick) => pick.playerId),
      };
    }) : undefined,
  };
}
