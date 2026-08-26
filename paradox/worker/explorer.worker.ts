/// <reference lib="webworker" />

import { exploreSession, verifyFinding } from "@/paradox/explorer/engine";
import type { WorkerRequest, WorkerResponse } from "@/paradox/explorer/types";

const scope: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = ({ data }: MessageEvent<WorkerRequest>) => {
  try {
    if (data.type === "EXPLORE") {
      const result = exploreSession(data.session, data.guardMode, data.maxNodes, (visited) => {
        const response: WorkerResponse = { type: "PROGRESS", runId: data.runId, visited };
        scope.postMessage(response);
      });
      const response: WorkerResponse = { type: "COMPLETE", runId: data.runId, result };
      scope.postMessage(response);
    } else {
      const report = verifyFinding(data.session, data.finding, data.maxNodes);
      const response: WorkerResponse = { type: "VERIFIED", runId: data.runId, report };
      scope.postMessage(response);
    }
  } catch (error) {
    const response: WorkerResponse = {
      type: "ERROR",
      runId: data.runId,
      message: error instanceof Error ? error.message : "Exploration failed.",
    };
    scope.postMessage(response);
  }
};

export {};
