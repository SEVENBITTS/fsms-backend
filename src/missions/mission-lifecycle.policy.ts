import type { MissionStatus } from "./mission-telemetry.types";

export class MissionLifecyclePolicy {
  canAcceptTelemetry(status: MissionStatus): boolean {
    return status === "active";
  }
}