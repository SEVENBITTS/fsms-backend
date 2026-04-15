export function renderHud({
  hud,
  airspaceGeojson,
  speed,
  frame,
  complianceState,
  predictionState,
  riskState,
  helpers
}) {
  const {
    toArray,
    toNumber,
    isFiniteNumber,
    escapeHtml,
    fmtM,
    fmtLimit,
    marginToPct,
    vsArrow,
    getZoneActiveClass,
    getZoneStatusClass,
    getResultClass,
    getRiskBarClass
  } = helpers;

  const breachText =
    complianceState.compliance?.breach ? "BREACH" :
    (predictionState.conflict4D?.conflict || predictionState.boundaryPrediction) ? "PREDICTED CONFLICT" :
    "CLEAR";

  const marginPct =
    complianceState.margin == null || Number.isNaN(complianceState.margin)
      ? 0
      : complianceState.margin < 0 ? 100 : marginToPct(complianceState.margin);

  const actionText = riskState.stableAdvisory?.actionChoice
    ? [
        riskState.stableAdvisory.actionChoice.primary,
        riskState.stableAdvisory.actionChoice.secondary
      ].filter(Boolean).join(" / ")
    : "—";

  const boundaryTtb = predictionState.boundaryPrediction?.ttb_s ?? null;
  const conflictTtb = predictionState.conflict4D?.conflict ? predictionState.conflict4D.ttb_s : null;
  const verticalConflictTtb = predictionState.verticalTtb?.ttb_s ?? null;
  const envelopeConflictCount = predictionState.predictiveEnvelopeConflicts.length;
  const envelopeActive = !!predictionState.predictiveEnvelope;

  const focusZone =
    (predictionState.conflict4D && {
      name: predictionState.conflict4D.zoneName || "Unknown",
      type: predictionState.conflict4D.zoneType || "-",
      ttb: predictionState.conflict4D.ttb_s ?? null,
      boundaryTtb: predictionState.boundaryPrediction?.ttb_s ?? null,
      conflictTtb: predictionState.conflict4D.ttb_s ?? null,
      active: true,
      source: "4D CONFLICT"
    }) ||
    (predictionState.boundaryPrediction && {
      name: predictionState.boundaryPrediction.zoneName || "Unknown",
      type: predictionState.boundaryPrediction.zoneType || "-",
      ttb: predictionState.boundaryPrediction.ttb_s ?? null,
      boundaryTtb: predictionState.boundaryPrediction.ttb_s ?? null,
      conflictTtb: null,
      active: true,
      source: "BOUNDARY PREDICTION"
    }) || {
      name: complianceState.zoneName,
      type: complianceState.zoneType,
      ttb: null,
      boundaryTtb: null,
      conflictTtb: null,
      active: !!complianceState.zone && complianceState.zoneName !== "None",
      source: "COMPLIANCE"
    };

  const focusZoneFeature = toArray(airspaceGeojson?.features).find(
    (f) => f?.properties?.name === focusZone.name
  );

  const focusZoneLowerM = focusZoneFeature?.properties?.lower_m ?? complianceState.lowerM;
  const focusZoneUpperM = focusZoneFeature?.properties?.upper_m ?? complianceState.upperM;
  const focusZoneActiveText = focusZone.active ? "ACTIVE" : "INACTIVE";
  const focusZoneVertBlock = `${fmtLimit(focusZoneLowerM)} → ${fmtLimit(focusZoneUpperM)}`;

  const zoneTtbText = focusZone.ttb !== null ? `${toNumber(focusZone.ttb).toFixed(1)} s` : "—";
  const boundaryTtbText = boundaryTtb !== null ? `${toNumber(boundaryTtb).toFixed(1)} s` : "—";
  const conflictTtbText = conflictTtb !== null ? `${toNumber(conflictTtb).toFixed(1)} s` : "—";
  const verticalConflictTtbText = verticalConflictTtb !== null ? `${toNumber(verticalConflictTtb).toFixed(1)} s` : "—";
  const marginText = complianceState.margin === null ? "—" : `${toNumber(complianceState.margin).toFixed(1)} m`;
  const ttbText = predictionState.ttb !== null ? `${toNumber(predictionState.ttb).toFixed(1)} s` : "—";
  const vsText = isFiniteNumber(frame.vz) ? `${vsArrow(frame.vz)} ${toNumber(frame.vz).toFixed(1)} m/s` : "—";
  const hdgText = Number.isFinite(frame.brg) ? `${frame.brg.toFixed(0)}°` : "—";
  const gsText = isFiniteNumber(frame.groundspeed) ? `${frame.groundspeed.toFixed(1)} m/s` : "—";

  hud.innerHTML = `
    <div class="hud-header">
      <div class="hud-title">MISSION CONTROL</div>
      <div class="hud-chip ${riskState.displayRiskInfo.cls}">${riskState.displayRiskInfo.label}</div>
    </div>

    <div class="hud-grid">
      <div class="hud-k">TIME</div><div class="hud-v">${new Date(frame.rawState.t).toLocaleTimeString()}</div>
      <div class="hud-k">LAT</div><div class="hud-v">${frame.displayPos.lat.toFixed(5)}</div>
      <div class="hud-k">LON</div><div class="hud-v">${frame.displayPos.lng.toFixed(5)}</div>
      <div class="hud-k">ALT AMSL</div><div class="hud-v">${fmtM(complianceState.altAmsl)}</div>
      <div class="hud-k">ALT AGL</div><div class="hud-v">${fmtM(complianceState.altAgl)}</div>
      <div class="hud-k">TERRAIN</div><div class="hud-v">${fmtM(complianceState.terrainAmsl)}</div>
      <div class="hud-k">V/S</div><div class="hud-v">${vsText}</div>
      <div class="hud-k">HDG</div><div class="hud-v">${hdgText}</div>
      <div class="hud-k">GS</div><div class="hud-v">${gsText}</div>
      <div class="hud-k">SPEED</div><div class="hud-v">${speed}×</div>
      <div class="hud-k">PROGRESS</div><div class="hud-v">${frame.progress.toFixed(1)}%</div>
    </div>

    <div class="hud-divider"></div>

    <div class="hud-v hud-section-title">ZONE DETAILS</div>

    <div class="hud-grid">
      <div class="hud-k">ZONE NAME</div><div class="hud-v">${escapeHtml(focusZone.name)}</div>
      <div class="hud-k">ZONE TYPE</div><div class="hud-v">${escapeHtml(focusZone.type)}</div>
      <div class="hud-k">ZONE STATUS</div><div class="hud-v ${getZoneStatusClass(focusZone.source)}">${escapeHtml(focusZone.source)}</div>
      <div class="hud-k">ZONE ACTIVE</div><div class="hud-v ${getZoneActiveClass(focusZoneActiveText)}">${focusZoneActiveText}</div>
      <div class="hud-k">ZONE VERT BLOCK</div><div class="hud-v">${focusZoneVertBlock}</div>
      <div class="hud-k">ZONE SRC</div><div class="hud-v">${escapeHtml(complianceState.zoneSource)}</div>
      <div class="hud-k">ZONE TTB</div><div class="hud-v">${zoneTtbText}</div>
      <div class="hud-k">BND TTB</div><div class="hud-v">${boundaryTtbText}</div>
      <div class="hud-k">4D TTB</div><div class="hud-v">${conflictTtbText}</div>
      <div class="hud-k">VERT TTB</div><div class="hud-v">${verticalConflictTtbText}</div>
      <div class="hud-k">ENVELOPE</div><div class="hud-v">${envelopeActive ? "ON" : "OFF"}</div>
      <div class="hud-k">ENV CONFLICTS</div><div class="hud-v">${envelopeConflictCount}</div>
    </div>

    <div class="hud-divider"></div>

    <div class="hud-v hud-section-title">UAV DETAILS</div>

    <div class="hud-grid">
      <div class="hud-k">UAV VERT LIMITS</div><div class="hud-v">${fmtLimit(complianceState.lowerM)} → ${fmtLimit(complianceState.upperM)}</div>
      <div class="hud-k">LIMIT BASIS</div><div class="hud-v">${complianceState.basis}</div>
      <div class="hud-k">UAV STATUS</div><div class="hud-v">${escapeHtml(complianceState.status)}</div>
      <div class="hud-k">CURRENT ALT</div><div class="hud-v">${fmtM(complianceState.predictionAltNow)}</div>
      <div class="hud-k">VERT REL</div><div class="hud-v">${complianceState.verticalRelation}</div>
      <div class="hud-k">MARGIN</div><div class="hud-v">${marginText}</div>
      <div class="hud-k">MARGIN %</div><div class="hud-v">${marginPct.toFixed(0)}%</div>
      <div class="hud-k">TTB</div><div class="hud-v">${ttbText}</div>
      <div class="hud-k">PRED HOR</div><div class="hud-v">${predictionState.predictSeconds.toFixed(1)} s</div>
      <div class="hud-k">PRED DIST</div><div class="hud-v">${predictionState.predictedDistanceM.toFixed(1)} m</div>
      <div class="hud-k">RESULT</div><div class="hud-v ${getResultClass(breachText)}">${breachText}</div>
    </div>

    <div class="hud-divider"></div>

    <div class="hud-grid">
      <div class="hud-k">RISK</div><div class="hud-v ${riskState.displayRiskInfo.cls}">${riskState.displayRiskInfo.label}</div>
      <div class="hud-k">SCORE</div><div class="hud-v">${riskState.displayRiskScore}%</div>
      <div class="hud-k">TREND</div><div class="hud-v">${riskState.riskTrend.arrow} ${riskState.riskTrend.label}</div>
      <div class="hud-k">ΔRISK</div><div class="hud-v">${riskState.riskDelta > 0 ? "+" : ""}${riskState.riskDelta}</div>
      <div class="hud-k">DRIVERS</div><div class="hud-v">${escapeHtml(riskState.riskSummary)}</div>
    </div>

    <div class="risk-bar-wrap" title="${escapeHtml(riskState.riskSummary)}">
      <div class="risk-bar-fill ${getRiskBarClass(riskState.displayRiskScore)}" style="width:${riskState.displayRiskScore}%"></div>
    </div>

    <div class="hud-divider"></div>

    <div class="hud-grid">
      <div class="hud-k">ADV PRI</div><div class="hud-v">${riskState.advisoryPriorityText}</div>
      <div class="hud-k">ADVISORY</div><div class="hud-v ${riskState.stableAdvisory.cls}">${riskState.stableAdvisory.level}</div>
      <div class="hud-k">INSTRUCTION</div><div class="hud-v ${riskState.stableAdvisory.cls}">${escapeHtml(riskState.stableAdvisory.text)}</div>
      <div class="hud-k">CONFIDENCE</div><div class="hud-v">${riskState.advisoryConfidence}</div>
      <div class="hud-k">MANEUVER</div><div class="hud-v">${escapeHtml(actionText)}</div>
    </div>
  `;
}