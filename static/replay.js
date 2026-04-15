   import { renderHud } from "./ui/hud.js";

    (async () => {
      // =========================
      // CONFIG
      // =========================
      const DEBUG = false;

      const flight_id = "3422422e-f6b4-4059-8de4-93145daecddc";
      const API_URL = `http://localhost:5000/api/fsms/replay/${flight_id}`;
      const AIRSPACE_URL = `/api/airspace/by-flight/${flight_id}?buffer_m=5000`;
      const COMPLIANCE_URL = `/api/compliance/airspace/by-flight/${flight_id}`;
      const MAP_KEY = "lxT2mb9w5c89C9E9kziZ";

      const TREND_SECONDS = 10;
      const MAX_PREDICT_DIST = 500;
      const MAX_PREDICT_SECONDS = 60;
      const STARTUP_MUTED_UNTIL_MS = 2000;
      const MAX_INTERPOLATION_GAP_MS = 15000;

      const MAX_EVENT_LOG_ITEMS = 100;
      const MAX_EVENT_LOG_STORE = 1000;

      const FETCH_TIMEOUT_MS = 10000;
      const FETCH_RETRIES = 2;
      const PREDICTION_RECALC_INTERVAL_MS = 150;
      const MIN_SPEED_FOR_PREDICTION_MPS = 0.5;
      const MIN_MOVEMENT_FOR_RECALC_M = 3;
      const MIN_HEADING_DELTA_FOR_RECALC_DEG = 2;
      const MIN_SPEED_DELTA_FOR_RECALC_MPS = 0.75;

      let destroyed = false;
      let mapReady = false;
      let mapStyleReady = false;
      let lastPredictionCalcMs = -Infinity;
      let lastPredictionInputs = null;
      let cachedPredictionResult = {
        futurePath: [],
        predictiveEnvelope: null,
        predictiveEnvelopeConflicts: [],
        boundaryPrediction: null,
        conflict4D: null,
        verticalTtb: null
      };

      function debugLog(...args) {
        if (DEBUG) console.log("[FSMS]", ...args);
      }

      function debugWarn(...args) {
        console.warn("[FSMS]", ...args);
      }

      window.addEventListener("error", (event) => {
        console.error("[FSMS] Uncaught error:", event.error || event.message || event);
      });

      window.addEventListener("unhandledrejection", (event) => {
        console.error("[FSMS] Unhandled promise rejection:", event.reason || event);
      });

      window.addEventListener("beforeunload", () => {
        destroyed = true;
        try {
          map.remove();
        } catch {}
      });

      function destroyGuard() {
        return destroyed || !map || !mapReady;
      }

      function safeJsonClone(obj, fallback = null) {
        try {
          return structuredClone(obj);
        } catch {
          try {
            return JSON.parse(JSON.stringify(obj));
          } catch {
            return fallback;
          }
        }
      }

     function renderScenarioDetailPanel(scenario) {
      if (!scenario) {
        return "";
      }

  const detail = scenario.detail || {};

  return `
    <div class="side-panel" id="detailPanel">
      <div class="side-panel-header">
        <h3 style="margin: 0;">${scenario.name ?? "Scenario Detail"}</h3>
        <button class="side-panel-close" onclick="closeScenarioPanel()" aria-label="Close panel">&times;</button>
      </div>

      <div style="margin-bottom: 12px;">
        <span class="badge ${scenario.classification ?? ""}">
          ${scenario.classification ?? "-"}
        </span>
      </div>

      <div class="detail-grid">
        <div class="detail-label">Lead Time</div>
        <div class="detail-value">${scenario.leadTime ?? "-"}</div>

        <div class="detail-label">First Alert</div>
        <div class="detail-value">${detail.firstAlert ?? "-"}</div>

        <div class="detail-label">First Warning</div>
        <div class="detail-value">${detail.firstWarning ?? scenario.firstWarning ?? "-"}</div>

        <div class="detail-label">First Truth Event</div>
        <div class="detail-value">${detail.firstTruthEvent ?? scenario.firstTruthEvent ?? "-"}</div>

        <div class="detail-label">First Breach</div>
        <div class="detail-value">${detail.firstBreach ?? "-"}</div>

        <div class="detail-label">Lead Steps</div>
        <div class="detail-value">${detail.leadSteps ?? "-"}</div>

        <div class="detail-label">Lead Seconds</div>
        <div class="detail-value">${detail.leadSeconds ?? "-"}</div>

        <div class="detail-label">Reasoning</div>
        <div class="detail-value">${detail.reasoning ?? "-"}</div>
      </div>
    </div>
  `;
}

function selectScenario(scenarioId) {
  activeScenarioId = scenarioId;
  renderScenarioList();
  renderScenarioPanel();
}

function closeScenarioPanel() {
  activeScenarioId = null;
  renderScenarioList();
  renderScenarioPanel();
}

function toggleSummaryCard(cardId) {
  const card = document.getElementById(cardId);
  if (!card) return;

  const toggle = card.querySelector(".summary-card__toggle");
  const body = card.querySelector(".summary-card__body");
  const icon = card.querySelector(".summary-card__icon");

  if (!toggle || !body) return;

  const isExpanded = card.classList.contains("is-expanded");

  if (isExpanded) {
    card.classList.remove("is-expanded");
    card.classList.add("is-collapsed");
    toggle.setAttribute("aria-expanded", "false");
    body.hidden = true;
    if (icon) icon.textContent = "+";
  } else {
    card.classList.remove("is-collapsed");
    card.classList.add("is-expanded");
    toggle.setAttribute("aria-expanded", "true");
    body.hidden = false;
    if (icon) icon.textContent = "–";
  }
}

window.selectScenario = selectScenario;
window.closeScenarioPanel = closeScenarioPanel;
window.toggleSummaryCard = toggleSummaryCard;


function positionScenarioPanel() {
  const panel = document.getElementById("detailPanel");
  const summaryCard = document.getElementById("card-scenarios");
  if (!panel || !summaryCard) return;

  const rect = summaryCard.getBoundingClientRect();
  const gap = 16;

  panel.style.position = "fixed";
  panel.style.top = `${rect.top}px`;
  panel.style.left = `${rect.right + gap}px`;
  panel.style.width = "320px";
  panel.style.maxHeight = `${rect.height}px`;

  const viewportRight = window.innerWidth - 20;
  const panelWidth = 320;

  if (rect.right + gap + panelWidth > viewportRight) {
    panel.style.left = `${window.innerWidth - panelWidth - 20}px`;
  }
}

function formatDateOnly(value) {
  if (!value) return "Unknown";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString();
}

function formatTimeOnly(value) {
  if (!value) return "Unknown";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatDateTime(value) {
  if (!value) return "Unknown";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function updateScenarioSummaryMeta({
  flightId,
  flightTimestamp,
  reportCreatedAt,
  lastEventTime,
  version
} = {}) {
  const flightEl = document.getElementById("summary-flight");
  const flightDateEl = document.getElementById("summary-flight-date");
  const flightTimeEl = document.getElementById("summary-flight-time");
  const reportCreatedEl = document.getElementById("summary-report-created");
  const lastEventTimeEl = document.getElementById("summary-last-event-time");
  const versionEl = document.getElementById("summary-version");

  if (flightEl) {
    flightEl.textContent = `Flight: ${flightId || "Unknown"}`;
  }

  if (flightDateEl) {
    flightDateEl.textContent = `Flight date: ${formatDateOnly(flightTimestamp)}`;
  }

  if (flightTimeEl) {
    flightTimeEl.textContent = `Flight time: ${formatTimeOnly(flightTimestamp)}`;
  }

  if (reportCreatedEl) {
    reportCreatedEl.textContent = `Report created: ${formatDateTime(reportCreatedAt)}`;
  }

  if (lastEventTimeEl) {
    lastEventTimeEl.textContent = `Last event time: ${formatDateTime(lastEventTime)}`;
  }

  if (versionEl) {
    versionEl.textContent = `Report version: ${version || "Unknown"}`;
  }
}

function renderScenarioPanel() {
  const existing = document.getElementById("detailPanel");
  if (existing) {
    existing.remove();
  }

  const activeScenario =
    latestScenarios.find(s => s.scenario_id === activeScenarioId) || null;

  if (!activeScenario) return;

  document.body.insertAdjacentHTML("beforeend", renderScenarioDetailPanel(activeScenario));
  positionScenarioPanel();
}

window.addEventListener("resize", positionScenarioPanel);

      // =========================
      // DOM
      // =========================
      const slider = document.getElementById("slider");
      const playBtn = document.getElementById("play");
      const speedSel = document.getElementById("speed");
      const hud = document.getElementById("hud");
      const zoomFlightBtn = document.getElementById("zoomFlight");
      const zoomAirspaceBtn = document.getElementById("zoomAirspace");
      const zoomBothBtn = document.getElementById("zoomBoth");
      const eventLogRoot = document.getElementById("event-log");
      const eventLogStatus = document.getElementById("event-log-status");
      const warnRoot = document.getElementById("warn-strip-root");

      // =========================
      // SAFE HELPERS
      // =========================
      const isFiniteNumber = (v) => Number.isFinite(Number(v));
      const toNumber = (v, fallback = 0) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : fallback;
      };
      const toNullableNumber = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };
      const toStringSafe = (v, fallback = "") => {
        if (v === null || v === undefined) return fallback;
        return String(v);
      };
      const toArray = (v) => Array.isArray(v) ? v : [];
      const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
      const clamp01 = (v) => clamp(v, 0, 1);

      function safeDateMs(value) {
        if (!value) return null;
        const d = new Date(value).getTime();
        return Number.isFinite(d) ? d : null;
      }

      function normalizeIso(value) {
        const ms = safeDateMs(value);
        return ms === null ? null : new Date(ms).toISOString();
      }

      function escapeHtml(value) {
        return String(value ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
      }

      function isValidLngLat(pos) {
        return !!pos &&
          Number.isFinite(pos.lng) &&
          Number.isFinite(pos.lat) &&
          pos.lng >= -180 &&
          pos.lng <= 180 &&
          pos.lat >= -90 &&
          pos.lat <= 90;
      }

      function fmtM(v) {
        const n = toNullableNumber(v);
        return n === null ? "—" : `${n.toFixed(1)} m`;
      }

      function fmtLimit(v) {
        const n = toNullableNumber(v);
        if (n === null) return "—";
        if (Math.abs(n - 121.92) < 2) return "120.0 m (400 ft)";
        const ft = n * 3.28084;
        return `${n.toFixed(1)} m (${Math.round(ft)} ft)`;
      }

      function marginToPct(m) {
        const n = toNullableNumber(m);
        if (n === null) return 0;
        return clamp(n, 0, 100);
      }

      function formatSimTime(ms) {
        const totalSeconds = Math.max(0, Math.floor((ms || 0) / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const tenths = Math.floor(((ms || 0) % 1000) / 100);
        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
      }

      function sigmoid(x, center, width) {
        if (!Number.isFinite(x) || !Number.isFinite(center) || !Number.isFinite(width) || width === 0) return 0;
        return 1 / (1 + Math.exp((x - center) / width));
      }

      function smoothValue(previous, next, alpha = 0.2) {
        const prev = toNullableNumber(previous);
        const nxt = toNullableNumber(next);
        if (prev === null) return nxt ?? 0;
        if (nxt === null) return prev;
        return prev + alpha * (nxt - prev);
      }

      function normalizeHeading(deg) {
        return ((toNumber(deg) % 360) + 360) % 360;
      }

      function normalizeAngle180(deg) {
        return ((toNumber(deg) + 180) % 360 + 360) % 360 - 180;
      }

      function vsArrow(vz) {
        const n = toNullableNumber(vz);
        if (n === null) return "—";
        if (n > 0.15) return "↑";
        if (n < -0.15) return "↓";
        return "→";
      }

      function safeSetGeojsonData(map, sourceId, data) {
        try {
          const src = map.getSource(sourceId);
          if (src && typeof src.setData === "function") {
            src.setData(data);
          }
        } catch (err) {
          console.warn(`Failed to set source data for ${sourceId}:`, err);
        }
      }

      function safeSetLayerVisibility(map, layerId, visible) {
        try {
          if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
          }
        } catch (err) {
          console.warn(`Failed to set layer visibility for ${layerId}:`, err);
        }
      }

      function safeSetFilter(map, layerId, filter) {
        try {
          if (map.getLayer(layerId)) {
            map.setFilter(layerId, filter);
          }
        } catch (err) {
          console.warn(`Failed to set filter for ${layerId}:`, err);
        }
      }

      // =========================
      // STATE
      // =========================
      let startupMuted = true;

      const FEATURES = {
        trend: true,
        prediction: true,
        envelope: false,
        cone: false,
        kalman: false,
        vectors: false
      };

      let playing = false;
      let speed = 1;
      let simElapsed = 0;
      let lastFrame = null;
      let currentIndex = 0;
      let lastDisplayPos = null;
      let lastCameraUpdate = 0;

      let flightBounds = null;
      let airspaceBounds = null;
      let airspaceGeojson = null;
      let airspaceLoaded = false;

      let latestScenarios = [];
      let activeScenarioId = null;
    
      let lastSmoothedPos = null;
      let lastPrediction = null;

      let lastRiskLabel = null;
      let lastRiskTransitionTs = null;
      let smoothedRiskScore = 0;
      let lastDisplayedRiskScore = 0;

      let lastEventSignature = "";

      function makeEventSignature({ riskLabel, advisory, ttb, zoneName, zoneType }) {
        return [
          riskLabel || "",
          advisory?.level || "",
          advisory?.text || "",
          zoneName || "",
          zoneType || "",
          ttb == null ? "" : Number(ttb).toFixed(1)
        ].join("|");
      }

      let selectedEventId = null;
      let currentPlaybackEventId = null;

      let lastStableAdvisory = {
        level: "INFO",
        text: "NO ACTION REQUIRED",
        cls: "risk-ok",
        actionChoice: null,
        priorityScore: 0
      };

      let pendingAdvisoryTs = 0;
      let pendingAdvisory = null;
      let lastStableAdvisoryTs = 0;

      let eventSeq = 0;
      const flightEventLog = [];
      window.flightEventLog = flightEventLog;

      let lastEventState = {
        riskLabel: null,
        advisoryKey: null,
        boundaryActive: false,
        conflict4DActive: false,
        envelopeActive: false,
        ttbBands: {
          le20: false,
          le10: false,
          le5: false,
          le2: false
        }
      };

      const renderState = {
        lastEventRenderKey: "",
        lastScrollEventId: null
      };

      // =========================
      // UI / EVENT LOG
      // =========================
      function nextEventId() {
        eventSeq += 1;
        return `evt_${String(eventSeq).padStart(6, "0")}`;
      }

      function eventTypeLabel(eventType) {
        switch (eventType) {
          case "risk_transition": return "RISK";
          case "advisory_transition": return "ACTION";
          case "prediction_threshold_crossed": return "THRESHOLD";
          case "boundary_prediction_started": return "BOUNDARY";
          case "conflict_4d_started": return "CONFLICT";
          case "vertical_conflict_started": return "VERTICAL";
          case "envelope_conflict_started": return "ENVELOPE";
          case "INIT": return "INIT";
          default:
            return toStringSafe(eventType, "EVENT").replaceAll("_", " ").toUpperCase();
        }
      }

      function eventSeverityClass(severity) {
        const s = toStringSafe(severity).toLowerCase();
        if (s === "critical" || s === "immediate") return "event-sev-critical";
        if (s === "warning") return "event-sev-warning";
        if (s === "caution") return "event-sev-caution";
        return "event-sev-info";
      }

      function formatEventText(evt) {
        if (!evt) return "—";

        switch (evt.event_type) {
          case "risk_transition":
            return `Risk ${evt.value?.from || "NONE"} → ${evt.value?.to || "UNKNOWN"} (${evt.value?.score ?? "—"})`;

          case "advisory_transition": {
            const advisoryText = evt.value?.to?.split("|")[1];
            return advisoryText || evt.value?.to || "Advisory updated";
          }

          case "prediction_threshold_crossed": {
            const label = toStringSafe(evt.value?.threshold).replace("le", "≤ ");
            const ttb = evt.value?.ttb_s != null ? `${toNumber(evt.value.ttb_s).toFixed(1)}s` : "—";
            return `TTB ${label} (${ttb})`;
          }

          case "boundary_prediction_started":
            return `${evt.value?.zone_name || "Zone"} boundary ahead`;

          case "conflict_4d_started":
            return `${evt.value?.zone_name || "Zone"} 4D conflict`;

          case "vertical_conflict_started":
            return "Vertical conflict detected";

          case "envelope_conflict_started":
            return `Envelope conflicts: ${evt.value?.count ?? 0}`;

          default:
            return eventTypeLabel(evt.event_type);
        }
      }

      function findCurrentPlaybackEvent(events, simTimeMs) {
        const safeEvents = toArray(events);
        if (!safeEvents.length) return null;

        let current = null;
        for (const evt of safeEvents) {
          if (toNumber(evt.sim_time_ms, 0) <= simTimeMs) current = evt;
          else break;
        }
        return current;
      }

     function jumpToSimTime(ms, duration) {
  simElapsed = Math.max(0, Math.min(toNumber(ms, 0), duration));
  lastFrame = null;
  playing = false;
  playBtn.textContent = "Play";

  const replayTime = t0 + simElapsed;
  currentIndex = 0;
  while (currentIndex < pts.length - 2 && pts[currentIndex + 1].t <= replayTime) {
    currentIndex++;
  }

  resetReplayDerivedState({ preserveLogs: false });
  renderEventLog(flightEventLog, simElapsed, duration, true);
}

      function bindEventLogClicks(duration) {
        if (!eventLogRoot) return;
        eventLogRoot.querySelectorAll(".event-item[data-event-id]").forEach((item) => {
          item.addEventListener("click", () => {
            const eventId = item.getAttribute("data-event-id");
            const targetMs = Number(item.getAttribute("data-sim-time") || 0);
            selectedEventId = eventId;
            jumpToSimTime(targetMs, duration);
            renderEventLog(flightEventLog, simElapsed, duration, true);
          });
        });
      }

      function buildEventRenderKey(events, simTimeMs) {
        const current = findCurrentPlaybackEvent(events, simTimeMs);
        const total = toArray(events).length;
        const lastId = total ? events[total - 1]?.id : "";
        return `${total}|${lastId}|${selectedEventId || ""}|${current?.id || ""}`;
      }

      function renderSliderEventMarkers(events, duration) {
  const root = document.getElementById("slider-event-markers");
  if (!root) return;

  if (!duration || duration <= 0) {
    root.innerHTML = "";
    return;
  }

  const visible = toArray(events).filter((evt) => evt.event_type !== "INIT");

  root.innerHTML = visible.map((evt) => {
    const leftPct = clamp((toNumber(evt.sim_time_ms, 0) / duration) * 100, 0, 100);
    const sev = String(evt.severity || "info").toLowerCase();
    const cls =
      sev === "critical" || sev === "immediate" ? "critical" :
      sev === "warning" ? "warning" :
      sev === "caution" ? "caution" :
      "info";

    return `<div class="slider-event-marker ${cls}" style="left:${leftPct}%"></div>`;
  }).join("");
}

      function renderEventLog(events, simTimeMs, duration, force = false) {
        if (!eventLogRoot || !eventLogStatus) return;

        const safeEvents = toArray(events);
        const renderKey = buildEventRenderKey(safeEvents, simTimeMs);
        if (!force && renderKey === renderState.lastEventRenderKey) return;
        renderState.lastEventRenderKey = renderKey;

        const visibleEvents = safeEvents
          .filter((evt) => evt.event_type !== "INIT")
          .slice(-MAX_EVENT_LOG_ITEMS)
          .reverse();

        const currentEvent = findCurrentPlaybackEvent(safeEvents, simTimeMs);
        currentPlaybackEventId = currentEvent?.id ?? null;

        eventLogStatus.textContent = `${safeEvents.length} event${safeEvents.length === 1 ? "" : "s"}`;

        if (!visibleEvents.length) {
          eventLogRoot.innerHTML = `
            <div class="event-item">
              <div class="event-text">No events recorded.</div>
            </div>
          `;
          return;
        }

        eventLogRoot.innerHTML = visibleEvents.map((evt) => {
          const isSelected = evt.id === selectedEventId;
          const isCurrent = evt.id === currentPlaybackEventId;
          const sevClass = eventSeverityClass(evt.severity);

          return `
            <div
              class="event-item${isSelected ? " selected" : ""}${isCurrent ? " current" : ""}"
              data-event-id="${escapeHtml(evt.id)}"
              data-sim-time="${toNumber(evt.sim_time_ms, 0)}"
            >
              <div class="event-time">${escapeHtml(formatSimTime(toNumber(evt.sim_time_ms, 0)))}</div>
              <div class="event-type ${sevClass}">${escapeHtml(eventTypeLabel(evt.event_type))}</div>
              <div class="event-text">${escapeHtml(formatEventText(evt))}</div>
            </div>
          `;
        }).join("");

        bindEventLogClicks(duration);
        renderSliderEventMarkers(safeEvents, duration);
}

      function scrollCurrentEventIntoView() {
        if (!eventLogRoot || !currentPlaybackEventId) return;
        if (renderState.lastScrollEventId === currentPlaybackEventId) return;

        const active = eventLogRoot.querySelector(".event-item.current");
        if (!active) return;

        renderState.lastScrollEventId = currentPlaybackEventId;
        active.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }

      function pushFlightEvent({
        event_type,
        source,
        severity = null,
        value = {},
        context = {},
        replayIso,
        simTimeMs
      }) {
        flightEventLog.push({
          id: nextEventId(),
          flight_id,
          sim_time_ms: Math.round(toNumber(simTimeMs, 0)),
          replay_ts: replayIso,
          event_type,
          source,
          severity,
          value,
          context
        });

        if (flightEventLog.length > MAX_EVENT_LOG_STORE) {
          const overflow = flightEventLog.length - MAX_EVENT_LOG_STORE;
          flightEventLog.splice(0, overflow);
        }
      }

      function buildEventContext({
        zoneName,
        zoneType,
        ttb,
        boundaryPrediction,
        conflict4D,
        margin,
        verticalRelation,
        advisory
      }) {
        return {
          zone_name: zoneName,
          zone_type: zoneType,
          ttb_s: ttb ?? null,
          boundary_ttb_s: boundaryPrediction?.ttb_s ?? null,
          conflict_ttb_s: conflict4D?.ttb_s ?? null,
          margin_m: margin ?? null,
          vertical_relation: verticalRelation ?? null,
          advisory: advisory?.text ?? null
        };
      }

      function logFlightEvents({
        replayIso,
        simTimeMs,
        riskLabel,
        riskScore,
        advisory,
        ttb,
        boundaryPrediction,
        conflict4D,
        envelopeConflictCount,
        zoneName,
        zoneType,
        margin,
        verticalRelation
      }) {
        const signature = makeEventSignature({ riskLabel, advisory, ttb, zoneName, zoneType });
        if (signature === lastEventSignature && Math.abs(simTimeMs - (flightEventLog.at(-1)?.sim_time_ms ?? -999999)) < 250) {
          return;
        }
        lastEventSignature = signature;

        const advisoryKeyValue = advisory
          ? `${advisory.level}|${advisory.text}`
          : "INFO|NO ACTION REQUIRED";

        const context = buildEventContext({
          zoneName,
          zoneType,
          ttb,
          boundaryPrediction,
          conflict4D,
          margin,
          verticalRelation,
          advisory
        });

        if (lastEventState.riskLabel !== riskLabel) {
          pushFlightEvent({
            event_type: "risk_transition",
            source: "risk",
            severity: riskLabel,
            value: {
              from: lastEventState.riskLabel,
              to: riskLabel,
              score: riskScore
            },
            context,
            replayIso,
            simTimeMs
          });
          lastEventState.riskLabel = riskLabel;
        }

        if (lastEventState.advisoryKey !== advisoryKeyValue) {
          pushFlightEvent({
            event_type: "advisory_transition",
            source: "advisory",
            severity: advisory?.level ?? "INFO",
            value: {
              from: lastEventState.advisoryKey,
              to: advisoryKeyValue
            },
            context,
            replayIso,
            simTimeMs
          });
          lastEventState.advisoryKey = advisoryKeyValue;
        }

        const boundaryActive = !!boundaryPrediction;
        if (!lastEventState.boundaryActive && boundaryActive) {
          pushFlightEvent({
            event_type: "boundary_prediction_started",
            source: "prediction",
            severity: "CAUTION",
            value: {
              zone_name: boundaryPrediction?.zoneName ?? null,
              ttb_s: boundaryPrediction?.ttb_s ?? null
            },
            context,
            replayIso,
            simTimeMs
          });
        }
        lastEventState.boundaryActive = boundaryActive;

        const conflict4DActive = !!conflict4D?.conflict;
        if (!lastEventState.conflict4DActive && conflict4DActive) {
          pushFlightEvent({
            event_type: "conflict_4d_started",
            source: "prediction",
            severity: "WARNING",
            value: {
              zone_name: conflict4D?.zoneName ?? null,
              ttb_s: conflict4D?.ttb_s ?? null
            },
            context,
            replayIso,
            simTimeMs
          });
        }
        lastEventState.conflict4DActive = conflict4DActive;

        const envelopeActive = (envelopeConflictCount || 0) > 0;
        if (!lastEventState.envelopeActive && envelopeActive) {
          pushFlightEvent({
            event_type: "envelope_conflict_started",
            source: "prediction",
            severity: "CAUTION",
            value: { count: envelopeConflictCount },
            context,
            replayIso,
            simTimeMs
          });
        }
        lastEventState.envelopeActive = envelopeActive;

        const bands = {
          le20: ttb != null && ttb <= 20,
          le10: ttb != null && ttb <= 10,
          le5: ttb != null && ttb <= 5,
          le2: ttb != null && ttb <= 2
        };

        for (const key of ["le20", "le10", "le5", "le2"]) {
          if (!lastEventState.ttbBands[key] && bands[key]) {
            pushFlightEvent({
              event_type: "prediction_threshold_crossed",
              source: "prediction",
              severity:
                key === "le2" ? "CRITICAL" :
                key === "le5" ? "WARNING" :
                "CAUTION",
              value: {
                threshold: key,
                ttb_s: ttb
              },
              context,
              replayIso,
              simTimeMs
            });
          }
          lastEventState.ttbBands[key] = bands[key];
        }
      }

      // =========================
      // GEOMETRY / MOVEMENT
      // =========================
      function bearingDeg(a, b) {
        if (!a || !b) return NaN;
        const toRad = (d) => d * Math.PI / 180;
        const toDeg = (r) => r * 180 / Math.PI;
        const lat1 = toRad(toNumber(a.lat, 0));
        const lat2 = toRad(toNumber(b.lat, 0));
        const dLon = toRad(toNumber(b.lng, 0) - toNumber(a.lng, 0));
        const y = Math.sin(dLon) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
        return (toDeg(Math.atan2(y, x)) + 360) % 360;
      }

      function computeTurnBias({ brg, zoneBearing }) {
        if (!Number.isFinite(brg) || !Number.isFinite(zoneBearing)) {
          return { turn: "NONE", delta: null };
        }
        const delta = normalizeAngle180(zoneBearing - brg);
        if (delta > 5) return { turn: "LEFT", delta };
        if (delta < -5) return { turn: "RIGHT", delta };
        return { turn: "NONE", delta };
      }

      function kalmanLike(prev, current) {
        const k = 0.2;
        return {
          lat: prev.lat + k * (current.lat - prev.lat),
          lng: prev.lng + k * (current.lng - prev.lng),
          alt: prev.alt + k * (current.alt - prev.alt)
        };
      }

      function distanceM(a, b) {
        if (!a || !b) return 0;
        const R = 6371000;
        const lat1 = toNumber(a.lat, 0) * Math.PI / 180;
        const lat2 = toNumber(b.lat, 0) * Math.PI / 180;
        const dLat = (toNumber(b.lat, 0) - toNumber(a.lat, 0)) * Math.PI / 180;
        const dLon = (toNumber(b.lng, 0) - toNumber(a.lng, 0)) * Math.PI / 180;

        const x =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

        return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
      }

      function movePoint(start, headingDeg, distanceMVal) {
        const R = 6371000;
        const brng = toNumber(headingDeg, 0) * Math.PI / 180;
        const lat1 = toNumber(start.lat, 0) * Math.PI / 180;
        const lon1 = toNumber(start.lng, 0) * Math.PI / 180;

        const lat2 = Math.asin(
          Math.sin(lat1) * Math.cos(distanceMVal / R) +
          Math.cos(lat1) * Math.sin(distanceMVal / R) * Math.cos(brng)
        );

        const lon2 = lon1 + Math.atan2(
          Math.sin(brng) * Math.sin(distanceMVal / R) * Math.cos(lat1),
          Math.cos(distanceMVal / R) - Math.sin(lat1) * Math.sin(lat2)
        );

        return {
          lat: lat2 * 180 / Math.PI,
          lng: lon2 * 180 / Math.PI
        };
      }

      function makeArrowHead(endPos, headingDeg, arrowLengthM = 18, arrowAngleDeg = 28) {
        const left = movePoint(endPos, normalizeHeading(headingDeg + 180 - arrowAngleDeg), arrowLengthM);
        const right = movePoint(endPos, normalizeHeading(headingDeg + 180 + arrowAngleDeg), arrowLengthM);

        return {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [[
              [endPos.lng, endPos.lat],
              [left.lng, left.lat],
              [right.lng, right.lat],
              [endPos.lng, endPos.lat]
            ]]
          }
        };
      }

      function pointInRing(point, ring) {
        if (!point || !Array.isArray(ring) || !ring.length) return false;

        const x = toNumber(point.lng, 0);
        const y = toNumber(point.lat, 0);
        let inside = false;

        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const xi = toNumber(ring[i]?.[0], 0);
          const yi = toNumber(ring[i]?.[1], 0);
          const xj = toNumber(ring[j]?.[0], 0);
          const yj = toNumber(ring[j]?.[1], 0);

          const intersect =
            ((yi > y) !== (yj > y)) &&
            (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi);

          if (intersect) inside = !inside;
        }

        return inside;
      }

      function pointInPolygon(point, geometry) {
        if (!geometry) return false;
        if (geometry.type === "Polygon") return pointInRing(point, geometry.coordinates?.[0]);
        if (geometry.type === "MultiPolygon") {
          return toArray(geometry.coordinates).some((poly) => pointInRing(point, poly?.[0]));
        }
        return false;
      }

      function predictFuturePath(currentPos, headingDeg, groundspeedVal, vz, secondsAhead = 60, stepSeconds = 1) {
        const gs = toNullableNumber(groundspeedVal);
        if (gs === null || gs <= 0) return [];

        const adaptiveStep =
          gs > 50 ? 0.25 :
          gs > 25 ? 0.5 :
          stepSeconds;

        const points = [];
        let pos = { lat: toNumber(currentPos.lat, 0), lng: toNumber(currentPos.lng, 0) };
        let alt = toNumber(currentPos.alt, 0);

        for (let s = adaptiveStep; s <= secondsAhead; s += adaptiveStep) {
          const dist = gs * adaptiveStep;
          pos = movePoint(pos, headingDeg, dist);
          alt = alt + toNumber(vz, 0) * adaptiveStep;
          points.push({ lat: pos.lat, lng: pos.lng, alt, ttb_s: s });
        }

        return points;
      }

      function predictPathIntersection(pathPoints, zoneFeature) {
        if (!zoneFeature?.geometry || !Array.isArray(pathPoints) || pathPoints.length < 2 || typeof turf === "undefined") {
          return null;
        }

        let best = null;

        for (let i = 1; i < pathPoints.length; i++) {
          const p0 = pathPoints[i - 1];
          const p1 = pathPoints[i];
          const inside0 = pointInPolygon(p0, zoneFeature.geometry);
          const inside1 = pointInPolygon(p1, zoneFeature.geometry);

          if (inside1 && !best) {
            best = { lng: p1.lng, lat: p1.lat, alt: p1.alt, ttb_s: p1.ttb_s };
          }

          if (!inside0 && inside1) {
            try {
              const seg = turf.lineString([[p0.lng, p0.lat], [p1.lng, p1.lat]]);
              let poly = null;

              if (zoneFeature.geometry.type === "Polygon") {
                poly = turf.polygon(zoneFeature.geometry.coordinates);
              } else if (zoneFeature.geometry.type === "MultiPolygon") {
                poly = turf.multiPolygon(zoneFeature.geometry.coordinates);
              }

              if (!poly) continue;

              const hits = turf.lineIntersect(seg, poly);
              if (hits?.features?.length) {
                const hit = hits.features[0];
                const [hitLng, hitLat] = hit.geometry.coordinates;
                const segDx = p1.lng - p0.lng;
                const segDy = p1.lat - p0.lat;

                let frac = 0.5;
                if (Math.abs(segDx) >= Math.abs(segDy) && segDx !== 0) {
                  frac = (hitLng - p0.lng) / segDx;
                } else if (segDy !== 0) {
                  frac = (hitLat - p0.lat) / segDy;
                }

                frac = Math.max(0, Math.min(1, frac));

                return {
                  lng: hitLng,
                  lat: hitLat,
                  alt: p0.alt + (p1.alt - p0.alt) * frac,
                  ttb_s: p0.ttb_s + (p1.ttb_s - p0.ttb_s) * frac
                };
              }

              return {
                lng: p0.lng + (p1.lng - p0.lng) * 0.5,
                lat: p0.lat + (p1.lat - p0.lat) * 0.5,
                alt: p0.alt + (p1.alt - p0.alt) * 0.5,
                ttb_s: p0.ttb_s + (p1.ttb_s - p0.ttb_s) * 0.5
              };
            } catch (err) {
              console.warn("Path intersection failed:", err);
              return best;
            }
          }
        }

        return best;
      }

      function predictEarliestZoneEntry(pathPoints, geojson) {
        const features = toArray(geojson?.features);
        if (!features.length) return null;

        let best = null;
        for (const feature of features) {
          const hit = predictPathIntersection(pathPoints, feature);
          if (!hit) continue;

          const candidate = {
            zoneId: feature?.properties?.id ?? null,
            zoneName: feature?.properties?.name ?? "Unknown",
            zoneType: feature?.properties?.zone_type ?? "-",
            pos: { lng: hit.lng, lat: hit.lat },
            ttb_s: hit.ttb_s,
            alt: hit.alt
          };

          if (!best || candidate.ttb_s < best.ttb_s) best = candidate;
        }

        return best;
      }

      function isWithinVerticalBand(predictedAlt, lowerM, upperM) {
        const alt = toNullableNumber(predictedAlt);
        if (alt === null) return null;

        const lower = toNullableNumber(lowerM);
        const upper = toNullableNumber(upperM);

        if (lower !== null && alt < lower) return false;
        if (upper !== null && alt > upper) return false;
        return true;
      }

      function describeVerticalRelation(predictedAlt, lowerM, upperM) {
        const alt = toNullableNumber(predictedAlt);
        if (alt === null) return "UNKNOWN";

        const lower = toNullableNumber(lowerM);
        const upper = toNullableNumber(upperM);

        if (lower !== null && alt < lower) return "BELOW FLOOR";
        if (upper !== null && alt > upper) return "ABOVE CEILING";
        return "INSIDE BAND";
      }

      function predictVerticalConflictTtb(pathPoints, zoneFeature) {
        if (!zoneFeature?.properties || !Array.isArray(pathPoints) || !pathPoints.length) return null;

        const lowerM = zoneFeature?.properties?.lower_m ?? null;
        const upperM = zoneFeature?.properties?.upper_m ?? null;

        for (const p of pathPoints) {
          const verticalOk = isWithinVerticalBand(p.alt, lowerM, upperM);
          if (verticalOk === true) {
            return { ttb_s: p.ttb_s, alt: p.alt, lower_m: lowerM, upper_m: upperM };
          }
        }

        return null;
      }

      function predictEarliest4DConflict(pathPoints, geojson) {
        const features = toArray(geojson?.features);
        if (!features.length) return null;

        let bestConflict = null;
        let bestLateralOnly = null;

        for (const feature of features) {
          const hit = predictPathIntersection(pathPoints, feature);
          if (!hit) continue;

          const lowerM = feature?.properties?.lower_m ?? null;
          const upperM = feature?.properties?.upper_m ?? null;
          const verticalOk = isWithinVerticalBand(hit.alt, lowerM, upperM);
          const verticalKnown = verticalOk !== null;
          const isConflict = verticalOk === true;

          const candidate = {
            zoneId: feature?.properties?.id ?? null,
            zoneName: feature?.properties?.name ?? "Unknown",
            zoneType: feature?.properties?.zone_type ?? "-",
            pos: { lng: hit.lng, lat: hit.lat },
            ttb_s: hit.ttb_s,
            predicted_alt_m: hit.alt,
            lower_m: lowerM,
            upper_m: upperM,
            vertical_ok: verticalOk,
            vertical_known: verticalKnown,
            conflict: isConflict
          };

          if (isConflict) {
            if (!bestConflict || candidate.ttb_s < bestConflict.ttb_s) bestConflict = candidate;
          } else {
            if (!bestLateralOnly || candidate.ttb_s < bestLateralOnly.ttb_s) bestLateralOnly = candidate;
          }
        }

        return bestConflict || bestLateralOnly;
      }

      function smoothPrediction(newPrediction) {
        if (!newPrediction) return lastPrediction;
        if (!lastPrediction) {
          lastPrediction = newPrediction;
          return newPrediction;
        }
        const dt = Math.abs(toNumber(newPrediction.ttb_s, 0) - toNumber(lastPrediction.ttb_s, 0));
        if (dt < 0.5) return lastPrediction;
        lastPrediction = newPrediction;
        return newPrediction;
      }

      function buildPredictiveConflictEnvelope(pathPoints, corridorWidthM = 20) {
        if (!Array.isArray(pathPoints) || pathPoints.length < 2 || typeof turf === "undefined") return null;

        try {
          const coords = pathPoints.map((p) => [p.lng, p.lat]);
          const line = turf.lineString(coords);
          return turf.buffer(line, corridorWidthM, { units: "meters" });
        } catch (err) {
          console.warn("Failed to build predictive envelope:", err);
          return null;
        }
      }

      function findEnvelopeConflicts(envelopeFeature, geojson) {
        const features = toArray(geojson?.features);
        if (!envelopeFeature || !features.length || typeof turf === "undefined") return [];

        const conflicts = [];

        for (const feature of features) {
          try {
            const overlap = turf.intersect(turf.featureCollection([envelopeFeature, feature]));
            if (overlap) {
              conflicts.push({
                zoneId: feature?.properties?.id ?? null,
                zoneName: feature?.properties?.name ?? "Unknown",
                zoneType: feature?.properties?.zone_type ?? "-",
                overlap
              });
            }
          } catch (err) {
            console.warn("Envelope conflict test failed:", err);
          }
        }

        return conflicts;
      }

      // =========================
      // RISK / ADVISORY
      // =========================
      function predictTtb(marginM, vzMps) {
        const margin = toNullableNumber(marginM);
        const vz = toNullableNumber(vzMps);

        if (margin === null || vz === null) return null;
        if (vz <= 0) return null;
        if (margin <= 0) return 0;
        return margin / vz;
      }

      function computeRiskLevel(score) {
        const s = toNumber(score, 0);
        if (s >= 82) return { label: "CRITICAL", cls: "risk-breach" };
        if (s >= 58) return { label: "WARNING", cls: "risk-warning" };
        if (s >= 28) return { label: "CAUTION", cls: "risk-caution" };
        return { label: "SAFE", cls: "risk-ok" };
      }

      function normalizeZoneType(zoneType) {
        return toStringSafe(zoneType).trim().toUpperCase();
      }

      function zoneSeverityProfile(zoneType) {
        const z = normalizeZoneType(zoneType);

        if (z.includes("PROHIBITED")) {
          return { class: "PROHIBITED", riskMultiplier: 1.45, advisoryBias: 26, cautionTtb: 90, warningTtb: 45, immediateTtb: 18 };
        }
        if (z.includes("RESTRICTED")) {
          return { class: "RESTRICTED", riskMultiplier: 1.28, advisoryBias: 18, cautionTtb: 75, warningTtb: 35, immediateTtb: 15 };
        }
        if (z.includes("DANGER")) {
          return { class: "DANGER", riskMultiplier: 1.18, advisoryBias: 12, cautionTtb: 60, warningTtb: 28, immediateTtb: 12 };
        }
        if (z.includes("CTR")) {
          return { class: "CTR", riskMultiplier: 1.08, advisoryBias: 8, cautionTtb: 60, warningTtb: 25, immediateTtb: 10 };
        }
        if (z.includes("CONTROLLED") || z.includes("CTA") || z.includes("TMA")) {
          return { class: "CONTROLLED", riskMultiplier: 1.0, advisoryBias: 5, cautionTtb: 55, warningTtb: 22, immediateTtb: 9 };
        }
        if (z.includes("RMZ") || z.includes("TMZ")) {
          return { class: "RMZ/TMZ", riskMultiplier: 0.88, advisoryBias: 1, cautionTtb: 45, warningTtb: 18, immediateTtb: 8 };
        }

        return { class: "OTHER", riskMultiplier: 1.0, advisoryBias: 4, cautionTtb: 50, warningTtb: 22, immediateTtb: 9 };
      }

      function computePilotRiskModel({
        zoneType,
        margin,
        ttb,
        boundaryPrediction,
        conflict4D,
        verticalRelation,
        envelopeCount = 0,
        vz
      }) {
        const sev = zoneSeverityProfile(zoneType);

        const effectiveTtb =
          conflict4D?.ttb_s ??
          boundaryPrediction?.ttb_s ??
          ttb ??
          null;

        const timeUrgency =
          effectiveTtb == null ? 0 :
          effectiveTtb <= 0 ? 1 :
          sigmoid(effectiveTtb, 40, 10);

        const nearTermUrgency =
          effectiveTtb == null ? 0 :
          effectiveTtb <= 0 ? 1 :
          sigmoid(effectiveTtb, 20, 5);

        let marginUrgency = 0;
        if (margin != null && Number.isFinite(margin)) {
          if (margin < 0) marginUrgency = 1;
          else marginUrgency = sigmoid(margin, 35, 10);
        }

        let geometryUrgency = 0;
        if (conflict4D?.conflict) geometryUrgency = 1;
        else if (boundaryPrediction) geometryUrgency = 0.58;

        let verticalUrgency = 0;
        if (verticalRelation === "INSIDE BAND") verticalUrgency = 1;
        else if (verticalRelation === "ABOVE CEILING") verticalUrgency = 0.75;
        else if (verticalRelation === "BELOW FLOOR") verticalUrgency = 0.35;

        const envelopeUrgency = envelopeCount > 0 ? Math.min(0.35, 0.12 * envelopeCount) : 0;

        const climbPenalty =
          vz != null && vz > 0 && verticalRelation === "INSIDE BAND"
            ? clamp01(vz / 3.5)
            : 0;

        let timeDominance = 0;
        if (effectiveTtb != null) {
          if (effectiveTtb <= 5) timeDominance = 1.0;
          else if (effectiveTtb <= 10) timeDominance = 0.85;
          else if (effectiveTtb <= 20) timeDominance = 0.65;
        }

        let weighted =
          timeUrgency * (0.25 + 0.35 * timeDominance) +
          nearTermUrgency * 0.15 +
          marginUrgency * (0.20 * (1 - timeDominance)) +
          geometryUrgency * 0.18 +
          verticalUrgency * 0.10 +
          envelopeUrgency * 0.05 +
          climbPenalty * 0.07;

        weighted = clamp01(weighted);

        if (effectiveTtb != null) {
          if (effectiveTtb <= 2) return { score: 100, effectiveTtb, severity: sev, factors: { override: "TTB_LE_2" } };
          if (effectiveTtb <= 5) return { score: 96, effectiveTtb, severity: sev, factors: { override: "TTB_LE_5" } };
          if (effectiveTtb <= 10) {
            return {
              score: Math.max(88, Math.round(Math.min(100, (weighted * 100 + sev.advisoryBias) * sev.riskMultiplier))),
              effectiveTtb,
              severity: sev,
              factors: { override: "TTB_LE_10" }
            };
          }
          if (effectiveTtb <= 20) {
            return {
              score: Math.max(72, Math.round(Math.min(100, (weighted * 100 + sev.advisoryBias) * sev.riskMultiplier))),
              effectiveTtb,
              severity: sev,
              factors: { override: "TTB_LE_20" }
            };
          }
        }

        const riskScore = Math.round(
          Math.min(100, (weighted * 100 + sev.advisoryBias) * sev.riskMultiplier)
        );

        return {
          score: Math.min(100, riskScore),
          effectiveTtb,
          severity: sev,
          factors: {
            timeUrgency,
            nearTermUrgency,
            marginUrgency,
            geometryUrgency,
            verticalUrgency,
            envelopeUrgency,
            climbPenalty
          }
        };
      }

      function computeOperationalRisk(args) {
        return computePilotRiskModel(args).score;
      }

      function choosePrimaryAction({
        conflict4D,
        boundaryPrediction,
        verticalRelation,
        vz,
        margin,
        ttb,
        turnBias
      }) {
        const turnText =
          turnBias?.turn === "LEFT" ? "TURN LEFT" :
          turnBias?.turn === "RIGHT" ? "TURN RIGHT" :
          "TURN";

        const urgentVertical =
          verticalRelation === "INSIDE BAND" &&
          vz != null && vz > 0 &&
          ttb != null && ttb <= 35;

        const veryLowMargin =
          margin != null &&
          margin <= 15 &&
          vz != null && vz > 0;

        if (urgentVertical || veryLowMargin) {
          return { primary: "DESCEND", secondary: turnText };
        }

        if (conflict4D?.conflict || boundaryPrediction) {
          return { primary: turnText, secondary: "DESCEND" };
        }

        return { primary: turnText, secondary: "DESCEND" };
      }

      function computeAdvisoryPriority({
        level,
        ttb,
        zoneType,
        conflict4D,
        boundaryPrediction,
        verticalRelation,
        margin,
        vz
      }) {
        const sev = zoneSeverityProfile(zoneType);

        const levelBase =
          level === "IMMEDIATE" ? 100 :
          level === "WARNING" ? 72 :
          level === "CAUTION" ? 40 :
          10;

        let timeBoost = 0;
        if (ttb != null) {
          if (ttb <= sev.immediateTtb) timeBoost = 34;
          else if (ttb <= sev.warningTtb) timeBoost = 24;
          else if (ttb <= sev.cautionTtb) timeBoost = 10;
        }

        let geometryBoost = 0;
        if (conflict4D?.conflict) geometryBoost += 22;
        else if (boundaryPrediction) geometryBoost += 9;

        let verticalBoost = 0;
        if (verticalRelation === "INSIDE BAND") verticalBoost += 10;
        if (margin != null && margin < 0) verticalBoost += 18;
        else if (margin != null && margin <= 15) verticalBoost += 8;

        let trendBoost = 0;
        if (vz != null && vz > 0 && ttb != null && ttb <= 40) trendBoost += 6;

        return (levelBase + timeBoost + geometryBoost + verticalBoost + trendBoost + sev.advisoryBias) * sev.riskMultiplier;
      }

      // ===== HELPERS =====

      function toDisplayedLimitMeters(m) {
        return Math.floor(m / 10) * 10;
      }

     function computeDisplayMargin(upper_m, alt) {
        const upperDisplayM = toDisplayedLimitMeters(toNumber(upper_m));
        const altDisplayM = toNumber(alt);
        return upperDisplayM - altDisplayM;
      }

      function selectHighestPriorityAdvisory(candidates) {
        const valid = toArray(candidates).filter(Boolean);
        if (!valid.length) {
          return {
            level: "INFO",
            text: "NO ACTION REQUIRED",
            cls: "risk-ok",
            actionChoice: null,
            priorityScore: 0
          };
        }

        return valid.reduce((best, candidate) =>
          (candidate.priorityScore || 0) > (best.priorityScore || 0) ? candidate : best
        );
      }

      function computeAdvisory({
        margin,
        vz,
        ttb,
        conflict4D,
        boundaryPrediction,
        verticalRelation,
        zoneName,
        zoneType,
        groundspeed,
        turnBias
      }) {
        const candidates = [];
        const sev = zoneSeverityProfile(zoneType);
        const effectiveTtb = conflict4D?.ttb_s ?? boundaryPrediction?.ttb_s ?? ttb ?? null;

        if (margin != null && margin < 0) {
          const actionChoice = choosePrimaryAction({
            conflict4D, boundaryPrediction, verticalRelation, vz, margin, ttb, turnBias
          });

          const advisory = {
            level: "IMMEDIATE",
            text:
              vz != null && vz > 0
                ? `DESCEND IMMEDIATELY — AIRSPACE BREACH (${zoneName || "ACTIVE ZONE"})`
                : `EXIT AIRSPACE IMMEDIATELY (${zoneName || "ACTIVE ZONE"})`,
            cls: "risk-breach",
            actionChoice
          };

          advisory.priorityScore = computeAdvisoryPriority({
            level: advisory.level,
            ttb: 0,
            zoneType,
            conflict4D,
            boundaryPrediction,
            verticalRelation,
            margin,
            vz
          });

          candidates.push(advisory);
        }

        if (conflict4D?.conflict) {
          const zoneLabel = conflict4D.zoneName || zoneName || "ZONE";
          const effectiveZoneType = conflict4D.zoneType || zoneType;
          const actionChoice = choosePrimaryAction({
            conflict4D, boundaryPrediction, verticalRelation, vz, margin, ttb, turnBias
          });

          let level = "CAUTION";
          if (effectiveTtb != null && effectiveTtb <= sev.warningTtb) level = "WARNING";
          if (effectiveTtb != null && effectiveTtb <= sev.immediateTtb) level = "IMMEDIATE";

          const advisory = {
            level,
            text:
              level === "IMMEDIATE"
                ? `${actionChoice.primary} NOW — CONFLICT WITH ${zoneLabel}`
                : level === "WARNING"
                ? `${actionChoice.primary} TO AVOID ${zoneLabel}`
                : `PLAN ${actionChoice.primary} — ${zoneLabel} AHEAD`,
            cls:
              level === "IMMEDIATE" ? "risk-breach" :
              level === "WARNING" ? "risk-warning" :
              "risk-caution",
            actionChoice
          };

          advisory.priorityScore = computeAdvisoryPriority({
            level: advisory.level,
            ttb: conflict4D.ttb_s ?? ttb,
            zoneType: effectiveZoneType,
            conflict4D,
            boundaryPrediction,
            verticalRelation,
            margin,
            vz
          });

          candidates.push(advisory);
        }

        if (boundaryPrediction && boundaryPrediction.ttb_s != null) {
          const zoneLabel = boundaryPrediction.zoneName || zoneName || "ZONE";
          const effectiveZoneType = boundaryPrediction.zoneType || zoneType;
          const actionChoice = choosePrimaryAction({
            conflict4D, boundaryPrediction, verticalRelation, vz, margin, ttb, turnBias
          });

          let level = null;
          if (boundaryPrediction.ttb_s <= sev.warningTtb) level = "WARNING";
          else if (boundaryPrediction.ttb_s <= sev.cautionTtb) level = "CAUTION";

          if (level) {
            const advisory = {
              level,
              text:
                level === "WARNING"
                  ? `${actionChoice.primary} — BOUNDARY AHEAD (${zoneLabel})`
                  : `PREPARE TO ${actionChoice.primary} (${zoneLabel})`,
              cls: level === "WARNING" ? "risk-warning" : "risk-caution",
              actionChoice
            };

            advisory.priorityScore = computeAdvisoryPriority({
              level: advisory.level,
              ttb: boundaryPrediction.ttb_s,
              zoneType: effectiveZoneType,
              conflict4D,
              boundaryPrediction,
              verticalRelation,
              margin,
              vz
            });

            candidates.push(advisory);
          }
        }

        if (ttb != null && verticalRelation === "INSIDE BAND") {
          let level = null;
          if (ttb <= 20) level = "WARNING";
          else if (ttb <= 45) level = "CAUTION";

          if (level) {
            const actionChoice = choosePrimaryAction({
              conflict4D, boundaryPrediction, verticalRelation, vz, margin, ttb, turnBias
            });

            const advisory = {
              level,
              text:
                level === "WARNING"
                  ? "DESCEND SOON — VERTICAL LIMIT APPROACHING"
                  : "MONITOR VERTICAL MARGIN",
              cls: level === "WARNING" ? "risk-warning" : "risk-caution",
              actionChoice
            };

            advisory.priorityScore = computeAdvisoryPriority({
              level: advisory.level,
              ttb,
              zoneType,
              conflict4D,
              boundaryPrediction,
              verticalRelation,
              margin,
              vz
            });

            candidates.push(advisory);
          }
        }

        if (margin != null && margin <= 20 && margin >= 0 && !candidates.length) {
          const actionChoice = choosePrimaryAction({
            conflict4D, boundaryPrediction, verticalRelation, vz, margin, ttb, turnBias
          });

          const advisory = {
            level: "CAUTION",
            text: "LOW VERTICAL MARGIN — HOLD PROFILE CAREFULLY",
            cls: "risk-caution",
            actionChoice
          };

          advisory.priorityScore = computeAdvisoryPriority({
            level: advisory.level,
            ttb,
            zoneType,
            conflict4D,
            boundaryPrediction,
            verticalRelation,
            margin,
            vz
          });

          candidates.push(advisory);
        }

        if (!candidates.length && groundspeed != null && groundspeed > 0) {
          candidates.push({
            level: "INFO",
            text: "TRACK STABLE — CONTINUE MONITORING",
            cls: "risk-ok",
            actionChoice: null,
            priorityScore: 1
          });
        }

        if (!candidates.length) {
          candidates.push({
            level: "INFO",
            text: "NO ACTION REQUIRED",
            cls: "risk-ok",
            actionChoice: null,
            priorityScore: 0
          });
        }

        return selectHighestPriorityAdvisory(candidates);
      }

      function advisoryLevelRank(level) {
        if (level === "IMMEDIATE") return 4;
        if (level === "WARNING") return 3;
        if (level === "CAUTION") return 2;
        return 1;
      }

      function advisoryKey(advisory) {
        if (!advisory) return "INFO|NO ACTION REQUIRED";
        return `${advisory.level || "INFO"}|${advisory.text || "NO ACTION REQUIRED"}`;
      }

      function getRiskBarClass(score) {
        const s = toNumber(score, 0);
        if (s >= 82) return "risk-fill-critical";
        if (s >= 58) return "risk-fill-warning";
        if (s >= 28) return "risk-fill-caution";
        return "risk-fill-safe";
      }

      function getRiskTrend(previousScore, currentScore, deadband = 2) {
        const prev = toNumber(previousScore, 0);
        const curr = toNumber(currentScore, 0);
        const delta = curr - prev;

        if (Math.abs(delta) < deadband) return { label: "STEADY", arrow: "→", delta };
        if (delta > 0) return { label: "RISING", arrow: "↑", delta };
        return { label: "FALLING", arrow: "↓", delta };
      }

      function getRiskReasonSummary({ margin, ttb, conflict4D, boundaryPrediction, envelopeCount = 0 }) {
        const reasons = [];
        const m = toNullableNumber(margin);
        const t = toNullableNumber(ttb);

        if (m !== null) {
          if (m < 10) reasons.push("Very low margin");
          else if (m < 20) reasons.push("Low margin");
          else if (m < 50) reasons.push("Reduced margin");
        }

        if (t !== null) {
          if (t < 30) reasons.push("Immediate boundary risk");
          else if (t < 60) reasons.push("Near-term boundary risk");
          else if (t < 120) reasons.push("Emerging boundary risk");
        }

        if (conflict4D?.conflict) reasons.push("4D conflict predicted");
        else if (boundaryPrediction) reasons.push("Boundary prediction active");

        if (Number(envelopeCount) > 0) reasons.push(`Envelope conflicts: ${Number(envelopeCount)}`);

        return reasons.length ? reasons.join(" • ") : "Nominal conditions";
      }

      function logRiskTransition({ replayTime, previousRiskLabel, currentRiskLabel, riskScore, details, minGapMs = 2000 }) {
        const now = Date.now();

        if (!currentRiskLabel || previousRiskLabel === currentRiskLabel) return previousRiskLabel;
        if (lastRiskTransitionTs && now - lastRiskTransitionTs < minGapMs) return previousRiskLabel;

        console.log(
          `[RISK TRANSITION] t=${replayTime ?? "n/a"} ${previousRiskLabel || "NONE"} -> ${currentRiskLabel} | score=${riskScore} | ${details}`
        );

        lastRiskTransitionTs = now;
        return currentRiskLabel;
      }

      function computeAdvisoryConfidence({
        conflict4D,
        boundaryPrediction,
        turnBias,
        ttb,
        verticalRelation,
        zoneType
      }) {
        const sev = zoneSeverityProfile(zoneType);
        let score = 0;

        if (conflict4D?.conflict) score += 38;
        if (boundaryPrediction?.ttb_s != null && boundaryPrediction.ttb_s <= sev.warningTtb) score += 22;
        if (turnBias?.turn && turnBias.turn !== "NONE") score += 16;
        if (ttb != null && ttb <= 25) score += 12;
        if (verticalRelation === "INSIDE BAND") score += 8;

        if (score >= 65) return "HIGH";
        if (score >= 38) return "MEDIUM";
        return "LOW";
      }

      function stabilizeAdvisoryDisplay(newAdvisory, nowTs, { holdMs = 1500, candidateDwellMs = 700 } = {}) {
        const incoming = newAdvisory && newAdvisory.text
          ? newAdvisory
          : { level: "INFO", text: "NO ACTION REQUIRED", cls: "risk-ok", actionChoice: null, priorityScore: 0 };

        const current = lastStableAdvisory || {
          level: "INFO",
          text: "NO ACTION REQUIRED",
          cls: "risk-ok",
          actionChoice: null,
          priorityScore: 0
        };

        const incomingRank = advisoryLevelRank(incoming.level);
        const currentRank = advisoryLevelRank(current.level);

        const incomingKey = advisoryKey(incoming);
        const currentKey = advisoryKey(current);

        if (incomingKey === currentKey) {
          pendingAdvisory = null;
          pendingAdvisoryTs = 0;
          lastStableAdvisoryTs = nowTs;
          return current;
        }

        if (incomingRank > currentRank) {
          lastStableAdvisory = incoming;
          lastStableAdvisoryTs = nowTs;
          pendingAdvisory = null;
          pendingAdvisoryTs = 0;
          return lastStableAdvisory;
        }

        const withinHold = (nowTs - lastStableAdvisoryTs) < holdMs;
        if (withinHold) return current;

        const pendingKey = advisoryKey(pendingAdvisory);
        if (pendingKey !== incomingKey) {
          pendingAdvisory = incoming;
          pendingAdvisoryTs = nowTs;
          return current;
        }

        const pendingReady = (nowTs - pendingAdvisoryTs) >= candidateDwellMs;
        if (!pendingReady) return current;

        lastStableAdvisory = incoming;
        lastStableAdvisoryTs = nowTs;
        pendingAdvisory = null;
        pendingAdvisoryTs = 0;
        return lastStableAdvisory;
      }

      function shouldRecalculatePrediction({ nowMs, pos, brg, groundspeed }) {
        if (!FEATURES.prediction) return false;
        if (!airspaceLoaded || !Array.isArray(airspaceGeojson?.features) || !airspaceGeojson.features.length) return false;
        if (!Number.isFinite(brg)) return false;
        if (!Number.isFinite(groundspeed) || groundspeed < MIN_SPEED_FOR_PREDICTION_MPS) return false;

        if (!lastPredictionInputs) return true;
        if ((nowMs - lastPredictionCalcMs) >= PREDICTION_RECALC_INTERVAL_MS) return true;

        const moved = distanceM(pos, lastPredictionInputs.pos);
        const headingDelta = Math.abs(normalizeAngle180(brg - lastPredictionInputs.brg));
        const speedDelta = Math.abs(groundspeed - lastPredictionInputs.groundspeed);

        return (
          moved >= MIN_MOVEMENT_FOR_RECALC_M ||
          headingDelta >= MIN_HEADING_DELTA_FOR_RECALC_DEG ||
          speedDelta >= MIN_SPEED_DELTA_FOR_RECALC_MPS
        );
      }

      function computePredictionBundle({ pos, brg, groundspeed, vz, predictSeconds, predictionAltNow }) {
        const futurePath = predictFuturePath(
          { lat: pos.lat, lng: pos.lng, alt: predictionAltNow },
          brg,
          groundspeed,
          vz,
          predictSeconds,
          1
        );

        let predictiveEnvelope = null;
        let predictiveEnvelopeConflicts = [];
        let boundaryPrediction = null;
        let conflict4D = null;
        let verticalTtb = null;

        if (futurePath.length >= 2) {
          const earliestEntry = predictEarliestZoneEntry(futurePath, airspaceGeojson);
          const earliest4D = smoothPrediction(predictEarliest4DConflict(futurePath, airspaceGeojson));

          if (earliestEntry) {
            boundaryPrediction = {
              zoneId: earliestEntry.zoneId,
              zoneName: earliestEntry.zoneName,
              zoneType: earliestEntry.zoneType,
              pos: earliestEntry.pos,
              distance_m: distanceM({ lng: pos.lng, lat: pos.lat }, earliestEntry.pos),
              ttb_s: earliestEntry.ttb_s
            };
          }

          conflict4D = earliest4D;

          if (earliest4D?.zoneId) {
            const z = airspaceGeojson.features.find((f) => (f?.properties?.id ?? null) === earliest4D.zoneId);
            if (z) verticalTtb = predictVerticalConflictTtb(futurePath, z);
          }

          if (FEATURES.envelope) {
            predictiveEnvelope = buildPredictiveConflictEnvelope(futurePath, 20);
            predictiveEnvelopeConflicts = findEnvelopeConflicts(predictiveEnvelope, airspaceGeojson);
          }
        }

        return {
          futurePath,
          predictiveEnvelope,
          predictiveEnvelopeConflicts,
          boundaryPrediction,
          conflict4D,
          verticalTtb
        };
      }

      // =========================
      // MAP HELPERS
      // =========================
      function computeGeojsonBounds(fc) {
        const b = new maplibregl.LngLatBounds();
        let hasAny = false;

        for (const f of toArray(fc?.features)) {
          const g = f?.geometry;
          if (!g) continue;

          if (g.type === "Polygon") {
            for (const ring of toArray(g.coordinates)) {
              for (const coord of toArray(ring)) {
                if (Array.isArray(coord) && coord.length >= 2) {
                  b.extend(coord);
                  hasAny = true;
                }
              }
            }
          } else if (g.type === "MultiPolygon") {
            for (const poly of toArray(g.coordinates)) {
              for (const ring of toArray(poly)) {
                for (const coord of toArray(ring)) {
                  if (Array.isArray(coord) && coord.length >= 2) {
                    b.extend(coord);
                    hasAny = true;
                  }
                }
              }
            }
          }
        }

        return hasAny ? b : null;
      }

      function ensureAirspaceLayers(map) {
        if (!map || !airspaceGeojson) return;

        const safeAirspace =
          Array.isArray(airspaceGeojson?.features)
            ? airspaceGeojson
            : { type: "FeatureCollection", features: [] };

        if (!map.getSource("airspace")) {
          map.addSource("airspace", {
            type: "geojson",
            data: safeAirspace
          });
        } else {
          safeSetGeojsonData(map, "airspace", safeAirspace);
        }

        if (!map.getLayer("airspace-fill")) {
          map.addLayer({
            id: "airspace-fill",
            type: "fill",
            source: "airspace",
            paint: {
              "fill-color": [
                "match",
                ["downcase", ["to-string", ["coalesce", ["get", "zone_type"], ""]]],
                "controlled", "#3366ff",
                "restricted", "#ff0000",
                "prohibited", "#cc00ff",
                "danger", "#ffcc00",
                "#999999"
              ],
              "fill-opacity": 0.30
            }
          });
        }

        if (!map.getLayer("airspace-outline")) {
          map.addLayer({
            id: "airspace-outline",
            type: "line",
            source: "airspace",
            paint: {
              "line-color": "#ff0000",
              "line-width": 2
            }
          });
        }

        if (!map.getLayer("airspace-3d")) {
          map.addLayer({
            id: "airspace-3d",
            type: "fill-extrusion",
            source: "airspace",
            layout: { visibility: "none" },
            paint: {
              "fill-extrusion-color": "#ff0000",
              "fill-extrusion-height": [
                "*",
                ["coalesce", ["to-number", ["get", "upper_m"]], 0],
                2
              ],
              "fill-extrusion-base": [
                "*",
                ["coalesce", ["to-number", ["get", "lower_m"]], 0],
                2
              ],
              "fill-extrusion-opacity": 0.25
            }
          });
        }
      }

      function zoomTo(map, bounds) {
        if (!bounds) return;
        try {
          map.fitBounds(bounds, { padding: 80, duration: 800 });
        } catch (err) {
          console.warn("fitBounds failed:", err);
        }
      }

      function unionBounds(a, b) {
        if (!a && !b) return null;
        if (a && !b) return a;
        if (!a && b) return b;

        try {
          const u = new maplibregl.LngLatBounds(a.getSouthWest(), a.getNorthEast());
          u.extend(b.getSouthWest());
          u.extend(b.getNorthEast());
          return u;
        } catch {
          return a || b || null;
        }
      }

      function ensureTrendLayer(map) {
        if (!map.getSource("trend")) {
          map.addSource("trend", {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: { type: "LineString", coordinates: [[0, 0], [0, 0]] }
            }
          });
        }

        if (!map.getLayer("trend-line")) {
          map.addLayer({
            id: "trend-line",
            type: "line",
            source: "trend",
            paint: {
              "line-color": "#ffffff",
              "line-opacity": 0.7,
              "line-width": 2,
              "line-dasharray": [2, 2]
            }
          });
        }
      }

      function ensureVectorLayers(map) {
        if (!map.getSource("heading-vector")) {
          map.addSource("heading-vector", {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: { type: "LineString", coordinates: [[0, 0], [0, 0]] }
            }
          });
        }

        if (!map.getLayer("heading-vector-line")) {
          map.addLayer({
            id: "heading-vector-line",
            type: "line",
            source: "heading-vector",
            layout: {
              "line-cap": "round",
              "line-join": "round",
              "visibility": "none"
            },
            paint: {
              "line-color": "#00e5ff",
              "line-width": 3,
              "line-opacity": 0.95
            }
          });
        }

        if (!map.getSource("flight-vector-arrow")) {
          map.addSource("flight-vector-arrow", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] }
          });
        }

        if (!map.getLayer("flight-vector-arrow-fill")) {
          map.addLayer({
            id: "flight-vector-arrow-fill",
            type: "fill",
            source: "flight-vector-arrow",
            layout: { visibility: "none" },
            paint: {
              "fill-color": "#00e5ff",
              "fill-opacity": 0.95
            }
          });
        }
      }

      function ensurePredictiveEnvelopeLayers(map) {
  if (!map.getSource("predictive-envelope")) {
    map.addSource("predictive-envelope", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] }
    });
  }

  if (!map.getLayer("predictive-envelope-fill")) {
    map.addLayer({
      id: "predictive-envelope-fill",
      type: "fill",
      source: "predictive-envelope",
      paint: {
        "fill-color": "#ffd54a",
        "fill-opacity": 0.34
      }
    });
  }

  if (!map.getLayer("predictive-envelope-outline")) {
    map.addLayer({
      id: "predictive-envelope-outline",
      type: "line",
      source: "predictive-envelope",
      paint: {
        "line-color": "#ffbf00",
        "line-width": 3,
        "line-opacity": 1
      }
    });
  }

  if (!map.getSource("predictive-envelope-conflicts")) {
    map.addSource("predictive-envelope-conflicts", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] }
    });
  }

  if (!map.getLayer("predictive-envelope-conflicts-fill")) {
    map.addLayer({
      id: "predictive-envelope-conflicts-fill",
      type: "fill",
      source: "predictive-envelope-conflicts",
      paint: {
        "fill-color": "#ff3b30",
        "fill-opacity": 0.42
      }
    });
  }

  if (!map.getLayer("predictive-envelope-conflicts-outline")) {
    map.addLayer({
      id: "predictive-envelope-conflicts-outline",
      type: "line",
      source: "predictive-envelope-conflicts",
      paint: {
        "line-color": "#ff0000",
        "line-width": 3.5,
        "line-opacity": 1
      }
    });
  }
}

      function updateZoneFilter(map) {
        const checked = Array.from(
          document.querySelectorAll(".zone-filter:checked")
        ).map((cb) => cb.value.toLowerCase());

        if (!checked.length) {
          safeSetFilter(map, "airspace-fill", ["==", 1, 0]);
          safeSetFilter(map, "airspace-outline", ["==", 1, 0]);
          safeSetFilter(map, "airspace-3d", ["==", 1, 0]);
          return;
        }

        const filter = [
          "match",
          ["downcase", ["to-string", ["coalesce", ["get", "zone_type"], ""]]],
          checked,
          true,
          false
        ];

        safeSetFilter(map, "airspace-fill", filter);
        safeSetFilter(map, "airspace-outline", filter);
        safeSetFilter(map, "airspace-3d", filter);
      }

      function getZoneActiveClass(activeText) {
        if (!activeText) return "";
        if (activeText.includes("ACTIVE")) return "hud-status-active";
        if (activeText.includes("INACTIVE")) return "hud-status-inactive";
        return "";
      }

      function getZoneStatusClass(source) {
        if (!source) return "";
        if (source.includes("4D")) return "hud-status-warning";
        if (source.includes("PREDICT")) return "hud-status-caution";
        return "";
      }

      function getResultClass(resultText) {
        if (!resultText) return "";
        if (resultText.includes("BREACH")) return "hud-status-critical";
        if (resultText.includes("CONFLICT")) return "hud-status-warning";
        if (resultText.includes("CLEAR")) return "hud-status-ok";
        return "";
      }

      function bindToggle(id, key) {
        const el = document.getElementById(id);
        if (!el) return;
        FEATURES[key] = !!el.checked;
        el.addEventListener("change", (e) => {
          FEATURES[key] = !!e.target.checked;
        });
      }

      function setupFeatureToggles() {
        bindToggle("toggleTrend", "trend");
        bindToggle("togglePrediction", "prediction");
        bindToggle("toggleEnvelope", "envelope");
        bindToggle("toggleCone", "cone");
        bindToggle("toggleKalman", "kalman");
        bindToggle("toggleVectors", "vectors");
      }

      function rehydrateMapOverlays(map) {
        ensureTrendLayer(map);
        ensureVectorLayers(map);
        ensurePredictiveEnvelopeLayers(map);
        ensureAirspaceLayers(map);
        updateZoneFilter(map);
      }

      // =========================
      // STATE RESET HELPERS
      // =========================
      function resetReplayDerivedState({ preserveLogs = false } = {}) {
        if (!preserveLogs) {
          flightEventLog.length = 0;
          lastDisplayPos = null;
          lastCameraUpdate = 0; 
        }

        cachedPredictionResult = {
          futurePath: [],
          predictiveEnvelope: null,
          predictiveEnvelopeConflicts: [],
          boundaryPrediction: null,
          conflict4D: null,
          verticalTtb: null
        };

        lastPredictionInputs = null;
        lastPredictionCalcMs = -Infinity;
        lastPrediction = null;
        lastSmoothedPos = null;

        lastEventSignature = "";
        lastRiskLabel = null;
        lastRiskTransitionTs = null;
        smoothedRiskScore = 0;
        lastDisplayedRiskScore = 0;

        selectedEventId = null;
        currentPlaybackEventId = null;
        renderState.lastEventRenderKey = "";
        renderState.lastScrollEventId = null;

        lastStableAdvisory = {
          level: "INFO",
          text: "NO ACTION REQUIRED",
          cls: "risk-ok",
          actionChoice: null,
          priorityScore: 0
        };

        pendingAdvisory = null;
        pendingAdvisoryTs = 0;
        lastStableAdvisoryTs = 0;

        lastEventState = {
          riskLabel: null,
          advisoryKey: null,
          boundaryActive: false,
          conflict4DActive: false,
          envelopeActive: false,
          ttbBands: {
            le20: false,
            le10: false,
            le5: false,
            le2: false
          }
        };
      }

      function getLastEventTimestamp(events) {
  if (!Array.isArray(events) || events.length === 0) return null;

  let latest = null;

  for (const event of events) {
    const candidate =
      event?.timestamp ||
      event?.created_at ||
      event?.event_time ||
      event?.time ||
      null;

    if (!candidate) continue;

    const ms = new Date(candidate).getTime();
    if (Number.isNaN(ms)) continue;

    if (latest === null || ms > latest) {
      latest = ms;
    }
  }

  return latest ? new Date(latest).toISOString() : null;
}

      // =========================
      // DATA LOAD
      // =========================
      async function fetchJson(url, errorLabel, { timeoutMs = FETCH_TIMEOUT_MS, retries = FETCH_RETRIES } = {}) {
        let lastError = null;

        for (let attempt = 0; attempt <= retries; attempt++) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), timeoutMs);

          try {
            if (DEBUG) console.log(`[FETCH] ${url} (attempt ${attempt + 1})`);

            const res = await fetch(url, {
              signal: controller.signal,
              headers: { "Accept": "application/json" }
            });

            clearTimeout(timeout);

            if (!res.ok) {
              throw new Error(`${errorLabel} (${res.status})`);
            }

            return await res.json();
          } catch (err) {
            clearTimeout(timeout);
            lastError = err;

            if (DEBUG) console.warn(`[FETCH FAIL] ${url}`, err);

            if (attempt === retries) break;

            await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
          }
        }

        throw lastError || new Error(errorLabel);
      }
      

      let replayData;
