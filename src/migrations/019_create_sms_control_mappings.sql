create table if not exists sms_controls (
  code text primary key,
  title text not null,
  control_area text not null,
  description text not null,
  display_order int not null unique
);

create table if not exists sms_control_element_mappings (
  control_code text not null references sms_controls(code) on delete cascade,
  element_code text not null references sms_elements(code) on delete restrict,
  rationale text not null,
  display_order int not null,
  primary key (control_code, element_code),
  constraint sms_control_element_mappings_order_uniq
    unique (control_code, display_order)
);

insert into sms_controls (
  code,
  title,
  control_area,
  description,
  display_order
)
values
  (
    'PLATFORM_READINESS_MAINTENANCE',
    'Platform readiness and maintenance controls',
    'platform',
    'Checks that UAV platform status and maintenance evidence are suitable before mission use.',
    1
  ),
  (
    'PILOT_READINESS',
    'Pilot readiness controls',
    'pilot',
    'Checks that operator readiness evidence is current and suitable for mission use.',
    2
  ),
  (
    'MISSION_RISK_ASSESSMENT',
    'Mission risk controls',
    'risk',
    'Captures operational risk inputs for mission complexity, exposure, weather, airspace, and payload considerations.',
    3
  ),
  (
    'AIRSPACE_COMPLIANCE',
    'Airspace compliance controls',
    'airspace',
    'Captures operating constraints, airspace class, altitude, restriction, and permission status.',
    4
  ),
  (
    'MISSION_READINESS_GATE',
    'Mission readiness gate controls',
    'mission_gate',
    'Combines platform, pilot, risk, and airspace readiness into a gate result before approval or dispatch.',
    5
  ),
  (
    'MISSION_APPROVAL_GUARD',
    'Mission approval guard controls',
    'mission_gate',
    'Requires linked readiness and planning evidence before mission approval state changes.',
    6
  ),
  (
    'MISSION_DISPATCH_GUARD',
    'Mission dispatch guard controls',
    'mission_gate',
    'Requires linked approval and dispatch evidence before launch state changes.',
    7
  ),
  (
    'AUDIT_EVIDENCE_SNAPSHOTS',
    'Audit evidence snapshot controls',
    'audit',
    'Preserves readiness and decision evidence as reviewable records.',
    8
  ),
  (
    'POST_OPERATION_REPORT_SIGNOFF',
    'Post-operation report and sign-off controls',
    'audit',
    'Produces post-operation evidence reports and stores accountable-manager sign-off records.',
    9
  )
on conflict (code) do update
set
  title = excluded.title,
  control_area = excluded.control_area,
  description = excluded.description,
  display_order = excluded.display_order;

insert into sms_control_element_mappings (
  control_code,
  element_code,
  rationale,
  display_order
)
values
  (
    'PLATFORM_READINESS_MAINTENANCE',
    'RISK_ASSESSMENT_AND_MITIGATION',
    'Platform status and maintenance due checks mitigate technical safety risk before mission use.',
    1
  ),
  (
    'PLATFORM_READINESS_MAINTENANCE',
    'SAFETY_PERFORMANCE_MONITORING',
    'Maintenance status provides measurable safety performance evidence for the UAV platform.',
    2
  ),
  (
    'PILOT_READINESS',
    'RISK_ASSESSMENT_AND_MITIGATION',
    'Pilot readiness evidence mitigates operator-related mission risk.',
    1
  ),
  (
    'PILOT_READINESS',
    'SAFETY_TRAINING_AND_EDUCATION',
    'Pilot readiness depends on current authorisation, competence, and training evidence.',
    2
  ),
  (
    'MISSION_RISK_ASSESSMENT',
    'RISK_HAZARD_DETECTION_AND_IDENTIFICATION',
    'Mission risk inputs identify operational hazards before approval or dispatch.',
    1
  ),
  (
    'MISSION_RISK_ASSESSMENT',
    'RISK_ASSESSMENT_AND_MITIGATION',
    'Risk scoring and risk bands support mitigation decisions and gate outcomes.',
    2
  ),
  (
    'AIRSPACE_COMPLIANCE',
    'RISK_HAZARD_DETECTION_AND_IDENTIFICATION',
    'Airspace constraints identify operational hazards and restrictions.',
    1
  ),
  (
    'AIRSPACE_COMPLIANCE',
    'RISK_ASSESSMENT_AND_MITIGATION',
    'Permission and restriction status mitigate airspace operating risk.',
    2
  ),
  (
    'MISSION_READINESS_GATE',
    'SAFETY_PERFORMANCE_MONITORING',
    'The readiness gate measures whether mission inputs satisfy approval and dispatch expectations.',
    1
  ),
  (
    'MISSION_READINESS_GATE',
    'SMS_DOCUMENTATION',
    'Gate results are documented as structured safety evidence.',
    2
  ),
  (
    'MISSION_APPROVAL_GUARD',
    'ULTIMATE_SAFETY_RESPONSIBILITY',
    'Approval guardrails support accountable decision-making before mission state changes.',
    1
  ),
  (
    'MISSION_APPROVAL_GUARD',
    'SAFETY_PERFORMANCE_MONITORING',
    'Approval checks verify gate-ready evidence before approval is recorded.',
    2
  ),
  (
    'MISSION_DISPATCH_GUARD',
    'RISK_ASSESSMENT_AND_MITIGATION',
    'Dispatch checks mitigate launch risk by requiring linked approval and dispatch evidence.',
    1
  ),
  (
    'MISSION_DISPATCH_GUARD',
    'SAFETY_PERFORMANCE_MONITORING',
    'Dispatch evidence confirms the mission remains suitable at launch decision time.',
    2
  ),
  (
    'AUDIT_EVIDENCE_SNAPSHOTS',
    'SMS_DOCUMENTATION',
    'Audit snapshots document readiness, decision, and post-operation evidence.',
    1
  ),
  (
    'AUDIT_EVIDENCE_SNAPSHOTS',
    'SMS_CONTINUOUS_IMPROVEMENT',
    'Reviewable evidence supports later trend review and SMS improvement.',
    2
  ),
  (
    'POST_OPERATION_REPORT_SIGNOFF',
    'ULTIMATE_SAFETY_RESPONSIBILITY',
    'Accountable-manager sign-off records formal review responsibility.',
    1
  ),
  (
    'POST_OPERATION_REPORT_SIGNOFF',
    'SMS_DOCUMENTATION',
    'Generated reports and sign-off records preserve post-operation safety decisions.',
    2
  ),
  (
    'POST_OPERATION_REPORT_SIGNOFF',
    'SMS_CONTINUOUS_IMPROVEMENT',
    'Completed reports provide retained evidence for audit review and improvement.',
    3
  )
on conflict (control_code, element_code) do update
set
  rationale = excluded.rationale,
  display_order = excluded.display_order;
