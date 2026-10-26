import { interestReady } from './refresh.mjs';
import { createServer } from 'node:http';

export function createStatusState(settings, group, now = Date.now()) {
  return {
    startedAt: now, network: settings.network, groupId: settings.groupId,
    dryRun: settings.dryRun, liveSigning: !settings.dryRun,
    controllerId: group.controllerId, markets: group.markets,
    activePositions: 0, lastSuccessfulCycle: null, lastError: null,
    fatal: false, stopping: false, lastTx: null, refresh: {}, interest: {},
  };
}
export function publicStatus(state, now = Date.now()) {
  const refreshUnhealthy = Object.values(state.refresh).some(job => (job.failures || 0) > 0 || (!state.dryRun && (!job.lastSuccess || now - job.lastSuccess > 240000)));
  const healthy = (state.dryRun || interestReady(state.markets,state.interest||{},false,now)) && !refreshUnhealthy && !state.lastError && !state.fatal && !state.stopping && state.lastSuccessfulCycle !== null && now - state.lastSuccessfulCycle < 180000;
  return { ...state, healthy, mode: state.dryRun ? 'simulation-only' : 'live', uptimeSeconds: Math.floor((now - state.startedAt) / 1000) };
}
export function createStatusServer(state, view = publicStatus) {
  return createServer((request, response) => {
    if (request.method !== 'GET' || !['/health','/status'].includes(request.url)) {
      response.writeHead(404, { 'Content-Type': 'application/json' }); response.end('{"error":"not found"}'); return;
    }
    const status = view(state);
    response.writeHead(request.url === '/health' && !status.healthy ? 503 : 200, {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    });
    response.end(JSON.stringify(request.url === '/health' ? { healthy: status.healthy, mode: status.mode, ...(status.groupId !== undefined ? { groupId: status.groupId } : {}) } : status));
  });
}
