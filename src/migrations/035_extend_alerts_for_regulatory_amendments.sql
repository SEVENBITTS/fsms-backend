alter table alerts
  drop constraint if exists alerts_alert_type_chk;

alter table alerts
  add constraint alerts_alert_type_chk
    check (alert_type in (
      'ALTITUDE_HIGH',
      'SPEED_HIGH',
      'RESTRICTED_ZONE',
      'MISSION_INACTIVE_TELEMETRY',
      'REGULATORY_AMENDMENT'
    ));
