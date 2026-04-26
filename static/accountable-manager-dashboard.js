const organisationIdInput = document.getElementById("organisation-id-input");
const authEmailInput = document.getElementById("auth-email-input");
const authPasswordInput = document.getElementById("auth-password-input");
const loginButton = document.getElementById("login-btn");
const loadDashboardButton = document.getElementById("load-dashboard-btn");
const copyLinkButton = document.getElementById("copy-link-btn");
const dashboardStatus = document.getElementById("dashboard-status");
const authStatus = document.getElementById("auth-status");
const loadedOrgPill = document.getElementById("loaded-org-pill");
const metricsGrid = document.getElementById("metrics-grid");
const stageGrid = document.getElementById("stage-grid");
const alertGrid = document.getElementById("alert-grid");
const hotspotGrid = document.getElementById("hotspot-grid");
const missionsTable = document.getElementById("missions-table");

const SESSION_STORAGE_KEY = "verityatlas_document_portal_session_token";
const SESSION_USER_KEY = "verityatlas_document_portal_session_user";

const state = {
  organisationId: "",
  sessionToken: "",
  sessionUser: null,
  dashboard: null,
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const toneClass = (value) => {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("pass") || text.includes("stable") || text.includes("healthy")) {
    return "tone-ok";
  }
  if (text.includes("warning") || text.includes("emerging") || text.includes("review")) {
    return "tone-warn";
  }
  if (text.includes("fail") || text.includes("immediate") || text.includes("attention")) {
    return "tone-bad";
  }
  return "tone-info";
};

const heatResultClass = (value) => {
  const text = String(value ?? "").toLowerCase();
  if (text === "pass") return "heat-pass";
  if (text === "warning") return "heat-warning";
  if (text === "fail") return "heat-fail";
  if (text === "stable") return "heat-stable";
  if (text === "emerging") return "heat-emerging";
  if (text === "immediate") return "heat-immediate";
  return "";
};

const renderBadge = (value) =>
  `<span class="badge ${toneClass(value)}">${escapeHtml(value ?? "Unknown")}</span>`;

const renderChip = (value) =>
  `<span class="chip ${heatResultClass(value)}">${escapeHtml(value ?? "Unknown")}</span>`;

const setDashboardStatus = (message, tone = "tone-info") => {
  dashboardStatus.className = `status-pill ${tone}`;
  dashboardStatus.textContent = message;
};

const setAuthStatus = (message, tone = "tone-info") => {
  authStatus.className = `status-pill ${tone}`;
  authStatus.textContent = message;
};

const updateAuthStatus = () => {
  if (state.sessionUser?.email) {
    setAuthStatus(`Signed in as ${state.sessionUser.email}`, "tone-ok");
  } else {
    setAuthStatus("No active session", "tone-warn");
  }
};

const getSessionHeaders = () =>
  state.sessionToken ? { "X-Session-Token": state.sessionToken } : {};

const persistSession = () => {
  if (state.sessionToken) {
    window.localStorage.setItem(SESSION_STORAGE_KEY, state.sessionToken);
  }

  if (state.sessionUser) {
    window.localStorage.setItem(SESSION_USER_KEY, JSON.stringify(state.sessionUser));
  }
};

const loadStoredSession = () => {
  state.sessionToken = window.localStorage.getItem(SESSION_STORAGE_KEY) ?? "";
  const rawUser = window.localStorage.getItem(SESSION_USER_KEY);
  if (!rawUser) {
    return;
  }

  try {
    state.sessionUser = JSON.parse(rawUser);
  } catch {
    state.sessionUser = null;
  }
};

const updateUrl = (organisationId) => {
  const next = new URL(window.location.href);
  if (organisationId) {
    next.searchParams.set("organisationId", organisationId);
  } else {
    next.searchParams.delete("organisationId");
  }
  window.history.replaceState({}, "", next);
};

const getOrganisationIdFromLocation = () => {
  const pathMatch = window.location.pathname.match(
    /^\/operator\/organisations\/([^/]+)\/accountable-manager-dashboard$/,
  );
  if (pathMatch?.[1]) {
    return decodeURIComponent(pathMatch[1]);
  }

  return new URL(window.location.href).searchParams.get("organisationId")?.trim() ?? "";
};

