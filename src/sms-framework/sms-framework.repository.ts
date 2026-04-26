import type { PoolClient, QueryResultRow } from "pg";
import type {
  SmsControlMappedElement,
  SmsControlMapping,
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

interface SmsControlRow extends QueryResultRow {
  code: string;
  title: string;
  control_area: string;
  description: string;
  display_order: number;
}

interface SmsControlMappedElementRow extends QueryResultRow {
  control_code: string;
  element_code: string;
  pillar_code: string;
  pillar_title: string;
  element_number: string;
  element_title: string;
  element_display_order: number;
  rationale: string;
  mapping_display_order: number;
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

const toMappedElement = (
  row: SmsControlMappedElementRow,
): SmsControlMappedElement => ({
  code: row.element_code,
  pillarCode: row.pillar_code,
  pillarTitle: row.pillar_title,
  elementNumber: row.element_number,
  title: row.element_title,
  displayOrder: row.element_display_order,
  rationale: row.rationale,
});

const toControlMapping = (
  row: SmsControlRow,
  elements: SmsControlMappedElement[],
): SmsControlMapping => ({
  code: row.code,
  title: row.title,
  controlArea: row.control_area,
  description: row.description,
  displayOrder: row.display_order,
  elements,
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

  async listControlMappings(tx: PoolClient): Promise<SmsControlMapping[]> {
    const controls = await tx.query<SmsControlRow>(
      `
      select *
      from sms_controls
      order by display_order asc
      `,
    );
    const mappedElements = await tx.query<SmsControlMappedElementRow>(
      `
      select
        mappings.control_code,
        mappings.element_code,
        elements.pillar_code,
        pillars.title as pillar_title,
        elements.element_number,
        elements.title as element_title,
        elements.display_order as element_display_order,
        mappings.rationale,
        mappings.display_order as mapping_display_order
      from sms_control_element_mappings mappings
      inner join sms_elements elements
        on elements.code = mappings.element_code
      inner join sms_pillars pillars
        on pillars.code = elements.pillar_code
      order by mappings.control_code asc, mappings.display_order asc
      `,
    );

    return controls.rows.map((control) =>
      toControlMapping(
        control,
        mappedElements.rows
          .filter((element) => element.control_code === control.code)
          .map(toMappedElement),
      ),
    );
  }
}
