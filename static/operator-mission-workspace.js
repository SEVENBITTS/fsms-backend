const missionIdInput = document.getElementById("mission-id-input");
const loadWorkspaceButton = document.getElementById("load-workspace-btn");
const copyLinkButton = document.getElementById("copy-link-btn");
const openApiButton = document.getElementById("open-api-btn");
const openLiveOpsButton = document.getElementById("open-live-ops-btn");
const connectionStatus = document.getElementById("connection-status");
const loadedMissionPill = document.getElementById("loaded-mission-pill");
const overviewMetrics = document.getElementById("overview-metrics");
const missionSearchInput = document.getElementById("mission-search-input");
const missionSearchButton = document.getElementById("mission-search-btn");
const missionBrowserList = document.getElementById("mission-browser-list");
const missionBrowserDetail = document.getElementById("mission-browser-detail");
const actionsPanel = document.getElementById("actions-panel");
const evidencePanel = document.getElementById("evidence-panel");
const regulatoryMatrixPanel = document.getElementById("regulatory-matrix-panel");
const planningPanel = document.getElementById("planning-panel");
const dispatchPanel = document.getElementById("dispatch-panel");
const timelinePanel = document.getElementById("timeline-panel");

const ACTION_ORDER = ["submit", "approve", "launch", "complete", "abort"];
const ACTION_DEFINITIONS = {
  submit: {
    title: "Submit",
    description: "Move the mission from draft into submitted planning review.",
    fields: [
      { key: "userId", label: "User ID", type: "text", required: true },
    ],
  },
  approve: {
    title: "Approve",
    description: "Record approval once readiness and approval evidence safeguards are satisfied.",
    fields: [
      { key: "reviewerId", label: "Reviewer ID", type: "text", required: true },
      {
        key: "decisionEvidenceLinkId",
        label: "Approval evidence link ID",
        type: "text",
        required: false,
      },
      { key: "notes", label: "Notes", type: "textarea", required: false },
    ],
  },
  launch: {
    title: "Launch",
    description: "Execute launch only after approval, dispatch evidence, and launch preflight are clear.",
    fields: [
      { key: "operatorId", label: "Operator ID", type: "text", required: true },
      { key: "vehicleId", label: "Vehicle ID", type: "text", required: true },
      { key: "lat", label: "Launch latitude", type: "number", required: true },
      { key: "lng", label: "Launch longitude", type: "number", required: true },
      {
        key: "decisionEvidenceLinkId",
        label: "Dispatch evidence link ID",
        type: "text",
        required: false,
      },
    ],
  },
  complete: {
    title: "Complete",
    description: "Close the mission and preserve the post-operation evidence chain.",
    fields: [
      { key: "operatorId", label: "Operator ID", type: "text", required: false },
    ],
  },
  abort: {
    title: "Abort",
    description: "Terminate the mission with a recorded operational reason.",
    fields: [
      { key: "actorId", label: "Actor ID", type: "text", required: false },
      { key: "reason", label: "Reason", type: "textarea", required: true },
    ],
  },
};

const EVIDENCE_HELPERS = {
  readinessSnapshot: {
    title: "Readiness Snapshot",
    description: "Create the latest mission readiness snapshot using the existing audit evidence flow.",
    endpoint: (missionId) => `/missions/${missionId}/readiness/audit-snapshots`,
    method: "POST",
    fields: [{ key: "createdBy", label: "Created by", type: "text", required: true }],
  },
  approvalHandoff: {
    title: "Approval Evidence",
    description: "Create the planning approval handoff, snapshot, and approval evidence link in one backend flow.",
    endpoint: (missionId) => `/mission-plans/drafts/${missionId}/approval-handoff`,
    method: "POST",
    fields: [{ key: "createdBy", label: "Created by", type: "text", required: true }],
  },
  dispatchEvidence: {
    title: "Dispatch Evidence",
    description: "Create a dispatch evidence link from an existing readiness snapshot.",
    endpoint: (missionId) => `/missions/${missionId}/decision-evidence-links`,
    method: "POST",
    fields: [
      { key: "createdBy", label: "Created by", type: "text", required: true },
      { key: "snapshotId", label: "Snapshot ID", type: "text", required: true },
    ],
  },
};

const uiState = {
  missionId: "",
  planningWorkspace: null,
  dispatchWorkspace: null,
  timeline: null,
  regulatoryMatrix: [],
  regulatoryReviewImpact: null,
  postOperationSnapshots: [],
  postOperationEvidenceReport: null,
  postOperationEvidenceReportError: "",
  missionList: [],
  missionQuery: "",
  transitionChecks: {},
  actionStatus: {},
  busyAction: null,
  helperStatus: {},
  busyHelper: null,
  busyAlertAction: null,
};

