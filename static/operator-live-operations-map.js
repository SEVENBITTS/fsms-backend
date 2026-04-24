const missionIdInput = document.getElementById("live-ops-mission-id-input");
const loadButton = document.getElementById("load-live-ops-btn");
const openWorkspaceButton = document.getElementById("open-workspace-btn");
const openReplayApiButton = document.getElementById("open-replay-api-btn");
const connectionStatus = document.getElementById("live-ops-connection-status");
const loadedMissionPill = document.getElementById("live-ops-loaded-mission-pill");
const overviewPanel = document.getElementById("live-ops-overview");
const mapPanel = document.getElementById("live-ops-map");
const statusPanel = document.getElementById("live-ops-status");
const timelinePanel = document.getElementById("live-ops-timeline");
const alertCorrelationPanel = document.getElementById("live-ops-alert-correlation");
const conflictAssessmentPanel = document.getElementById("live-ops-conflict-assessment");
const conflictAdvisoryPanel = document.getElementById("live-ops-conflict-advisory");
const jumpControlsPanel = document.getElementById("live-ops-jump-controls");
const replayPlayButton = document.getElementById("live-ops-replay-play-btn");
const replayPauseButton = document.getElementById("live-ops-replay-pause-btn");
const replayStepBackButton = document.getElementById("live-ops-replay-step-back-btn");
const replayStepForwardButton = document.getElementById("live-ops-replay-step-forward-btn");
const replaySlider = document.getElementById("live-ops-replay-slider");
const replayTimeReadout = document.getElementById("live-ops-replay-time");
const replayProgress = document.getElementById("live-ops-replay-progress");
const replayMarkers = document.getElementById("live-ops-replay-markers");
const replaySpeedSelect = document.getElementById("live-ops-replay-speed");
const missionSearchInput = document.getElementById("live-ops-mission-search-input");
const missionSearchButton = document.getElementById("live-ops-mission-search-btn");
const missionBrowserList = document.getElementById("live-ops-mission-browser-list");
const missionBrowserDetail = document.getElementById("live-ops-mission-browser-detail");
const missionRoutePattern = /^\/operator\/missions\/([^/]+)\/live-operations$/;

const uiState = {
  missionId: "",
  planningWorkspace: null,
  dispatchWorkspace: null,
  timeline: null,
  replay: null,
  latestTelemetry: null,
  alerts: [],
  externalOverlays: [],
  conflictAssessment: null,
  conflictGuidanceAcknowledgements: [],
  missionList: [],
  missionQuery: "",
  replayPlayback: {
    index: 0,
    playing: false,
    timerId: null,
    speed: 1,
  },
};

const toneClass = (value) => {
  const text = String(value ?? "").toLowerCase();

  if (
    text.includes("approved") ||
    text.includes("present") ||
    text.includes("ready") ||
    text.includes("clear") ||
    text.includes("pass") ||
    text.includes("allowed") ||
    text.includes("active")
  ) {
    return "tone-ok";
  }

  if (
    text.includes("review") ||
    text.includes("pending") ||
    text.includes("stale") ||
    text.includes("partial") ||
    text.includes("missing") ||
    text.includes("draft") ||
    text.includes("submitted")
  ) {
    return "tone-warn";
  }

  if (
    text.includes("blocked") ||
    text.includes("rejected") ||
    text.includes("failed") ||
    text.includes("fail") ||
    text.includes("abort")
  ) {
    return "tone-bad";
  }

  return "tone-info";
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderBadge = (value) =>
  `<span class="badge ${toneClass(value)}">${escapeHtml(value ?? "Unknown")}</span>`;

const missionDisplayName = (mission) =>
  mission?.missionPlanId || mission?.id || "Unknown mission";

const weatherOverlays = () =>
  (uiState.externalOverlays ?? []).filter((overlay) => overlay.kind === "weather");

const crewedTrafficOverlays = () =>
  (uiState.externalOverlays ?? []).filter(
    (overlay) => overlay.kind === "crewed_traffic",
  );

const droneTrafficOverlays = () =>
  (uiState.externalOverlays ?? []).filter(
    (overlay) => overlay.kind === "drone_traffic",
  );

const areaConflictOverlays = () =>
  (uiState.externalOverlays ?? []).filter(
    (overlay) => overlay.kind === "area_conflict",
  );

const areaOverlaySourceRefreshState = (overlay) =>
  overlay?.metadata?.sourceRefresh ?? null;

const areaOverlayNotamGeometryContext = (overlay) =>
  overlay?.metadata?.notamGeometryContext ?? null;

const areaOverlayQLineIndexSummary = (overlay) =>
  overlay?.metadata?.qLineIndexSummary ?? null;

const formatCoordinate = (value) =>
  value == null || Number.isNaN(value) ? "Not recorded" : Number(value).toFixed(5);

const areaOverlayNotamGeometryDetail = (overlay) => {
  const geometryContext = areaOverlayNotamGeometryContext(overlay);
  if (!geometryContext) {
    return null;
  }

  const detailParts = [
    geometryContext.geometrySource === "e_field"
      ? "NOTAM geometry: E-field"
      : geometryContext.geometrySource === "q_line"
        ? "NOTAM geometry: Q-line fallback"
        : "NOTAM geometry: provided geometry",
  ];

  if (geometryContext.qLineIndex) {
    detailParts.push(
      `Q-line center ${formatCoordinate(geometryContext.qLineIndex.centerLat)}, ${formatCoordinate(geometryContext.qLineIndex.centerLng)}`,
    );
    detailParts.push(`Q-line radius ${geometryContext.qLineIndex.radiusNm} NM`);
  }

  return detailParts.join(" | ");
};

const areaOverlayNotamGeometrySummaryContext = (overlay) => {
  const geometryContext = areaOverlayNotamGeometryContext(overlay);
  if (!geometryContext) {
    return null;
  }

  return geometryContext.geometrySource === "e_field"
    ? "NOTAM geometry E-field"
    : geometryContext.geometrySource === "q_line"
      ? "NOTAM geometry Q-line fallback"
      : "NOTAM geometry provided";
};

const areaOverlayQLineIndexReviewContext = (overlay) => {
  const summary = areaOverlayQLineIndexSummary(overlay);
  if (summary?.available) {
    return [
      "Q-line index metadata",
      `center ${summary.centerLabel ?? "Not recorded"}`,
      `radius ${summary.radiusLabel ?? "Not recorded"}`,
      summary.operatorNote,
    ].join(" | ");
  }

  const geometryContext = areaOverlayNotamGeometryContext(overlay);
  const qLineIndex = geometryContext?.qLineIndex;
  if (!qLineIndex) {
    return summary?.operatorNote ?? null;
  }

  return [
    "Q-line index metadata",
    `center ${formatCoordinate(qLineIndex.centerLat)}, ${formatCoordinate(qLineIndex.centerLng)}`,
    `radius ${qLineIndex.radiusNm} NM`,
    "coarse index only",
  ].join(" | ");
};

const areaOverlaySourceRefreshDetail = (overlay) => {
  const refreshState = areaOverlaySourceRefreshState(overlay);
  if (!refreshState) {
    return "Not recorded";
  }

  const detailParts = [`${refreshState.status}`];

  if (refreshState.lastSuccessfulRefreshRunId) {
    detailParts.push(
      `last successful ${formatDateTime(refreshState.lastSuccessfulRefreshRunId)}`,
    );
  } else {
    detailParts.push("no successful refresh recorded");
  }

  if (refreshState.lastFailedRefreshRunId) {
    detailParts.push(
      `last failed ${formatDateTime(refreshState.lastFailedRefreshRunId)}`,
    );
  }

  if (refreshState.lastPartialRefreshRunId) {
    detailParts.push(
      `last partial ${formatDateTime(refreshState.lastPartialRefreshRunId)}`,
    );
  }

  if (refreshState.carriedForwardFromPartialRefresh) {
    detailParts.push("carried forward after partial refresh");
  }

  if (refreshState.carriedForwardFromFailedRefresh) {
    detailParts.push("carried forward after failed refresh");
  }

  return detailParts.join(" | ");
};

const areaOverlaySourceRefreshCardContext = (overlay) => {
  const refreshState = areaOverlaySourceRefreshState(overlay);
  if (!refreshState) {
    return areaOverlayNotamGeometrySummaryContext(overlay);
  }

  const label =
    refreshState.status === "failed"
      ? "Area source failed"
      : refreshState.status === "partial"
        ? "Area source partial"
        : refreshState.status === "stale"
          ? "Area source stale"
          : refreshState.status === "fresh"
            ? "Area source fresh"
            : null;

  if (!label) {
    return null;
  }

  if (refreshState.carriedForwardFromFailedRefresh) {
    return `${label} | carried forward after failed refresh`;
  }

  if (refreshState.carriedForwardFromPartialRefresh) {
    return `${label} | carried forward after partial refresh`;
  }

  const notamGeometryContext = areaOverlayNotamGeometrySummaryContext(overlay);
  const qLineIndexContext = areaOverlayQLineIndexReviewContext(overlay);
  return [label, notamGeometryContext, qLineIndexContext].filter(Boolean).join(" | ");
};

const areaSourceRefreshSummary = () => {
  const overlays = areaConflictOverlays();
  if (overlays.length === 0) {
    return {
      label: "Area source refresh missing",
      detail: "No normalized area overlays are currently available.",
    };
  }

  const statuses = overlays
    .map((overlay) => areaOverlaySourceRefreshState(overlay)?.status)
    .filter(Boolean);
  const highestPriorityStatus =
    statuses.find((status) => status === "failed") ??
    statuses.find((status) => status === "partial") ??
    statuses.find((status) => status === "stale") ??
    statuses.find((status) => status === "fresh") ??
    "missing";
  const degradedCount = overlays.filter((overlay) => {
    const status = areaOverlaySourceRefreshState(overlay)?.status;
    return status && status !== "fresh";
  }).length;
  const latestSuccessfulRefresh = overlays
    .map((overlay) => areaOverlaySourceRefreshState(overlay)?.lastSuccessfulRefreshRunId)
    .filter(Boolean)
    .sort()
    .at(-1);
  const latestFailedRefresh = overlays
    .map((overlay) => areaOverlaySourceRefreshState(overlay)?.lastFailedRefreshRunId)
    .filter(Boolean)
    .sort()
    .at(-1);
  const latestPartialRefresh = overlays
    .map((overlay) => areaOverlaySourceRefreshState(overlay)?.lastPartialRefreshRunId)
    .filter(Boolean)
    .sort()
    .at(-1);
  const carriedForwardPartialCount = overlays.filter(
    (overlay) =>
      areaOverlaySourceRefreshState(overlay)?.carriedForwardFromPartialRefresh === true,
  ).length;
  const carriedForwardFailedCount = overlays.filter(
    (overlay) =>
      areaOverlaySourceRefreshState(overlay)?.carriedForwardFromFailedRefresh === true,
  ).length;

  return {
    label:
      highestPriorityStatus === "fresh"
        ? "Fresh"
        : highestPriorityStatus === "failed"
          ? `Failed refresh (${degradedCount})`
        : highestPriorityStatus === "missing"
          ? "Missing"
          : `${highestPriorityStatus} (${degradedCount})`,
    detail:
      highestPriorityStatus === "failed"
        ? [
            latestFailedRefresh != null
              ? `Last failed refresh ${formatDateTime(latestFailedRefresh)}`
              : "Failed refresh recorded",
            latestSuccessfulRefresh != null
              ? `last successful ${formatDateTime(latestSuccessfulRefresh)}`
              : "no successful refresh recorded",
            carriedForwardFailedCount > 0
              ? `${carriedForwardFailedCount} carried-forward overlay${carriedForwardFailedCount === 1 ? "" : "s"}`
              : null,
          ]
            .filter(Boolean)
            .join(" | ")
        : highestPriorityStatus === "partial"
          ? [
              latestPartialRefresh != null
                ? `Last partial refresh ${formatDateTime(latestPartialRefresh)}`
                : "Partial refresh recorded",
              latestSuccessfulRefresh != null
                ? `last successful ${formatDateTime(latestSuccessfulRefresh)}`
                : "no successful refresh recorded",
              carriedForwardPartialCount > 0
                ? `${carriedForwardPartialCount} carried-forward overlay${carriedForwardPartialCount === 1 ? "" : "s"}`
                : null,
            ]
              .filter(Boolean)
              .join(" | ")
        : latestSuccessfulRefresh != null
          ? `Last successful refresh ${formatDateTime(latestSuccessfulRefresh)}`
          : "No successful refresh recorded",
  };
};

const formatDateTime = (value) => {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const cardinalFromBearing = (value) => {
  if (value == null || Number.isNaN(value)) {
    return "";
  }

  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(value / 45) % directions.length];
};

const formatBearingDegrees = (value) => {
  if (value == null || Number.isNaN(value)) {
    return "Not recorded";
  }

  return `${Math.round(value)}\u00B0 ${cardinalFromBearing(value)}`;
};

const formatVerticalSeparation = (value) =>
  value == null || Number.isNaN(value) ? "Not recorded" : `${Math.round(value)} ft`;

const formatVerticalContext = (conflict) => {
  const relation = conflict?.verticalContext?.relation ?? "not_applicable";
  const floor = conflict?.verticalContext?.altitudeFloorFt;
  const ceiling = conflict?.verticalContext?.altitudeCeilingFt;
  const reference = conflict?.verticalContext?.referenceAltitudeFt;
  const bandText =
    floor == null && ceiling == null
      ? "No altitude band"
      : `${floor ?? "surface"}-${ceiling ?? "open"} ft`;

  if (relation === "inside_band") {
    return `Inside altitude band | ${bandText} | ref ${reference == null ? "unknown" : `${Math.round(reference)} ft`}`;
  }
  if (relation === "below_band") {
    return `Below altitude band | ${bandText} | ref ${reference == null ? "unknown" : `${Math.round(reference)} ft`}`;
  }
  if (relation === "above_band") {
    return `Above altitude band | ${bandText} | ref ${reference == null ? "unknown" : `${Math.round(reference)} ft`}`;
  }
  if (relation === "unknown") {
    return `Altitude band ${bandText} | reference altitude unknown`;
  }

  return "Not applicable";
};

const formatTemporalContext = (conflict) => {
  const relation = conflict?.temporalContext?.relation ?? "not_applicable";
  const validFrom = conflict?.temporalContext?.validFrom;
  const validTo = conflict?.temporalContext?.validTo;
  const referenceTimestamp = conflict?.temporalContext?.referenceTimestamp;
  const windowText =
    validFrom == null && validTo == null
      ? "No active window"
      : `${formatDateTime(validFrom)} - ${formatDateTime(validTo)}`;

  if (relation === "inside_window") {
    return `Inside active window | ${windowText} | ref ${formatDateTime(referenceTimestamp)}`;
  }
  if (relation === "before_window") {
    return `Before active window | ${windowText} | ref ${formatDateTime(referenceTimestamp)}`;
  }
  if (relation === "after_window") {
    return `After active window | ${windowText} | ref ${formatDateTime(referenceTimestamp)}`;
  }
  if (relation === "unknown") {
    return `Active window ${windowText} | reference time unknown`;
  }

  return "Not applicable";
};

const formatRangeBearing = (metrics) => {
  const rangeMeters = metrics?.rangeMeters ?? metrics?.lateralDistanceMeters;
  if (rangeMeters == null && metrics?.bearingDegrees == null) {
    return "Not recorded";
  }

  const rangeText =
    rangeMeters == null || Number.isNaN(rangeMeters)
      ? "Unknown range"
      : `${Math.round(rangeMeters)} m`;
  const bearingText = formatBearingDegrees(metrics?.bearingDegrees ?? null);
  if (metrics?.insideArea === true) {
    return `Inside area | ${rangeText} to boundary @ ${bearingText}`;
  }
  return `${rangeText} @ ${bearingText}`;
};

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(
      payload?.error?.message || `Request failed with ${response.status}`,
    );
    error.type = payload?.error?.type;
    error.status = response.status;
    throw error;
  }

  return payload;
};

