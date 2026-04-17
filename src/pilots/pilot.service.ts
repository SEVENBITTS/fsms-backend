import type { Pool } from "pg";
import { PilotNotFoundError } from "./pilot.errors";
import { PilotRepository } from "./pilot.repository";
import type {
  CreatePilotEvidenceInput,
  CreatePilotInput,
  PilotEvidence,
  PilotReadinessCheck,
  PilotReadinessReason,
  PilotReadinessResult,
  PilotReadinessStatus,
} from "./pilot.types";
import {
  validateCreatePilotEvidenceInput,
  validateCreatePilotInput,
} from "./pilot.validators";

export class PilotService {
  constructor(
    private readonly pool: Pool,
    private readonly pilotRepository: PilotRepository,
  ) {}

  async createPilot(input: CreatePilotInput) {
    const validated = validateCreatePilotInput(input);
    const client = await this.pool.connect();

    try {
      return await this.pilotRepository.insertPilot(client, validated);
    } finally {
      client.release();
    }
  }

  async getPilot(pilotId: string) {
    const client = await this.pool.connect();

    try {
      const pilot = await this.pilotRepository.getPilotById(client, pilotId);

      if (!pilot) {
        throw new PilotNotFoundError(pilotId);
      }

      return pilot;
    } finally {
      client.release();
    }
  }

  async createReadinessEvidence(
    pilotId: string,
    input: CreatePilotEvidenceInput,
  ) {
    const validated = validateCreatePilotEvidenceInput(input);
    const client = await this.pool.connect();

    try {
      const pilot = await this.pilotRepository.getPilotById(client, pilotId);

      if (!pilot) {
        throw new PilotNotFoundError(pilotId);
      }

      return await this.pilotRepository.insertEvidence(client, {
        pilotId,
        ...validated,
      });
    } finally {
      client.release();
    }
  }

  async checkPilotReadiness(pilotId: string): Promise<PilotReadinessCheck> {
    const readinessStatus = await this.getReadinessStatus(pilotId);
    const reasons = this.buildReadinessReasons(readinessStatus);

    return {
      pilotId,
      result: this.getReadinessResult(reasons),
      reasons,
      readinessStatus,
    };
  }

  private async getReadinessStatus(
    pilotId: string,
  ): Promise<PilotReadinessStatus> {
    const client = await this.pool.connect();

    try {
      const pilot = await this.pilotRepository.getPilotById(client, pilotId);

      if (!pilot) {
        throw new PilotNotFoundError(pilotId);
      }

      const evidence = await this.pilotRepository.listEvidence(client, pilotId);
      const now = new Date();
      const expiredEvidence = evidence.filter((item) =>
        this.isEvidenceExpired(item, now),
      );
      const inactiveEvidence = evidence.filter(
        (item) => item.status !== "active" && !expiredEvidence.includes(item),
      );
      const currentEvidence = evidence.filter(
        (item) =>
          item.status === "active" && !expiredEvidence.some((expired) => expired.id === item.id),
      );

      return {
        pilot,
        currentEvidence,
        expiredEvidence,
        inactiveEvidence,
      };
    } finally {
      client.release();
    }
  }

  private isEvidenceExpired(evidence: PilotEvidence, now: Date): boolean {
    return evidence.expiresAt !== null && new Date(evidence.expiresAt) <= now;
  }

  private buildReadinessReasons(
    readinessStatus: PilotReadinessStatus,
  ): PilotReadinessReason[] {
    const { pilot, currentEvidence, expiredEvidence, inactiveEvidence } =
      readinessStatus;

    if (pilot.status === "suspended") {
      return [
        {
          code: "PILOT_SUSPENDED",
          severity: "fail",
          message: "Pilot is suspended and is not fit for mission use",
        },
      ];
    }

    if (pilot.status === "retired") {
      return [
        {
          code: "PILOT_RETIRED",
          severity: "fail",
          message: "Pilot is retired and is not fit for mission use",
        },
      ];
    }

    const reasons: PilotReadinessReason[] = [];

    if (pilot.status === "inactive") {
      reasons.push({
        code: "PILOT_INACTIVE",
        severity: "warning",
        message: "Pilot is inactive and requires review before mission use",
      });
    }

    if (currentEvidence.length === 0) {
      reasons.push({
        code: "PILOT_EVIDENCE_MISSING",
        severity: "fail",
        message: "Pilot has no current readiness evidence",
      });
    }

    if (expiredEvidence.length > 0) {
      reasons.push({
        code: "PILOT_EVIDENCE_EXPIRED",
        severity: "fail",
        message: "Pilot has expired readiness evidence",
        relatedEvidenceIds: expiredEvidence.map((item) => item.id),
      });
    }

    const revokedEvidence = inactiveEvidence.filter(
      (item) => item.status === "revoked",
    );

    if (revokedEvidence.length > 0) {
      reasons.push({
        code: "PILOT_EVIDENCE_REVOKED",
        severity: "fail",
        message: "Pilot has revoked readiness evidence",
        relatedEvidenceIds: revokedEvidence.map((item) => item.id),
      });
    }

    if (reasons.length === 0) {
      reasons.push({
        code: "PILOT_ACTIVE",
        severity: "pass",
        message: "Pilot is active with current readiness evidence",
        relatedEvidenceIds: currentEvidence.map((item) => item.id),
      });
    }

    return reasons;
  }

  private getReadinessResult(
    reasons: PilotReadinessReason[],
  ): PilotReadinessResult {
    if (reasons.some((reason) => reason.severity === "fail")) {
      return "fail";
    }

    if (reasons.some((reason) => reason.severity === "warning")) {
      return "warning";
    }

    return "pass";
  }
}