try {
  replayData = await fetchJson(API_URL, "Replay fetch failed");
} catch (err) {
  alert(`Replay failed: ${err.message}`);
  return;
}
window.replayDataDebug = replayData; 
console.log("replayData:", replayData);

updateScenarioSummaryMeta({
  flightId: replayData?.flight_id || flight_id,

  flightTimestamp: replayData?.flight_start_time,

  reportCreatedAt:
    replayData?.created_at ||
    replayData?.flight_start_time,   // fallback

  lastEventTime:
    replayData?.last_event_time ||
    replayData?.latest_event_at ||
    getLastEventTimestamp(replayData?.events || []) ||
    getLastReplayTimestamp(replayData?.replay || []),  // fallback

  version:
    replayData?.report_version ||
    replayData?.version ||
    "v0.3"
});

      const replayItems = toArray(replayData?.replay);
      if (!replayItems.length) {
        alert("No replay data");
        return;
      }

      const pts = replayItems
        .map((p) => {
          const t = safeDateMs(p?.timestamp);
          const lat = toNullableNumber(p?.lat);
          const lng = toNullableNumber(p?.lon);
          const alt = toNumber(p?.altitude_m, 0);

          if (t === null || lat === null || lng === null) return null;
          return { lat, lng, alt, t };
        })
        .filter(Boolean);

      if (!pts.length) {
        alert("Replay data is present but invalid");
        return;
      }

      const t0 = pts[0].t;
      const duration = Math.max(0, pts[pts.length - 1].t - t0);

      flightBounds = new maplibregl.LngLatBounds();
      pts.forEach((p) => flightBounds.extend([p.lng, p.lat]));

      let pointStatus = [];
      try {
        const complianceJson = await fetchJson(COMPLIANCE_URL, "Compliance fetch failed");
        pointStatus = toArray(complianceJson?.items);
      } catch (err) {
        console.warn("Compliance fetch error:", err.message);
      }

     let validationJson = null;

      try {
        validationJson = await fetchJson("/api/fsms/validation/latest", "Validation report failed");

        const report = validationJson?.report || {};
        latestScenarios = report?.summary?.scenarios || [];

        const summary = {
          ...computeSummary(
            report?.results || [],
            report?.generated_at || null
          ),
          flightId: report?.flight_id || null,
          reportVersion: report?.report_version || null,
          reportFile: validationJson?.report_file || null
        };

        renderSummary(summary);
        renderScenarioPanel();
        } catch (err) {
          console.warn("Validation report error:", err.message);
        }


      function getComplianceForReplayTime(ts, fallbackIndex = 0) {
        if (!pointStatus.length) return null;

        const safeFallback = pointStatus[Math.min(fallbackIndex, pointStatus.length - 1)] || null;
        const targetMs = safeDateMs(ts);
        if (targetMs === null) return safeFallback;

        let exact = null;
        let best = null;
        let bestDiff = Infinity;

        for (const item of pointStatus) {
          const itemTs = safeDateMs(item?.ts || item?.timestamp || item?.time);
          if (itemTs === null) continue;

          if (itemTs === targetMs) {
            exact = item;
            break;
          }

          const diff = Math.abs(itemTs - targetMs);
          if (diff < bestDiff) {
            best = item;
            bestDiff = diff;
          }
        }

        return exact || best || safeFallback;
      }

     function interpolate(time) {
  if (!pts.length) {
    return { lng: 0, lat: 0, alt: 0, t: time, source_t: time };
  }

  const clampedTime = clamp(time, pts[0].t, pts[pts.length - 1].t);

  while (currentIndex < pts.length - 2 && pts[currentIndex + 1].t <= clampedTime) {
    currentIndex++;
  }

  while (currentIndex > 0 && pts[currentIndex].t > clampedTime) {
    currentIndex--;
  }

  const a = pts[currentIndex] || pts[0];
  const b = pts[currentIndex + 1] || a;
  const span = b.t - a.t;

  if (span <= 0 || span > MAX_INTERPOLATION_GAP_MS) {
    return {
      lng: a.lng,
      lat: a.lat,
      alt: a.alt,
      t: clampedTime,
      source_t: a.t
    };
  }

  const f = clamp((clampedTime - a.t) / span, 0, 1);

  return {
    lng: a.lng + (b.lng - a.lng) * f,
    lat: a.lat + (b.lat - a.lat) * f,
    alt: a.alt + (b.alt - a.alt) * f,
    t: clampedTime,
    source_t: a.t
  };
}

       
  function computeSummary(reportRows, generatedAt = null) {
    const rows = Array.isArray(reportRows) ? reportRows : [];

    let passCount = 0;
    let reviewCount = 0;
    let failCount = 0;
    let breachScenariosCovered = 0;
    let passingLeadSum = 0;
    let passingLeadCount = 0;

    for (const row of rows) {
      const score = row?.score;

      if (score === "PASS") passCount += 1;
      else if (score === "REVIEW") reviewCount += 1;
      else if (score === "FAIL") failCount += 1;

      const hasTruthBreachEvent =
        row?.first_truth_event !== null &&
        row?.first_truth_event !== undefined;

      if (hasTruthBreachEvent) {
        breachScenariosCovered += 1;
      }

      const isBaseline = row?.scenario === "baseline";
      const isBorderlineCeiling = row?.scenario === "borderline_ceiling";
      const lead = row?.lead_seconds;

      const eligibleForAvgLeadTime =
        hasTruthBreachEvent &&
        score === "PASS" &&
        !isBaseline &&
        !isBorderlineCeiling &&
        isFiniteNumber(lead);

      if (eligibleForAvgLeadTime) {
        passingLeadSum += Number(lead);
        passingLeadCount += 1;
      }
    }

    return {
      totalScenarios: rows.length,
      passCount,
      reviewCount,
      failCount,
      latestRunTimestamp: generatedAt,
      avgPassLeadSeconds:
        passingLeadCount > 0 ? passingLeadSum / passingLeadCount : null,
      breachScenariosCovered,
    };
  }

    function formatTimestamp(ts) {
    if (!ts) return "Unknown";
    const d = new Date(ts);
    return d.toLocaleString();  // clean readable format
  }

    function getLastReplayTimestamp(replay = []) {
    if (!replay.length) return null;
    return replay[replay.length - 1]?.timestamp || null;
  }

  function formatLeadTime(seconds) {
    if (seconds == null || Number.isNaN(seconds)) return "N/A";
    return `${seconds.toFixed(1)}s`;
  }

  function getScenarioRowClass(classification) {
  const cls = String(classification || "").toUpperCase();

  if (cls === "PASS") return "pass-row";
  if (cls === "REVIEW") return "review-row";
  if (cls === "FAIL") return "fail-row";
  return "";
}

 function getScenarioToneClass(value) {
  const v = String(value || "").toUpperCase();

  if (v === "PASS" || v === "EARLY") return "tone-pass";
  if (v === "REVIEW" || v === "EDGE") return "tone-review";
  if (v === "FAIL") return "tone-fail";
  if (v === "NO-BREACH") return "tone-neutral";

  return "tone-neutral";
}