const setConnectionState = (message, tone = "tone-muted") => {
  connectionStatus.className = `status-pill ${tone}`;
  connectionStatus.textContent = message;
};

const setLoadedMission = (missionId) => {
  loadedMissionPill.textContent = missionId || "None";
};

const normalizeMissionId = (value) => String(value ?? "").trim();

const isPlaceholderMissionId = (missionId) => {
  const value = normalizeMissionId(missionId);
  return (
    !value ||
    /^<[^>]+>$/.test(value) ||
    /^(mission[-_\s]?id|enter mission uuid|uuid)$/i.test(value)
  );
};

const hasSelectedMissionId = (missionId) => !isPlaceholderMissionId(missionId);

const isMissionSpecificRoute = () => missionRoutePattern.test(window.location.pathname);

const resetLiveOperationsState = () => {
  uiState.missionId = "";
  uiState.planningWorkspace = null;
  uiState.dispatchWorkspace = null;
  uiState.timeline = null;
  uiState.replay = null;
  uiState.latestTelemetry = null;
  uiState.alerts = [];
  uiState.externalOverlays = [];
  uiState.conflictAssessment = null;
  uiState.conflictGuidanceAcknowledgements = [];
  uiState.replayPlayback.index = 0;
};

const renderMissionBrowser = () => {
  const missions = uiState.missionList ?? [];

  if (!missionBrowserList || !missionBrowserDetail) {
    return;
  }

  if (missions.length === 0) {
    missionBrowserList.innerHTML =
      '<div class="empty-state">No missions match the current filter.</div>';
    missionBrowserDetail.innerHTML = `
      <div class="empty-state">
        Search recent missions or clear the filter to choose a mission for the live operations view.
      </div>
    `;
    return;
  }

  missionBrowserList.innerHTML = `
    <div class="stack">
      ${missions
        .map((mission) => {
          const loaded = mission.id === uiState.missionId;
          const lastEvent = mission.latestEventSummary ?? "No lifecycle events yet";
          const platform =
            mission.platform?.name ?? mission.platform?.id ?? "Platform not assigned";
          const pilot =
            mission.pilot?.displayName ?? mission.pilot?.id ?? "Pilot not assigned";

          return `
            <article class="mission-row" data-mission-id="${escapeHtml(mission.id)}">
              <div class="mission-row-title">
                <div>
                  <strong>${escapeHtml(missionDisplayName(mission))}</strong>
                  <div class="mission-row-meta">Mission ID: ${escapeHtml(mission.id)}</div>
                </div>
                <div>${renderBadge(mission.status ?? "Unknown")}</div>
              </div>
              <div class="mission-row-meta">
                Platform: ${escapeHtml(platform)}<br />
                Pilot: ${escapeHtml(pilot)}<br />
                Last event: ${escapeHtml(lastEvent)}<br />
                Updated: ${escapeHtml(formatDateTime(mission.latestEventAt ?? mission.updatedAt))}
              </div>
              <div style="margin-top: 10px;">
                <button class="action-button" type="button" data-open-mission="${escapeHtml(
                  mission.id,
                )}">
                  ${loaded ? "Loaded" : "Load live ops"}
                </button>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;

  missionBrowserList.querySelectorAll("[data-open-mission]").forEach((button) => {
    button.addEventListener("click", () => {
      const missionId = button.getAttribute("data-open-mission");
      if (!missionId) {
        return;
      }

      missionIdInput.value = missionId;
      loadLiveOperationsView(missionId);
    });
  });

  const selectedMission =
    missions.find((mission) => mission.id === uiState.missionId) ?? missions[0];
  const selectedPlatform =
    selectedMission.platform?.name ??
    selectedMission.platform?.id ??
    "Platform not assigned";
  const selectedPilot =
    selectedMission.pilot?.displayName ??
    selectedMission.pilot?.id ??
    "Pilot not assigned";

  missionBrowserDetail.innerHTML = `
    <section class="summary-block">
      <h4>Selected Mission</h4>
      <div class="kv">
        <div class="k">Mission</div>
        <div>${escapeHtml(missionDisplayName(selectedMission))}</div>
        <div class="k">Mission ID</div>
        <div>${escapeHtml(selectedMission.id)}</div>
        <div class="k">Status</div>
        <div>${renderBadge(selectedMission.status ?? "Unknown")}</div>
        <div class="k">Platform</div>
        <div>${escapeHtml(selectedPlatform)}</div>
        <div class="k">Pilot</div>
        <div>${escapeHtml(selectedPilot)}</div>
        <div class="k">Latest event</div>
        <div>${escapeHtml(selectedMission.latestEventSummary ?? "No lifecycle events yet")}</div>
      </div>
      <div style="margin-top: 12px;">
        <button class="action-button" type="button" data-load-selected-mission="${escapeHtml(
          selectedMission.id,
        )}">
          ${selectedMission.id === uiState.missionId ? "Reload live ops" : "Load selected mission"}
        </button>
      </div>
    </section>
  `;

  missionBrowserDetail
    .querySelector("[data-load-selected-mission]")
    ?.addEventListener("click", () => {
      missionIdInput.value = selectedMission.id;
      loadLiveOperationsView(selectedMission.id);
    });
};

const loadMissionList = async (query = "") => {
  uiState.missionQuery = query;

  if (!missionBrowserList || !missionBrowserDetail) {
    return;
  }

  missionBrowserList.innerHTML =
    '<div class="empty-state">Loading mission list...</div>';

  const params = new URLSearchParams();
  if (query) {
    params.set("q", query);
  }
  params.set("limit", "12");

  try {
    const response = await fetchJson(`/missions?${params.toString()}`);
    uiState.missionList = response.missions ?? [];
    renderMissionBrowser();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load mission list";
    uiState.missionList = [];
    missionBrowserList.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
    missionBrowserDetail.innerHTML =
      '<div class="empty-state">Mission selection is unavailable because the mission list did not load.</div>';
  }
};

const replayPlaybackIntervalMs = () =>
  Math.max(150, Math.round(900 / (uiState.replayPlayback.speed || 1)));

const renderReplayControls = () => {
  const points = replayTrack();
  const pointCount = points.length;
  const activePoint = activeReplayPoint();
  const sliderMax = Math.max(pointCount - 1, 0);
  const replayStart = points[0]?.timestamp ? Date.parse(points[0].timestamp) : null;
  const replayEnd = points[pointCount - 1]?.timestamp
    ? Date.parse(points[pointCount - 1].timestamp)
    : replayStart;
  const replaySpan =
    replayStart != null && replayEnd != null ? Math.max(replayEnd - replayStart, 1) : 1;

  replaySlider.max = String(sliderMax);
  replaySlider.disabled = pointCount <= 1;
  replayPlayButton.disabled = pointCount <= 1 || uiState.replayPlayback.playing;
  replayPauseButton.disabled = !uiState.replayPlayback.playing;
  replayStepBackButton.disabled = pointCount <= 1 || uiState.replayPlayback.index <= 0;
  replayStepForwardButton.disabled =
    pointCount <= 1 || uiState.replayPlayback.index >= pointCount - 1;
  replaySpeedSelect.value = String(uiState.replayPlayback.speed);
  replayTimeReadout.textContent = activePoint?.timestamp
    ? `Replay time: ${formatDateTime(activePoint.timestamp)}`
    : "Replay time: not loaded";
  replayProgress.textContent =
    pointCount === 0
      ? "0 / 0"
      : `${uiState.replayPlayback.index + 1} / ${pointCount} | ${uiState.replayPlayback.speed}x`;
  replayMarkers.innerHTML =
    pointCount === 0 || replayStart == null || replayEnd == null
      ? ""
      : [
          ...(uiState.alerts ?? []).map((alert) => {
            const markerTime = Date.parse(alert.triggeredAt);
            if (!Number.isFinite(markerTime)) {
              return "";
            }

            const left = ((markerTime - replayStart) / replaySpan) * 100;
            return `<span class="replay-marker ${escapeHtml(
              alert.severity,
            )}" style="left:${Math.max(0, Math.min(left, 100))}%"></span>`;
          }),
          ...conflictReplayMarkers(replayStart, replaySpan),
        ].join("");
};

const activeWeatherOverlay = () => {
  const replayPoint = activeReplayPoint();
  const replayTime = replayPoint?.timestamp ? Date.parse(replayPoint.timestamp) : null;
  const overlays = weatherOverlays();

  if (overlays.length === 0) {
    return null;
  }

  const relevant = overlays
    .map((overlay) => {
      const observedAt = Date.parse(overlay.observedAt ?? "");
      const validFrom = overlay.validFrom ? Date.parse(overlay.validFrom) : observedAt;
      const validTo = overlay.validTo ? Date.parse(overlay.validTo) : null;
      const activeAtReplay =
        replayTime != null &&
        Number.isFinite(validFrom) &&
        replayTime >= validFrom &&
        (validTo == null || replayTime <= validTo);
      const relativeMs =
        replayTime == null || !Number.isFinite(observedAt)
          ? Number.POSITIVE_INFINITY
          : Math.abs(replayTime - observedAt);

      return {
        ...overlay,
        activeAtReplay,
        relativeMs,
      };
    })
    .sort((left, right) => {
      if (left.activeAtReplay !== right.activeAtReplay) {
        return left.activeAtReplay ? -1 : 1;
      }

      return left.relativeMs - right.relativeMs;
    });

  return relevant[0] ?? null;
};

const weatherSummary = () => {
  const overlay = activeWeatherOverlay();
  if (!overlay) {
    return {
      label: "Weather overlay missing",
      tone: "warning",
      detail: "No mission-linked weather overlay is available for the current replay position.",
    };
  }

  const metadata = overlay.metadata ?? {};
  return {
    label: `Weather ${metadata.precipitation ?? "unknown"}`,
    tone: overlay.severity ?? "info",
    detail: `${metadata.windSpeedKnots ?? "?"} kt @ ${metadata.windDirectionDegrees ?? "?"}\u00B0 | ${metadata.temperatureC ?? "?"}\u00B0C | observed ${formatDateTime(overlay.observedAt)}`,
  };
};

const activeCrewedTrafficOverlays = () => {
  const replayPoint = activeReplayPoint();
  const replayTime = replayPoint?.timestamp ? Date.parse(replayPoint.timestamp) : null;

  return crewedTrafficOverlays()
    .map((overlay) => {
      const observedAt = Date.parse(overlay.observedAt ?? "");
      const validFrom = overlay.validFrom ? Date.parse(overlay.validFrom) : observedAt;
      const validTo = overlay.validTo ? Date.parse(overlay.validTo) : null;
      const activeAtReplay =
        replayTime != null &&
        Number.isFinite(validFrom) &&
        replayTime >= validFrom &&
        (validTo == null || replayTime <= validTo);
      const relativeMs =
        replayTime == null || !Number.isFinite(observedAt)
          ? Number.POSITIVE_INFINITY
          : Math.abs(replayTime - observedAt);

      return {
        ...overlay,
        activeAtReplay,
        relativeMs,
      };
    })
    .sort((left, right) => {
      if (left.activeAtReplay !== right.activeAtReplay) {
        return left.activeAtReplay ? -1 : 1;
      }

      return left.relativeMs - right.relativeMs;
    })
    .slice(0, 5);
};

const crewedTrafficSummary = () => {
  const traffic = activeCrewedTrafficOverlays();
  if (traffic.length === 0) {
    return {
      label: "Crewed traffic missing",
      tone: "warning",
      detail: "No mission-linked crewed traffic overlays are available for the current replay position.",
    };
  }

  const primary = traffic[0];
  const metadata = primary.metadata ?? {};
  return {
    label: `${traffic.length} crewed traffic contact${traffic.length === 1 ? "" : "s"}`,
    tone: primary.severity ?? "info",
    detail: `${metadata.callsign ?? metadata.trafficId ?? "Unknown"} | ${primary.speedKnots ?? "?"} kt | ${primary.geometry?.altitudeMslFt ?? "?"} ft | observed ${formatDateTime(primary.observedAt)}`,
  };
};

const activeDroneTrafficOverlays = () => {
  const replayPoint = activeReplayPoint();
  const replayTime = replayPoint?.timestamp ? Date.parse(replayPoint.timestamp) : null;

  return droneTrafficOverlays()
    .map((overlay) => {
      const observedAt = Date.parse(overlay.observedAt ?? "");
      const validFrom = overlay.validFrom ? Date.parse(overlay.validFrom) : observedAt;
      const validTo = overlay.validTo ? Date.parse(overlay.validTo) : null;
      const activeAtReplay =
        replayTime != null &&
        Number.isFinite(validFrom) &&
        replayTime >= validFrom &&
        (validTo == null || replayTime <= validTo);
      const relativeMs =
        replayTime == null || !Number.isFinite(observedAt)
          ? Number.POSITIVE_INFINITY
          : Math.abs(replayTime - observedAt);

      return {
        ...overlay,
        activeAtReplay,
        relativeMs,
      };
    })
    .sort((left, right) => {
      if (left.activeAtReplay !== right.activeAtReplay) {
        return left.activeAtReplay ? -1 : 1;
      }

      return left.relativeMs - right.relativeMs;
    })
    .slice(0, 6);
};