const toneClass = (value) => {
  const text = String(value ?? "").toLowerCase();

  if (
    text.includes("approved") ||
    text.includes("present") ||
    text.includes("ready") ||
    text.includes("clear") ||
    text.includes("pass") ||
    text.includes("assigned") ||
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
    text.includes("not_found") ||
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

const renderBadge = (value) =>
  `<span class="badge ${toneClass(value)}">${escapeHtml(value ?? "Unknown")}</span>`;

const missionDisplayName = (mission) =>
  mission?.missionPlanId || mission?.id || "Unknown mission";

const formatMatrixSource = (mapping) =>
  [
    mapping.sourceCode,
    mapping.sourceVersionLabel,
    mapping.requirementRef,
  ]
    .filter(Boolean)
    .join(" | ");

const regulatoryImpactByRequirement = () => {
  const impacted = uiState.regulatoryReviewImpact?.impactedMappings ?? [];

  return new Map(
    impacted.map((item) => [item.mapping.requirementCode, item]),
  );
};

const alertActionKey = (action, alertId) => `${action}:${alertId}`;

const latestPostOperationSnapshot = () => uiState.postOperationSnapshots?.[0] ?? null;

const reportSection = (heading) =>
  uiState.postOperationEvidenceReport?.report?.sections?.find(
    (section) => section.heading === heading,
  ) ?? null;

const reportFieldValue = (heading, label) =>
  reportSection(heading)?.fields?.find((field) => field.label === label)?.value ??
  null;

const postOperationExportLinks = (snapshotId) => {
  if (!uiState.missionId || !snapshotId) {
    return { renderUrl: "", pdfUrl: "" };
  }

  const base = `/missions/${encodeURIComponent(
    uiState.missionId,
  )}/post-operation/evidence-snapshots/${encodeURIComponent(snapshotId)}/export/render`;

  return {
    renderUrl: base,
    pdfUrl: `${base}/pdf`,
  };
};

const renderAlertActionButtons = (impact) => {
  const alertIds = impact?.alertIds ?? [];
  if (!uiState.missionId || alertIds.length === 0) {
    return "";
  }

  return `
    <div class="action-footer" style="justify-content: flex-start; margin-top: 10px;">
      ${alertIds
        .map((alertId) => {
          const acknowledgeKey = alertActionKey("acknowledge", alertId);
          const resolveKey = alertActionKey("resolve", alertId);

          return `
            <button
              class="action-button"
              type="button"
              data-alert-action="acknowledge"
              data-alert-id="${escapeHtml(alertId)}"
              ${uiState.busyAlertAction === acknowledgeKey ? "disabled" : ""}
            >
              ${uiState.busyAlertAction === acknowledgeKey ? "Acknowledging..." : "Acknowledge alert"}
            </button>
            <button
              class="action-button"
              type="button"
              data-alert-action="resolve"
              data-alert-id="${escapeHtml(alertId)}"
              ${uiState.busyAlertAction === resolveKey ? "disabled" : ""}
            >
              ${uiState.busyAlertAction === resolveKey ? "Resolving..." : "Resolve alert"}
            </button>
          `;
        })
        .join("")}
    </div>
  `;
};

const setConnectionState = (message, tone = "tone-muted") => {
  connectionStatus.className = `status-pill ${tone}`;
  connectionStatus.textContent = message;
};

const setLoadedMission = (missionId) => {
  loadedMissionPill.textContent = missionId || "None";
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
  const pathMatch = window.location.pathname.match(/^\/operator\/missions\/([^/]+)$/);
  if (pathMatch?.[1]) {
    return decodeURIComponent(pathMatch[1]);
  }

  const queryMissionId = new URL(window.location.href).searchParams.get("missionId");
  return queryMissionId?.trim() || "";
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
    const message = payload?.error?.message || `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return payload;
};

const collectActionPayload = (action) => {
  const definition = ACTION_DEFINITIONS[action];
  const payload = {};

  for (const field of definition.fields) {
    const input = document.getElementById(`action-${action}-${field.key}`);
    const rawValue = input?.value ?? "";
    const trimmed = typeof rawValue === "string" ? rawValue.trim() : rawValue;

    if (field.required && !trimmed) {
      throw new Error(`${field.label} is required`);
    }

    if (!trimmed) {
      continue;
    }

    payload[field.key] =
      field.type === "number" ? Number(trimmed) : trimmed;
  }

  return payload;
};

const applyActionDefaults = () => {
  const planningWorkspace = uiState.planningWorkspace;
  const dispatchWorkspace = uiState.dispatchWorkspace;

  const defaultMap = {
    approve: {
      reviewerId: "planning-reviewer-1",
      decisionEvidenceLinkId:
        planningWorkspace?.evidence?.latestApprovalEvidenceLink?.id ?? "",
      notes: "",
    },
    submit: {
      userId: "planning-user-1",
    },
    launch: {
      operatorId: "dispatch-operator-1",
      vehicleId:
        dispatchWorkspace?.platform?.summary?.id ??
        dispatchWorkspace?.mission?.platformId ??
        "",
      lat: "",
      lng: "",
      decisionEvidenceLinkId:
        dispatchWorkspace?.dispatch?.latestDispatchEvidenceLink?.id ?? "",
    },
    complete: {
      operatorId: "ops-closer-1",
    },
    abort: {
      actorId: "ops-controller-1",
      reason: "",
    },
  };

  for (const action of ACTION_ORDER) {
    const defaults = defaultMap[action] ?? {};

    for (const [key, value] of Object.entries(defaults)) {
      const input = document.getElementById(`action-${action}-${key}`);
      if (!input) {
        continue;
      }

      if (!input.value || key === "decisionEvidenceLinkId" || key === "vehicleId") {
        input.value = value;
      }
    }
  }
};

const applyEvidenceHelperDefaults = () => {
  const latestSnapshotId =
    uiState.planningWorkspace?.evidence?.latestReadinessSnapshot?.id ?? "";

  const defaultMap = {
    readinessSnapshot: {
      createdBy: "evidence-reviewer-1",
    },
    approvalHandoff: {
      createdBy: "planning-lead-1",
    },
    dispatchEvidence: {
      createdBy: "dispatcher-1",
      snapshotId: latestSnapshotId,
    },
  };

  for (const helper of Object.keys(EVIDENCE_HELPERS)) {
    const defaults = defaultMap[helper] ?? {};

    for (const [key, value] of Object.entries(defaults)) {
      const input = document.getElementById(`helper-${helper}-${key}`);
      if (!input) {
        continue;
      }

      if (!input.value || key === "snapshotId") {
        input.value = value;
      }
    }
  }
};

const collectEvidenceHelperPayload = (helper) => {
  const definition = EVIDENCE_HELPERS[helper];
  const payload = {};

  for (const field of definition.fields) {
    const input = document.getElementById(`helper-${helper}-${field.key}`);
    const rawValue = input?.value ?? "";
    const trimmed = typeof rawValue === "string" ? rawValue.trim() : rawValue;

    if (field.required && !trimmed) {
      throw new Error(`${field.label} is required`);
    }

    if (!trimmed) {
      continue;
    }

    payload[field.key] = trimmed;
  }

  if (helper === "dispatchEvidence") {
    payload.decisionType = "dispatch";
  }

  return payload;
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
        Search recent missions or clear the filter to load a mission into the operator workspace.
      </div>
    `;
    return;
  }

  missionBrowserList.innerHTML = missions
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
              <div class="timeline-meta">Mission ID: ${escapeHtml(mission.id)}</div>
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
              ${loaded ? "Loaded" : "Open mission"}
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  missionBrowserList.querySelectorAll("[data-open-mission]").forEach((button) => {
    button.addEventListener("click", () => {
      const missionId = button.getAttribute("data-open-mission");
      if (!missionId) {
        return;
      }

      missionIdInput.value = missionId;
      loadMissionWorkspace(missionId);
    });
  });

  const selectedMission =
    missions.find((mission) => mission.id === uiState.missionId) ?? missions[0];

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
        <div>${escapeHtml(
          selectedMission.platform?.name ??
            selectedMission.platform?.id ??
            "Platform not assigned",
        )}</div>
        <div class="k">Pilot</div>
        <div>${escapeHtml(
          selectedMission.pilot?.displayName ??
            selectedMission.pilot?.id ??
            "Pilot not assigned",
        )}</div>
        <div class="k">Last event</div>
        <div>${escapeHtml(selectedMission.latestEventSummary ?? "No lifecycle events yet")}</div>
        <div class="k">Updated</div>
        <div>${escapeHtml(formatDateTime(selectedMission.latestEventAt ?? selectedMission.updatedAt))}</div>
      </div>
    </section>
  `;
};

const renderEvidenceHelpers = () => {
  if (!evidencePanel) {
    return;
  }

  if (!uiState.missionId || !uiState.planningWorkspace || !uiState.dispatchWorkspace) {
    evidencePanel.innerHTML =
      '<div class="empty-state">Load a mission before evidence helpers can be used.</div>';
    return;
  }

  const planningWorkspace = uiState.planningWorkspace;
  const dispatchWorkspace = uiState.dispatchWorkspace;
  const latestSnapshot = planningWorkspace.evidence.latestReadinessSnapshot;
  const latestApprovalLink = planningWorkspace.evidence.latestApprovalEvidenceLink;
  const latestDispatchLink = dispatchWorkspace.dispatch.latestDispatchEvidenceLink;
  const latestHandoff = planningWorkspace.approval.latestApprovalHandoff;
  const missionStatus = planningWorkspace.mission?.status ?? "Unknown";
  const postOperationSnapshot = latestPostOperationSnapshot();
  const signoffDecision = reportFieldValue(
    "Accountable manager sign-off",
    "Review decision/status",
  );
  const signoffRecordId = reportFieldValue(
    "Accountable manager sign-off",
    "Sign-off record ID",
  );
  const regulatoryAlertCount =
    uiState.postOperationEvidenceReport?.sourceExport?.regulatoryAmendmentAlerts
      ?.length ?? 0;
  const exportLinks = postOperationExportLinks(postOperationSnapshot?.id);
  const signoffState =
    signoffDecision && signoffDecision !== "Pending sign-off"
      ? `Recorded: ${signoffDecision}`
      : "Pending sign-off";
  const postOperationReady = missionStatus === "completed";

  evidencePanel.innerHTML = `
    <div class="summary-grid" style="margin-bottom: 14px;">
      <section class="summary-block">
        <h4>Current Evidence State</h4>
        <div class="kv">
          <div class="k">Readiness snapshots</div>
          <div>${escapeHtml(String(planningWorkspace.evidence.readinessSnapshotCount))}</div>
          <div class="k">Latest snapshot</div>
          <div>${escapeHtml(latestSnapshot?.id ?? "Missing")}</div>
          <div class="k">Approval handoff</div>
          <div>${escapeHtml(latestHandoff?.id ?? "Missing")}</div>
          <div class="k">Approval evidence link</div>
          <div>${escapeHtml(latestApprovalLink?.id ?? "Missing")}</div>
          <div class="k">Dispatch evidence link</div>
          <div>${escapeHtml(latestDispatchLink?.id ?? "Missing")}</div>
        </div>
      </section>
      <section class="summary-block">
        <h4>Safeguards</h4>
        <div class="kv">
          <div class="k">Approval handoff state</div>
          <div>${renderBadge(planningWorkspace.approval.handoffCreated ? "Recorded" : "Missing")}</div>
          <div class="k">Approval blockers</div>
          <div>${escapeHtml(planningWorkspace.approval.blockingReasons.join("; ") || "None")}</div>
          <div class="k">Dispatch blockers</div>
          <div>${escapeHtml(dispatchWorkspace.dispatch.blockingReasons.join("; ") || "None")}</div>
          <div class="k">Dispatch missing requirements</div>
          <div>${escapeHtml(dispatchWorkspace.dispatch.missingRequirements.join("; ") || "None")}</div>
        </div>
      </section>
      <section class="summary-block">
        <h4>Post-operation Evidence Pack</h4>
        <div class="kv">
          <div class="k">Mission state</div>
          <div>${renderBadge(missionStatus)}</div>
          <div class="k">Latest post-op snapshot</div>
          <div>${escapeHtml(postOperationSnapshot?.id ?? "Not captured")}</div>
          <div class="k">Captured at</div>
          <div>${escapeHtml(formatDateTime(postOperationSnapshot?.createdAt))}</div>
          <div class="k">Accountable-manager sign-off</div>
          <div>${renderBadge(signoffState)}</div>
          <div class="k">Sign-off record</div>
          <div>${escapeHtml(signoffRecordId ?? "Not recorded")}</div>
          <div class="k">Regulatory review records</div>
          <div>${escapeHtml(String(regulatoryAlertCount))}</div>
        </div>
        <div class="action-meta" style="margin-top: 12px;">
          Read-only evidence export for audit review. This is not a legal compliance certificate and does not approve dispatch or flight.
          ${
            postOperationReady
              ? ""
              : "Complete the mission before relying on a post-operation evidence pack."
          }
          ${
            uiState.postOperationEvidenceReportError
              ? `<br />Report status: ${escapeHtml(uiState.postOperationEvidenceReportError)}`
              : ""
          }
        </div>
        <div class="action-footer" style="justify-content: flex-start; margin-top: 12px;">
          ${
            postOperationSnapshot
              ? `
                <a class="action-button link-button" href="${escapeHtml(exportLinks.renderUrl)}" target="_blank" rel="noopener">
                  Open audit report
                </a>
                <a class="action-button link-button" href="${escapeHtml(exportLinks.pdfUrl)}" target="_blank" rel="noopener">
                  Download PDF evidence pack
                </a>
              `
              : `<div class="action-status tone-warn">No post-operation snapshot is available yet.</div>`
          }
        </div>
      </section>
    </div>
    <div class="action-grid">
      ${Object.entries(EVIDENCE_HELPERS)
        .map(([helper, definition]) => renderEvidenceHelperCard(helper, definition))
        .join("")}
    </div>
  `;

  applyEvidenceHelperDefaults();
  bindEvidenceHelperForms();
};

const renderEvidenceHelperCard = (helper, definition) => {
  const helperBusy = uiState.busyHelper === helper;
  const helperStatus = uiState.helperStatus[helper];

  const fieldMarkup = definition.fields
    .map((field) => {
      const inputId = `helper-${helper}-${field.key}`;
      return `
        <div class="action-field">
          <label for="${inputId}">${escapeHtml(field.label)}</label>
          <input id="${inputId}" type="${field.type}" ${field.required ? "required" : ""} />
        </div>
      `;
    })
    .join("");

  return `
    <section class="action-card">
      <h4>${escapeHtml(definition.title)}</h4>
      <div class="action-meta">${escapeHtml(definition.description)}</div>
      <form class="evidence-helper-form" data-helper="${helper}">
        <div class="action-form-row">
          ${fieldMarkup}
        </div>
        <div class="action-footer">
          <button class="action-button" type="submit" ${helperBusy ? "disabled" : ""}>
            ${helperBusy ? "Running..." : `Create ${escapeHtml(definition.title)}`}
          </button>
          <div class="action-status ${toneClass(helperStatus?.message ?? "info")}">${escapeHtml(
            helperStatus?.message ?? "Ready",
          )}</div>
        </div>
      </form>
    </section>
  `;
};

const renderRegulatoryMatrix = () => {
  if (!regulatoryMatrixPanel) {
    return;
  }

  const mappings = uiState.regulatoryMatrix ?? [];
  if (mappings.length === 0) {
    regulatoryMatrixPanel.innerHTML =
      '<div class="empty-state">Regulatory requirement matrix is not loaded.</div>';
    return;
  }

  const sourceMapped = mappings.filter(
    (mapping) => mapping.reviewStatus === "source_mapped",
  ).length;
  const needsReview = mappings.filter((mapping) =>
    String(mapping.reviewStatus ?? "").includes("needs"),
  ).length;
  const reviewImpact = uiState.regulatoryReviewImpact;
  const impactedByRequirement = regulatoryImpactByRequirement();
  const displayedMappings = [...mappings].sort((left, right) => {
    const leftImpacted = impactedByRequirement.has(left.requirementCode) ? 1 : 0;
    const rightImpacted = impactedByRequirement.has(right.requirementCode) ? 1 : 0;

    return (
      rightImpacted - leftImpacted ||
      (left.displayOrder ?? 0) - (right.displayOrder ?? 0)
    );
  });

  regulatoryMatrixPanel.innerHTML = `
    <div class="summary-grid" style="margin-bottom: 14px;">
      <section class="summary-block">
        <h4>Matrix Status</h4>
        <div class="kv">
          <div class="k">Mapped requirements</div>
          <div>${escapeHtml(String(mappings.length))}</div>
          <div class="k">Source mapped</div>
          <div>${renderBadge(String(sourceMapped))}</div>
          <div class="k">Needs review</div>
          <div>${renderBadge(needsReview > 0 ? `${needsReview} needs review` : "Clear")}</div>
          <div class="k">Mission amendment alerts</div>
          <div>${renderBadge(
            reviewImpact
              ? `${reviewImpact.openAmendmentAlertCount} open`
              : "Load mission",
          )}</div>
        </div>
      </section>
      <section class="summary-block">
        <h4>Mission Review Impact</h4>
        <div class="kv">
          <div class="k">Impacted rows</div>
          <div>${renderBadge(
            reviewImpact
              ? `${reviewImpact.impactedMappingCount} impacted`
              : "Mission not loaded",
          )}</div>
          <div class="k">Clause review count</div>
          <div>${renderBadge(
            reviewImpact
              ? `${reviewImpact.needsClauseReviewCount} needs review`
              : "Mission not loaded",
          )}</div>
          <div class="k">Boundary</div>
          <div>Read-only traceability matrix; not a legal compliance certification.</div>
        </div>
      </section>
    </div>
    <ul class="list">
      ${displayedMappings
        .map(
          (mapping) => {
            const impact = impactedByRequirement.get(mapping.requirementCode);

            return `
            <li class="list-item">
              <strong>${escapeHtml(mapping.requirementCode)}</strong>
              <div>
                ${impact ? renderBadge("Impacted by amendment") : ""}
                ${renderBadge(mapping.reviewStatus)}
                ${renderBadge(mapping.assuranceOwner)}
              </div>
              <div style="margin-top: 8px;">
                ${escapeHtml(mapping.requirementSummary)}
              </div>
              <div class="timeline-meta" style="margin-top: 8px;">
                Source: ${escapeHtml(formatMatrixSource(mapping))}<br />
                Control: ${escapeHtml(mapping.controlCode)} - ${escapeHtml(mapping.controlTitle)}<br />
                Evidence: ${escapeHtml(mapping.evidenceType)}<br />
                Intent: ${escapeHtml(mapping.complianceIntent)}
                ${
                  impact
                    ? `<br />Review impact: ${escapeHtml(impact.reviewReason)}<br />Alert IDs: ${escapeHtml(impact.alertIds.join(", "))}`
                    : ""
                }
              </div>
              ${impact ? renderAlertActionButtons(impact) : ""}
            </li>
          `;
          },
        )
        .join("")}
    </ul>
  `;

  bindRegulatoryAlertActions();
};

const bindRegulatoryAlertActions = () => {
  regulatoryMatrixPanel
    ?.querySelectorAll("[data-alert-action][data-alert-id]")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        const action = button.getAttribute("data-alert-action");
        const alertId = button.getAttribute("data-alert-id");

        if (!action || !alertId) {
          return;
        }

        await executeAlertLifecycleAction(action, alertId);
      });
    });
};

const bindEvidenceHelperForms = () => {
  document.querySelectorAll(".evidence-helper-form").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const helper = form.getAttribute("data-helper");
      if (!helper) {
        return;
      }

      await executeEvidenceHelper(helper);
    });
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
      '<div class="empty-state">Mission detail is unavailable because the mission list did not load.</div>';
  }
};

const loadRegulatoryMatrix = async () => {
  if (!regulatoryMatrixPanel) {
    return;
  }

  regulatoryMatrixPanel.innerHTML =
    '<div class="empty-state">Loading regulatory requirement matrix...</div>';

  try {
    const response = await fetchJson("/sms/regulatory-requirement-mappings");
    uiState.regulatoryMatrix = response.mappings ?? [];
    renderRegulatoryMatrix();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load regulatory requirement matrix";
    uiState.regulatoryMatrix = [];
    regulatoryMatrixPanel.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  }
};

const renderOverview = () => {
  const planningWorkspace = uiState.planningWorkspace;
  const dispatchWorkspace = uiState.dispatchWorkspace;
  const timeline = uiState.timeline;
  const mission = planningWorkspace?.mission ?? dispatchWorkspace?.mission;
  const readinessGate = planningWorkspace?.readiness?.gate;
  const dispatchReady = dispatchWorkspace?.dispatch?.ready ? "Ready" : "Blocked";
  const approvalReady = planningWorkspace?.approval?.ready ? "Ready" : "Blocked";
  const timelineCount = timeline?.items?.length ?? 0;
  const missionStatus = mission?.status ?? "Unknown";

  overviewMetrics.innerHTML = `
    <article class="metric">
      <div class="label">Mission status</div>
      <div class="value ${toneClass(missionStatus)}">${escapeHtml(missionStatus)}</div>
      <div class="meta">Mission ID: ${escapeHtml(mission?.id ?? "Not loaded")}</div>
    </article>
    <article class="metric">
      <div class="label">Readiness gate</div>
      <div class="value ${toneClass(readinessGate?.status ?? "Unknown")}">${escapeHtml(
        readinessGate?.status ?? "Unknown",
      )}</div>
      <div class="meta">Dispatch block: ${escapeHtml(
        readinessGate?.blocksDispatch ? "Yes" : "No",
      )}</div>
    </article>
    <article class="metric">
      <div class="label">Approval / Dispatch</div>
      <div class="value">${renderBadge(approvalReady)} ${renderBadge(dispatchReady)}</div>
      <div class="meta">Approval handoff: ${escapeHtml(
        planningWorkspace?.approval?.handoffCreated ? "Recorded" : "Missing",
      )}</div>
    </article>
    <article class="metric">
      <div class="label">Timeline coverage</div>
      <div class="value">${escapeHtml(String(timelineCount))}</div>
      <div class="meta">Phases present: ${escapeHtml(
        String((timeline?.phases ?? []).filter((phase) => phase.status === "present").length),
      )} / ${escapeHtml(String((timeline?.phases ?? []).length ?? 0))}</div>
    </article>
  `;
};

const renderPlanning = () => {
  const workspace = uiState.planningWorkspace;

  if (!workspace) {
    planningPanel.innerHTML = `<div class="empty-state">Planning workspace is not available.</div>`;
    return;
  }

  const checklist = (workspace.planning?.checklist ?? []).map((item) => ({
    label: `${item.key} - ${item.status}`,
    value: item.message,
  }));
  const blockers = (workspace.blockingReasons ?? []).map((reason) => ({
    label: "Blocking reason",
    value: reason,
  }));
  const missing = (workspace.missingRequirements ?? []).map((reason) => ({
    label: "Missing requirement",
    value: reason,
  }));
  const actions = (workspace.nextAllowedActions ?? []).map((action) => ({
    label: `${action.action} -> ${action.targetStatus}`,
    value: action.allowed
      ? `Allowed from ${action.currentStatus}`
      : action.error?.message ?? `Blocked from ${action.currentStatus}`,
  }));

  planningPanel.innerHTML = `
    <div class="summary-grid">
      <section class="summary-block">
        <h4>Mission Core</h4>
        <div class="kv">
          <div class="k">Mission plan</div>
          <div>${escapeHtml(workspace.mission.missionPlanId ?? "Not assigned")}</div>
          <div class="k">Platform</div>
          <div>${escapeHtml(workspace.platform.summary?.name ?? workspace.platform.assignedPlatformId ?? "Missing")}</div>
          <div class="k">Pilot</div>
          <div>${escapeHtml(workspace.pilot.summary?.displayName ?? workspace.pilot.assignedPilotId ?? "Missing")}</div>
          <div class="k">Risk input</div>
          <div>${renderBadge(workspace.missionRisk ? "Present" : "Missing")}</div>
          <div class="k">Airspace input</div>
          <div>${renderBadge(workspace.airspaceCompliance ? "Present" : "Missing")}</div>
        </div>
      </section>
      <section class="summary-block">
        <h4>Evidence Chain</h4>
        <div class="kv">
          <div class="k">Readiness snapshots</div>
          <div>${escapeHtml(String(workspace.evidence.readinessSnapshotCount))}</div>
          <div class="k">Approval evidence</div>
          <div>${escapeHtml(String(workspace.evidence.approvalEvidenceLinkCount))}</div>
          <div class="k">Dispatch evidence</div>
          <div>${escapeHtml(String(workspace.evidence.dispatchEvidenceLinkCount))}</div>
          <div class="k">Latest handoff</div>
          <div>${escapeHtml(
            workspace.approval.latestApprovalHandoff?.createdAt
              ? formatDateTime(workspace.approval.latestApprovalHandoff.createdAt)
              : "Not recorded",
          )}</div>
        </div>
      </section>
      <section class="summary-block">
        <h4>Checklist</h4>
        ${renderList(checklist, "checklist items")}
      </section>
      <section class="summary-block">
        <h4>Next Allowed Actions</h4>
        ${renderList(actions, "next allowed actions")}
      </section>
    </div>
    <div class="stack" style="margin-top: 14px;">
      <section>
        <h4 style="margin: 0 0 10px;">Blocking Reasons</h4>
        ${renderList(blockers, "blocking reasons")}
      </section>
      <section>
        <h4 style="margin: 0 0 10px;">Missing Requirements</h4>
        ${renderList(missing, "missing requirements")}
      </section>
    </div>
  `;
};

const renderDispatch = () => {
  const workspace = uiState.dispatchWorkspace;

  if (!workspace) {
    dispatchPanel.innerHTML = `<div class="empty-state">Dispatch workspace is not available.</div>`;
    return;
  }

  const blockers = (workspace.dispatch?.blockingReasons ?? []).map((reason) => ({
    label: "Launch blocker",
    value: reason,
  }));
  const missing = (workspace.dispatch?.missingRequirements ?? []).map((reason) => ({
    label: "Dispatch requirement",
    value: reason,
  }));
  const actions = (workspace.nextAllowedActions ?? []).map((action) => ({
    label: `${action.action} -> ${action.targetStatus}`,
    value: action.allowed
      ? `Allowed from ${action.currentStatus}`
      : action.error?.message ?? `Blocked from ${action.currentStatus}`,
  }));

  dispatchPanel.innerHTML = `
    <div class="stack">
      <section class="summary-block">
        <h4>Dispatch Status</h4>
        <div class="kv">
          <div class="k">Mission lifecycle</div>
          <div>${renderBadge(workspace.mission.status)}</div>
          <div class="k">Approved for dispatch</div>
          <div>${renderBadge(workspace.approval.approvedForDispatch ? "Approved" : "Not approved")}</div>
          <div class="k">Dispatch ready</div>
          <div>${renderBadge(workspace.dispatch.ready ? "Ready" : "Blocked")}</div>
          <div class="k">Launch preflight</div>
          <div>${renderBadge(workspace.dispatch.launchPreflight.allowed ? "Allowed" : "Blocked")}</div>
        </div>
      </section>
      <section class="summary-block">
        <h4>Approval and Evidence</h4>
        <div class="kv">
          <div class="k">Approval handoff</div>
          <div>${escapeHtml(workspace.approval.handoffCreated ? "Recorded" : "Missing")}</div>
          <div class="k">Approval evidence link</div>
          <div>${escapeHtml(workspace.approval.latestApprovalEvidenceLink?.id ?? "Missing")}</div>
          <div class="k">Dispatch evidence link</div>
          <div>${escapeHtml(workspace.dispatch.latestDispatchEvidenceLink?.id ?? "Missing")}</div>
        </div>
      </section>
      <section>
        <h4 style="margin: 0 0 10px;">Launch Blockers</h4>
        ${renderList(blockers, "launch blockers")}
      </section>
      <section>
        <h4 style="margin: 0 0 10px;">Missing Dispatch Requirements</h4>
        ${renderList(missing, "dispatch requirements")}
      </section>
      <section>
        <h4 style="margin: 0 0 10px;">Relevant Lifecycle Actions</h4>
        ${renderList(actions, "dispatch actions")}
      </section>
    </div>
  `;
};

const renderTimeline = () => {
  const timeline = uiState.timeline;

  if (!timeline) {
    timelinePanel.innerHTML = `<div class="empty-state">Operations timeline is not available.</div>`;
    return;
  }

  const phaseSummary = `
    <div class="summary-grid" style="margin-bottom: 14px;">
      ${(timeline.phases ?? [])
        .map(
          (phase) => `
            <section class="summary-block">
              <h4>${escapeHtml(phase.phase.replaceAll("_", " "))}</h4>
              <div class="kv">
                <div class="k">Status</div>
                <div>${renderBadge(phase.status)}</div>
                <div class="k">Latest record</div>
                <div>${escapeHtml(formatDateTime(phase.latestAt))}</div>
                <div class="k">Summary</div>
                <div>${escapeHtml(phase.summary)}</div>
              </div>
            </section>
          `,
        )
        .join("")}
    </div>
  `;

  const items = timeline.items ?? [];
  const renderedItems =
    items.length === 0
      ? `<div class="empty-state">No mission timeline items recorded yet.</div>`
      : `<div class="timeline">
          ${items
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
        </div>`;

  timelinePanel.innerHTML = `${phaseSummary}${renderedItems}`;
};

const renderActions = () => {
  if (!uiState.missionId) {
    actionsPanel.innerHTML = `<div class="empty-state">Load a mission before lifecycle actions can be evaluated.</div>`;
    return;
  }

  actionsPanel.innerHTML = `
    <div class="action-grid">
      ${ACTION_ORDER.map((action) => renderActionCard(action)).join("")}
    </div>
  `;

  applyActionDefaults();
  bindActionForms();
};

const renderActionCard = (action) => {
  const definition = ACTION_DEFINITIONS[action];
  const check = uiState.transitionChecks[action];
  const actionStatus = uiState.actionStatus[action];
  const allowed = Boolean(check?.allowed);
  const actionBusy = uiState.busyAction === action;
  const footerMessage =
    actionStatus?.message ??
    (check?.allowed
      ? `Allowed from ${check.currentStatus} to ${check.targetStatus}`
      : check?.error?.message ?? "Transition check unavailable");

  const fieldMarkup = definition.fields
    .map((field) => {
      const inputId = `action-${action}-${field.key}`;
      const inputMarkup =
        field.type === "textarea"
          ? `<textarea id="${inputId}" ${field.required ? "required" : ""}></textarea>`
          : `<input id="${inputId}" type="${field.type}" ${field.required ? "required" : ""} />`;

      return `
        <div class="action-field">
          <label for="${inputId}">${escapeHtml(field.label)}</label>
          ${inputMarkup}
        </div>
      `;
    })
    .join("");

  return `
    <section class="action-card">
      <h4>${escapeHtml(definition.title)}</h4>
      <div>${renderBadge(check?.allowed ? "Allowed" : "Blocked")}</div>
      <div class="action-meta">
        ${escapeHtml(definition.description)}<br />
        Current status: ${escapeHtml(check?.currentStatus ?? "Unknown")}<br />
        Target status: ${escapeHtml(check?.targetStatus ?? "Unknown")}
      </div>
      <form class="action-form" data-action="${action}">
        <div class="action-form-row">
          ${fieldMarkup}
        </div>
        <div class="action-footer">
          <button class="action-button" type="submit" ${!allowed || actionBusy ? "disabled" : ""}>
            ${actionBusy ? "Running..." : `Run ${escapeHtml(definition.title)}`}
          </button>
          <div class="action-status ${toneClass(footerMessage)}">${escapeHtml(footerMessage)}</div>
        </div>
      </form>
    </section>
  `;
};

const bindActionForms = () => {
  document.querySelectorAll(".action-form").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const action = form.getAttribute("data-action");
      if (!action) {
        return;
      }

      await executeAction(action);
    });
  });
};

const refreshTransitionChecks = async (missionId) => {
  const checks = await Promise.all(
    ACTION_ORDER.map(async (action) => {
      const result = await fetchJson(
        `/missions/${missionId}/transitions/${action}/check`,
      );
      return [action, result];
    }),
  );

  uiState.transitionChecks = Object.fromEntries(checks);
};

const loadMissionWorkspace = async (missionId, options = {}) => {
  const preserveActionStatus = Boolean(options.preserveActionStatus);

  if (!missionId) {
    uiState.missionId = "";
    uiState.planningWorkspace = null;
    uiState.dispatchWorkspace = null;
    uiState.timeline = null;
    uiState.regulatoryReviewImpact = null;
    uiState.postOperationSnapshots = [];
    uiState.postOperationEvidenceReport = null;
    uiState.postOperationEvidenceReportError = "";
    renderMissionBrowser();
    uiState.transitionChecks = {};
    uiState.actionStatus = {};
    uiState.busyAction = null;
    uiState.helperStatus = {};
    uiState.busyHelper = null;
    uiState.busyAlertAction = null;
    setConnectionState("Enter a mission UUID", "tone-warn");
    setLoadedMission("");
    overviewMetrics.innerHTML = "";
    actionsPanel.innerHTML = `<div class="empty-state">Load a mission before lifecycle actions can be evaluated.</div>`;
    evidencePanel.innerHTML = `<div class="empty-state">Load a mission before evidence helpers can be used.</div>`;
    regulatoryMatrixPanel.innerHTML = `<div class="empty-state">Regulatory requirement matrix is available after the workspace loads.</div>`;
    planningPanel.innerHTML = `<div class="empty-state">Enter a mission UUID to load the planning workspace.</div>`;
    dispatchPanel.innerHTML = `<div class="empty-state">Dispatch state will appear after a mission is loaded.</div>`;
    timelinePanel.innerHTML = `<div class="empty-state">Timeline data will appear after a mission is loaded.</div>`;
    return;
  }

  uiState.missionId = missionId;
  if (!preserveActionStatus) {
    uiState.actionStatus = {};
  }

  setConnectionState("Loading mission workspace...", "tone-info");
  setLoadedMission(missionId);
  updateUrl(missionId);

  try {
    const [
      planningResponse,
      dispatchResponse,
      timelineResponse,
      regulatoryReviewImpactResponse,
      postOperationSnapshotsResponse,
    ] = await Promise.all([
      fetchJson(`/missions/${missionId}/planning-workspace`),
      fetchJson(`/missions/${missionId}/dispatch-workspace`),
      fetchJson(`/missions/${missionId}/operations-timeline`),
      fetchJson(`/missions/${missionId}/regulatory-review-impact`),
      fetchJson(`/missions/${missionId}/post-operation/evidence-snapshots`),
    ]);

    uiState.planningWorkspace = planningResponse.workspace;
    uiState.dispatchWorkspace = dispatchResponse.workspace;
    uiState.timeline = timelineResponse.timeline;
    uiState.regulatoryReviewImpact = regulatoryReviewImpactResponse;
    uiState.postOperationSnapshots = postOperationSnapshotsResponse.snapshots ?? [];
    uiState.postOperationEvidenceReport = null;
    uiState.postOperationEvidenceReportError = "";
    const postOperationSnapshot = latestPostOperationSnapshot();

    if (postOperationSnapshot) {
      try {
        const reportResponse = await fetchJson(
          postOperationExportLinks(postOperationSnapshot.id).renderUrl,
        );
        uiState.postOperationEvidenceReport = reportResponse.report;
      } catch (error) {
        uiState.postOperationEvidenceReportError =
          error instanceof Error ? error.message : "Report unavailable";
      }
    }

    await refreshTransitionChecks(missionId);

    renderMissionBrowser();
    renderOverview();
    renderActions();
    renderEvidenceHelpers();
    renderRegulatoryMatrix();
    renderPlanning();
    renderDispatch();
    renderTimeline();
    setConnectionState("Mission workspace loaded", "tone-ok");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load mission workspace";
    uiState.planningWorkspace = null;
    uiState.dispatchWorkspace = null;
    uiState.timeline = null;
    uiState.regulatoryReviewImpact = null;
    uiState.postOperationSnapshots = [];
    uiState.postOperationEvidenceReport = null;
    uiState.postOperationEvidenceReportError = "";
    uiState.transitionChecks = {};
    renderMissionBrowser();
    uiState.helperStatus = {};
    uiState.busyHelper = null;
    setConnectionState(message, "tone-bad");
    actionsPanel.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
    evidencePanel.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
    renderRegulatoryMatrix();
    planningPanel.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
    dispatchPanel.innerHTML = `<div class="empty-state">Dispatch view unavailable because the mission workspace did not load.</div>`;
    timelinePanel.innerHTML = `<div class="empty-state">Timeline view unavailable because the mission workspace did not load.</div>`;
    overviewMetrics.innerHTML = "";
  }
};

const executeEvidenceHelper = async (helper) => {
  const missionId = uiState.missionId;
  if (!missionId) {
    return;
  }

  let payload;
  try {
    payload = collectEvidenceHelperPayload(helper);
  } catch (error) {
    uiState.helperStatus[helper] = {
      message: error instanceof Error ? error.message : "Invalid evidence helper payload",
    };
    renderEvidenceHelpers();
    return;
  }

  uiState.busyHelper = helper;
  uiState.helperStatus[helper] = { message: "Submitting evidence helper..." };
  renderEvidenceHelpers();

  try {
    const definition = EVIDENCE_HELPERS[helper];
    await fetchJson(definition.endpoint(missionId), {
      method: definition.method,
      body: JSON.stringify(payload),
    });

    uiState.helperStatus = {
      [helper]: { message: `${definition.title} created` },
    };
    uiState.busyHelper = null;
    await loadMissionList(uiState.missionQuery);
    await loadMissionWorkspace(missionId, { preserveActionStatus: true });
    setConnectionState(`${definition.title} created`, "tone-ok");
  } catch (error) {
    uiState.busyHelper = null;
    uiState.helperStatus[helper] = {
      message: error instanceof Error ? error.message : "Evidence helper failed",
    };
    renderEvidenceHelpers();
    setConnectionState(
      error instanceof Error ? error.message : "Evidence helper failed",
      "tone-bad",
    );
  }
};

const executeAlertLifecycleAction = async (action, alertId) => {
  const missionId = uiState.missionId;
  if (!missionId) {
    return;
  }

  uiState.busyAlertAction = alertActionKey(action, alertId);
  renderRegulatoryMatrix();
  setConnectionState(`${action === "resolve" ? "Resolving" : "Acknowledging"} alert...`, "tone-info");

  try {
    await fetchJson(`/missions/${missionId}/alerts/${alertId}/${action}`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    uiState.busyAlertAction = null;
    await loadMissionWorkspace(missionId, { preserveActionStatus: true });
    setConnectionState(
      action === "resolve" ? "Alert resolved" : "Alert acknowledged",
      "tone-ok",
    );
  } catch (error) {
    uiState.busyAlertAction = null;
    renderRegulatoryMatrix();
    setConnectionState(
      error instanceof Error ? error.message : "Alert lifecycle action failed",
      "tone-bad",
    );
  }
};

const executeAction = async (action) => {
  const missionId = uiState.missionId;
  const check = uiState.transitionChecks[action];

  if (!missionId || !check?.allowed) {
    uiState.actionStatus[action] = {
      message: check?.error?.message ?? "Action is currently blocked",
    };
    renderActions();
    return;
  }

  let payload;
  try {
    payload = collectActionPayload(action);
  } catch (error) {
    uiState.actionStatus[action] = {
      message: error instanceof Error ? error.message : "Invalid action payload",
    };
    renderActions();
    return;
  }

  uiState.busyAction = action;
  uiState.actionStatus[action] = { message: "Submitting lifecycle action..." };
  renderActions();

  try {
    await fetchJson(`/missions/${missionId}/${action}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    uiState.actionStatus = {
      [action]: { message: `${ACTION_DEFINITIONS[action].title} completed` },
    };
    uiState.busyAction = null;
    await loadMissionList(uiState.missionQuery);
    await loadMissionWorkspace(missionId, { preserveActionStatus: true });
    setConnectionState(`${ACTION_DEFINITIONS[action].title} completed`, "tone-ok");
  } catch (error) {
    uiState.busyAction = null;
    uiState.actionStatus[action] = {
      message: error instanceof Error ? error.message : "Lifecycle action failed",
    };
    renderActions();
    setConnectionState(
      error instanceof Error ? error.message : "Lifecycle action failed",
      "tone-bad",
    );
  }
};

loadWorkspaceButton.addEventListener("click", () => {
  loadMissionWorkspace(missionIdInput.value.trim());
});

missionIdInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadMissionWorkspace(missionIdInput.value.trim());
  }
});

