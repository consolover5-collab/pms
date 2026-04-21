import buildGate from './build-gate.ts';
import apiProbe from './api-probe.ts';

export default async function globalSetup(): Promise<void> {
  await buildGate();
  await apiProbe();
}