const droneTrafficSummary = () => {
  const traffic = activeDroneTrafficOverlays();
  if (traffic.length === 0) {
    return {
      label: "Drone traffic missing",
      tone: "warning",
      detail: "No mission-linked drone traffic overlays are available for the current replay position.",
    };
  }

  const primary = traffic[0];
  const metadata = primary.metadata ?? {};
  return {
    label: `${traffic.length} drone traffic contact${traffic.length === 1 ? "" : "s"}`,
    tone: primary.severity ?? "info",
    detail: `${metadata.operatorReference ?? metadata.trafficId ?? "Unknown"} | ${primary.speedKnots ?? "?"} kt | ${primary.geometry?.altitudeMslFt ?? "?"} ft | observed ${formatDateTime(primary.observedAt)}`,
  };
};

const currentConflictAssessment = () => uiState.conflictAssessment?.assessment ?? null;

const conflictAssessmentItems = () =>
  currentConflictAssessment()?.conflicts ?? [];

const activeConflictAssessmentItems = () => {
  const replayPoint = activeReplayPoint();
  const replayTime = replayPoint?.timestamp ? Date.parse(replayPoint.timestamp) : null;

  return conflictAssessmentItems()
    .map((conflict) => {
      const conflictTime = Date.parse(conflict.referenceTimestamp ?? "");
      const timeDeltaSeconds =
        replayTime != null && Number.isFinite(conflictTime)
          ? Math.abs(replayTime - conflictTime) / 1000
          : conflict.metrics?.timeDeltaSeconds ?? Number.POSITIVE_INFINITY;

      return {
        ...conflict,
        replayRelevant: timeDeltaSeconds <= 600,
        replayTimeDeltaSeconds: Math.round(timeDeltaSeconds),
      };
    })
    .sort((left, right) => {
      if (left.replayRelevant !== right.replayRelevant) {
        return left.replayRelevant ? -1 : 1;
      }

      const order = { critical: 3, caution: 2, info: 1 };
      return (order[right.severity] ?? 0) - (order[left.severity] ?? 0);
    });
};

const conflictAssessmentSummary = () => {
  const conflicts = activeConflictAssessmentItems();
  if (conflicts.length === 0) {
    return {
      label: "Conflict assessment clear",
      tone: "pass",
      detail: "No current traffic conflict candidates are assessed for the selected mission context.",
    };
  }

  const highest = conflicts[0];
  const highestOverlay =
    highest.overlayKind === "area_conflict" ? conflictOverlayForItem(highest) : null;
  const highestRefreshContext = areaOverlaySourceRefreshCardContext(highestOverlay);
  return {
    label: `${conflicts.length} conflict candidate${conflicts.length === 1 ? "" : "s"}`,
    tone: highest.severity,
    detail: [
      highest.overlayLabel,
      formatRangeBearing(highest.metrics),
      highest.overlayKind === "area_conflict"
        ? `${formatTemporalContext(highest)} | ${formatVerticalContext(highest)}`
        : `${formatVerticalSeparation(highest.metrics?.altitudeDeltaFt)} vertical`,
      highestRefreshContext,
    ]
      .filter(Boolean)
      .join(" | "),
  };
};

const primaryConflictAssessmentItem = () => activeConflictAssessmentItems()[0] ?? null;

const secondaryConflictAssessmentItems = () =>
  activeConflictAssessmentItems().slice(1, 4);

const fallbackResolutionGuidance = (conflict) => ({
  mode: "decision_support",
  urgency:
    conflict?.severity === "critical"
      ? "immediate_review"
      : conflict?.severity === "caution"
        ? "review"
        : "monitor",
  recommendedAction:
    conflict?.severity === "critical"
      ? "Review immediately"
      : conflict?.severity === "caution"
        ? "Review conflict context"
        : "Monitor conflict context",
  actionCode:
    conflict?.severity === "critical"
      ? "prepare_deconfliction"
      : conflict?.severity === "caution"
        ? "review_separation"
        : "monitor_context",
  prohibitedActions: ["Do not treat this guidance as an aircraft command"],
  authorityRequired: conflict?.severity === "critical" ? "supervisor" : "operator",
  acknowledgementRequired: conflict?.severity === "critical" || conflict?.severity === "caution",
  evidenceAction:
    conflict?.severity === "critical"
      ? "record_supervisor_review"
      : conflict?.severity === "caution"
        ? "record_operator_review"
        : "none",
  pilotInstructionStatus: "not_a_pilot_command",
  rationale: conflict?.explanation ?? "No conflict rationale is currently available.",
});

const matchingConflictGuidanceAcknowledgement = (advisory) =>
  (uiState.conflictGuidanceAcknowledgements ?? []).find(
    (acknowledgement) =>
      acknowledgement.overlayId === advisory.overlayId &&
      acknowledgement.guidanceActionCode === advisory.actionCode &&
      acknowledgement.evidenceAction === advisory.evidenceAction,
  ) ?? null;

const deriveConflictAdvisories = () =>
  activeConflictAssessmentItems().slice(0, 5).map((conflict) => {
    const guidance =
      conflict.resolutionGuidance ?? fallbackResolutionGuidance(conflict);
    let headline = "Monitor traffic proximity";

    if (guidance.urgency === "immediate_review") {
      headline = "Immediate deconfliction review";
    } else if (guidance.urgency === "review") {
      headline = "Deconfliction review recommended";
    }

    const replayRelevance = conflict.replayRelevant
      ? "Current replay window"
      : `${conflict.replayTimeDeltaSeconds} s from replay cursor`;
    const refreshContext =
      conflict.overlayKind === "area_conflict"
        ? areaOverlaySourceRefreshCardContext(conflictOverlayForItem(conflict))
        : null;

    return {
      id: conflict.id,
      overlayId: conflict.overlayId,
      tone: conflict.severity,
      headline,
      actionCode: guidance.actionCode,
      recommendation: guidance.recommendedAction,
      prohibitedActions: guidance.prohibitedActions ?? [],
      authorityRequired: guidance.authorityRequired,
      acknowledgementRequired: Boolean(guidance.acknowledgementRequired),
      evidenceAction: guidance.evidenceAction ?? "none",
      pilotInstructionStatus: guidance.pilotInstructionStatus,
      guidanceRationale: guidance.rationale,
      relatedObject: conflict.overlayLabel,
      relatedSource: `${conflict.relatedSource.provider} / ${conflict.relatedSource.sourceType}`,
      reasoning: conflict.explanation,
      relevance: replayRelevance,
      refreshContext,
      summary: [
        formatRangeBearing(conflict.metrics),
        conflict.overlayKind === "area_conflict"
          ? `${formatTemporalContext(conflict)} | ${formatVerticalContext(conflict)}`
          : `${formatVerticalSeparation(conflict.metrics?.altitudeDeltaFt)} vertical`,
        refreshContext,
      ]
        .filter(Boolean)
        .join(" | "),
    };
  }).map((advisory) => {
    const acknowledgement = matchingConflictGuidanceAcknowledgement(advisory);

    return {
      ...advisory,
      acknowledgement,
      acknowledgementStatus: acknowledgement
        ? `Recorded by ${acknowledgement.acknowledgedBy} (${acknowledgement.acknowledgementRole}) at ${formatDateTime(acknowledgement.createdAt)}`
        : advisory.acknowledgementRequired
          ? "Required"
          : "Not required",
    };
  });

const conflictAdvisorySummary = () => {
  const advisories = deriveConflictAdvisories();
  if (advisories.length === 0) {
    return {
      label: "Advisory layer clear",
      tone: "pass",
      detail: "No conflict advisory presentation is currently required.",
    };
  }

  const primary = advisories[0];
  return {
    label: `${advisories.length} advisory item${advisories.length === 1 ? "" : "s"}`,
    tone: primary.tone,
    detail: `${primary.recommendation} | ${primary.acknowledgementStatus} | ${primary.relatedObject} | ${primary.summary}`,
  };
};

const primaryConflictAdvisory = () => deriveConflictAdvisories()[0] ?? null;

const secondaryConflictAdvisories = () => deriveConflictAdvisories().slice(1, 4);

const missionLifecycleStatus = () =>
  uiState.planningWorkspace?.mission?.status ??
  uiState.dispatchWorkspace?.mission?.status ??
  "";

const isPostLaunchMission = () =>
  ["active", "completed", "aborted"].includes(
    String(missionLifecycleStatus() ?? "").toLowerCase(),
  );

const currentConflictReplayRelation = () => {
  const conflicts = activeConflictAssessmentItems();

  if (conflicts.length === 0) {
    return {
      label: "Outside conflict relevance",
      tone: "pass",
      detail: "No assessed conflict candidate currently aligns with the replay cursor.",
    };
  }

  const primary = conflicts[0];
  if (primary.replayRelevant) {
    return {
      label: "Inside conflict relevance",
      tone: primary.severity,
      detail: `${primary.overlayLabel} is aligned with the current replay window.`,
    };
  }

  return {
    label: "Near conflict relevance",
    tone: primary.severity === "critical" ? "warning" : "info",
    detail: `${primary.overlayLabel} is ${primary.replayTimeDeltaSeconds} s from the current replay cursor.`,
  };
};

const conflictReplayMarkers = (replayStart, replaySpan) =>
  conflictAssessmentItems().map((conflict) => {
    const markerTime = Date.parse(conflict.referenceTimestamp ?? "");
    if (!Number.isFinite(markerTime)) {
      return "";
    }

    const left = ((markerTime - replayStart) / replaySpan) * 100;
    return `<span class="replay-marker conflict ${escapeHtml(
      conflict.severity,
    )}" style="left:${Math.max(0, Math.min(left, 100))}%"></span>`;
  });

const correlatedConflictTimelineItems = () => {
  const timelineItems = uiState.timeline?.items ?? [];
  const conflicts = activeConflictAssessmentItems();

  return timelineItems
    .map((item) => {
      const itemTime = item?.occurredAt ? Date.parse(item.occurredAt) : NaN;
      const nearestConflict = conflicts
        .map((conflict) => {
          const conflictTime = Date.parse(conflict.referenceTimestamp ?? "");
          const deltaSeconds =
            Number.isFinite(itemTime) && Number.isFinite(conflictTime)
              ? Math.abs(itemTime - conflictTime) / 1000
              : Number.POSITIVE_INFINITY;

          return {
            conflict,
            deltaSeconds,
          };
        })
        .sort((left, right) => left.deltaSeconds - right.deltaSeconds)[0];

      return {
        ...item,
        nearestConflict: nearestConflict?.conflict ?? null,
        conflictDeltaSeconds: nearestConflict?.deltaSeconds ?? Number.POSITIVE_INFINITY,
        conflictRelevant: (nearestConflict?.deltaSeconds ?? Number.POSITIVE_INFINITY) <= 900,
      };
    })
    .sort((left, right) => {
      if (left.conflictRelevant !== right.conflictRelevant) {
        return left.conflictRelevant ? -1 : 1;
      }

      return Date.parse(right.occurredAt ?? "") - Date.parse(left.occurredAt ?? "");
    })
    .slice(0, 8);
};

const currentConflictWindowSummary = () => {
  const replayRelation = currentConflictReplayRelation();
  const conflicts = activeConflictAssessmentItems();
  const primary = conflicts[0] ?? null;

  if (!primary) {
    return {
      headline: "No current conflict window",
      tone: "pass",
      detail: "No assessed conflict candidate currently overlaps the replay review context.",
      meta: "Window summary clear.",
    };
  }

  return {
    headline: replayRelation.label,
    tone: primary.severity,
    detail: `${primary.overlayLabel} | ${primary.metrics?.lateralDistanceMeters ?? "?"} m lateral | ${primary.metrics?.altitudeDeltaFt ?? "?"} ft vertical`,
    meta: replayRelation.detail,
  };
};

const conflictTrackWindowPoints = () => {
  const points = replayTrack();
  const activeConflicts = activeConflictAssessmentItems();

  if (points.length === 0 || activeConflicts.length === 0) {
    return [];
  }

  const targetTimes = activeConflicts
    .map((conflict) => Date.parse(conflict.referenceTimestamp ?? ""))
    .filter((value) => Number.isFinite(value));

  return points.filter((point) => {
    const pointTime = Date.parse(point.timestamp ?? "");
    if (!Number.isFinite(pointTime)) {
      return false;
    }

    return targetTimes.some((targetTime) => Math.abs(pointTime - targetTime) <= 600000);
  });
};

const conflictEnvelopeRadius = (conflict) => {
  const lateralDistance = Number(conflict?.metrics?.lateralDistanceMeters);

  if (!Number.isFinite(lateralDistance)) {
    return 72;
  }

  return Math.max(42, Math.min(160, 28 + lateralDistance * 0.18));
};

const conflictSeverityBandRadii = (conflict) => {
  const outerRadius = conflictEnvelopeRadius(conflict);

  if (String(conflict?.severity ?? "").toLowerCase() === "critical") {
    return [outerRadius, Math.max(28, outerRadius * 0.68), Math.max(16, outerRadius * 0.42)];
  }

  if (String(conflict?.severity ?? "").toLowerCase() === "caution") {
    return [outerRadius, Math.max(24, outerRadius * 0.62)];
  }

  return [outerRadius];
};

const conflictOverlayForItem = (conflict) =>
  (uiState.externalOverlays ?? []).find((overlay) => overlay.id === conflict?.overlayId) ?? null;

const activeConflictEnvelopeTargets = () =>
  activeConflictAssessmentItems()
    .map((conflict) => {
      const overlay = conflictOverlayForItem(conflict);
      const lat = Number(overlay?.geometry?.lat);
      const lng = Number(overlay?.geometry?.lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
      }

      return {
        conflict,
        overlay,
        lat,
        lng,
        radii: conflictSeverityBandRadii(conflict),
      };
    })
    .filter(Boolean);

const conflictProximityEnvelopeSummary = () => {
  const targets = activeConflictEnvelopeTargets();
  const primary = targets[0] ?? null;

  if (!primary) {
    return {
      headline: "No proximity envelope active",
      tone: "pass",
      detail: "No assessed conflict object currently has map-native proximity envelope rendering.",
      meta: "Envelope bands clear.",
    };
  }

  return {
    headline: `${primary.conflict.overlayLabel} proximity`,
    tone: primary.conflict.severity,
    detail: `${primary.radii.length} severity band${primary.radii.length === 1 ? "" : "s"} | ${formatRangeBearing(primary.conflict.metrics)} | ${primary.conflict.overlayKind === "area_conflict" ? formatVerticalContext(primary.conflict) : `${formatVerticalSeparation(primary.conflict.metrics?.altitudeDeltaFt)} vertical`}`,
    meta: primary.conflict.explanation,
  };
};

const replayTrack = () =>
  (uiState.replay?.replay ?? []).filter(
    (point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lng),
  );

