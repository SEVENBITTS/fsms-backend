import type { Pool } from "pg";
import { SmsFrameworkRepository } from "./sms-framework.repository";
import type {
  SmsControlMapping,
  SmsFramework,
  RegulatoryRequirementMapping,
} from "./sms-framework.types";

export class SmsFrameworkService {
  constructor(
    private readonly pool: Pool,
    private readonly smsFrameworkRepository: SmsFrameworkRepository,
  ) {}

  async getFramework(): Promise<SmsFramework> {
    const client = await this.pool.connect();

    try {
      const sources = await this.smsFrameworkRepository.listSources(client);
      const pillars = await this.smsFrameworkRepository.listPillars(client);

      return {
        sources,
        pillars,
      };
    } finally {
      client.release();
    }
  }

  async listControlMappings(): Promise<SmsControlMapping[]> {
    const client = await this.pool.connect();

    try {
      return await this.smsFrameworkRepository.listControlMappings(client);
    } finally {
      client.release();
    }
  }

  async listRegulatoryRequirementMappings(): Promise<
    RegulatoryRequirementMapping[]
  > {
    const client = await this.pool.connect();

    try {
      return await this.smsFrameworkRepository.listRegulatoryRequirementMappings(
        client,
      );
    } finally {
      client.release();
    }
  }
}
