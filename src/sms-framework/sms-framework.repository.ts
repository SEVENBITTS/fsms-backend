import type { PoolClient, QueryResultRow } from "pg";
import type {
  SmsElement,
  SmsFrameworkSource,
  SmsPillar,
} from "./sms-framework.types";

interface SmsFrameworkSourceRow extends QueryResultRow {
  code: string;
  title: string;
  source_type: string;
  version_label: string | null;
  source_url: string | null;
  notes: string | null;
  display_order: number;
}

interface SmsPillarRow extends QueryResultRow {
  code: string;
  title: string;
  display_order: number;
  source_code: string;
}

interface SmsElementRow extends QueryResultRow {
  code: string;
  pillar_code: string;
  element_number: string;
  title: string;
  display_order: number;
  source_code: string;
}

const toSource = (row: SmsFrameworkSourceRow): SmsFrameworkSource => ({
  code: row.code,
  title: row.title,
  sourceType: row.source_type,
  versionLabel: row.version_label,
  sourceUrl: row.source_url,
  notes: row.notes,
  displayOrder: row.display_order,
});

const toPillar = (row: SmsPillarRow, elements: SmsElement[]): SmsPillar => ({
  code: row.code,
  title: row.title,
  displayOrder: row.display_order,
  sourceCode: row.source_code,
  elements,
});

const toElement = (row: SmsElementRow): SmsElement => ({
  code: row.code,
  pillarCode: row.pillar_code,
  elementNumber: row.element_number,
  title: row.title,
  displayOrder: row.display_order,
  sourceCode: row.source_code,
});

export class SmsFrameworkRepository {
  async listSources(tx: PoolClient): Promise<SmsFrameworkSource[]> {
    const result = await tx.query<SmsFrameworkSourceRow>(
      `
      select *
      from sms_framework_sources
      order by display_order asc
      `,
    );

    return result.rows.map(toSource);
  }

  async listPillars(tx: PoolClient): Promise<SmsPillar[]> {
    const pillars = await tx.query<SmsPillarRow>(
      `
      select *
      from sms_pillars
      order by display_order asc
      `,
    );
    const elements = await this.listElements(tx);

    return pillars.rows.map((pillar) =>
      toPillar(
        pillar,
        elements.filter((element) => element.pillarCode === pillar.code),
      ),
    );
  }

  private async listElements(tx: PoolClient): Promise<SmsElement[]> {
    const result = await tx.query<SmsElementRow>(
      `
      select *
      from sms_elements
      order by display_order asc
      `,
    );

    return result.rows.map(toElement);
  }
}
