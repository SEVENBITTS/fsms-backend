import { randomUUID } from "crypto";
import type { PoolClient, QueryResultRow } from "pg";
import type { MissionRiskInput } from "./mission-risk.types";

interface MissionRiskInputRow extends QueryResultRow {
  id: string;
  mission_id: string;
  operating_category: MissionRiskInput["operatingCategory"];
  mission_complexity: MissionRiskInput["missionComplexity"];
  population_exposure: MissionRiskInput["populationExposure"];
  airspace_complexity: MissionRiskInput["airspaceComplexity"];
  weather_risk: MissionRiskInput["weatherRisk"];
  payload_risk: MissionRiskInput["payloadRisk"];
  mitigation_summary: string | null;
  created_at: Date;
  updated_at: Date;
}

type CreateMissionRiskInputRow = Omit<
  MissionRiskInput,
  "id" | "createdAt" | "updatedAt"
>;

const toMissionRiskInput = (row: MissionRiskInputRow): MissionRiskInput => ({
  id: row.id,
  missionId: row.mission_id,
  operatingCategory: row.operating_category,
  missionComplexity: row.mission_complexity,
  populationExposure: row.population_exposure,
  airspaceComplexity: row.airspace_complexity,
  weatherRisk: row.weather_risk,
  payloadRisk: row.payload_risk,
  mitigationSummary: row.mitigation_summary,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

export class MissionRiskRepository {
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

  async insertMissionRiskInput(
    tx: PoolClient,
    input: CreateMissionRiskInputRow,
  ): Promise<MissionRiskInput> {
    const result = await tx.query<MissionRiskInputRow>(
      `
      insert into mission_risk_inputs (
        id,
        mission_id,
        operating_category,
        mission_complexity,
        population_exposure,
        airspace_complexity,
        weather_risk,
        payload_risk,
        mitigation_summary
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning *
      `,
      [
        randomUUID(),
        input.missionId,
        input.operatingCategory,
        input.missionComplexity,
        input.populationExposure,
        input.airspaceComplexity,
        input.weatherRisk,
        input.payloadRisk,
        input.mitigationSummary,
      ],
    );

    return toMissionRiskInput(result.rows[0]);
  }

  async getLatestMissionRiskInput(
    tx: PoolClient,
    missionId: string,
  ): Promise<MissionRiskInput | null> {
    const result = await tx.query<MissionRiskInputRow>(
      `
      select *
      from mission_risk_inputs
      where mission_id = $1
      order by created_at desc, id desc
      limit 1
      `,
      [missionId],
    );

    return result.rows[0] ? toMissionRiskInput(result.rows[0]) : null;
  }
}
