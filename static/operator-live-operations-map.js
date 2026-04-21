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

const uiState = {
  missionId: "",
  planningWorkspace: null,
  dispatchWorkspace: null,
  timeline: null,
  replay: null,
  latestTelemetry: null,
  alerts: [],
  externalOverlays: [],
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

const weatherOverlays = () =>
  (uiState.externalOverlays ?? []).filter((overlay) => overlay.kind === "weather");

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
      : `${uiState.replayPlayback.index + 1} / ${pointCount} · ${uiState.replayPlayback.speed}x`;
  replayMarkers.innerHTML =
    pointCount === 0 || replayStart == null || replayEnd == null
      ? ""
      : (uiState.alerts ?? [])
          .map((alert) => {
            const markerTime = Date.parse(alert.triggeredAt);
            if (!Number.isFinite(markerTime)) {
              return "";
            }

            const left = ((markerTime - replayStart) / replaySpan) * 100;
            return `<span class="replay-marker ${escapeHtml(
              alert.severity,
            )}" style="left:${Math.max(0, Math.min(left, 100))}%"></span>`;
          })
          .join("");
};

const missionDisplayName = (mission) =>
  mission?.missionPlanId || mission?.id || "Unknown mission";

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
    detail: `${metadata.windSpeedKnots ?? "?"} kt @ ${metadata.windDirectionDegrees ?? "?"}° · ${metadata.temperatureC ?? "?"}°C · observed ${formatDateTime(overlay.observedAt)}`,
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
  const cards = [
    summarizeRiskState(planningWorkspace),
    summarizeAirspaceState(planningWorkspace),
    summarizeReadinessState(planningWorkspace, dispatchWorkspace),
    summarizeDispatchState(dispatchWorkspace),
    weatherSummary(),
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
          ? `${weatherMeta.temperatureC}°C at ${formatDateTime(activeWeather.observedAt)}`
          : "No weather overlay loaded for this mission.",
      )}</div>
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
  ];

  const openAlerts = (uiState.alerts ?? []).filter((alert) => alert.status !== "resolved");
  const legendItems = [
    "Cyan track replay",
    "Red marker latest telemetry",
    `Open alerts ${openAlerts.length}`,
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
  const mapRiskSeverity = [highestAlertSeverity, readinessState.tone, dispatchState.tone, riskState.tone, airspaceState.tone]
    .sort((left, right) => severityRank(right) - severityRank(left))[0];
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
      ${alertTrackHighlight}
      ${replayDots}
      ${weatherMarker}
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
          <div class="k">Weather overlay</div>
          <div>${renderBadge(weatherState.label)}</div>
          <div class="k">Wind / temp</div>
          <div>${escapeHtml(
            activeWeatherOverlay()
              ? `${activeWeatherOverlay().metadata?.windSpeedKnots ?? "?"} kt @ ${activeWeatherOverlay().metadata?.windDirectionDegrees ?? "?"}° · ${activeWeatherOverlay().metadata?.temperatureC ?? "?"}°C`
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
                  label: `${item.phase.replaceAll("_", " ")} · ${item.type}`,
                  value: `${formatDateTime(item.occurredAt)} · ${item.summary}`,
                })),
                "nearby operational events",
              )
        }
      </section>
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

const renderLiveOperations = () => {
  renderReplayControls();
  renderOverview();
  renderMap();
  renderJumpControls();
  renderStatus();
  renderAlertCorrelation();
  renderTimeline();
};

const clearPanels = (message) => {
  overviewPanel.innerHTML = "";
  mapPanel.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  jumpControlsPanel.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  statusPanel.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  alertCorrelationPanel.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  timelinePanel.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  renderReplayControls();
};

const loadLiveOperationsView = async (missionId) => {
  stopReplayPlayback();

  if (!missionId) {
    uiState.missionId = "";
    uiState.planningWorkspace = null;
    uiState.dispatchWorkspace = null;
    uiState.timeline = null;
    uiState.replay = null;
    uiState.latestTelemetry = null;
    uiState.alerts = [];
    uiState.externalOverlays = [];
    uiState.replayPlayback.index = 0;
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
      externalOverlayResponse,
    ] = await Promise.all([
      fetchJson(`/missions/${missionId}/planning-workspace`),
      fetchJson(`/missions/${missionId}/dispatch-workspace`),
      fetchJson(`/missions/${missionId}/operations-timeline`),
      fetchJson(`/missions/${missionId}/replay`),
      fetchJson(`/missions/${missionId}/telemetry/latest`),
      fetchJson(`/missions/${missionId}/alerts`),
      fetchJson(`/missions/${missionId}/external-overlays?kind=weather`),
    ]);

    uiState.planningWorkspace = planningResponse.workspace;
    uiState.dispatchWorkspace = dispatchResponse.workspace;
    uiState.timeline = timelineResponse.timeline;
    uiState.replay = replayResponse;
    uiState.latestTelemetry = latestTelemetryResponse;
    uiState.alerts = alertsResponse.alerts ?? [];
    uiState.externalOverlays = externalOverlayResponse.overlays ?? [];
    uiState.replayPlayback.index = 0;
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
    uiState.replayPlayback.index = 0;
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

window.addEventListener("beforeunload", () => {
  stopReplayPlayback();
});

const initialMissionId = getMissionIdFromLocation();
if (initialMissionId) {
  missionIdInput.value = initialMissionId;
}

loadLiveOperationsView(initialMissionId);
