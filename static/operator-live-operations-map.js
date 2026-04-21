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

const uiState = {
  missionId: "",
  planningWorkspace: null,
  dispatchWorkspace: null,
  timeline: null,
  replay: null,
  latestTelemetry: null,
  alerts: [],
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
    text.includes("missing") ||
    text.includes("draft") ||
    text.includes("submitted")
  ) {
    return "tone-warn";
  }

  if (
    text.includes("blocked") ||
    text.includes("rejected") ||
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
    throw new Error(payload?.error?.message || `Request failed with ${response.status}`);
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

const missionDisplayName = (mission) =>
  mission?.missionPlanId || mission?.id || "Unknown mission";

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
  const pathMatch = window.location.pathname.match(/^\/operator\/missions\/([^/]+)\/live-operations$/);
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

const buildOverlayCards = () => {
  const planningWorkspace = uiState.planningWorkspace;
  const dispatchWorkspace = uiState.dispatchWorkspace;
  const cards = [
    summarizeRiskState(planningWorkspace),
    summarizeAirspaceState(planningWorkspace),
    summarizeReadinessState(planningWorkspace, dispatchWorkspace),
    summarizeDispatchState(dispatchWorkspace),
    summarizeTelemetryAlerts(uiState.alerts),
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

const renderOverview = () => {
  const planningWorkspace = uiState.planningWorkspace;
  const dispatchWorkspace = uiState.dispatchWorkspace;
  const mission = planningWorkspace?.mission ?? dispatchWorkspace?.mission;
  const replayCount = uiState.replay?.replay?.length ?? 0;
  const latestTelemetry = uiState.latestTelemetry?.telemetry;
  const timelineCount = uiState.timeline?.items?.length ?? 0;
  const openAlertCount = (uiState.alerts ?? []).filter((alert) => alert.status !== "resolved").length;

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
      <div class="label">Latest telemetry</div>
      <div class="value ${toneClass(latestTelemetry ? "present" : "missing")}">${escapeHtml(
        latestTelemetry ? formatDateTime(latestTelemetry.timestamp) : "Missing",
      )}</div>
      <div class="meta">Altitude: ${escapeHtml(
        latestTelemetry?.altitudeM != null ? `${latestTelemetry.altitudeM} m` : "Not recorded",
      )}</div>
    </article>
    <article class="metric">
      <div class="label">Timeline coverage</div>
      <div class="value">${escapeHtml(String(timelineCount))}</div>
      <div class="meta">Mission narrative items across planning, approval, dispatch, flight, and post-operation.</div>
    </article>
    <article class="metric">
      <div class="label">Active alerts</div>
      <div class="value ${toneClass(openAlertCount > 0 ? "warning" : "clear")}">${escapeHtml(String(openAlertCount))}</div>
      <div class="meta">Open telemetry-linked alerts currently associated with the selected mission.</div>
    </article>
  `;
};

const buildMapMarkup = () => {
  const replayPoints = uiState.replay?.replay ?? [];
  const latestTelemetry = uiState.latestTelemetry?.telemetry ?? null;
  const points = replayPoints
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
    .concat(
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

  const replayPath = replayPoints
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
    .map((point) => {
      const projected = toPoint(Number(point.lat), Number(point.lng));
      return `${projected.x},${projected.y}`;
    })
    .join(" ");

  const replayDots = replayPoints
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
    .map((point, index) => {
      const projected = toPoint(Number(point.lat), Number(point.lng));
      return `
        <circle cx="${projected.x}" cy="${projected.y}" r="${index === 0 ? 6 : 4}" fill="${
          index === 0 ? "#22c55e" : "#38bdf8"
        }" opacity="${index === 0 ? "1" : "0.82"}" />
      `;
    })
    .join("");

  const latestPoint =
    latestTelemetry &&
    Number.isFinite(latestTelemetry.lat) &&
    Number.isFinite(latestTelemetry.lng)
      ? toPoint(Number(latestTelemetry.lat), Number(latestTelemetry.lng))
      : null;

  const overlays = [
    `Replay points ${replayPoints.length}`,
    latestTelemetry ? `Latest telemetry ${formatDateTime(latestTelemetry.timestamp)}` : "Latest telemetry missing",
    uiState.dispatchWorkspace?.dispatch?.ready ? "Dispatch ready" : "Dispatch blocked",
    summarizeRiskState(uiState.planningWorkspace).label,
    summarizeAirspaceState(uiState.planningWorkspace).label,
  ];

  const openAlerts = (uiState.alerts ?? []).filter((alert) => alert.status !== "resolved");
  const legendItems = [
    "Cyan track replay",
    "Red marker latest telemetry",
    `Open alerts ${openAlerts.length}`,
  ];

  return `
    <div class="map-grid"></div>
    <div class="map-legend">
      ${legendItems.map((item) => `<div class="overlay-pill">${escapeHtml(item)}</div>`).join("")}
    </div>
    <div class="map-alert-stack">
      ${buildOverlayCards()}
    </div>
    <svg class="map-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-label="Mission live operations map">
      ${replayPath ? `<polyline points="${replayPath}" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="0.92" />` : ""}
      ${replayDots}
      ${
        latestPoint
          ? `
            <circle cx="${latestPoint.x}" cy="${latestPoint.y}" r="14" fill="rgba(239,68,68,0.18)" />
            <circle cx="${latestPoint.x}" cy="${latestPoint.y}" r="7" fill="#ef4444" stroke="#edf3fb" stroke-width="2" />
          `
          : ""
      }
    </svg>
    <div class="map-overlay">
      ${overlays.map((item) => `<div class="overlay-pill">${escapeHtml(item)}</div>`).join("")}
    </div>
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
  const latestTelemetry = uiState.latestTelemetry?.telemetry;
  const alertSignals = (uiState.alerts ?? []).map((alert) => ({
    label: `${alert.alertType} - ${alert.severity}`,
    value: `${alert.status}: ${alert.message}`,
  }));
  const riskSignals = [
    ...((planningWorkspace.blockingReasons ?? []).map((reason) => ({
      label: "Planning blocker",
      value: reason,
    }))),
    ...((dispatchWorkspace.dispatch?.blockingReasons ?? []).map((reason) => ({
      label: "Dispatch blocker",
      value: reason,
    }))),
    ...((dispatchWorkspace.dispatch?.missingRequirements ?? []).map((reason) => ({
      label: "Dispatch requirement",
      value: reason,
    }))),
    ...alertSignals,
  ];

  statusPanel.innerHTML = `
    <div class="summary-grid">
      <section class="summary-block">
        <h4>Telemetry State</h4>
        <div class="kv">
          <div class="k">Timestamp</div>
          <div>${escapeHtml(formatDateTime(latestTelemetry?.timestamp))}</div>
          <div class="k">Position</div>
          <div>${escapeHtml(
            latestTelemetry?.lat != null && latestTelemetry?.lng != null
              ? `${latestTelemetry.lat}, ${latestTelemetry.lng}`
              : "Not recorded",
          )}</div>
          <div class="k">Altitude</div>
          <div>${escapeHtml(
            latestTelemetry?.altitudeM != null ? `${latestTelemetry.altitudeM} m` : "Not recorded",
          )}</div>
          <div class="k">Speed</div>
          <div>${escapeHtml(
            latestTelemetry?.speedMps != null ? `${latestTelemetry.speedMps} m/s` : "Not recorded",
          )}</div>
        </div>
      </section>
      <section class="summary-block">
        <h4>Operational Posture</h4>
        <div class="kv">
          <div class="k">Approval</div>
          <div>${renderBadge(planningWorkspace.approval.ready ? "Ready" : "Blocked")}</div>
          <div class="k">Dispatch</div>
          <div>${renderBadge(dispatchWorkspace.dispatch.ready ? "Ready" : "Blocked")}</div>
          <div class="k">Launch preflight</div>
          <div>${renderBadge(dispatchWorkspace.dispatch.launchPreflight.allowed ? "Allowed" : "Blocked")}</div>
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
        </div>
      </section>
    </div>
    <div style="margin-top: 14px;">
      ${renderList(riskSignals, "live operation signals")}
    </div>
  `;
};

const renderTimeline = () => {
  const items = uiState.timeline?.items ?? [];
  const relevant = items.slice(-8).reverse();

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
            <article class="timeline-item">
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
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
};

const clearPanels = (message) => {
  overviewPanel.innerHTML = "";
  mapPanel.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  statusPanel.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  timelinePanel.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
};

const loadLiveOperationsView = async (missionId) => {
  if (!missionId) {
    uiState.missionId = "";
    uiState.planningWorkspace = null;
    uiState.dispatchWorkspace = null;
    uiState.timeline = null;
    uiState.replay = null;
    uiState.latestTelemetry = null;
    uiState.alerts = [];
    setLoadedMission("");
    setConnectionState("Enter a mission UUID", "tone-warn");
    clearPanels("Enter a mission UUID to load the live operations view.");
    return;
  }

  uiState.missionId = missionId;
  setLoadedMission(missionId);
  setConnectionState("Loading live operations view...", "tone-info");
  updateUrl(missionId);

  try {
    const [
      planningResponse,
      dispatchResponse,
      timelineResponse,
      replayResponse,
      latestTelemetryResponse,
      alertsResponse,
    ] = await Promise.all([
      fetchJson(`/missions/${missionId}/planning-workspace`),
      fetchJson(`/missions/${missionId}/dispatch-workspace`),
      fetchJson(`/missions/${missionId}/operations-timeline`),
      fetchJson(`/missions/${missionId}/replay`),
      fetchJson(`/missions/${missionId}/telemetry/latest`),
      fetchJson(`/missions/${missionId}/alerts`),
    ]);

    uiState.planningWorkspace = planningResponse.workspace;
    uiState.dispatchWorkspace = dispatchResponse.workspace;
    uiState.timeline = timelineResponse.timeline;
    uiState.replay = replayResponse;
    uiState.latestTelemetry = latestTelemetryResponse;
    uiState.alerts = alertsResponse.alerts ?? [];

    renderOverview();
    renderMap();
    renderStatus();
    renderTimeline();
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
    clearPanels(message);
    setConnectionState(message, "tone-bad");
  }
};

loadButton.addEventListener("click", () => {
  loadLiveOperationsView(missionIdInput.value.trim());
});

missionIdInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadLiveOperationsView(missionIdInput.value.trim());
  }
});

openWorkspaceButton.addEventListener("click", () => {
  const missionId = missionIdInput.value.trim();
  const target = missionId
    ? `/operator/missions/${encodeURIComponent(missionId)}`
    : "/operator/mission-workspace";
  window.location.assign(target);
});

openReplayApiButton.addEventListener("click", () => {
  const missionId = missionIdInput.value.trim();
  if (!missionId) {
    setConnectionState("Enter a mission UUID before opening replay JSON", "tone-warn");
    return;
  }

  window.open(`/missions/${missionId}/replay`, "_blank", "noopener");
});

const initialMissionId = getMissionIdFromLocation();
if (initialMissionId) {
  missionIdInput.value = initialMissionId;
}

loadLiveOperationsView(initialMissionId);