const activeReplayPoint = () => {
  const points = replayTrack();
  if (points.length === 0) {
    return uiState.latestTelemetry?.telemetry ?? null;
  }

  const index = Math.max(
    0,
    Math.min(uiState.replayPlayback.index, points.length - 1),
  );
  return points[index];
};

const stopReplayPlayback = () => {
  if (uiState.replayPlayback.timerId != null) {
    window.clearInterval(uiState.replayPlayback.timerId);
    uiState.replayPlayback.timerId = null;
  }
  uiState.replayPlayback.playing = false;
};

const startReplayPlayback = () => {
  const points = replayTrack();
  if (points.length <= 1) {
    renderReplayControls();
    return;
  }

  if (uiState.replayPlayback.index >= points.length - 1) {
    setReplayIndex(0);
  }

  stopReplayPlayback();
  uiState.replayPlayback.playing = true;
  renderReplayControls();
  uiState.replayPlayback.timerId = window.setInterval(() => {
    const currentPoints = replayTrack();
    if (uiState.replayPlayback.index >= currentPoints.length - 1) {
      stopReplayPlayback();
      renderLiveOperations();
      return;
    }

    setReplayIndex(uiState.replayPlayback.index + 1);
    renderLiveOperations();
  }, replayPlaybackIntervalMs());
};

const setReplayIndex = (nextIndex) => {
  const points = replayTrack();
  const boundedIndex =
    points.length === 0 ? 0 : Math.max(0, Math.min(nextIndex, points.length - 1));
  uiState.replayPlayback.index = boundedIndex;
  replaySlider.value = String(boundedIndex);
};

