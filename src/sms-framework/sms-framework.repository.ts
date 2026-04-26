import type { PoolClient, QueryResultRow } from "pg";
import type {
  SmsControlMappedElement,
  SmsControlMapping,
  SmsElement,
  SmsFrameworkSource,
  SmsPillar,
  RegulatoryRequirementMapping,
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

interface RegulatoryRequirementMappingRow extends QueryResultRow {
  requirement_code: string;
  source_code: string;
  source_title: string;
  source_version_label: string | null;
  requirement_ref: string;
  requirement_summary: string;
  compliance_intent: string;
  control_code: string;
  control_title: string;
  control_area: string;
  evidence_type: string;
  assurance_owner: string;
  review_status: string;
  notes: string | null;
  display_order: number;
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

const toRegulatoryRequirementMapping = (
  row: RegulatoryRequirementMappingRow,
): RegulatoryRequirementMapping => ({
  requirementCode: row.requirement_code,
  sourceCode: row.source_code,
  sourceTitle: row.source_title,
  sourceVersionLabel: row.source_version_label,
  requirementRef: row.requirement_ref,
  requirementSummary: row.requirement_summary,
  complianceIntent: row.compliance_intent,
  controlCode: row.control_code,
  controlTitle: row.control_title,
  controlArea: row.control_area,
  evidenceType: row.evidence_type,
  assuranceOwner: row.assurance_owner,
  reviewStatus: row.review_status,
  notes: row.notes,
  displayOrder: row.display_order,
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

  async listRegulatoryRequirementMappings(
    tx: PoolClient,
  ): Promise<RegulatoryRequirementMapping[]> {
    const result = await tx.query<RegulatoryRequirementMappingRow>(
      `
      select
        requirements.requirement_code,
        requirements.source_code,
        sources.title as source_title,
        sources.version_label as source_version_label,
        requirements.requirement_ref,
        requirements.requirement_summary,
        requirements.compliance_intent,
        requirements.control_code,
        controls.title as control_title,
        controls.control_area,
        requirements.evidence_type,
        requirements.assurance_owner,
        requirements.review_status,
        requirements.notes,
        requirements.display_order
      from regulatory_requirement_mappings requirements
      inner join sms_framework_sources sources
        on sources.code = requirements.source_code
      inner join sms_controls controls
        on controls.code = requirements.control_code
      order by requirements.display_order asc
      `,
    );

    return result.rows.map(toRegulatoryRequirementMapping);
  }
}