const formatDateTime = (value) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
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

const renderMetrics = () => {
  const dashboard = state.dashboard;
  if (!dashboard) {
    metricsGrid.innerHTML = "";
    return;
  }

  const cards = [
    {
      label: "Overall posture",
      value: dashboard.overall.result,
      meta: dashboard.overall.headline,
    },
    {
      label: "Immediate attention",
      value: dashboard.summary.immediateAttentionMissions,
      meta: "Missions currently carrying immediate risk pressure.",
    },
    {
      label: "Review pressure",
      value: dashboard.summary.reviewMissions,
      meta: "Missions currently in warning/review territory.",
    },
    {
      label: "Pending amendments",
      value: dashboard.summary.pilotPendingAmendmentCount,
      meta: "OA pilot records pending formal amendment or approval.",
    },
    {
      label: "Override pressure",
      value: dashboard.summary.overridePressureCount,
      meta: "Missions showing override or review-required pressure signals.",
    },
  ];

  metricsGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="metric">
          <div class="label">${escapeHtml(card.label)}</div>
          <div class="value ${toneClass(card.value)}">${escapeHtml(String(card.value))}</div>
          <div class="meta">${escapeHtml(card.meta)}</div>
        </article>
      `,
    )
    .join("");
};

const renderStageMap = () => {
  const stages = state.dashboard?.stageMap ?? [];
  if (stages.length === 0) {
    stageGrid.innerHTML =
      '<div class="empty-state">Load an organisation to see the accountable-manager risk heat map.</div>';
    return;
  }

  stageGrid.innerHTML = stages
    .map(
      (stage) => `
        <article class="stage-tile ${heatResultClass(stage.threatLevel)}">
          <h4>${escapeHtml(stage.label)}</h4>
          <div class="stage-value">${escapeHtml(stage.headline)}</div>
          <div class="chip-row">
            ${renderChip(stage.result)}
            ${renderChip(stage.threatLevel)}
            <span class="chip">${escapeHtml(`${stage.affectedMissionCount} affected`)}</span>
          </div>
        </article>
      `,
    )
    .join("");
};

const renderAlerts = () => {
  const alerts = state.dashboard?.alerts ?? [];
  if (alerts.length === 0) {
    alertGrid.innerHTML =
      '<div class="empty-state">No organisation-level alerts are currently active.</div>';
    return;
  }

  alertGrid.innerHTML = alerts
    .map(
      (alert) => `
        <article class="alert-card ${heatResultClass(alert.threatLevel)}">
          <h4>${escapeHtml(alert.title)}</h4>
          <div class="chip-row">
            ${renderChip(alert.result)}
            ${renderChip(alert.threatLevel)}
          </div>
          <p>${escapeHtml(alert.summary)}</p>
          <div class="link-row">
            <a class="action-link" href="${escapeHtml(alert.targetPath)}">Open related area</a>
          </div>
        </article>
      `,
    )
    .join("");
};

const renderHotspots = () => {
  const hotspots = state.dashboard?.missionHotspots ?? [];
  if (hotspots.length === 0) {
    hotspotGrid.innerHTML =
      '<div class="empty-state">No mission hotspots are currently active.</div>';
    return;
  }

  hotspotGrid.innerHTML = hotspots
    .map(
      (hotspot) => `
        <article class="hotspot-card ${heatResultClass(hotspot.threatLevel)}">
          <h4>${escapeHtml(hotspot.missionPlanId ?? hotspot.missionId)}</h4>
          <div class="chip-row">
            ${renderChip(hotspot.result)}
            ${renderChip(hotspot.threatLevel)}
            <span class="chip">Score ${escapeHtml(String(hotspot.score))}</span>
          </div>
          <p>${escapeHtml(hotspot.headline)}</p>
          <ul class="risk-list">
            ${hotspot.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}
          </ul>
          <div class="link-row">
            <a class="action-link" href="${escapeHtml(hotspot.targetPath)}">Open mission</a>
          </div>
        </article>
      `,
    )
    .join("");
};

const renderMissions = () => {
  const missions = state.dashboard?.missions ?? [];
  if (missions.length === 0) {
    missionsTable.innerHTML =
      '<div class="empty-state">No missions are currently available for this organisation.</div>';
    return;
  }

  missionsTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Mission</th>
          <th>Status</th>
          <th>Operation</th>
          <th>Platform / Pilot</th>
          <th>Updated</th>
          <th>Open</th>
        </tr>
      </thead>
      <tbody>
        ${missions
          .map(
            (mission) => `
              <tr>
                <td>
                  <strong>${escapeHtml(mission.missionPlanId ?? mission.missionId)}</strong>
                  <div class="table-meta">${escapeHtml(mission.missionId)}</div>
                </td>
                <td>${renderBadge(mission.status)}</td>
                <td>
                  ${escapeHtml(mission.operationType ?? "Not recorded")}
                  <div class="table-meta">${mission.requiresBvlos ? "BVLOS required" : "VLOS profile"}</div>
                </td>
                <td>
                  ${escapeHtml(mission.platformName ?? "No platform")}<br />
                  <span class="table-meta">${escapeHtml(mission.pilotName ?? "No pilot")}</span>
                </td>
                <td>${escapeHtml(formatDateTime(mission.updatedAt))}</td>
                <td><a class="action-link" href="/operator/missions/${encodeURIComponent(mission.missionId)}">Open</a></td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
};