function renderScenarioList() {
  const root = document.getElementById("scenario-list");
  if (!root) return;

  if (!Array.isArray(latestScenarios) || !latestScenarios.length) {
    root.innerHTML = `<div class="summary-subtitle">No scenarios available</div>`;
    return;
  }

  root.innerHTML = latestScenarios.map((row) => {
    const toneClass = getScenarioToneClass(row.classification);

    return `
      <div
        class="scenario-row ${row.scenario_id === activeScenarioId ? "active" : ""}"
        style="padding: 8px 10px; border-radius: 8px; margin-top: 6px; background: rgba(255,255,255,0.04);"
        onclick="selectScenario('${row.scenario_id}')"
      >
        <span class="scenario-name">${row.name ?? "-"}</span>
        <span class="scenario-status ${toneClass}">${row.classification ?? "-"}</span>
      </div>
    `;
  }).join("");
}

  function renderSummary(summary) {
  document.getElementById("summary-total").textContent = String(summary.totalScenarios);
  document.getElementById("summary-pass").textContent = String(summary.passCount);
  document.getElementById("summary-review").textContent = String(summary.reviewCount);
  document.getElementById("summary-fail").textContent = String(summary.failCount);
  document.getElementById("summary-latest-run").textContent = formatTimestamp(summary.latestRunTimestamp);
  document.getElementById("summary-avg-lead").textContent = formatLeadTime(summary.avgPassLeadSeconds);

  document.getElementById("summary-breach-covered").textContent =
    `${summary.breachScenariosCovered} breach scenarios covered`;

 const flightEl = document.getElementById("summary-flight");
  if (flightEl) {
    flightEl.classList.add("copyable");
    flightEl.style.cursor = "pointer";

    flightEl.onclick = () => {
      const flightText =
        flightEl.textContent?.replace(/^Flight:\s*/, "") || "";

      if (!flightText || flightText === "Unknown" || flightText === "—") return;

      navigator.clipboard.writeText(flightText);

      const prev = flightEl.textContent;
      flightEl.textContent = "Copied flight ID ✓";

      setTimeout(() => {
        flightEl.textContent = prev;
      }, 1200);
    };
  }

const versionEl = document.getElementById("summary-version");
if (versionEl) {
  versionEl.classList.add("copyable");
  versionEl.style.cursor = "pointer";

  versionEl.onclick = () => {
    const versionText =
      versionEl.textContent
        ?.replace(/^Report version:\s*/, "")
        .replace(/^Report file:\s*/, "") || "";

    if (!versionText || versionText === "Unknown" || versionText === "—") return;

    navigator.clipboard.writeText(versionText);

    const prev = versionEl.textContent;
    versionEl.textContent = "Copied report ✓";

    setTimeout(() => {
      versionEl.textContent = prev;
    }, 1200);
  };
}

  renderScenarioList();
  }


      // =========================
      // MAP INIT
      // =========================
      const map = new maplibregl.Map({
        container: "map",
        style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAP_KEY}`,
        center: [pts[0].lng, pts[0].lat],
        zoom: 14,
        pitch: 50
      });

      map.addControl(new maplibregl.NavigationControl());

      const aircraftEl = document.createElement("div");
      aircraftEl.className = "aircraft-dot";
      const aircraft = new maplibregl.Marker({ element: aircraftEl })
        .setLngLat([pts[0].lng, pts[0].lat])
        .addTo(map);

      const ghostEl = document.createElement("div");
      ghostEl.className = "ghost-dot";
      const ghost = new maplibregl.Marker({ element: ghostEl })
        .setLngLat([pts[0].lng, pts[0].lat])
        .addTo(map);

      const breachEl = document.createElement("div");
      breachEl.className = "breach-dot";
      breachEl.style.display = "none";
      const breachMarker = new maplibregl.Marker({ element: breachEl })
        .setLngLat([pts[0].lng, pts[0].lat])
        .addTo(map);

      const entryEl = document.createElement("div");
      entryEl.className = "entry-dot";
      entryEl.style.display = "none";
      const entryMarker = new maplibregl.Marker({ element: entryEl })
        .setLngLat([pts[0].lng, pts[0].lat])
        .addTo(map);

      const vectorLabelEl = document.createElement("div");
      Object.assign(vectorLabelEl.style, {
        background: "rgba(10,12,16,0.9)",
        color: "#e8eefc",
        padding: "4px 6px",
        borderRadius: "6px",
        fontFamily: "ui-monospace, Menlo, Consolas, monospace",
        fontSize: "11px",
        fontWeight: "700",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
        display: "none",
        whiteSpace: "nowrap"
      });

      const vectorLabel = new maplibregl.Marker({
        element: vectorLabelEl,
        offset: [20, -25]
      }).setLngLat([pts[0].lng, pts[0].lat]).addTo(map);

      map.on("load", async () => {
        mapReady = true;
        mapStyleReady = true;

        setupFeatureToggles();
        ensureTrendLayer(map);
        ensureVectorLayers(map);
        ensurePredictiveEnvelopeLayers(map);

        try {
          airspaceGeojson = await fetchJson(AIRSPACE_URL, "Airspace fetch failed");
          if (!Array.isArray(airspaceGeojson?.features)) {
            airspaceGeojson = { type: "FeatureCollection", features: [] };
          }

          airspaceLoaded = true;
          ensureAirspaceLayers(map);

          airspaceBounds = computeGeojsonBounds(airspaceGeojson);
          if (airspaceBounds) {
            zoomAirspaceBtn.disabled = false;
            zoomBothBtn.disabled = false;
          }

          document.querySelectorAll(".zone-filter").forEach((cb) => {
            cb.addEventListener("change", () => updateZoneFilter(map));
          });

          updateZoneFilter(map);
        } catch (err) {
          console.warn("Airspace not loaded:", err.message);
          airspaceGeojson = { type: "FeatureCollection", features: [] };
          airspaceLoaded = false;
        }

        map.addSource("flight-path", {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: pts.map((p) => [p.lng, p.lat])
            }
          }
        });

        map.addLayer({
          id: "flight-line",
          type: "line",
          source: "flight-path",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#ff0000",
            "line-opacity": 0.95,
            "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2, 12, 4, 14, 6, 16, 10, 18, 14]
          }
        });

        zoomTo(map, flightBounds);
        requestAnimationFrame(loop);
      });

      map.on("styledata", () => {
        const ready = map.isStyleLoaded?.() ?? false;
        mapStyleReady = ready;
        if (!ready) return;

        try {
          rehydrateMapOverlays(map);
          debugLog("Map overlays rehydrated after styledata");
        } catch (err) {
          debugWarn("Failed to rehydrate overlays after style change", err);
        }
      });

     
  // =========================
  // FRAME LAYERS
  // =========================
        function computeReplayFrame(now) {
    if (lastFrame === null) lastFrame = now;
    const dt = now - lastFrame;
    lastFrame = now;

    if (playing) {
      simElapsed += dt * speed;
      if (simElapsed > duration) {
        simElapsed = duration;
        playing = false;
        playBtn.textContent = "Play";
      }
    }

    const simTimeMs = simElapsed;
    startupMuted = simTimeMs < STARTUP_MUTED_UNTIL_MS;

    if (simElapsed < (computeReplayFrame._lastSimElapsed ?? 0)) {
      resetReplayDerivedState({ preserveLogs: false });
      renderEventLog(flightEventLog, simElapsed, duration, true);
    }

    computeReplayFrame._lastSimElapsed = simElapsed;

    const replayTime = t0 + simElapsed;
    const rawState = interpolate(replayTime);

    let displayPos = rawState;

    if (lastDisplayPos && distanceM(lastDisplayPos, displayPos) < 0.5) {
      displayPos = lastDisplayPos;
    }

    lastDisplayPos = displayPos;

    if (FEATURES.kalman) {
      displayPos = kalmanLike(lastSmoothedPos || rawState, rawState);
      lastSmoothedPos = displayPos;
    } else {
      lastSmoothedPos = null;
    }

    const progress = duration > 0 ? (simElapsed / duration) * 100 : 0;

    const curr = pts[currentIndex] || pts[0];
    const next = pts[Math.min(pts.length - 1, currentIndex + 1)] || curr;
    const dtTrack = Math.max(0.001, (next.t - curr.t) / 1000);

    const groundspeed = distanceM(
      { lng: curr.lng, lat: curr.lat },
      { lng: next.lng, lat: next.lat }
    ) / dtTrack;

    const brg = bearingDeg(
      { lng: curr.lng, lat: curr.lat },
      { lng: next.lng, lat: next.lat }
    );

    const vz = ((next.alt ?? 0) - (curr.alt ?? 0)) / dtTrack;

    const currentReplayTime = rawState.t;
    const tFutureTrend = Math.min(t0 + duration, currentReplayTime + TREND_SECONDS * 1000);
    const posFuture = interpolate(tFutureTrend);

    return {
      now,
      dt,
      simTimeMs,
      replayTime,
      rawState,
      displayPos,
      progress,
      curr,
      next,
      dtTrack,
      groundspeed,
      brg,
      vz,
      posFuture
    };
  }

  function computeComplianceState(frame) {
    const c = getComplianceForReplayTime(frame.replayTime, currentIndex);
    const zone = c?.zone || null;
    const zoneName = zone?.name || "None";
    const zoneType = zone?.zone_type || "-";
    const status = c?.eval_status || zone?.eval_status || "-";
    const upperM = zone?.upper_m ?? null;
    const lowerM = zone?.lower_m ?? null;

    const altAgl = c?.alt_agl_m ?? null;
    const altAmsl = c?.alt_amsl_m ?? frame.displayPos.alt;
    const terrainAmsl =
      altAgl !== null && altAmsl !== null
        ? toNumber(altAmsl) - toNumber(altAgl)
        : null;

    let margin = null;
    let marginTruth = null;
    let basis = "—";

    if (upperM !== null && upperM !== undefined) {
      if (toStringSafe(status).includes("_AGL") && altAgl !== null && altAgl !== undefined) {
        const upperTruth = toNumber(upperM);
        const altTruth = toNumber(altAgl);

        marginTruth = upperTruth - altTruth;

        const upperDisplay = Math.floor(upperTruth / 10) * 10;
        margin = upperDisplay - altTruth;

        basis = "AGL";
      } else if (altAmsl !== null && altAmsl !== undefined) {
        const upperTruth = toNumber(upperM);
        const altTruth = toNumber(altAmsl);

        marginTruth = upperTruth - altTruth;

        const upperDisplay = Math.floor(upperTruth / 10) * 10;
        margin = upperDisplay - altTruth;

        basis = "AMSL";
      }
    }

    const predictionAltNow = basis === "AGL" ? altAgl : altAmsl;
    const zoneSource =
      zone?.source ||
      zone?.source_name ||
      zone?.authority_name ||
      zone?.external_id ||
      "Unknown";

    const verticalRelation = describeVerticalRelation(predictionAltNow, lowerM, upperM);

    return {
      compliance: c,
      zone,
      zoneName,
      zoneType,
      status,
      upperM,
      lowerM,
      altAgl,
      altAmsl,
      terrainAmsl,
      margin,
      marginTruth,
      basis,
      predictionAltNow,
      zoneSource,
      verticalRelation
    };
  }

  function computePredictionState(frame, complianceState) {
    const predictSeconds =
      frame.groundspeed > 0
        ? Math.min(MAX_PREDICT_SECONDS, MAX_PREDICT_DIST / frame.groundspeed)
        : MAX_PREDICT_SECONDS;

    const predictedDistanceM =
      frame.groundspeed > 0
        ? Math.min(MAX_PREDICT_DIST, frame.groundspeed * predictSeconds)
        : 0;

    const hasAirspace = airspaceLoaded && toArray(airspaceGeojson?.features).length > 0;

    let futurePath = [];
    let predictiveEnvelope = null;
    let predictiveEnvelopeConflicts = [];
    let boundaryPrediction = null;
    let conflict4D = null;
    let verticalTtb = null;

    if (FEATURES.prediction && hasAirspace) {
      const shouldCalc = shouldRecalculatePrediction({
        nowMs: frame.now,
        pos: frame.displayPos,
        brg: frame.brg,
        groundspeed: frame.groundspeed
      });

      if (shouldCalc) {
        cachedPredictionResult = computePredictionBundle({
          pos: frame.displayPos,
          brg: frame.brg,
          groundspeed: frame.groundspeed,
          vz: frame.vz,
          predictSeconds,
          predictionAltNow: complianceState.predictionAltNow
        });

        lastPredictionCalcMs = frame.now;
        lastPredictionInputs = {
          pos: { lat: frame.displayPos.lat, lng: frame.displayPos.lng },
          brg: frame.brg,
          groundspeed: frame.groundspeed
        };
      }

      ({
        futurePath,
        predictiveEnvelope,
        predictiveEnvelopeConflicts,
        boundaryPrediction,
        conflict4D,
        verticalTtb
      } = cachedPredictionResult);
    } else {
      cachedPredictionResult = {
        futurePath: [],
        predictiveEnvelope: null,
        predictiveEnvelopeConflicts: [],
        boundaryPrediction: null,
        conflict4D: null,
        verticalTtb: null
      };

      lastPredictionInputs = null;
      lastPredictionCalcMs = -Infinity;
    }

    const ttb = predictTtb(complianceState.margin, frame.vz);

    return {
      hasAirspace,
      predictSeconds,
      predictedDistanceM,
      futurePath,
      predictiveEnvelope,
      predictiveEnvelopeConflicts,
      boundaryPrediction,
      conflict4D,
      verticalTtb,
      ttb
    };
  }

  function computeRiskState(frame, complianceState, predictionState) {
    const rawRiskScore = computeOperationalRisk({
      zoneType: complianceState.zoneType,
      margin: complianceState.margin,
      ttb: predictionState.ttb,
      conflict4D: predictionState.conflict4D,
      boundaryPrediction: predictionState.boundaryPrediction,
      verticalRelation: complianceState.verticalRelation,
      envelopeCount: predictionState.predictiveEnvelopeConflicts.length,
      vz: frame.vz
    });

    smoothedRiskScore = smoothValue(smoothedRiskScore, rawRiskScore, 0.25);

    const displayRiskScore = Math.round(smoothedRiskScore);
    const displayRiskInfo = computeRiskLevel(displayRiskScore);
    const riskTrend = getRiskTrend(lastDisplayedRiskScore, displayRiskScore, 2);
    const riskDelta = displayRiskScore - lastDisplayedRiskScore;
    lastDisplayedRiskScore = displayRiskScore;

    const riskSummary = getRiskReasonSummary({
      margin: complianceState.margin,
      ttb: predictionState.ttb,
      conflict4D: predictionState.conflict4D,
      boundaryPrediction: predictionState.boundaryPrediction,
      envelopeCount: predictionState.predictiveEnvelopeConflicts.length
    });

    lastRiskLabel = logRiskTransition({
      replayTime: frame.replayTime,
      previousRiskLabel: lastRiskLabel,
      currentRiskLabel: displayRiskInfo.label,
      riskScore: displayRiskScore,
      details: riskSummary
    });

    const hazardPos =
      predictionState.conflict4D?.conflict
        ? predictionState.conflict4D.pos
        : predictionState.boundaryPrediction?.pos || null;

    const zoneBearing = hazardPos ? bearingDeg(frame.displayPos, hazardPos) : null;
    const turnBias = computeTurnBias({ brg: frame.brg, zoneBearing });

    const advisory = computeAdvisory({
      margin: complianceState.margin,
      vz: frame.vz,
      ttb: predictionState.ttb,
      conflict4D: predictionState.conflict4D,
      boundaryPrediction: predictionState.boundaryPrediction,
      verticalRelation: complianceState.verticalRelation,
      zoneName: complianceState.zoneName,
      zoneType: complianceState.zoneType,
      groundspeed: frame.groundspeed,
      turnBias
    });

    const stableAdvisory = stabilizeAdvisoryDisplay(
      advisory,
      frame.replayTime || Date.now(),
      { holdMs: 1500, candidateDwellMs: 700 }
    );

    const advisoryConfidence = computeAdvisoryConfidence({
      conflict4D: predictionState.conflict4D,
      boundaryPrediction: predictionState.boundaryPrediction,
      turnBias,
      ttb: predictionState.ttb,
      verticalRelation: complianceState.verticalRelation,
      zoneType: complianceState.zoneType
    });

    const advisoryPriorityText =
      stableAdvisory?.priorityScore != null
        ? stableAdvisory.priorityScore.toFixed(1)
        : "—";

    return {
      rawRiskScore,
      displayRiskScore,
      displayRiskInfo,
      riskTrend,
      riskDelta,
      riskSummary,
      turnBias,
      advisory,
      stableAdvisory,
      advisoryConfidence,
      advisoryPriorityText
    };
  }

  function updateReplayEvents(frame, complianceState, predictionState, riskState) {
    if (!startupMuted) {
      logFlightEvents({
        replayIso: new Date(frame.rawState.t).toISOString(),
        simTimeMs: simElapsed,
        riskLabel: riskState.displayRiskInfo.label,
        riskScore: riskState.displayRiskScore,
        advisory: riskState.stableAdvisory,
        ttb: predictionState.ttb,
        boundaryPrediction: predictionState.boundaryPrediction,
        conflict4D: predictionState.conflict4D,
        envelopeConflictCount: predictionState.predictiveEnvelopeConflicts.length,
        zoneName: complianceState.zoneName,
        zoneType: complianceState.zoneType,
        margin: complianceState.margin,
        verticalRelation: complianceState.verticalRelation
      });
    }

    renderEventLog(flightEventLog, simElapsed, duration);
    if (playing) {
      scrollCurrentEventIntoView();
    }
  }

  function renderWarningStrip(riskState, complianceState, predictionState) {
    let warnText = "";
    let warnClass = "";
    let warnShow = false;

    if (!startupMuted && FEATURES.prediction && complianceState.margin !== null && !Number.isNaN(complianceState.margin)) {
      if (complianceState.margin < 0) {
        warnShow = true;
        warnClass = "risk-breach";
        warnText = "BREACH — IMMEDIATE ACTION";
      } else if (predictionState.ttb !== null && predictionState.ttb <= 30) {
        warnShow = true;
        warnClass = "risk-warning";
        warnText = `PREDICTED BREACH IN ${Math.round(predictionState.ttb)}s`;
      } else if (predictionState.conflict4D?.conflict) {
        warnShow = true;
        warnClass = "risk-warning";
        warnText = `4D CONFLICT IN ${Math.round(predictionState.conflict4D.ttb_s)}s (${predictionState.conflict4D.zoneName})`;
      } else if (predictionState.conflict4D && predictionState.conflict4D.vertical_known === false) {
        warnShow = true;
        warnClass = "risk-caution";
        warnText = `BOUNDARY ENTRY IN ${Math.round(predictionState.conflict4D.ttb_s)}s — VERTICAL UNKNOWN (${predictionState.conflict4D.zoneName})`;
      } else if (predictionState.boundaryPrediction) {
        warnShow = true;
        warnClass = "risk-caution";
        warnText = `TRACK ENTRY IN ${Math.round(predictionState.boundaryPrediction.ttb_s)}s (${predictionState.boundaryPrediction.zoneName})`;
      } else if (complianceState.margin <= 20) {
        warnShow = true;
        warnClass = "risk-warning";
        warnText = "WARNING — LOW MARGIN";
      } else if (complianceState.margin <= 50) {
        warnShow = true;
        warnClass = "risk-caution";
        warnText = "CAUTION — MARGIN REDUCING";
      }
    }

    if (!startupMuted && riskState.stableAdvisory.level !== "INFO") {
      warnShow = true;
      warnClass = riskState.stableAdvisory.cls;
      warnText = riskState.stableAdvisory.text;
    }

    if (!warnRoot) return;

    if (!warnShow) {
      warnRoot.innerHTML = "";
      return;
    }

    warnRoot.innerHTML = `
      <div class="warnstrip show ${escapeHtml(warnClass)}">
        ${escapeHtml(warnText)}
      </div>
    `;
  }

  function renderMapFrame(frame, complianceState, predictionState, riskState) {
    aircraft.setLngLat([frame.displayPos.lng, frame.displayPos.lat]);

    const nowMs = performance.now();
    if (playing && nowMs - lastCameraUpdate > 200) {
      map.easeTo({
        center: [frame.displayPos.lng, frame.displayPos.lat],
        duration: 300,
        easing: (x) => x
      });
      lastCameraUpdate = nowMs;
    }

    ghostEl.style.display = (playing && FEATURES.trend) ? "block" : "none";
    safeSetLayerVisibility(map, "trend-line", playing && FEATURES.trend);

    if (FEATURES.trend) {
      ghost.setLngLat([frame.posFuture.lng, frame.posFuture.lat]);
      safeSetGeojsonData(map, "trend", {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [frame.rawState.lng, frame.rawState.lat],
            [frame.posFuture.lng, frame.posFuture.lat]
          ]
        }
      });
    }

    const vectorVisible = FEATURES.vectors && Number.isFinite(frame.brg);
    safeSetLayerVisibility(map, "heading-vector-line", vectorVisible);
    safeSetLayerVisibility(map, "flight-vector-arrow-fill", vectorVisible);

    if (vectorVisible) {
      const headingEnd = movePoint(
        { lat: frame.displayPos.lat, lng: frame.displayPos.lng },
        frame.brg,
        50
      );

      const projectedEnd = movePoint(
        { lat: frame.displayPos.lat, lng: frame.displayPos.lng },
        frame.brg,
        frame.groundspeed > 0 ? Math.max(70, Math.min(180, frame.groundspeed * 4)) : 90
      );

      safeSetGeojsonData(map, "heading-vector", {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [frame.displayPos.lng, frame.displayPos.lat],
            [headingEnd.lng, headingEnd.lat]
          ]
        }
      });

      safeSetGeojsonData(map, "flight-vector-arrow", {
        type: "FeatureCollection",
        features: [makeArrowHead(projectedEnd, frame.brg, 12, 24)]
      });
    }

    if (FEATURES.vectors && vectorVisible) {
      vectorLabelEl.style.display = "block";
      vectorLabel.setLngLat([frame.displayPos.lng, frame.displayPos.lat]);
      vectorLabelEl.innerHTML =
        `HDG ${Number.isFinite(frame.brg) ? frame.brg.toFixed(0) : "—"}° | ` +
        `GS ${isFiniteNumber(frame.groundspeed) ? frame.groundspeed.toFixed(1) : "—"} m/s | ` +
        `VS ${isFiniteNumber(frame.vz) ? frame.vz.toFixed(1) : "—"} m/s`;
    } else {
      vectorLabelEl.style.display = "none";
    }

    safeSetGeojsonData(
      map,
      "predictive-envelope",
      predictionState.predictiveEnvelope || { type: "FeatureCollection", features: [] }
    );

    safeSetGeojsonData(map, "predictive-envelope-conflicts", {
      type: "FeatureCollection",
      features: predictionState.predictiveEnvelopeConflicts.map((x) => x.overlap).filter(Boolean)
    });

    aircraftEl.style.background =
      complianceState.compliance?.breach_unknown ? "#ffbf00" :
      complianceState.compliance?.breach ? "#ff0000" :
      complianceState.compliance ? "#00ff00" : "#0057ff";

    if (!startupMuted && FEATURES.prediction && predictionState.ttb !== null && predictionState.ttb > 0 && predictionState.ttb <= 120) {
      const tBreach = Math.min(t0 + duration, frame.rawState.t + predictionState.ttb * 1000);
      const breachPos = interpolate(tBreach);

      if (isValidLngLat(breachPos)) {
        breachMarker.setLngLat([breachPos.lng, breachPos.lat]);
        breachEl.style.display = "block";
      } else {
        breachEl.style.display = "none";
      }
    } else {
      breachEl.style.display = "none";
    }

    if (!startupMuted && FEATURES.prediction && (predictionState.conflict4D?.conflict || predictionState.boundaryPrediction)) {
      const p = predictionState.conflict4D?.conflict
        ? predictionState.conflict4D.pos
        : predictionState.boundaryPrediction?.pos;

      if (p && isValidLngLat(p)) {
        entryMarker.setLngLat([p.lng, p.lat]);
        entryEl.style.display = "block";

        if (predictionState.conflict4D?.conflict) {
          entryEl.style.border = "3px solid #ff0000";
          entryEl.style.background = "rgba(255,0,0,0.18)";
        } else {
          entryEl.style.border = "3px solid #ffbf00";
          entryEl.style.background = "rgba(255,191,0,0.18)";
        }
      } else {
        entryEl.style.display = "none";
      }
    } else {
      entryEl.style.display = "none";
    }

    safeSetLayerVisibility(map, "airspace-3d", FEATURES.cone);
  }

  

    

 function renderFrame(frame, complianceState, predictionState, riskState) {
  renderMapFrame(frame, complianceState, predictionState, riskState);

  renderHud({
    hud,
    airspaceGeojson,
    speed,
    frame,
    complianceState,
    predictionState,
    riskState,
    helpers: {
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
    }
  });

  renderWarningStrip(riskState, complianceState, predictionState);

  if (slider) {
    slider.value = duration > 0 ? String(simElapsed / duration) : "0";
  }

  window._fsmsDebug = {
    simElapsed,
    simTimeMs: frame.simTimeMs,
    playing,
    currentIndex,
    risk: riskState.displayRiskInfo?.label ?? null,
    advisory: riskState.stableAdvisory?.text ?? null,
    airspaceLoaded,
    hasAirspace: predictionState.hasAirspace
  };
}

  // =========================
  // MAIN LOOP
  // =========================
  function loop(now) {
    if (!map || !mapReady) {
      requestAnimationFrame(loop);
      return;
    }

    const styleReady = map.isStyleLoaded?.() ?? true;
    if (!styleReady) {
      requestAnimationFrame(loop);
      return;
    }

    const frame = computeReplayFrame(now);
    const complianceState = computeComplianceState(frame);
    const predictionState = computePredictionState(frame, complianceState);
    const riskState = computeRiskState(frame, complianceState, predictionState);

    updateReplayEvents(frame, complianceState, predictionState, riskState);
    renderFrame(frame, complianceState, predictionState, riskState);

    requestAnimationFrame(loop);
  }

      // =========================
      // CONTROLS
      // =========================
      zoomFlightBtn.onclick = () => zoomTo(map, flightBounds);
zoomAirspaceBtn.onclick = () => zoomTo(map, airspaceBounds);
zoomBothBtn.onclick = () => zoomTo(map, unionBounds(flightBounds, airspaceBounds));

playBtn.onclick = () => {
  const atEnd = simElapsed >= duration - 1;

  if (atEnd) {
    simElapsed = 0;
    currentIndex = 0;
    lastFrame = null;
    resetReplayDerivedState({ preserveLogs: false });
    renderEventLog(flightEventLog, simElapsed, duration, true);
  }

  playing = !playing;
  playBtn.textContent = playing ? "Pause" : "Play";
};

slider.oninput = (e) => {
  const ratio = clamp(toNumber(e.target.value, 0), 0, 1);
  const ms = duration > 0 ? ratio * duration : 0;
  jumpToSimTime(ms, duration);
};

speedSel.onchange = () => {
  speed = toNumber(speedSel.value, 1);
};

const featureToggleBtn = document.getElementById("feature-toggle");
if (featureToggleBtn) {
  featureToggleBtn.onclick = () => {
    const panel = document.getElementById("feature-panel");
    if (panel) {
      panel.style.display = panel.style.display === "block" ? "none" : "block";
    }
  };
}
})();
