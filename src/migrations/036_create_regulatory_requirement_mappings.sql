insert into sms_framework_sources (
  code,
  title,
  source_type,
  version_label,
  source_url,
  notes,
  display_order
)
values
  (
    'CAA_CAP_722_2024',
    'CAA CAP 722: Unmanned Aircraft System Operations in UK Airspace - Guidance',
    'external_guidance_reference',
    'Version 9.2, 16-Apr-2024',
    'https://www.caa.co.uk/cap722',
    'Recorded as CAA UAS source guidance and version context only; not executable compliance logic.',
    3
  ),
  (
    'UK_UAS_REGULATIONS',
    'UK UAS core regulations and applicable AMC/GM/CS',
    'external_regulatory_reference',
    'UK Regulation (EU) 2019/947 and UK Regulation (EU) 2019/945',
    'https://www.caa.co.uk/drones/regulations-consultations-and-policy-programmes/regulations-consultations-and-caa-publications-caps/',
    'Recorded as core regulatory source context for later clause-level review; not executable compliance logic.',
    4
  )
on conflict (code) do update
set
  title = excluded.title,
  source_type = excluded.source_type,
  version_label = excluded.version_label,
  source_url = excluded.source_url,
  notes = excluded.notes,
  display_order = excluded.display_order;

create table if not exists regulatory_requirement_mappings (
  requirement_code text primary key,
  source_code text not null references sms_framework_sources(code) on delete restrict,
  requirement_ref text not null,
  requirement_summary text not null,
  compliance_intent text not null,
  control_code text not null references sms_controls(code) on delete restrict,
  evidence_type text not null,
  assurance_owner text not null,
  review_status text not null,
  notes text null,
  display_order int not null unique,
  constraint regulatory_requirement_mappings_status_chk
    check (review_status in (
      'source_mapped',
      'needs_clause_review',
      'needs_owner_review',
      'accepted'
    ))
);

insert into regulatory_requirement_mappings (
  requirement_code,
  source_code,
  requirement_ref,
  requirement_summary,
  compliance_intent,
  control_code,
  evidence_type,
  assurance_owner,
  review_status,
  notes,
  display_order
)
values
  (
    'REG_UAS_OPERATING_SOURCE_BASIS',
    'CAA_CAP_722_2024',
    'CAP 722 source guidance',
    'UAS operations should be planned and reviewed using current CAA UAS operating guidance.',
    'Keep mission planning, airspace, risk, and assurance evidence traceable to current CAA UAS source material.',
    'MISSION_RISK_ASSESSMENT',
    'mission risk assessment and regulatory source reference',
    'compliance_owner',
    'needs_clause_review',
    'Initial source-level mapping only; requires clause-level review before compliance claims.',
    1
  ),
  (
    'REG_AIRSPACE_PERMISSION_EVIDENCE',
    'CAA_CAP_722_2024',
    'CAP 722 airspace and permissions source guidance',
    'Mission airspace constraints, permissions, and operating limits should be identified before operation.',
    'Capture airspace class, restrictions, permissions, altitude limits, and evidence references for review.',
    'AIRSPACE_COMPLIANCE',
    'airspace compliance input and evidence reference',
    'compliance_owner',
    'needs_clause_review',
    'Maps current airspace evidence capture to CAA source guidance; not a legal sufficiency determination.',
    2
  ),
  (
    'REG_OPERATING_SAFETY_CASE_CONTEXT',
    'CAA_CAP_722A_2022',
    'CAP 722A operating safety case source guidance',
    'Specific Category operational authorisation evidence should be structured for safety case review.',
    'Preserve planning, risk, approval, dispatch, and audit evidence that can support later OSC preparation.',
    'AUDIT_EVIDENCE_SNAPSHOTS',
    'decision evidence snapshot',
    'accountable_manager',
    'needs_clause_review',
    'Evidence structure supports later OSC preparation but does not replace a submitted OSC.',
    3
  ),
  (
    'REG_CHANGE_MANAGEMENT_AMENDMENTS',
    'UK_UAS_REGULATIONS',
    'CAA regulations, AMC, GM, CS, and CAP amendment monitoring',
    'Regulatory amendments should trigger documented review of affected controls and evidence.',
    'Create amendment alerts, capture what changed, and require owner review before relying on affected controls.',
    'MISSION_READINESS_GATE',
    'regulatory amendment alert and review action',
    'compliance_owner',
    'source_mapped',
    'Initial mapping for amendment-alert workflow; later work should add owner acknowledgement and closure evidence.',
    4
  ),
  (
    'REG_POST_OPERATION_RECORDS',
    'CAA_CAP_722_2024',
    'CAP 722 operational record keeping source guidance',
    'Operational evidence should be retained for assurance, audit, and accountable review.',
    'Generate and retain post-operation reports, sign-offs, acknowledgements, and evidence package metadata.',
    'POST_OPERATION_REPORT_SIGNOFF',
    'post-operation report and sign-off record',
    'accountable_manager',
    'needs_clause_review',
    'Record-retention period and clause-specific obligations still need formal review.',
    5
  )
on conflict (requirement_code) do update
set
  source_code = excluded.source_code,
  requirement_ref = excluded.requirement_ref,
  requirement_summary = excluded.requirement_summary,
  compliance_intent = excluded.compliance_intent,
  control_code = excluded.control_code,
  evidence_type = excluded.evidence_type,
  assurance_owner = excluded.assurance_owner,
  review_status = excluded.review_status,
  notes = excluded.notes,
  display_order = excluded.display_order;
