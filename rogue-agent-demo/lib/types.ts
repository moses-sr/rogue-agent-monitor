// One game of the ledger task. The same shape is used for the scripted
// simulation and for real runs loaded from a file (see README.md).

export type EntryKind = "ok" | "mistake" | "sabotage" | "frame";

export type Entry = {
  agent: string;
  answer: number;
  note: string;
  // Ground truth about the entry. The monitor never sees this.
  kind?: EntryKind;
};

export type Round = {
  n: number;
  item: string;
  truth: number;
  entries: Entry[];
  recheck?: Entry;
  posted: number;
  monitorNote: string;
  strikes: Record<string, number>;
  quarantined: string | null;
};

export type Game = {
  id: string;
  source: "scripted" | "real";
  rogueLevel: string;
  monitor: string;
  agents: string[];
  rogue: string | null;
  rounds: Round[];
};

export type Option = { id: string; name: string; blurb?: string };
