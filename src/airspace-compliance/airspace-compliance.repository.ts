import { randomUUID } from "crypto";
import type { PoolClient, QueryResultRow } from "pg";
import type { AirspaceComplianceInput } from "./airspace-compliance.types";

interface AirspaceComplianceInputRow extends QueryResultRow {
  id: string;
  mission_id: string;
  airspace_class: AirspaceComplianceInput["airspaceClass"];
  max_altitude_ft: number;
  restriction_status: AirspaceComplianceInput["restrictionStatus"];
  permission_status: AirspaceComplianceInput["permissionStatus"];
  controlled_airspace: boolean;
  nearby_aerodrome: boolean;
  evidence_ref: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

type CreateAirspaceComplianceInputRow = Omit<
  AirspaceComplianceInput,
  "id" | "createdAt" | "updatedAt"
>;

const toAirspaceComplianceInput = (
  row: AirspaceComplianceInputRow,
): AirspaceComplianceInput => ({
  id: row.id,
  missionId: row.mission_id,
  airspaceClass: row.airspace_class,
  maxAltitudeFt: Number(row.max_altitude_ft),
  restrictionStatus: row.restriction_status,
  permissionStatus: row.permission_status,
  controlledAirspace: row.controlled_airspace,
  nearbyAerodrome: row.nearby_aerodrome,
  evidenceRef: row.evidence_ref,
  notes: row.notes,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

export class AirspaceComplianceRepository {
  async missionExists(tx: PoolClient, missionId: string): Promise<boolean> {
    const result = await tx.query(
      `
      select 1
      from missions
      where id = $1
      `,
      [missionId],
    );

    return result.rowCount === 1;
  }

  async insertAirspaceComplianceInput(
    tx: PoolClient,
    input: CreateAirspaceComplianceInputRow,
  ): Promise<AirspaceComplianceInput> {
    const result = await tx.query<AirspaceComplianceInputRow>(
      `
      insert into airspace_compliance_inputs (
        id,
        mission_id,
        airspace_class,
        max_altitude_ft,
        restriction_status,
        permission_status,
        controlled_airspace,
        nearby_aerodrome,
        evidence_ref,
        notes
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      returning *
      `,
      [
        randomUUID(),
        input.missionId,
        input.airspaceClass,
        input.maxAltitudeFt,
        input.restrictionStatus,
        input.permissionStatus,
        input.controlledAirspace,
        input.nearbyAerodrome,
        input.evidenceRef,
        input.notes,
      ],
    );

    return toAirspaceComplianceInput(result.rows[0]);
  }

  async getLatestAirspaceComplianceInput(
    tx: PoolClient,
    missionId: string,
  ): Promise<AirspaceComplianceInput | null> {
    const result = await tx.query<AirspaceComplianceInputRow>(
      `
      select *
      from airspace_compliance_inputs
      where mission_id = $1
      order by created_at desc, id desc
      limit 1
      `,
      [missionId],
    );

    return result.rows[0] ? toAirspaceComplianceInput(result.rows[0]) : null;
  }
}