const findNearestReplayIndexForTime = (timestamp) => {
  const targetTime = Date.parse(timestamp ?? "");
  const points = replayTrack();

  if (!Number.isFinite(targetTime) || points.length === 0) {
    return null;
  }

  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  points.forEach((point, index) => {
    const pointTime = Date.parse(point.timestamp ?? "");
    if (!Number.isFinite(pointTime)) {
      return;
    }

    const distance = Math.abs(pointTime - targetTime);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
};

const replayMilestones = () => {
  const timelineItems = uiState.timeline?.items ?? [];
  const eventMilestones = timelineItems
    .filter((item) => {
      const eventType = item?.details?.eventType;
      return (
        eventType === "mission.launched" ||
        eventType === "mission.completed" ||
        eventType === "mission.aborted"
      );
    })
    .map((item) => ({
      key: `${item.type}-${item.occurredAt}`,
      label:
        item?.details?.eventType === "mission.launched"
          ? "Launch"
          : item?.details?.eventType === "mission.completed"
            ? "Completion"
            : "Abort",
      timestamp: item.occurredAt,
      tone:
        item?.details?.eventType === "mission.aborted"
          ? "fail"
          : "info",
    }));

  const alertMilestones = (uiState.alerts ?? [])
    .slice(0, 4)
    .map((alert) => ({
      key: `alert-${alert.id}`,
      label: `${alert.alertType.replaceAll("_", " ")}`,
      timestamp: alert.triggeredAt,
      tone: alert.severity,
    }));

  return [...eventMilestones, ...alertMilestones].filter(
    (milestone, index, list) =>
      index === list.findIndex((candidate) => candidate.key === milestone.key),
  );
};

const updateUrl = (missionId) => {
  const next = new URL(window.location.href);
  if (missionId) {
    next.searchParams.set("missionId", missionId);
  } else {
    next.searchParams.delete("missionId");
  }
  window.history.replaceState({}, "", next);
};

const getMissionIdFromLocation = () => {
  const pathMatch = window.location.pathname.match(missionRoutePattern);
  if (pathMatch?.[1]) {
    return decodeURIComponent(pathMatch[1]);
  }

  const queryMissionId = new URL(window.location.href).searchParams.get("missionId");
  return queryMissionId?.trim() || "";
};

const renderList = (items, title) => {
  if (!items || items.length === 0) {
    return `<div class="empty-state">No ${escapeHtml(title).toLowerCase()} recorded.</div>`;
  }

  return `
    <ul class="list">
      ${items
        .map(
          (item) => `
            <li class="list-item">
              <strong>${escapeHtml(item.label ?? title)}</strong>
              <div>${escapeHtml(item.value ?? item)}</div>
            </li>
          `,
        )
        .join("")}
    </ul>
  `;
};

const summarizeRiskState = (planningWorkspace) => {
  const assessment = planningWorkspace?.missionRisk;
  if (!assessment) {
    return {
      label: "Mission risk missing",
      tone: "warning",
      detail: "No mission risk assessment is available for the current mission.",
    };
  }

  return {
    label: `Mission risk ${assessment.result ?? "unknown"}`,
    tone: assessment.result ?? "info",
    detail:
      assessment.reasons?.[0]?.message ??
      `Risk band ${assessment.riskBand ?? "unknown"}`,
  };
};

const summarizeAirspaceState = (planningWorkspace) => {
  const assessment = planningWorkspace?.airspaceCompliance;
  if (!assessment) {
    return {
      label: "Airspace state missing",
      tone: "warning",
      detail: "No airspace compliance assessment is available for the current mission.",
    };
  }

  return {
    label: `Airspace ${assessment.result ?? "unknown"}`,
    tone: assessment.result ?? "info",
    detail:
      assessment.reasons?.[0]?.message ??
      `Restriction ${assessment.input?.restrictionStatus ?? "unknown"}`,
  };
};

const summarizeReadinessState = (planningWorkspace, dispatchWorkspace) => {
  if (isPostLaunchMission()) {
    return {
      label: "Readiness complete",
      tone: "pass",
      detail:
        "Mission is already in post-launch state; readiness gates are historical for this live view.",
    };
  }

  const readinessGate = planningWorkspace?.readiness?.gate;
  const launchPreflight = dispatchWorkspace?.dispatch?.launchPreflight;
  const blocked =
    readinessGate?.blocksDispatch ||
    dispatchWorkspace?.dispatch?.blockingReasons?.length > 0 ||
    launchPreflight?.allowed === false;

  return {
    label: blocked ? "Readiness blocked" : "Readiness clear",
    tone: blocked ? "fail" : "pass",
    detail:
      dispatchWorkspace?.dispatch?.blockingReasons?.[0] ??
      planningWorkspace?.blockingReasons?.[0] ??
      launchPreflight?.error?.message ??
      "No current readiness blockers are reported.",
  };
};

const summarizeDispatchState = (dispatchWorkspace) => {
  if (isPostLaunchMission()) {
    return {
      label: "Dispatch complete",
      tone: "pass",
      detail:
        "Mission is already in post-launch state; dispatch gating is no longer the active operator concern.",
    };
  }

  const blocked = dispatchWorkspace?.dispatch?.ready === false;
  return {
    label: blocked ? "Dispatch blocked" : "Dispatch ready",
    tone: blocked ? "fail" : "pass",
    detail:
      dispatchWorkspace?.dispatch?.missingRequirements?.[0] ??
      dispatchWorkspace?.dispatch?.blockingReasons?.[0] ??
      "Dispatch state is clear for the current mission.",
  };
};

const summarizeTelemetryAlerts = (alerts) => {
  const openAlerts = (alerts ?? []).filter((alert) => alert.status !== "resolved");
  if (openAlerts.length === 0) {
    return {
      label: "Telemetry alerts clear",
      tone: "pass",
      detail: "No open telemetry alerts are currently reported.",
    };
  }

  const highest = [...openAlerts].sort((left, right) => {
    const order = { critical: 3, warning: 2, info: 1 };
    return (order[right.severity] ?? 0) - (order[left.severity] ?? 0);
  })[0];

  return {
    label: `${openAlerts.length} active alert${openAlerts.length === 1 ? "" : "s"}`,
    tone: highest?.severity ?? "warning",
    detail: highest?.message ?? "Telemetry alerts are present.",
  };
};

const severityRank = (value) => {
  const order = {
    critical: 4,
    fail: 4,
    warning: 3,
    blocked: 3,
    info: 2,
    pass: 1,
    clear: 1,
  };

  return order[String(value ?? "").toLowerCase()] ?? 0;
};

const severityStroke = (value) => {
  const text = String(value ?? "").toLowerCase();

  if (text === "critical" || text === "fail") {
    return "#ef4444";
  }

  if (text === "warning" || text === "blocked") {
    return "#f59e0b";
  }

  if (text === "info") {
    return "#38bdf8";
  }

  return "#22c55e";
};

const buildOverlayCards = () => {
  const planningWorkspace = uiState.planningWorkspace;
  const dispatchWorkspace = uiState.dispatchWorkspace;
  const primaryConflict = primaryConflictAssessmentItem();
  const primaryAdvisory = primaryConflictAdvisory();
  const primaryConflictOverlay = primaryConflict
    ? conflictOverlayForItem(primaryConflict)
    : null;
  const primaryConflictRefreshContext =
    primaryConflict?.overlayKind === "area_conflict"
      ? areaOverlaySourceRefreshCardContext(primaryConflictOverlay)
      : null;
  const cards = [
    summarizeRiskState(planningWorkspace),
    summarizeAirspaceState(planningWorkspace),
    summarizeReadinessState(planningWorkspace, dispatchWorkspace),
    summarizeDispatchState(dispatchWorkspace),
    weatherSummary(),
    crewedTrafficSummary(),
    droneTrafficSummary(),
    summarizeTelemetryAlerts(uiState.alerts),
    primaryConflict
      ? {
          label: "Primary conflict",
          tone: primaryConflict.severity,
          detail: [
            primaryConflict.overlayLabel,
            formatRangeBearing(primaryConflict.metrics),
            primaryConflict.overlayKind === "area_conflict"
              ? formatVerticalContext(primaryConflict)
              : `${formatVerticalSeparation(primaryConflict.metrics?.altitudeDeltaFt)} vertical`,
            primaryConflictRefreshContext,
          ]
            .filter(Boolean)
            .join(" | "),
        }
      : conflictAssessmentSummary(),
    primaryAdvisory
      ? {
          label: "Primary advisory",
          tone: primaryAdvisory.tone,
          detail: [
            primaryAdvisory.recommendation,
            primaryAdvisory.relatedObject,
            primaryAdvisory.refreshContext,
          ]
            .filter(Boolean)
            .join(" | "),
        }
      : conflictAdvisorySummary(),
  ];

  return cards
    .map(
      (card) => `
        <section class="map-alert-card ${toneClass(card.tone)}">
          <strong>${escapeHtml(card.label)}</strong>
          <div>${escapeHtml(card.detail)}</div>
        </section>
      `,
    )
    .join("");
};

const correlatedAlertWindows = () => {
  const replayPoints = replayTrack();
  const activePoint = activeReplayPoint();
  const activeTime = activePoint?.timestamp ? Date.parse(activePoint.timestamp) : null;
  const lastReplayTimestamp =
    replayPoints[replayPoints.length - 1]?.timestamp
      ? Date.parse(replayPoints[replayPoints.length - 1].timestamp)
      : activeTime;

  return (uiState.alerts ?? [])
    .map((alert) => {
      const start = Date.parse(alert.triggeredAt);
      const end = alert.resolvedAt
        ? Date.parse(alert.resolvedAt)
        : lastReplayTimestamp ?? start;
      const activeAtReplay =
        activeTime != null &&
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        activeTime >= start &&
        activeTime <= end;
      const relativeMs =
        activeTime == null || !Number.isFinite(start) ? Number.POSITIVE_INFINITY : Math.abs(activeTime - start);

      return {
        ...alert,
        activeAtReplay,
        relativeMs,
      };
    })
    .sort((left, right) => {
      if (left.activeAtReplay !== right.activeAtReplay) {
        return left.activeAtReplay ? -1 : 1;
      }
      return left.relativeMs - right.relativeMs;
    });
};

const correlatedTimelineEvents = () => {
  const activePoint = activeReplayPoint();
  const activeTime = activePoint?.timestamp ? Date.parse(activePoint.timestamp) : null;

  return (uiState.timeline?.items ?? [])
    .map((item) => {
      const itemTime = item?.occurredAt ? Date.parse(item.occurredAt) : NaN;
      const relativeMs =
        activeTime == null || !Number.isFinite(itemTime) ? Number.POSITIVE_INFINITY : Math.abs(itemTime - activeTime);

      return {
        ...item,
        relativeMs,
      };
    })
    .filter((item) => Number.isFinite(item.relativeMs))
    .sort((left, right) => left.relativeMs - right.relativeMs)
    .slice(0, 4);
};

const renderOverview = () => {
  const planningWorkspace = uiState.planningWorkspace;
  const dispatchWorkspace = uiState.dispatchWorkspace;
  const mission = planningWorkspace?.mission ?? dispatchWorkspace?.mission;
  const replayCount = replayTrack().length;
  const currentReplayPoint = activeReplayPoint();
  const timelineCount = uiState.timeline?.items?.length ?? 0;
  const openAlertCount = (uiState.alerts ?? []).filter((alert) => alert.status !== "resolved").length;
  const activeWeather = activeWeatherOverlay();
  const weatherMeta = activeWeather?.metadata ?? null;
  const activeTraffic = activeCrewedTrafficOverlays();
  const primaryTraffic = activeTraffic[0];
  const primaryTrafficMeta = primaryTraffic?.metadata ?? null;
  const activeDroneTraffic = activeDroneTrafficOverlays();
  const primaryDroneTraffic = activeDroneTraffic[0];
  const primaryDroneMeta = primaryDroneTraffic?.metadata ?? null;
  const conflicts = activeConflictAssessmentItems();
  const primaryConflict = conflicts[0];
  const advisories = deriveConflictAdvisories();
  const primaryAdvisory = advisories[0];
  const replayConflictRelation = currentConflictReplayRelation();

  overviewPanel.innerHTML = `
    <article class="metric">
      <div class="label">Mission</div>
      <div class="value ${toneClass(mission?.status ?? "Unknown")}">${escapeHtml(
        missionDisplayName(mission),
      )}</div>
      <div class="meta">Mission status: ${escapeHtml(mission?.status ?? "Unknown")}</div>
    </article>
    <article class="metric">
      <div class="label">Replay track</div>
      <div class="value">${escapeHtml(String(replayCount))}</div>
      <div class="meta">Replay points available for the selected mission.</div>
    </article>
    <article class="metric">
      <div class="label">Replay position</div>
      <div class="value ${toneClass(currentReplayPoint ? "present" : "missing")}">${escapeHtml(
        currentReplayPoint ? formatDateTime(currentReplayPoint.timestamp) : "Missing",
      )}</div>
      <div class="meta">Altitude: ${escapeHtml(
        currentReplayPoint?.altitudeM != null ? `${currentReplayPoint.altitudeM} m` : "Not recorded",
      )}</div>
    </article>
    <article class="metric">
      <div class="label">Timeline coverage</div>
      <div class="value">${escapeHtml(String(timelineCount))}</div>
      <div class="meta">Mission narrative items across planning, approval, dispatch, flight, and post-operation.</div>
    </article>
    <article class="metric">
      <div class="label">Replay progress</div>
      <div class="value">${escapeHtml(
        replayCount === 0
          ? "0 / 0"
          : `${uiState.replayPlayback.index + 1} / ${replayCount}`,
      )}</div>
      <div class="meta">Current replay cursor across the mission track.</div>
    </article>
    <article class="metric">
      <div class="label">Active alerts</div>
      <div class="value ${toneClass(openAlertCount > 0 ? "warning" : "clear")}">${escapeHtml(String(openAlertCount))}</div>
      <div class="meta">Open telemetry-linked alerts currently associated with the selected mission.</div>
    </article>
    <article class="metric">
      <div class="label">Weather</div>
      <div class="value ${toneClass(activeWeather?.severity ?? "missing")}">${escapeHtml(
        weatherMeta
          ? `${weatherMeta.windSpeedKnots} kt ${weatherMeta.precipitation}`
          : "Missing",
      )}</div>
      <div class="meta">${escapeHtml(
        weatherMeta
          ? `${weatherMeta.temperatureC}\u00B0C at ${formatDateTime(activeWeather.observedAt)}`
          : "No weather overlay loaded for this mission.",
      )}</div>
    </article>
    <article class="metric">
      <div class="label">Crewed traffic</div>
      <div class="value ${toneClass(primaryTraffic?.severity ?? "missing")}">${escapeHtml(
        activeTraffic.length === 0
          ? "Missing"
          : `${activeTraffic.length} contact${activeTraffic.length === 1 ? "" : "s"}`,
      )}</div>
      <div class="meta">${escapeHtml(
        primaryTrafficMeta
          ? `${primaryTrafficMeta.callsign ?? primaryTrafficMeta.trafficId ?? "Unknown"} at ${formatDateTime(primaryTraffic.observedAt)}`
          : "No crewed traffic overlay loaded for this mission.",
      )}</div>
    </article>
    <article class="metric">
      <div class="label">Drone traffic</div>
      <div class="value ${toneClass(primaryDroneTraffic?.severity ?? "missing")}">${escapeHtml(
        activeDroneTraffic.length === 0
          ? "Missing"
          : `${activeDroneTraffic.length} contact${activeDroneTraffic.length === 1 ? "" : "s"}`,
      )}</div>
      <div class="meta">${escapeHtml(
        primaryDroneMeta
          ? `${primaryDroneMeta.operatorReference ?? primaryDroneMeta.trafficId ?? "Unknown"} at ${formatDateTime(primaryDroneTraffic.observedAt)}`
          : "No drone traffic overlay loaded for this mission.",
      )}</div>
    </article>
    <article class="metric">
      <div class="label">Conflict assessment</div>
      <div class="value ${toneClass(primaryConflict?.severity ?? "clear")}">${escapeHtml(
        conflicts.length === 0
          ? "Clear"
          : `${conflicts.length} candidate${conflicts.length === 1 ? "" : "s"}`,
      )}</div>
      <div class="meta">${escapeHtml(
        primaryConflict
          ? `${primaryConflict.overlayLabel} at ${primaryConflict.metrics?.lateralDistanceMeters ?? "?"} m lateral / ${primaryConflict.metrics?.altitudeDeltaFt ?? "?"} ft vertical`
          : "No current interpreted traffic conflict candidates.",
      )}</div>
    </article>
    <article class="metric">
      <div class="label">Conflict advisory</div>
      <div class="value ${toneClass(primaryAdvisory?.tone ?? "clear")}">${escapeHtml(
        advisories.length === 0
          ? "Clear"
          : primaryAdvisory.recommendation,
      )}</div>
      <div class="meta">${escapeHtml(
        primaryAdvisory
          ? `${primaryAdvisory.relatedObject} | ${primaryAdvisory.summary}`
          : "No advisory-grade conflict presentation is currently required.",
      )}</div>
    </article>
    <article class="metric">
      <div class="label">Replay conflict relation</div>
      <div class="value ${toneClass(replayConflictRelation.tone)}">${escapeHtml(
        replayConflictRelation.label,
      )}</div>
      <div class="meta">${escapeHtml(replayConflictRelation.detail)}</div>
    </article>
  `;
};

const buildMapMarkup = () => {
  const replayPoints = replayTrack();
  const latestTelemetry = uiState.latestTelemetry?.telemetry ?? null;
  const points = replayPoints.concat(
    latestTelemetry &&
      Number.isFinite(latestTelemetry.lat) &&
      Number.isFinite(latestTelemetry.lng)
      ? [latestTelemetry]
      : [],
  );

  if (points.length === 0) {
    return `<div class="empty-state">No replay or telemetry coordinates are available for this mission yet.</div>`;
  }

  const lats = points.map((point) => Number(point.lat));
  const lngs = points.map((point) => Number(point.lng));
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(maxLat - minLat, 0.0001);
  const lngSpan = Math.max(maxLng - minLng, 0.0001);
  const width = 1000;
  const height = 620;
  const padding = 48;

  const toPoint = (lat, lng) => {
    const x = padding + ((lng - minLng) / lngSpan) * (width - padding * 2);
    const y = height - padding - ((lat - minLat) / latSpan) * (height - padding * 2);
    return { x, y };
  };

  const replayPath = replayPoints.map((point) => {
      const projected = toPoint(Number(point.lat), Number(point.lng));
      return `${projected.x},${projected.y}`;
    }).join(" ");

  const projectedReplayPoints = replayPoints.map((point) => ({
      ...point,
      ...toPoint(Number(point.lat), Number(point.lng)),
    }));

  const selectedReplayIndex = Math.max(
    0,
    Math.min(uiState.replayPlayback.index, Math.max(projectedReplayPoints.length - 1, 0)),
  );
  const completedReplayPath = projectedReplayPoints
    .slice(0, selectedReplayIndex + 1)
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  const replayDots = projectedReplayPoints
    .map((point, index) => {
      return `
        <circle cx="${point.x}" cy="${point.y}" r="${index === selectedReplayIndex ? 6 : 3.5}" fill="${
          index <= selectedReplayIndex ? "#38bdf8" : "#47627f"
        }" opacity="${index === selectedReplayIndex ? "1" : "0.68"}" />
      `;
    })
    .join("");

  const currentReplayPoint = activeReplayPoint();
  const currentMapPoint =
    currentReplayPoint &&
    Number.isFinite(currentReplayPoint.lat) &&
    Number.isFinite(currentReplayPoint.lng)
      ? toPoint(Number(currentReplayPoint.lat), Number(currentReplayPoint.lng))
      : null;

  const overlays = [
    `Replay points ${replayPoints.length}`,
    currentReplayPoint ? `Replay time ${formatDateTime(currentReplayPoint.timestamp)}` : "Replay time missing",
    replayPoints.length > 0 ? `Replay progress ${selectedReplayIndex + 1}/${replayPoints.length}` : "Replay progress 0/0",
    uiState.dispatchWorkspace?.dispatch?.ready ? "Dispatch ready" : "Dispatch blocked",
    summarizeRiskState(uiState.planningWorkspace).label,
    summarizeAirspaceState(uiState.planningWorkspace).label,
    weatherOverlays().length > 0 ? `Weather overlays ${weatherOverlays().length}` : "Weather overlays 0",
    crewedTrafficOverlays().length > 0 ? `Crewed traffic ${crewedTrafficOverlays().length}` : "Crewed traffic 0",
    droneTrafficOverlays().length > 0 ? `Drone traffic ${droneTrafficOverlays().length}` : "Drone traffic 0",
  ];

  const openAlerts = (uiState.alerts ?? []).filter((alert) => alert.status !== "resolved");
  const legendItems = [
    "Cyan track replay",
    "Red marker latest telemetry",
    `Open alerts ${openAlerts.length}`,
    `Conflict windows ${activeConflictAssessmentItems().length}`,
  ];

  const highestAlertSeverity = openAlerts.reduce((highest, alert) => {
    return severityRank(alert.severity) > severityRank(highest)
      ? alert.severity
      : highest;
  }, "clear");
  const highlightedSegments = projectedReplayPoints
    .slice(Math.max(projectedReplayPoints.length - Math.max(openAlerts.length + 1, 2), 1))
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
  const readinessState = summarizeReadinessState(uiState.planningWorkspace, uiState.dispatchWorkspace);
  const dispatchState = summarizeDispatchState(uiState.dispatchWorkspace);
  const riskState = summarizeRiskState(uiState.planningWorkspace);
  const airspaceState = summarizeAirspaceState(uiState.planningWorkspace);
  const weatherState = weatherSummary();
  const trafficState = crewedTrafficSummary();
  const droneState = droneTrafficSummary();
  const conflictWindowSummary = currentConflictWindowSummary();
  const conflictEnvelopeSummary = conflictProximityEnvelopeSummary();
  const conflictEnvelopeTargets = activeConflictEnvelopeTargets();
  const conflictTrackWindow = conflictTrackWindowPoints();
  const mapRiskSeverity = [highestAlertSeverity, readinessState.tone, dispatchState.tone, riskState.tone, airspaceState.tone]
    .sort((left, right) => severityRank(right) - severityRank(left))[0];
  const conflictTrackHighlight = conflictTrackWindow.length >= 2
    ? `
      <polyline
        points="${conflictTrackWindow
          .map((point) => {
            const projected = toPoint(Number(point.lat), Number(point.lng));
            return `${projected.x},${projected.y}`;
          })
          .join(" ")}"
        fill="none"
        stroke="${severityStroke(conflictWindowSummary.tone)}"
        stroke-width="14"
        stroke-linecap="round"
        stroke-linejoin="round"
        opacity="0.26"
      />
    `
    : "";
  const weatherOverlay = activeWeatherOverlay();
  const weatherPoint =
    weatherOverlay &&
    Number.isFinite(weatherOverlay.geometry?.lat) &&
    Number.isFinite(weatherOverlay.geometry?.lng)
      ? toPoint(
          Number(weatherOverlay.geometry.lat),
          Number(weatherOverlay.geometry.lng),
        )
      : null;
  const latestTelemetryHalo = currentMapPoint
    ? `
      <circle cx="${currentMapPoint.x}" cy="${currentMapPoint.y}" r="34" fill="none" stroke="${severityStroke(
        highestAlertSeverity,
      )}" stroke-width="3" opacity="0.22" />
      <circle cx="${currentMapPoint.x}" cy="${currentMapPoint.y}" r="54" fill="none" stroke="${severityStroke(
        mapRiskSeverity,
      )}" stroke-width="2" stroke-dasharray="8 10" opacity="0.18" />
    `
    : "";
  const airspaceRegion = `
    <polygon
      points="${width - 280},92 ${width - 92},128 ${width - 164},280 ${width - 332},224"
      fill="${severityStroke(airspaceState.tone)}"
      opacity="${severityRank(airspaceState.tone) >= 3 ? "0.16" : "0.08"}"
      stroke="${severityStroke(airspaceState.tone)}"
      stroke-width="2"
      stroke-dasharray="8 6"
    />
  `;
  const riskCorridor = projectedReplayPoints.length >= 2
    ? `
      <polyline
        points="${projectedReplayPoints.map((point) => `${point.x},${point.y}`).join(" ")}"
        fill="none"
        stroke="${severityStroke(riskState.tone)}"
        stroke-width="18"
        stroke-linecap="round"
        stroke-linejoin="round"
        opacity="${severityRank(riskState.tone) >= 3 ? "0.12" : "0.06"}"
      />
    `
    : "";
  const alertTrackHighlight = highlightedSegments
    ? `
      <polyline
        points="${highlightedSegments}"
        fill="none"
        stroke="${severityStroke(highestAlertSeverity)}"
        stroke-width="10"
        stroke-linecap="round"
        stroke-linejoin="round"
        opacity="${openAlerts.length > 0 ? "0.5" : "0"}"
      />
    `
    : "";
  const directionalCue = currentMapPoint
    ? `
      <polygon
        points="${currentMapPoint.x},${currentMapPoint.y - 42} ${currentMapPoint.x + 18},${currentMapPoint.y - 6} ${currentMapPoint.x - 18},${currentMapPoint.y - 6}"
        fill="${severityStroke(dispatchState.tone)}"
        opacity="0.72"
      />
    `
    : "";
  const weatherMarker = weatherPoint
    ? `
      <circle cx="${weatherPoint.x}" cy="${weatherPoint.y}" r="18" fill="rgba(56,189,248,0.14)" stroke="#7dd3fc" stroke-width="2" />
      <path d="M ${weatherPoint.x - 10} ${weatherPoint.y} L ${weatherPoint.x + 8} ${weatherPoint.y - 8} L ${weatherPoint.x + 8} ${weatherPoint.y + 8} Z" fill="#7dd3fc" opacity="0.88" />
      <text x="${weatherPoint.x + 22}" y="${weatherPoint.y + 5}" fill="#d8ecff" font-size="12" font-weight="700">${escapeHtml(
        `${weatherOverlay?.metadata?.windSpeedKnots ?? "?"}kt`,
      )}</text>
    `
    : "";
  const crewedTrafficMarkers = activeCrewedTrafficOverlays()
    .map((overlay) => {
      const trafficPoint =
        Number.isFinite(overlay.geometry?.lat) &&
        Number.isFinite(overlay.geometry?.lng)
          ? toPoint(Number(overlay.geometry.lat), Number(overlay.geometry.lng))
          : null;

      if (!trafficPoint) {
        return "";
      }

      const metadata = overlay.metadata ?? {};
      return `
        <g>
          <circle cx="${trafficPoint.x}" cy="${trafficPoint.y}" r="11" fill="rgba(251,191,36,0.18)" stroke="#fbbf24" stroke-width="2" />
          <path d="M ${trafficPoint.x} ${trafficPoint.y - 10} L ${trafficPoint.x + 7} ${trafficPoint.y + 9} L ${trafficPoint.x} ${trafficPoint.y + 4} L ${trafficPoint.x - 7} ${trafficPoint.y + 9} Z" fill="#fbbf24" opacity="0.92" />
          <text x="${trafficPoint.x + 14}" y="${trafficPoint.y - 3}" fill="#f8fafc" font-size="11" font-weight="700">${escapeHtml(
            metadata.callsign ?? metadata.trafficId ?? "Traffic",
          )}</text>
          <text x="${trafficPoint.x + 14}" y="${trafficPoint.y + 11}" fill="#d8ecff" font-size="10">${escapeHtml(
            `${overlay.geometry?.altitudeMslFt ?? "?"}ft | ${overlay.speedKnots ?? "?"}kt`,
          )}</text>
        </g>
      `;
    })
    .join("");
  const droneTrafficMarkers = activeDroneTrafficOverlays()
    .map((overlay) => {
      const trafficPoint =
        Number.isFinite(overlay.geometry?.lat) &&
        Number.isFinite(overlay.geometry?.lng)
          ? toPoint(Number(overlay.geometry.lat), Number(overlay.geometry.lng))
          : null;

      if (!trafficPoint) {
        return "";
      }

      const metadata = overlay.metadata ?? {};
      return `
        <g>
          <circle cx="${trafficPoint.x}" cy="${trafficPoint.y}" r="9" fill="rgba(34,197,94,0.16)" stroke="#22c55e" stroke-width="2" />
          <rect x="${trafficPoint.x - 5}" y="${trafficPoint.y - 5}" width="10" height="10" rx="2" fill="#22c55e" opacity="0.94" />
          <text x="${trafficPoint.x + 12}" y="${trafficPoint.y - 2}" fill="#f8fafc" font-size="11" font-weight="700">${escapeHtml(
            metadata.operatorReference ?? metadata.trafficId ?? "Drone",
          )}</text>
          <text x="${trafficPoint.x + 12}" y="${trafficPoint.y + 12}" fill="#d8ecff" font-size="10">${escapeHtml(
            `${overlay.geometry?.altitudeMslFt ?? "?"}ft | ${overlay.speedKnots ?? "?"}kt`,
          )}</text>
        </g>
      `;
    })
    .join("");
  const conflictSeverityBands = conflictEnvelopeTargets
    .map((target) =>
      target.radii
        .map((radius, index) => {
          const point = toPoint(target.lat, target.lng);
          const stroke = severityStroke(target.conflict.severity);
          const opacity = index === 0 ? 0.26 : index === 1 ? 0.18 : 0.12;
          const dash = index === 0 ? "none" : index === 1 ? "8 8" : "4 10";

          return `
            <circle
              class="conflict-severity-band conflict-severity-band-${escapeHtml(target.conflict.severity)}"
              cx="${point.x}"
              cy="${point.y}"
              r="${radius}"
              fill="${stroke}"
              fill-opacity="${index === 0 ? 0.05 : 0.02}"
              stroke="${stroke}"
              stroke-width="${index === 0 ? 2.5 : 1.8}"
              stroke-opacity="${opacity}"
              stroke-dasharray="${dash}"
            />
          `;
        })
        .join(""),
    )
    .join("");
  const conflictProximityEnvelope = conflictEnvelopeTargets
    .map((target) => {
      const point = toPoint(target.lat, target.lng);
      const stroke = severityStroke(target.conflict.severity);
      const envelopeRadius = target.radii[0] ?? conflictEnvelopeRadius(target.conflict);

      return `
        <g class="conflict-proximity-envelope">
          <circle
            class="conflict-proximity-envelope-core"
            cx="${point.x}"
            cy="${point.y}"
            r="${Math.max(12, envelopeRadius * 0.22)}"
            fill="${stroke}"
            fill-opacity="0.1"
            stroke="${stroke}"
            stroke-width="2"
            stroke-opacity="0.6"
          />
          <text
            class="conflict-proximity-envelope-label"
            x="${point.x}"
            y="${point.y - envelopeRadius - 10}"
            fill="${stroke}"
            text-anchor="middle"
          >${escapeHtml(target.conflict.severity.toUpperCase())}</text>
        </g>
      `;
    })
    .join("");

  return `
    <div class="map-grid"></div>
    <div class="map-terrain"></div>
    <div class="map-contours"></div>
    <div class="map-legend">
      ${legendItems.map((item) => `<div class="overlay-pill">${escapeHtml(item)}</div>`).join("")}
    </div>
    <div class="map-alert-stack">
      ${buildOverlayCards()}
    </div>
    <svg class="map-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-label="Mission live operations map">
      ${airspaceRegion}
      ${riskCorridor}
      ${replayPath ? `<polyline points="${replayPath}" fill="none" stroke="#224665" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="0.72" />` : ""}
      ${completedReplayPath ? `<polyline points="${completedReplayPath}" fill="none" stroke="#38bdf8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity="0.98" />` : ""}
      ${conflictTrackHighlight}
      ${alertTrackHighlight}
      ${replayDots}
      ${weatherMarker}
      ${conflictSeverityBands}
      ${crewedTrafficMarkers}
      ${droneTrafficMarkers}
      ${conflictProximityEnvelope}
      ${
        currentMapPoint
          ? `
            ${latestTelemetryHalo}
            <circle cx="${currentMapPoint.x}" cy="${currentMapPoint.y}" r="14" fill="rgba(239,68,68,0.18)" />
            <circle cx="${currentMapPoint.x}" cy="${currentMapPoint.y}" r="7" fill="#ef4444" stroke="#edf3fb" stroke-width="2" />
            ${directionalCue}
          `
          : ""
      }
    </svg>
    <div class="map-window-summary ${toneClass(conflictWindowSummary.tone)}">
      <strong>${escapeHtml(conflictWindowSummary.headline)}</strong>
      <div>${escapeHtml(conflictWindowSummary.detail)}</div>
      <div class="meta">${escapeHtml(conflictWindowSummary.meta)}</div>
    </div>
    <div class="map-window-summary map-envelope-summary ${toneClass(conflictEnvelopeSummary.tone)}">
      <strong>${escapeHtml(conflictEnvelopeSummary.headline)}</strong>
      <div>${escapeHtml(conflictEnvelopeSummary.detail)}</div>
      <div class="meta">${escapeHtml(conflictEnvelopeSummary.meta)}</div>
    </div>
    <div class="map-overlay">
      ${overlays.map((item) => `<div class="overlay-pill">${escapeHtml(item)}</div>`).join("")}
    </div>
    <div class="map-compass">N</div>
  `;
};

const renderMap = () => {
  mapPanel.innerHTML = buildMapMarkup();
};

const renderStatus = () => {
  if (!uiState.planningWorkspace || !uiState.dispatchWorkspace) {
    statusPanel.innerHTML =
      '<div class="empty-state">Load a mission before telemetry and risk status can be evaluated.</div>';
    return;
  }

  const planningWorkspace = uiState.planningWorkspace;
  const dispatchWorkspace = uiState.dispatchWorkspace;
  const currentReplayPoint = activeReplayPoint();
  const latestTelemetry = uiState.latestTelemetry?.telemetry;
  const weatherState = weatherSummary();
  const trafficState = crewedTrafficSummary();
  const droneState = droneTrafficSummary();
  const areaSourceState = areaSourceRefreshSummary();
  const conflictState = conflictAssessmentSummary();
  const advisoryState = conflictAdvisorySummary();
  const replayConflictRelation = currentConflictReplayRelation();
  const primaryConflict = primaryConflictAssessmentItem();
  const primaryConflictOverlay = primaryConflict
    ? conflictOverlayForItem(primaryConflict)
    : null;
  const primaryAdvisory = primaryConflictAdvisory();
  const secondaryAdvisories = secondaryConflictAdvisories();
  const approvalPosture = isPostLaunchMission()
    ? "Completed"
    : planningWorkspace.approval.ready
      ? "Ready"
      : "Blocked";
  const dispatchPosture = isPostLaunchMission()
    ? "Completed"
    : dispatchWorkspace.dispatch.ready
      ? "Ready"
      : "Blocked";
  const launchPreflightPosture = isPostLaunchMission()
    ? "Not applicable"
    : dispatchWorkspace.dispatch.launchPreflight.allowed
      ? "Allowed"
      : "Blocked";
  const alertSignals = (uiState.alerts ?? []).map((alert) => ({
    label: `${alert.alertType} - ${alert.severity}`,
    value: `${alert.status}: ${alert.message}`,
  }));
  const conflictSignals = primaryConflict
    ? [
        {
          label: `${primaryConflict.overlayKind} ${primaryConflict.severity}`,
          value: `${primaryConflict.summary}: ${primaryConflict.explanation}`,
        },
        ...secondaryConflictAssessmentItems().map((conflict) => ({
          label: `Additional conflict ${conflict.overlayLabel}`,
          value: `${formatRangeBearing(conflict.metrics)} | ${conflict.overlayKind === "area_conflict" ? formatVerticalContext(conflict) : `${formatVerticalSeparation(conflict.metrics?.altitudeDeltaFt)} vertical`}`,
        })),
      ]
    : [];
  const riskSignals = [
    ...((planningWorkspace.blockingReasons ?? []).map((reason) => ({
      label: "Planning blocker",
      value: reason,
    }))),
    ...((isPostLaunchMission() ? [] : dispatchWorkspace.dispatch?.blockingReasons ?? []).map((reason) => ({
      label: "Dispatch blocker",
      value: reason,
    }))),
    ...((isPostLaunchMission() ? [] : dispatchWorkspace.dispatch?.missingRequirements ?? []).map((reason) => ({
      label: "Dispatch requirement",
      value: reason,
    }))),
    ...alertSignals,
    ...conflictSignals,
  ];

  statusPanel.innerHTML = `
    <div class="summary-grid">
      <section class="summary-block">
        <h4>Replay State</h4>
        <div class="kv">
          <div class="k">Replay timestamp</div>
          <div>${escapeHtml(formatDateTime(currentReplayPoint?.timestamp))}</div>
          <div class="k">Position</div>
          <div>${escapeHtml(
            currentReplayPoint?.lat != null && currentReplayPoint?.lng != null
              ? `${currentReplayPoint.lat}, ${currentReplayPoint.lng}`
              : "Not recorded",
          )}</div>
          <div class="k">Altitude</div>
          <div>${escapeHtml(
            currentReplayPoint?.altitudeM != null ? `${currentReplayPoint.altitudeM} m` : "Not recorded",
          )}</div>
          <div class="k">Speed</div>
          <div>${escapeHtml(
            currentReplayPoint?.speedMps != null ? `${currentReplayPoint.speedMps} m/s` : "Not recorded",
          )}</div>
          <div class="k">Replay progress</div>
          <div>${escapeHtml(
            replayTrack().length === 0
              ? "0 / 0"
              : `${uiState.replayPlayback.index + 1} / ${replayTrack().length}`,
          )}</div>
          <div class="k">Latest live telemetry</div>
          <div>${escapeHtml(formatDateTime(latestTelemetry?.timestamp))}</div>
        </div>
      </section>
      <section class="summary-block">
        <h4>Operational Posture</h4>
        <div class="kv">
          <div class="k">Approval</div>
          <div>${renderBadge(approvalPosture)}</div>
          <div class="k">Dispatch</div>
          <div>${renderBadge(dispatchPosture)}</div>
          <div class="k">Launch preflight</div>
          <div>${renderBadge(launchPreflightPosture)}</div>
          <div class="k">Approval evidence</div>
          <div>${escapeHtml(planningWorkspace.evidence.latestApprovalEvidenceLink?.id ?? "Missing")}</div>
          <div class="k">Dispatch evidence</div>
          <div>${escapeHtml(dispatchWorkspace.dispatch.latestDispatchEvidenceLink?.id ?? "Missing")}</div>
          <div class="k">Mission risk</div>
          <div>${renderBadge(planningWorkspace.missionRisk?.result ?? "Missing")}</div>
          <div class="k">Airspace state</div>
          <div>${renderBadge(planningWorkspace.airspaceCompliance?.result ?? "Missing")}</div>
          <div class="k">Open alerts</div>
          <div>${escapeHtml(
            String((uiState.alerts ?? []).filter((alert) => alert.status !== "resolved").length),
          )}</div>
          <div class="k">Weather overlay</div>
          <div>${renderBadge(weatherState.label)}</div>
          <div class="k">Wind / temp</div>
          <div>${escapeHtml(
            activeWeatherOverlay()
              ? `${activeWeatherOverlay().metadata?.windSpeedKnots ?? "?"} kt @ ${activeWeatherOverlay().metadata?.windDirectionDegrees ?? "?"}\u00B0 | ${activeWeatherOverlay().metadata?.temperatureC ?? "?"}\u00B0C`
              : "Missing",
          )}</div>
          <div class="k">Precipitation</div>
          <div>${escapeHtml(
            activeWeatherOverlay()?.metadata?.precipitation ?? "Missing",
          )}</div>
          <div class="k">Observed</div>
          <div>${escapeHtml(
            activeWeatherOverlay()
              ? formatDateTime(activeWeatherOverlay().observedAt)
              : "Not recorded",
          )}</div>
          <div class="k">Crewed traffic</div>
          <div>${renderBadge(trafficState.label)}</div>
          <div class="k">Primary contact</div>
          <div>${escapeHtml(
            activeCrewedTrafficOverlays()[0]
              ? `${activeCrewedTrafficOverlays()[0].metadata?.callsign ?? activeCrewedTrafficOverlays()[0].metadata?.trafficId ?? "Unknown"}`
              : "Missing",
          )}</div>
          <div class="k">Heading / speed</div>
          <div>${escapeHtml(
            activeCrewedTrafficOverlays()[0]
              ? `${activeCrewedTrafficOverlays()[0].headingDegrees ?? "?"}\u00B0 | ${activeCrewedTrafficOverlays()[0].speedKnots ?? "?"} kt`
              : "Missing",
          )}</div>
          <div class="k">Altitude</div>
          <div>${escapeHtml(
            activeCrewedTrafficOverlays()[0]
              ? `${activeCrewedTrafficOverlays()[0].geometry?.altitudeMslFt ?? "?"} ft`
              : "Missing",
          )}</div>
          <div class="k">Observed</div>
          <div>${escapeHtml(
            activeCrewedTrafficOverlays()[0]
              ? formatDateTime(activeCrewedTrafficOverlays()[0].observedAt)
              : "Not recorded",
          )}</div>
          <div class="k">Drone traffic</div>
          <div>${renderBadge(droneState.label)}</div>
          <div class="k">Primary drone</div>
          <div>${escapeHtml(
            activeDroneTrafficOverlays()[0]
              ? `${activeDroneTrafficOverlays()[0].metadata?.operatorReference ?? activeDroneTrafficOverlays()[0].metadata?.trafficId ?? "Unknown"}`
              : "Missing",
          )}</div>
          <div class="k">Vehicle / speed</div>
          <div>${escapeHtml(
            activeDroneTrafficOverlays()[0]
              ? `${activeDroneTrafficOverlays()[0].metadata?.vehicleType ?? "Unknown"} | ${activeDroneTrafficOverlays()[0].speedKnots ?? "?"} kt`
              : "Missing",
          )}</div>
          <div class="k">Altitude</div>
          <div>${escapeHtml(
            activeDroneTrafficOverlays()[0]
              ? `${activeDroneTrafficOverlays()[0].geometry?.altitudeMslFt ?? "?"} ft`
              : "Missing",
          )}</div>
          <div class="k">Observed</div>
          <div>${escapeHtml(
            activeDroneTrafficOverlays()[0]
              ? formatDateTime(activeDroneTrafficOverlays()[0].observedAt)
              : "Not recorded",
          )}</div>
          <div class="k">Area source refresh</div>
          <div>${renderBadge(areaSourceState.label)}</div>
          <div class="k">Area refresh detail</div>
          <div>${escapeHtml(areaSourceState.detail)}</div>
          <div class="k">NOTAM geometry</div>
          <div>${escapeHtml(
            primaryConflictOverlay ? areaOverlayNotamGeometryDetail(primaryConflictOverlay) ?? "Not recorded" : "Not recorded",
          )}</div>
          <div class="k">Q-line index summary</div>
          <div>${escapeHtml(
            primaryConflictOverlay ? areaOverlayQLineIndexReviewContext(primaryConflictOverlay) ?? "Not recorded" : "Not recorded",
          )}</div>
          <div class="k">Conflict assessment</div>
          <div>${renderBadge(conflictState.label)}</div>
          <div class="k">Primary conflict</div>
          <div>${escapeHtml(
            primaryConflict?.overlayLabel ?? "Clear",
          )}</div>
          <div class="k">Range / bearing</div>
          <div>${escapeHtml(
            primaryConflict
              ? formatRangeBearing(primaryConflict.metrics)
              : "Not recorded",
          )}</div>
          <div class="k">Time relevance</div>
          <div>${escapeHtml(
            primaryConflict
              ? primaryConflict.overlayKind === "area_conflict"
                ? formatTemporalContext(primaryConflict)
                : "Not applicable"
              : "Not recorded",
          )}</div>
          <div class="k">Vertical context</div>
          <div>${escapeHtml(
            primaryConflict
              ? primaryConflict.overlayKind === "area_conflict"
                ? formatVerticalContext(primaryConflict)
                : formatVerticalSeparation(primaryConflict.metrics?.altitudeDeltaFt)
              : "Not recorded",
          )}</div>
          <div class="k">Assessment time</div>
          <div>${escapeHtml(
            primaryConflict
              ? formatDateTime(primaryConflict.assessedAt)
              : "Not recorded",
          )}</div>
          <div class="k">Advisory presentation</div>
          <div>${renderBadge(advisoryState.label)}</div>
          <div class="k">Recommended attention</div>
          <div>${escapeHtml(
            primaryAdvisory?.recommendation ?? "Clear",
          )}</div>
          <div class="k">Advisory target</div>
          <div>${escapeHtml(
            primaryAdvisory?.relatedObject ?? "None",
          )}</div>
          <div class="k">Replay relation</div>
          <div>${renderBadge(replayConflictRelation.label)}</div>
          <div class="k">Replay relevance detail</div>
          <div>${escapeHtml(replayConflictRelation.detail)}</div>
          <div class="k">Additional advisories</div>
          <div>${escapeHtml(
            secondaryAdvisories.length === 0
              ? "None"
              : `${secondaryAdvisories.length} secondary item(s)`,
          )}</div>
        </div>
      </section>
    </div>
    <div style="margin-top: 14px;">
      ${renderList(riskSignals, "live operation signals")}
    </div>
  `;
};

const renderJumpControls = () => {
  const milestones = replayMilestones();

  if (milestones.length === 0) {
    jumpControlsPanel.innerHTML =
      '<div class="empty-state">No launch, completion, abort, or alert-linked milestones are available for replay jumping yet.</div>';
    return;
  }

  jumpControlsPanel.innerHTML = `
    <div class="jump-control-grid">
      ${milestones
        .map(
          (milestone) => `
            <button
              type="button"
              class="control-button ${toneClass(milestone.tone)}"
              data-jump-timestamp="${escapeHtml(milestone.timestamp)}"
            >
              ${escapeHtml(milestone.label)}
            </button>
          `,
        )
        .join("")}
    </div>
  `;
};

const renderAlertCorrelation = () => {
  const replayPoint = activeReplayPoint();
  const alertWindows = correlatedAlertWindows();
  const nearbyEvents = correlatedTimelineEvents();

  if (!replayPoint) {
    alertCorrelationPanel.innerHTML =
      '<div class="empty-state">Load a mission replay before alert windows and event correlation can be reviewed.</div>';
    return;
  }

  const currentAlerts = alertWindows.filter((alert) => alert.activeAtReplay).slice(0, 3);
  const recentWindows = (currentAlerts.length > 0 ? currentAlerts : alertWindows.slice(0, 3))
    .map(
      (alert) => `
        <article class="alert-window ${toneClass(alert.severity)}">
          <strong>${escapeHtml(alert.alertType.replaceAll("_", " "))} ${escapeHtml(alert.status)}</strong>
          <div>${escapeHtml(alert.message)}</div>
          <div class="alert-window-meta">
            Triggered: ${escapeHtml(formatDateTime(alert.triggeredAt))}<br />
            Resolved: ${escapeHtml(formatDateTime(alert.resolvedAt))}<br />
            Severity: ${escapeHtml(alert.severity)}
          </div>
        </article>
      `,
    )
    .join("");

  alertCorrelationPanel.innerHTML = `
    <div class="stack">
      <section class="correlation-card">
        <h4>Current Replay-Point Alert Context</h4>
        <div class="kv">
          <div class="k">Replay timestamp</div>
          <div>${escapeHtml(formatDateTime(replayPoint.timestamp))}</div>
          <div class="k">Active alerts</div>
          <div>${escapeHtml(
            currentAlerts.length === 0 ? "None at current replay position" : `${currentAlerts.length}`,
          )}</div>
          <div class="k">Window state</div>
          <div>${escapeHtml(
            currentAlerts[0]
              ? `${currentAlerts[0].alertType} ${currentAlerts[0].status}`
              : "No alert window intersects the current replay point",
          )}</div>
        </div>
      </section>
      <section class="correlation-card">
        <h4>Alert Windows</h4>
        <div class="alert-window-list">
          ${
            recentWindows ||
            '<div class="empty-state">No alert windows are available for this mission.</div>'
          }
        </div>
      </section>
      <section class="correlation-card">
        <h4>Nearby Operational Events</h4>
        ${
          nearbyEvents.length === 0
            ? '<div class="empty-state">No nearby mission events were found around the current replay position.</div>'
            : renderList(
                nearbyEvents.map((item) => ({
                  label: `${item.phase.replaceAll("_", " ")} | ${item.type}`,
                  value: `${formatDateTime(item.occurredAt)} | ${item.summary}`,
                })),
                "nearby operational events",
              )
        }
      </section>
    </div>
  `;
};

const renderConflictAssessment = () => {
  const assessment = currentConflictAssessment();
  const conflicts = activeConflictAssessmentItems();
  const primaryConflict = conflicts[0] ?? null;
  const secondaryConflicts = conflicts.slice(1, 4);

  if (!assessment) {
    conflictAssessmentPanel.innerHTML =
      '<div class="empty-state">Conflict assessment has not been loaded for this mission yet.</div>';
    return;
  }

  if (conflicts.length === 0) {
    conflictAssessmentPanel.innerHTML = `
      <div class="empty-state">
        No interpreted crewed or drone traffic conflict candidates are currently assessed.
        Reference telemetry: ${escapeHtml(formatDateTime(assessment.reference?.telemetry?.timestamp))}
      </div>
    `;
    return;
  }

  conflictAssessmentPanel.innerHTML = `
    <div class="stack">
      <section class="correlation-card">
        <h4>Assessment Reference</h4>
        <div class="kv">
          <div class="k">Assessed at</div>
          <div>${escapeHtml(formatDateTime(assessment.assessedAt))}</div>
          <div class="k">Reference telemetry</div>
          <div>${escapeHtml(formatDateTime(assessment.reference?.telemetry?.timestamp))}</div>
          <div class="k">Replay points</div>
          <div>${escapeHtml(String(assessment.reference?.replayPointCount ?? 0))}</div>
        </div>
      </section>
      <section class="correlation-card">
        <h4>Primary Conflict</h4>
        ${
          primaryConflict
            ? `
              <article class="alert-window ${toneClass(primaryConflict.severity)}">
                <strong>${escapeHtml(primaryConflict.summary)}</strong>
                <div>${escapeHtml(primaryConflict.explanation)}</div>
                <div class="alert-window-meta">
                  Source: ${escapeHtml(primaryConflict.relatedSource.provider)} / ${escapeHtml(primaryConflict.relatedSource.sourceType)}<br />
                  Observed: ${escapeHtml(formatDateTime(primaryConflict.overlayObservedAt))}<br />
                  ${
                    primaryConflict.overlayKind === "area_conflict"
                      ? `Area source refresh: ${escapeHtml(areaOverlaySourceRefreshDetail(areaConflictOverlays().find((overlay) => overlay.id === primaryConflict.overlayId)))}
                  <br />
                  NOTAM geometry: ${escapeHtml(areaOverlayNotamGeometryDetail(areaConflictOverlays().find((overlay) => overlay.id === primaryConflict.overlayId)) ?? "Not recorded")}
                  <br />
                  Q-line index summary: ${escapeHtml(areaOverlayQLineIndexReviewContext(areaConflictOverlays().find((overlay) => overlay.id === primaryConflict.overlayId)) ?? "Not recorded")}
                  <br />`
                      : ""
                  }
                  Range / bearing: ${escapeHtml(formatRangeBearing(primaryConflict.metrics))}<br />
                  Time relevance: ${escapeHtml(primaryConflict.overlayKind === "area_conflict" ? formatTemporalContext(primaryConflict) : "Not applicable")}<br />
                  Vertical context: ${escapeHtml(primaryConflict.overlayKind === "area_conflict" ? formatVerticalContext(primaryConflict) : formatVerticalSeparation(primaryConflict.metrics?.altitudeDeltaFt))}<br />
                  Replay relevance: ${escapeHtml(primaryConflict.replayRelevant ? "Current replay window" : `${primaryConflict.replayTimeDeltaSeconds} s from replay cursor`)}
                </div>
              </article>
            `
            : '<div class="empty-state">No primary conflict is currently assessed.</div>'
        }
      </section>
      <section class="correlation-card">
        <h4>Additional Conflicts</h4>
        ${
          secondaryConflicts.length === 0
            ? '<div class="empty-state">No additional conflict candidates are currently assessed.</div>'
            : renderList(
                secondaryConflicts.map((conflict) => ({
                  label: `${conflict.overlayLabel} | ${conflict.severity}`,
                  value: `${formatRangeBearing(conflict.metrics)} | ${conflict.overlayKind === "area_conflict" ? `${formatVerticalContext(conflict)} | ${areaOverlaySourceRefreshDetail(areaConflictOverlays().find((overlay) => overlay.id === conflict.overlayId))}` : `${formatVerticalSeparation(conflict.metrics?.altitudeDeltaFt)} vertical`}`,
                })),
                "additional conflicts",
              )
        }
      </section>
    </div>
  `;
};

const formatSecondaryAdvisoryValue = (advisory) =>
  [
    advisory.recommendation,
    `Authority: ${advisory.authorityRequired}`,
    `Evidence: ${advisory.evidenceAction}`,
    `Acknowledgement: ${advisory.acknowledgementStatus}`,
    `Pilot instruction: ${advisory.pilotInstructionStatus}`,
    advisory.acknowledgement
      ? `Guidance summary: ${advisory.acknowledgement.guidanceSummary}`
      : null,
    advisory.summary,
  ]
    .filter(Boolean)
    .join(" | ");

const auditGuidanceSummary = (advisory) =>
  [
    `Recommended attention: ${advisory.recommendation}`,
    `Rationale: ${advisory.guidanceRationale}`,
    `Do not: ${
      advisory.prohibitedActions.join(" | ") ||
      "No additional constraints recorded"
    }`,
    `Pilot instruction status: ${advisory.pilotInstructionStatus}`,
  ].join(" | ");

const renderConflictAdvisory = () => {
  const advisories = deriveConflictAdvisories();
  const replayConflictRelation = currentConflictReplayRelation();
  const primary = advisories[0] ?? null;
  const secondary = advisories.slice(1, 4);

  if (advisories.length === 0) {
    conflictAdvisoryPanel.innerHTML =
      '<div class="empty-state">No advisory presentation is currently required. The live operations view remains read-only and no automated action is available here.</div>';
    return;
  }

  conflictAdvisoryPanel.innerHTML = `
    <div class="stack">
      <section class="correlation-card">
        <h4>Replay Relation</h4>
        <div class="kv">
          <div class="k">Current state</div>
          <div>${renderBadge(replayConflictRelation.label)}</div>
          <div class="k">Detail</div>
          <div>${escapeHtml(replayConflictRelation.detail)}</div>
        </div>
      </section>
      <section class="correlation-card">
        <h4>Primary Advisory</h4>
        ${
          primary
            ? `
              <article class="alert-window ${toneClass(primary.tone)}">
                <strong>${escapeHtml(primary.headline)}</strong>
                <div>${escapeHtml(primary.reasoning)}</div>
                <div class="alert-window-meta">
                  Recommended attention: ${escapeHtml(primary.recommendation)}<br />
                  Action code: ${escapeHtml(primary.actionCode)}<br />
                  Authority required: ${escapeHtml(primary.authorityRequired)}<br />
                  Acknowledgement required: ${escapeHtml(primary.acknowledgementRequired ? "yes" : "no")}<br />
                  Acknowledgement status: ${escapeHtml(primary.acknowledgementStatus)}<br />
                  Evidence action: ${escapeHtml(primary.evidenceAction)}<br />
                  Pilot instruction status: ${escapeHtml(primary.pilotInstructionStatus)}<br />
                  Related object: ${escapeHtml(primary.relatedObject)}<br />
                  Related source: ${escapeHtml(primary.relatedSource)}<br />
                  Relevance: ${escapeHtml(primary.relevance)}<br />
                  Separation: ${escapeHtml(primary.summary)}
                </div>
                <div class="alert-window-meta">
                  Guidance rationale: ${escapeHtml(primary.guidanceRationale)}
                </div>
                <div class="alert-window-meta">
                  Do not: ${escapeHtml(primary.prohibitedActions.join(" | ") || "No additional constraints recorded")}
                </div>
                ${
                  primary.acknowledgement
                    ? `
                      <div class="alert-window-meta">
                        Audit record: ${escapeHtml(primary.acknowledgement.id)}<br />
                        Role: ${escapeHtml(primary.acknowledgement.acknowledgementRole)}<br />
                        Recorded at: ${escapeHtml(formatDateTime(primary.acknowledgement.createdAt))}<br />
                        Guidance summary: ${escapeHtml(primary.acknowledgement.guidanceSummary)}<br />
                        Pilot instruction status: ${escapeHtml(primary.acknowledgement.pilotInstructionStatus)}<br />
                        Note: ${escapeHtml(primary.acknowledgement.acknowledgementNote ?? "No note recorded")}
                      </div>
                    `
                    : primary.acknowledgementRequired && primary.evidenceAction !== "none"
                      ? `
                        <button
                          type="button"
                          class="action-button"
                          data-acknowledge-conflict="${escapeHtml(primary.id)}"
                          data-overlay-id="${escapeHtml(primary.overlayId)}"
                          data-action-code="${escapeHtml(primary.actionCode)}"
                          data-evidence-action="${escapeHtml(primary.evidenceAction)}"
                          data-acknowledgement-role="${escapeHtml(primary.authorityRequired)}"
                          data-guidance-summary="${escapeHtml(auditGuidanceSummary(primary))}"
                        >
                          Record audit acknowledgement
                        </button>
                        <div class="alert-window-meta">
                          This records operator/supervisor review evidence only. It does not transmit pilot instructions.
                        </div>
                      `
                      : ""
                }
              </article>
            `
            : '<div class="empty-state">No primary advisory is currently derived.</div>'
        }
      </section>
      <section class="correlation-card">
        <h4>Additional Advisories</h4>
        ${
          secondary.length === 0
            ? '<div class="empty-state">No additional advisory items are currently derived.</div>'
            : renderList(
                secondary.map((advisory) => ({
                  label: `${advisory.actionCode} | ${advisory.relatedObject}`,
                  value: formatSecondaryAdvisoryValue(advisory),
                })),
                "additional advisories",
              )
        }
      </section>
    </div>
  `;
};

const loadConflictGuidanceAcknowledgements = async (missionId) => {
  const response = await fetchJson(
    `/missions/${missionId}/conflict-guidance-acknowledgements`,
  );
  uiState.conflictGuidanceAcknowledgements = response.acknowledgements ?? [];
};

const recordConflictGuidanceAcknowledgement = async (button) => {
  const missionId = normalizeMissionId(uiState.missionId);
  if (!hasSelectedMissionId(missionId)) {
    setConnectionState("Load a mission before recording acknowledgement", "tone-warn");
    return;
  }

  button.disabled = true;
  const acknowledgementRole = button.dataset.acknowledgementRole ?? "operator";
  const guidanceSummary = button.dataset.guidanceSummary?.trim() ?? "";
  if (!guidanceSummary) {
    button.disabled = false;
    setConnectionState(
      "Cannot record acknowledgement without guidance summary evidence",
      "tone-bad",
    );
    return;
  }

  const acknowledgedBy =
    window.prompt(
      `Record ${acknowledgementRole} acknowledgement by`,
      acknowledgementRole,
    )?.trim() ?? "";

  if (!acknowledgedBy) {
    button.disabled = false;
    setConnectionState("Acknowledgement cancelled", "tone-warn");
    return;
  }

  const acknowledgementNote =
    window.prompt(
      "Optional audit note",
      "Reviewed in live operations; decision-support advisory only.",
    )?.trim() ?? "";

  try {
    await fetchJson(`/missions/${missionId}/conflict-guidance-acknowledgements`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conflictId: button.dataset.acknowledgeConflict,
        overlayId: button.dataset.overlayId,
        guidanceActionCode: button.dataset.actionCode,
        evidenceAction: button.dataset.evidenceAction,
        acknowledgementRole,
        acknowledgedBy,
        acknowledgementNote,
        guidanceSummary,
      }),
    });

    await loadConflictGuidanceAcknowledgements(missionId);
    renderLiveOperations();
    setConnectionState("Conflict guidance acknowledgement recorded", "tone-ok");
  } catch (error) {
    button.disabled = false;
    if (error?.type === "conflict_guidance_acknowledgement_already_exists") {
      await loadConflictGuidanceAcknowledgements(missionId);
      renderLiveOperations();
    }

    const message =
      error?.type === "conflict_guidance_acknowledgement_already_exists"
        ? "Conflict guidance acknowledgement already recorded for this advisory"
        : error instanceof Error
          ? error.message
          : "Failed to record acknowledgement";
    setConnectionState(message, "tone-bad");
  }
};

const renderTimeline = () => {
  const relevant = correlatedConflictTimelineItems();

  if (relevant.length === 0) {
    timelinePanel.innerHTML =
      '<div class="empty-state">No mission event context is available for this live operations view yet.</div>';
    return;
  }

  timelinePanel.innerHTML = `
    <div class="stack">
      ${relevant
        .map(
          (item) => `
            <article class="timeline-item ${item.conflictRelevant ? "conflict-relevant" : ""} ${item.nearestConflict?.severity === "critical" ? "conflict-critical" : ""}">
              <div class="timeline-time">${escapeHtml(formatDateTime(item.occurredAt))}</div>
              <div class="timeline-phase ${toneClass(item.phase)}">${escapeHtml(
                item.phase.replaceAll("_", " "),
              )}</div>
              <div>
                <div class="timeline-summary">${escapeHtml(item.summary)}</div>
                <div class="timeline-meta">
                  Type: ${escapeHtml(item.type)}<br />
                  Source: ${escapeHtml(item.source)}
                </div>
                <div class="timeline-chip-row">
                  ${
                    item.conflictRelevant
                      ? `<span class="badge ${toneClass(item.nearestConflict?.severity ?? "info")}">Conflict-relevant ${escapeHtml(`${Math.round(item.conflictDeltaSeconds)} s`)}</span>`
                      : ""
                  }
                  ${
                    item.conflictRelevant && item.nearestConflict
                      ? `<span class="badge ${toneClass(item.nearestConflict.severity)}">${escapeHtml(item.nearestConflict.overlayLabel)}</span>`
                      : ""
                  }
                </div>
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
};

const renderLiveOperations = () => {
  renderReplayControls();
  renderOverview();
  renderMap();
  renderJumpControls();
  renderStatus();
  renderAlertCorrelation();
  renderConflictAssessment();
  renderConflictAdvisory();
  renderTimeline();
};

const clearPanels = (message) => {
  overviewPanel.innerHTML = "";
  mapPanel.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  jumpControlsPanel.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  statusPanel.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  alertCorrelationPanel.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  conflictAssessmentPanel.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  conflictAdvisoryPanel.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  timelinePanel.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  renderReplayControls();
};

const renderEntryState = ({
  statusMessage = "No mission selected",
  statusTone = "tone-muted",
  guidance = "Enter a mission UUID or open the mission workspace to choose a mission before loading live operations.",
} = {}) => {
  setConnectionState(statusMessage, statusTone);
  setLoadedMission("");
  overviewPanel.innerHTML = `
    <article class="metric">
      <div class="label">Mission selection</div>
      <div class="value ${toneClass("pending")}">Required</div>
      <div class="meta">${escapeHtml(guidance)}</div>
    </article>
    <article class="metric">
      <div class="label">Generic route</div>
      <div class="value ${toneClass("clear")}">Idle</div>
      <div class="meta">No mission-specific fetch is attempted until a valid mission ID is provided.</div>
    </article>
    <article class="metric">
      <div class="label">Next step</div>
      <div class="value ${toneClass("info")}">Choose mission</div>
      <div class="meta">Use the mission ID field above or open the mission workspace to select a mission.</div>
    </article>
  `;
  mapPanel.innerHTML = `<div class="empty-state">${escapeHtml(guidance)}</div>`;
  jumpControlsPanel.innerHTML =
    '<div class="empty-state">Replay milestones will appear after a mission with replay data is loaded.</div>';
  statusPanel.innerHTML =
    '<div class="empty-state">Telemetry, readiness posture, and overlay status will appear after mission selection.</div>';
  alertCorrelationPanel.innerHTML =
    '<div class="empty-state">Alert timeline correlation becomes available after a mission replay is loaded.</div>';
  conflictAssessmentPanel.innerHTML =
    '<div class="empty-state">Conflict assessment is shown only after a mission with telemetry and overlays is loaded.</div>';
  conflictAdvisoryPanel.innerHTML =
    '<div class="empty-state">Conflict advisory guidance is derived only after a mission is loaded.</div>';
  timelinePanel.innerHTML =
    '<div class="empty-state">Mission event context will appear after mission selection.</div>';
  renderReplayControls();
  renderMissionBrowser();
};

const loadLiveOperationsView = async (missionId) => {
  stopReplayPlayback();
  const normalizedMissionId = normalizeMissionId(missionId);

  if (!hasSelectedMissionId(normalizedMissionId)) {
    resetLiveOperationsState();
    if (!isMissionSpecificRoute()) {
      updateUrl("");
    }
    renderEntryState({
      statusMessage: normalizedMissionId ? "Enter a valid mission UUID" : "No mission selected",
      statusTone: normalizedMissionId ? "tone-warn" : "tone-muted",
      guidance: normalizedMissionId
        ? "The generic live operations route ignores placeholder or invalid mission IDs until a real mission UUID is provided."
        : "Enter a mission UUID or open the mission workspace to choose a mission before loading live operations.",
    });
    return;
  }

  uiState.missionId = normalizedMissionId;
  setLoadedMission(normalizedMissionId);
  setConnectionState("Loading live operations view...", "tone-info");
  updateUrl(normalizedMissionId);

  try {
    const [
      planningResponse,
      dispatchResponse,
      timelineResponse,
      replayResponse,
      latestTelemetryResponse,
      alertsResponse,
      externalOverlayResponse,
      conflictAssessmentResponse,
      conflictGuidanceAcknowledgementsResponse,
    ] = await Promise.all([
      fetchJson(`/missions/${normalizedMissionId}/planning-workspace`),
      fetchJson(`/missions/${normalizedMissionId}/dispatch-workspace`),
      fetchJson(`/missions/${normalizedMissionId}/operations-timeline`),
      fetchJson(`/missions/${normalizedMissionId}/replay`),
      fetchJson(`/missions/${normalizedMissionId}/telemetry/latest`),
      fetchJson(`/missions/${normalizedMissionId}/alerts`),
      fetchJson(`/missions/${normalizedMissionId}/external-overlays`),
      fetchJson(`/missions/${normalizedMissionId}/conflict-assessment`),
      fetchJson(`/missions/${normalizedMissionId}/conflict-guidance-acknowledgements`),
    ]);

    uiState.planningWorkspace = planningResponse.workspace;
    uiState.dispatchWorkspace = dispatchResponse.workspace;
    uiState.timeline = timelineResponse.timeline;
    uiState.replay = replayResponse;
    uiState.latestTelemetry = latestTelemetryResponse;
    uiState.alerts = alertsResponse.alerts ?? [];
    uiState.externalOverlays = externalOverlayResponse.overlays ?? [];
    uiState.conflictAssessment = conflictAssessmentResponse;
    uiState.conflictGuidanceAcknowledgements =
      conflictGuidanceAcknowledgementsResponse.acknowledgements ?? [];
    uiState.replayPlayback.index = 0;
    renderMissionBrowser();
    renderLiveOperations();
    setConnectionState("Live operations view loaded", "tone-ok");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load live operations view";
    uiState.planningWorkspace = null;
    uiState.dispatchWorkspace = null;
    uiState.timeline = null;
    uiState.replay = null;
    uiState.latestTelemetry = null;
    uiState.alerts = [];
    uiState.externalOverlays = [];
    uiState.conflictAssessment = null;
    uiState.conflictGuidanceAcknowledgements = [];
    uiState.replayPlayback.index = 0;
    renderMissionBrowser();
    clearPanels(message);
    setConnectionState(message, "tone-bad");
  }
};

loadButton.addEventListener("click", () => {
  loadLiveOperationsView(normalizeMissionId(missionIdInput.value));
});

missionIdInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadLiveOperationsView(normalizeMissionId(missionIdInput.value));
  }
});

missionSearchButton?.addEventListener("click", () => {
  loadMissionList(normalizeMissionId(missionSearchInput?.value ?? ""));
});

missionSearchInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadMissionList(normalizeMissionId(missionSearchInput.value));
  }
});

replaySlider.addEventListener("input", () => {
  stopReplayPlayback();
  setReplayIndex(Number(replaySlider.value));
  renderLiveOperations();
});

replayPlayButton.addEventListener("click", () => {
  startReplayPlayback();
});

replayPauseButton.addEventListener("click", () => {
  stopReplayPlayback();
  renderReplayControls();
});

replayStepBackButton.addEventListener("click", () => {
  stopReplayPlayback();
  setReplayIndex(uiState.replayPlayback.index - 1);
  renderLiveOperations();
});

replayStepForwardButton.addEventListener("click", () => {
  stopReplayPlayback();
  setReplayIndex(uiState.replayPlayback.index + 1);
  renderLiveOperations();
});

replaySpeedSelect.addEventListener("change", () => {
  const nextSpeed = Number(replaySpeedSelect.value);
  uiState.replayPlayback.speed = Number.isFinite(nextSpeed) && nextSpeed > 0 ? nextSpeed : 1;

  if (uiState.replayPlayback.playing) {
    startReplayPlayback();
    return;
  }

  renderReplayControls();
});

jumpControlsPanel.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const timestamp = target.dataset.jumpTimestamp;
  if (!timestamp) {
    return;
  }

  const nextIndex = findNearestReplayIndexForTime(timestamp);
  if (nextIndex == null) {
    return;
  }

  stopReplayPlayback();
  setReplayIndex(nextIndex);
  renderLiveOperations();
});

conflictAdvisoryPanel.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const button = target.closest("[data-acknowledge-conflict]");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  recordConflictGuidanceAcknowledgement(button);
});

openWorkspaceButton.addEventListener("click", () => {
  const missionId = normalizeMissionId(missionIdInput.value);
  const target = hasSelectedMissionId(missionId)
    ? `/operator/missions/${encodeURIComponent(missionId)}`
    : "/operator/mission-workspace";
  window.location.assign(target);
});

openReplayApiButton.addEventListener("click", () => {
  const missionId = normalizeMissionId(missionIdInput.value);
  if (!hasSelectedMissionId(missionId)) {
    setConnectionState("Enter a valid mission UUID before opening replay JSON", "tone-warn");
    return;
  }

  window.open(`/missions/${missionId}/replay`, "_blank", "noopener");
});

window.addEventListener("beforeunload", () => {
  stopReplayPlayback();
});

const initialMissionId = normalizeMissionId(getMissionIdFromLocation());
if (initialMissionId) {
  missionIdInput.value = initialMissionId;
}

loadMissionList();

if (hasSelectedMissionId(initialMissionId)) {
  loadLiveOperationsView(initialMissionId);
} else {
  renderEntryState();
}