missionSearchButton?.addEventListener("click", () => {
  loadMissionList(missionSearchInput?.value.trim() ?? "");
});

missionSearchInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadMissionList(missionSearchInput.value.trim());
  }
});

copyLinkButton.addEventListener("click", async () => {
  const missionId = missionIdInput.value.trim();
  const url = new URL(window.location.href);
  if (missionId) {
    url.searchParams.set("missionId", missionId);
  }

  try {
    await navigator.clipboard.writeText(url.toString());
    setConnectionState("Direct link copied", "tone-ok");
  } catch {
    setConnectionState("Clipboard write failed", "tone-warn");
  }
});

openApiButton.addEventListener("click", () => {
  const missionId = missionIdInput.value.trim();
  if (!missionId) {
    setConnectionState("Enter a mission UUID before opening API JSON", "tone-warn");
    return;
  }

  window.open(`/missions/${missionId}/planning-workspace`, "_blank", "noopener");
});

openLiveOpsButton?.addEventListener("click", () => {
  const missionId = missionIdInput.value.trim();
  const target = missionId
    ? `/operator/missions/${encodeURIComponent(missionId)}/live-operations`
    : "/operator/live-operations-map";
  window.location.assign(target);
});

const initialMissionId = getMissionIdFromLocation();
if (initialMissionId) {
  missionIdInput.value = initialMissionId;
}

loadMissionList("");
loadRegulatoryMatrix();
loadMissionWorkspace(initialMissionId);