const renderDashboard = () => {
  loadedOrgPill.textContent = state.organisationId
    ? `Organisation ${state.organisationId}`
    : "No organisation selected";

  renderMetrics();
  renderStageMap();
  renderAlerts();
  renderHotspots();
  renderMissions();
};

const loadDashboard = async (organisationId) => {
  if (!organisationId) {
    state.organisationId = "";
    state.dashboard = null;
    renderDashboard();
    setDashboardStatus("Enter an organisation ID", "tone-warn");
    return;
  }

  state.organisationId = organisationId;
  updateUrl(organisationId);
  setDashboardStatus("Loading accountable-manager dashboard...", "tone-info");

  try {
    state.dashboard = await fetchJson(
      `/organisations/${organisationId}/accountable-manager-dashboard`,
      {
        headers: getSessionHeaders(),
      },
    );
    renderDashboard();
    setDashboardStatus("Accountable-manager dashboard loaded", "tone-ok");
  } catch (error) {
    state.dashboard = null;
    renderDashboard();
    setDashboardStatus(
      error instanceof Error ? error.message : "Failed to load dashboard",
      "tone-bad",
    );
  }
};

const login = async () => {
  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;

  if (!email || !password) {
    setAuthStatus("Enter email and password", "tone-warn");
    return;
  }

  try {
    const result = await fetchJson("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    state.sessionToken = result.sessionToken;
    state.sessionUser = result.user;
    persistSession();
    updateAuthStatus();
    setDashboardStatus("Session ready", "tone-ok");
  } catch (error) {
    setAuthStatus(
      error instanceof Error ? error.message : "Login failed",
      "tone-bad",
    );
  }
};

loginButton.addEventListener("click", login);
authPasswordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    login();
  }
});

loadDashboardButton.addEventListener("click", () => {
  loadDashboard(organisationIdInput.value.trim());
});

organisationIdInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadDashboard(organisationIdInput.value.trim());
  }
});

copyLinkButton.addEventListener("click", async () => {
  const organisationId = organisationIdInput.value.trim();
  const url = new URL(window.location.href);
  if (organisationId) {
    url.searchParams.set("organisationId", organisationId);
  }

  try {
    await navigator.clipboard.writeText(url.toString());
    setDashboardStatus("Direct link copied", "tone-ok");
  } catch {
    setDashboardStatus("Clipboard write failed", "tone-warn");
  }
});

loadStoredSession();
updateAuthStatus();
renderDashboard();

const initialOrganisationId = getOrganisationIdFromLocation();
if (initialOrganisationId) {
  organisationIdInput.value = initialOrganisationId;
  loadDashboard(initialOrganisationId);
}
