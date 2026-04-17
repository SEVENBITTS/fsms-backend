import { randomUUID } from "crypto";
import type { PoolClient, QueryResultRow } from "pg";
import type { Pilot, PilotEvidence } from "./pilot.types";

interface PilotRow extends QueryResultRow {
  id: string;
  display_name: string;
  caa_reference: string | null;
  status: Pilot["status"];
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

interface PilotEvidenceRow extends QueryResultRow {
  id: string;
  pilot_id: string;
  evidence_type: string;
  title: string;
  issued_at: Date | null;
  expires_at: Date | null;
  status: PilotEvidence["status"];
  evidence_ref: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

type CreatePilotRow = Omit<Pilot, "id" | "createdAt" | "updatedAt">;

type CreatePilotEvidenceRow = {
  pilotId: string;
  evidenceType: string;
  title: string;
  issuedAt: Date | null;
  expiresAt: Date | null;
  status: PilotEvidence["status"];
  evidenceRef: string | null;
  notes: string | null;
};

const toPilot = (row: PilotRow): Pilot => ({
  id: row.id,
  displayName: row.display_name,
  caaReference: row.caa_reference,
  status: row.status,
  notes: row.notes,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

const toEvidence = (row: PilotEvidenceRow): PilotEvidence => ({
  id: row.id,
  pilotId: row.pilot_id,
  evidenceType: row.evidence_type,
  title: row.title,
  issuedAt: row.issued_at?.toISOString() ?? null,
  expiresAt: row.expires_at?.toISOString() ?? null,
  status: row.status,
  evidenceRef: row.evidence_ref,
  notes: row.notes,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

export class PilotRepository {
  async insertPilot(tx: PoolClient, input: CreatePilotRow): Promise<Pilot> {
    const result = await tx.query<PilotRow>(
      `
      insert into pilots (
        id,
        display_name,
        caa_reference,
        status,
        notes
      )
      values ($1, $2, $3, $4, $5)
      returning *
      `,
      [
        randomUUID(),
        input.displayName,
        input.caaReference,
        input.status,
        input.notes,
      ],
    );

    return toPilot(result.rows[0]);
  }

  async getPilotById(tx: PoolClient, pilotId: string): Promise<Pilot | null> {
    const result = await tx.query<PilotRow>(
      `
      select *
      from pilots
      where id = $1
      `,
      [pilotId],
    );

    return result.rows[0] ? toPilot(result.rows[0]) : null;
  }

  async insertEvidence(
    tx: PoolClient,
    input: CreatePilotEvidenceRow,
  ): Promise<PilotEvidence> {
    const result = await tx.query<PilotEvidenceRow>(
      `
      insert into pilot_readiness_evidence (
        id,
        pilot_id,
        evidence_type,
        title,
        issued_at,
        expires_at,
        status,
        evidence_ref,
        notes
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning *
      `,
      [
        randomUUID(),
        input.pilotId,
        input.evidenceType,
        input.title,
        input.issuedAt,
        input.expiresAt,
        input.status,
        input.evidenceRef,
        input.notes,
      ],
    );

    return toEvidence(result.rows[0]);
  }

  async listEvidence(tx: PoolClient, pilotId: string): Promise<PilotEvidence[]> {
    const result = await tx.query<PilotEvidenceRow>(
      `
      select *
      from pilot_readiness_evidence
      where pilot_id = $1
      order by created_at asc, id asc
      `,
      [pilotId],
    );

    return result.rows.map(toEvidence);
  }
}
