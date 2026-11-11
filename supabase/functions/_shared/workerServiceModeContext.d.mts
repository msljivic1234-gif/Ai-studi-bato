import type { ServiceHandoff } from './serviceHandoff.mjs';
export type WorkerServiceMode = { service: string; mode: 'REMOTE' | 'ON_SITE'; categoryId: string; handoff?: ServiceHandoff };
export type WorkerServiceModeContext = {
  schemaVersion: 'WORKER_SERVICE_MODE_CONTEXT_V1'; revision: number;
  savedServices: WorkerServiceMode[]; draftServices: WorkerServiceMode[]; unresolvedServices: string[];
};
export function readWorkerServiceModeContext(context: Record<string, any>): WorkerServiceModeContext;
export function workerServiceModeSchema(schema: Record<string, any>): Record<string, any>;
export function workerServiceModeInstruction(context: WorkerServiceModeContext, includeContext?: boolean, includeClassification?: boolean): string;
export type WorkerModeRequest = {service: string; modes: Array<'REMOTE' | 'ON_SITE'>; evidence: string; handoff?: ServiceHandoff};
export function workerModeRequests(serviceModeChangesJson: unknown, context: {messages: Array<{role: string; body?: unknown}>},
  offered: ReadonlyMap<string, unknown>): Map<string, WorkerModeRequest>;
export function recoverWorkerExistingIdentity(input: {
  raw: Record<string, any>; inspection: any; context: Record<string, any>;
  modeContext: WorkerServiceModeContext; catalog: any;
}): {output: Record<string, any>; recoveredCount: number};
export function preserveWorkerServiceModes(input: {
  raw: Record<string, any>; hints: Record<string, any>[]; context: Record<string, any>;
  modeContext: WorkerServiceModeContext; catalog: any;
}): { output: Record<string, any>; hints: Record<string, any>[]; preserved: boolean; preservedServices: string[]; unresolvedChanges: string[] };
