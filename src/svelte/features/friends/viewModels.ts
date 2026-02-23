import type { FriendSnapshot } from './types';

export type FriendRow = {
  id: string;
  title: string;
  rosterCode: string;
  updatedAt: string | null;
  characterCount: number;
  cacheAgeMin: number | null;
  heatmapColor: string;
};

export type HeatmapGroup = {
  id: string;
  name: string;
  isSelf: boolean;
  color: string;
  characters: FriendSnapshot['characters'];
};

export type HeatmapDetailRow = {
  id: string;
  group: HeatmapGroup;
  character: FriendSnapshot['characters'][number] | null;
};

export type SyncBadgeState = {
  className: string;
  label: string;
  title: string;
};

export type RaidCellState = {
  className: string;
  text: string;
  label: string;
};

export type FriendGridCard = {
  id: string;
  title: string;
  rosterCode: string;
  isSelf: boolean;
  updatedAt: string | null;
  cacheAgeMin: number | null;
  heatmapColor: string;
  characters: FriendSnapshot['characters'];
};