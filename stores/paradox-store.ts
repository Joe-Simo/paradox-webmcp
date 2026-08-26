"use client";

import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import { createInitialSession } from "@/domain/ledger/model";
import type { LabSession } from "@/domain/ledger/types";
import type { CounterexampleFinding, ExplorationResult, VerificationReport } from "@/paradox/explorer/types";

export type ParadoxState = {
  hydrated: boolean;
  session: LabSession;
  run: ExplorationResult | null;
  finding: CounterexampleFinding | null;
  verification: VerificationReport | null;
  exploring: boolean;
  progress: number;
  capabilities: string[];
  webmcpSupported: boolean;
  notice: string | null;
};

export const paradoxStore = createStore<ParadoxState>(() => ({
  hydrated: false,
  session: createInitialSession(),
  run: null,
  finding: null,
  verification: null,
  exploring: false,
  progress: 0,
  capabilities: [],
  webmcpSupported: false,
  notice: null,
}));

export function useParadoxStore<T>(selector: (state: ParadoxState) => T) {
  return useStore(paradoxStore, selector);
}
