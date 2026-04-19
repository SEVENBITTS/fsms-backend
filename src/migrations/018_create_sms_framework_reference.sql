create table if not exists sms_framework_sources (
  code text primary key,
  title text not null,
  source_type text not null,
  version_label text null,
  source_url text null,
  notes text null,
  display_order int not null unique
);

create table if not exists sms_pillars (
  code text primary key,
  title text not null,
  display_order int not null unique,
  source_code text not null references sms_framework_sources(code)
);

create table if not exists sms_elements (
  code text primary key,
  pillar_code text not null references sms_pillars(code),
  element_number text not null,
  title text not null,
  display_order int not null unique,
  source_code text not null references sms_framework_sources(code),
  constraint sms_elements_pillar_number_uniq
    unique (pillar_code, element_number)
);

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
    'UAV_SMS_WORKBOOK',
    'UAV SMS 4 Pillars and 12 Elements workbook',
    'internal_reference',
    null,
    null,
    'Internal SMS framework reference supplied by the project owner.',
    1
  ),
  (
    'CAA_CAP_722A_2022',
    'CAA CAP 722A: Unmanned Aircraft System Operations in UK Airspace - Operating Safety Cases',
    'external_guidance_reference',
    'Version 2, 07-Dec-2022',
    'https://www.caa.co.uk/data-and-publications/publications/documents/content/cap-722a/',
    'Recorded as source guidance and version context only; not executable compliance logic.',
    2
  )
on conflict (code) do update
set
  title = excluded.title,
  source_type = excluded.source_type,
  version_label = excluded.version_label,
  source_url = excluded.source_url,
  notes = excluded.notes,
  display_order = excluded.display_order;

insert into sms_pillars (code, title, display_order, source_code)
values
  ('SAFETY_POLICY_AND_GOALS', 'Safety Policy and Goals', 1, 'UAV_SMS_WORKBOOK'),
  ('SAFETY_RISK_MANAGEMENT', 'Safety Risk Management', 2, 'UAV_SMS_WORKBOOK'),
  ('SAFETY_ASSURANCE', 'Safety Assurance', 3, 'UAV_SMS_WORKBOOK'),
  ('PROMOTION_OF_SAFETY', 'Promotion of Safety', 4, 'UAV_SMS_WORKBOOK')
on conflict (code) do update
set
  title = excluded.title,
  display_order = excluded.display_order,
  source_code = excluded.source_code;

insert into sms_elements (
  code,
  pillar_code,
  element_number,
  title,
  display_order,
  source_code
)
values
  (
    'MANAGEMENT_COMMITMENT_AND_RESPONSIBILITY',
    'SAFETY_POLICY_AND_GOALS',
    '1.1',
    'Commitment and Responsibility of the Management',
    1,
    'UAV_SMS_WORKBOOK'
  ),
  (
    'ULTIMATE_SAFETY_RESPONSIBILITY',
    'SAFETY_POLICY_AND_GOALS',
    '1.2',
    'The ultimate responsibility for the safety',
    2,
    'UAV_SMS_WORKBOOK'
  ),
  (
    'KEY_SAFETY_STAFF_IDENTIFICATION',
    'SAFETY_POLICY_AND_GOALS',
    '1.3',
    'Identification of the key safety staff',
    3,
    'UAV_SMS_WORKBOOK'
  ),
  (
    'EMERGENCY_RESPONSE_PLANNING',
    'SAFETY_POLICY_AND_GOALS',
    '1.4',
    'Coordinating the planning of procedures in the case of emergency; Emergency Response Plan (ERP)',
    4,
    'UAV_SMS_WORKBOOK'
  ),
  (
    'SMS_DOCUMENTATION',
    'SAFETY_POLICY_AND_GOALS',
    '1.5',
    'SMS documentation',
    5,
    'UAV_SMS_WORKBOOK'
  ),
  (
    'RISK_HAZARD_DETECTION_AND_IDENTIFICATION',
    'SAFETY_RISK_MANAGEMENT',
    '2.1',
    'Risk/hazard detection and identification',
    6,
    'UAV_SMS_WORKBOOK'
  ),
  (
    'RISK_ASSESSMENT_AND_MITIGATION',
    'SAFETY_RISK_MANAGEMENT',
    '2.2',
    'Assessment and mitigation of risks',
    7,
    'UAV_SMS_WORKBOOK'
  ),
  (
    'SAFETY_PERFORMANCE_MONITORING',
    'SAFETY_ASSURANCE',
    '3.1',
    'Monitoring and Measurement of Safety Performance',
    8,
    'UAV_SMS_WORKBOOK'
  ),
  (
    'CHANGE_MANAGEMENT',
    'SAFETY_ASSURANCE',
    '3.2',
    'Managing Changes',
    9,
    'UAV_SMS_WORKBOOK'
  ),
  (
    'SMS_CONTINUOUS_IMPROVEMENT',
    'SAFETY_ASSURANCE',
    '3.3',
    'Continuous improvement of SMS',
    10,
    'UAV_SMS_WORKBOOK'
  ),
  (
    'SAFETY_TRAINING_AND_EDUCATION',
    'PROMOTION_OF_SAFETY',
    '4.1',
    'Training and education',
    11,
    'UAV_SMS_WORKBOOK'
  ),
  (
    'SAFETY_COMMUNICATION',
    'PROMOTION_OF_SAFETY',
    '4.2',
    'Safety communication',
    12,
    'UAV_SMS_WORKBOOK'
  )
on conflict (code) do update
set
  pillar_code = excluded.pillar_code,
  element_number = excluded.element_number,
  title = excluded.title,
  display_order = excluded.display_order,
  source_code = excluded.source_code;
