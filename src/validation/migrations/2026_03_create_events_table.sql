try {
  // 🔹 START TRANSACTION
  await db.query('BEGIN');

  const complianceResult = await db.query(
    `
    INSERT INTO compliance_events (
      organization_id,
      mission_id,
      flight_id,
      recorded_at,
      event_type,
      severity,
      title,
      details,
      zone_id,
      latitude,
      longitude,
      altitude_m
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    RETURNING id
    `,
    [
      complianceEvent.organization_id,
      complianceEvent.mission_id,
      complianceEvent.flight_id,
      complianceEvent.recorded_at,
      complianceEvent.event_type,
      complianceEvent.severity,
      complianceEvent.title,
      complianceEvent.details || {},
      complianceEvent.zone_id,
      complianceEvent.latitude,
      complianceEvent.longitude,
      complianceEvent.altitude_m
    ]
  );

  const complianceEventId = complianceResult.rows[0].id;

  await db.query(
    `
    INSERT INTO events (
      organization_id,
      event_type,
      event_source,
      severity,
      event_time,
      mission_id,
      flight_id,
      airspace_zone_id,
      location_lat,
      location_lng,
      location_alt,
      title,
      description,
      source_table,
      source_record_id,
      metadata_json
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    `,
    [
      complianceEvent.organization_id,
      complianceEvent.event_type,
      'compliance',
      complianceEvent.severity || 'medium',
      complianceEvent.recorded_at || new Date(),
      complianceEvent.mission_id,
      complianceEvent.flight_id,
      complianceEvent.zone_id,
      complianceEvent.latitude,
      complianceEvent.longitude,
      complianceEvent.altitude_m,
      complianceEvent.title || 'Compliance event',
      JSON.stringify(complianceEvent.details || {}),
      'compliance_events',
      complianceEventId,
      complianceEvent.details || {}
    ]
  );

  // 🔹 SUCCESS → SAVE BOTH
  await db.query('COMMIT');

} catch (error) {
  // 🔹 FAILURE → UNDO BOTH
  await db.query('ROLLBACK');
  throw error;
}