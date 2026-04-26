const organisationIdInput = document.getElementById("organisation-id-input");
const authEmailInput = document.getElementById("auth-email-input");
const authPasswordInput = document.getElementById("auth-password-input");
const loginButton = document.getElementById("login-btn");
const loadPortalButton = document.getElementById("load-portal-btn");
const copyPortalLinkButton = document.getElementById("copy-portal-link-btn");
const portalStatus = document.getElementById("portal-status");
const authStatus = document.getElementById("auth-status");
const portalMetrics = document.getElementById("portal-metrics");
const oaUploadForm = document.getElementById("oa-upload-form");
const insuranceUploadForm = document.getElementById("insurance-upload-form");
const supportingUploadForm = document.getElementById("supporting-upload-form");
const oaPilotAuthorisationForm = document.getElementById("oa-pilot-authorisation-form");
const oaList = document.getElementById("oa-list");
const insuranceList = document.getElementById("insurance-list");
const supportingList = document.getElementById("supporting-list");
const oaPilotAuthorisationList = document.getElementById("oa-pilot-authorisation-list");

const SESSION_STORAGE_KEY = "verityatlas_document_portal_session_token";
const SESSION_USER_KEY = "verityatlas_document_portal_session_user";

const state = {
  organisationId: "",
  portal: null,
  sessionToken: "",
  sessionUser: null,
  oaPilotAuthorisations: null,
};

const getPortalProfiles = () => state.portal?.sections?.operationalAuthorityProfiles ?? [];
const getPortalPilots = () => state.portal?.sections?.pilots ?? [];

const getPilotLabel = (pilotId) => {
  const pilot = getPortalPilots().find((item) => item.id === pilotId);
  if (!pilot) {
    return pilotId;
  }

  return `${pilot.displayName} (${pilot.id})`;
};

const getDefaultProfileId = () =>
  getPortalProfiles().find((profile) => profile.activationStatus === "active")?.id ??
  getPortalProfiles()[0]?.id ??
  "";

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const toneClass = (value) => {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("active") || text.includes("recorded") || text.includes("reviewed")) {
    return "tone-ok";
  }
  if (text.includes("expir") || text.includes("draft") || text.includes("superseded")) {
    return "tone-warn";
  }
  if (text.includes("missing") || text.includes("revoked") || text.includes("cancelled")) {
    return "tone-bad";
  }
  return "";
};

const renderBadge = (value) =>
  `<span class="badge ${toneClass(value)}">${escapeHtml(value ?? "Unknown")}</span>`;

const setPortalStatus = (message, tone = "") => {
  portalStatus.className = `status-pill ${tone}`.trim();
  portalStatus.textContent = message;
};

const setAuthStatus = (message, tone = "") => {
  authStatus.className = `status-pill ${tone}`.trim();
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

const requireSessionToken = () => {
  if (!state.sessionToken) {
    throw new Error("Login is required before file upload or file review.");
  }

  return state.sessionToken;
};

const formatDate = (value) => {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
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

const fetchAuthJson = async (url, options = {}) =>
  fetchJson(url, {
    ...options,
    headers: {
      ...getSessionHeaders(),
      ...(options.headers ?? {}),
    },
  });

const uploadBinaryFile = async ({
  organisationId,
  file,
  sourceDocumentType,
  uploadedBy,
}) => {
  requireSessionToken();

  if (!(file instanceof File)) {
    throw new Error("Select a file before continuing");
  }

  const response = await fetch(`/organisations/${organisationId}/files`, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": file.name,
      "X-Source-Document-Type": sourceDocumentType,
      ...getSessionHeaders(),
      ...(uploadedBy ? { "X-Uploaded-By": uploadedBy } : {}),
    },
    body: file,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Upload failed with ${response.status}`);
  }

  return payload.file;
};

const persistSession = () => {
  if (state.sessionToken) {
    window.localStorage.setItem(SESSION_STORAGE_KEY, state.sessionToken);
  }

  if (state.sessionUser) {
    window.localStorage.setItem(
      SESSION_USER_KEY,
      JSON.stringify(state.sessionUser),
    );
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
    /^\/operator\/organisations\/([^/]+)\/document-portal$/,
  );
  if (pathMatch?.[1]) {
    return decodeURIComponent(pathMatch[1]);
  }

  return new URL(window.location.href).searchParams.get("organisationId")?.trim() ?? "";
};

const formMarkup = (fields, submitLabel) => `
  ${fields
    .map(
      (field) => `
        <div class="${field.full ? "full" : ""}">
          <label for="${field.id}">${escapeHtml(field.label)}</label>
          ${
            field.type === "textarea"
              ? `<textarea id="${field.id}" placeholder="${escapeHtml(field.placeholder ?? "")}"></textarea>`
              : field.type === "select"
                ? `<select id="${field.id}">
                    ${field.options
                      .map(
                        (option) =>
                          `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`,
                      )
                      .join("")}
                  </select>`
                : `<input id="${field.id}" type="${field.type}" placeholder="${escapeHtml(field.placeholder ?? "")}" />`
          }
        </div>
      `,
    )
    .join("")}
  <div class="full form-actions">
    <div class="status-text">Source file metadata and binary evidence are stored together for later assurance, review, and export.</div>
    <button type="submit">${escapeHtml(submitLabel)}</button>
  </div>
`;

const renderForms = () => {
  const profileOptions = getPortalProfiles().map((profile) => ({
    value: profile.id,
    label: `v${profile.versionNumber} - ${profile.activationStatus} - ${profile.id}`,
  }));
  const pilotOptions = getPortalPilots().map((pilot) => ({
    value: pilot.id,
    label: `${pilot.displayName} - ${pilot.status}`,
  }));

  oaUploadForm.innerHTML = formMarkup(
    [
      { id: "oa-authority-name", label: "Authority name", type: "text", placeholder: "Civil Aviation Authority" },
      { id: "oa-reference-number", label: "Reference number", type: "text", placeholder: "OA-2026-001" },
      { id: "oa-issue-date", label: "Issue date", type: "date" },
      { id: "oa-effective-from", label: "Effective from", type: "date" },
      { id: "oa-expires-at", label: "Expires at", type: "date" },
      { id: "oa-uploaded-by", label: "Uploaded by", type: "text", placeholder: "ops-manager" },
      { id: "oa-upload-file", label: "OA file", type: "file" },
      { id: "oa-source-document-type", label: "Source document type", type: "text", placeholder: "operational_authorisation_pdf" },
      { id: "oa-source-clause-refs", label: "Source clause refs", type: "text", placeholder: "Section 2.1, Annex B" },
      { id: "oa-review-notes", label: "Review notes", type: "textarea", full: true, placeholder: "Notes about extraction, review, or follow-up." },
    ],
    "Create OA record",
  );

  insuranceUploadForm.innerHTML = formMarkup(
    [
      { id: "insurance-provider-name", label: "Provider name", type: "text", placeholder: "Aviation Mutual" },
      { id: "insurance-policy-number", label: "Policy number", type: "text", placeholder: "POL-2026-001" },
      { id: "insurance-issue-date", label: "Issue date", type: "date" },
      { id: "insurance-effective-from", label: "Effective from", type: "date" },
      { id: "insurance-expires-at", label: "Expires at", type: "date" },
      { id: "insurance-uploaded-by", label: "Uploaded by", type: "text", placeholder: "ops-manager" },
      { id: "insurance-upload-file", label: "Insurance file", type: "file" },
      { id: "insurance-source-document-type", label: "Source document type", type: "text", placeholder: "policy_schedule" },
      { id: "insurance-policy-schedule-refs", label: "Policy schedule refs", type: "text", placeholder: "Schedule 1, Endorsement B" },
      { id: "insurance-review-notes", label: "Review notes", type: "textarea", full: true, placeholder: "Notes about policy wording, endorsements, or review." },
    ],
    "Create insurance record",
  );

  supportingUploadForm.innerHTML = formMarkup(
    [
      {
        id: "supporting-category",
        label: "Category",
        type: "select",
        options: [
          { value: "certificate", label: "Certificate" },
          { value: "training", label: "Training" },
          { value: "maintenance", label: "Maintenance" },
          { value: "manual", label: "Manual" },
          { value: "policy", label: "Policy" },
          { value: "contract", label: "Contract" },
          { value: "other", label: "Other" },
        ],
      },
      { id: "supporting-title", label: "Title", type: "text", placeholder: "Pilot competency matrix" },
      { id: "supporting-issuing-body", label: "Issuing body", type: "text", placeholder: "Internal / external issuer" },
      { id: "supporting-reference-number", label: "Reference number", type: "text", placeholder: "DOC-001" },
      { id: "supporting-issue-date", label: "Issue date", type: "date" },
      { id: "supporting-effective-from", label: "Effective from", type: "date" },
      { id: "supporting-expires-at", label: "Expires at", type: "date" },
      { id: "supporting-tags", label: "Tags", type: "text", placeholder: "renewal, competency, manual" },
      { id: "supporting-uploaded-by", label: "Uploaded by", type: "text", placeholder: "admin-user" },
      { id: "supporting-upload-file", label: "Supporting file", type: "file" },
      { id: "supporting-source-document-type", label: "Source document type", type: "text", placeholder: "pdf" },
      { id: "supporting-review-notes", label: "Review notes", type: "textarea", full: true, placeholder: "Why this document matters and any review observations." },
    ],
    "Create supporting record",
  );

  oaPilotAuthorisationForm.innerHTML = formMarkup(
    [
      profileOptions.length > 0
        ? {
            id: "oa-pilot-profile-id",
            label: "OA profile",
            type: "select",
            options: profileOptions,
          }
        : {
            id: "oa-pilot-profile-id",
            label: "OA profile ID",
            type: "text",
            placeholder: "Load an organisation with an OA profile",
          },
      pilotOptions.length > 0
        ? {
            id: "oa-pilot-pilot-id",
            label: "Pilot",
            type: "select",
            options: pilotOptions,
          }
        : {
            id: "oa-pilot-pilot-id",
            label: "Pilot ID",
            type: "text",
            placeholder: "Create a pilot before recording OA personnel status",
          },
      {
        id: "oa-pilot-state",
        label: "Authorisation state",
        type: "select",
        options: [
          { value: "authorised", label: "Authorised" },
          { value: "pending_amendment", label: "Pending amendment" },
          { value: "restricted", label: "Restricted" },
          { value: "inactive", label: "Inactive" },
        ],
      },
      { id: "oa-pilot-allowed-operation-types", label: "Allowed operation types", type: "text", placeholder: "inspection, survey" },
      { id: "oa-pilot-bvlos-authorised", label: "BVLOS authorised", type: "select", options: [{ value: "false", label: "No" }, { value: "true", label: "Yes" }] },
      { id: "oa-pilot-accountable-review", label: "Requires accountable review", type: "select", options: [{ value: "false", label: "No" }, { value: "true", label: "Yes" }] },
      { id: "oa-pilot-pending-reference", label: "Pending amendment reference", type: "text", placeholder: "CAA-AMEND-001" },
      { id: "oa-pilot-pending-submitted-at", label: "Pending submitted at", type: "date" },
      { id: "oa-pilot-approved-at", label: "Approved at", type: "date" },
      { id: "oa-pilot-notes", label: "Notes", type: "textarea", full: true, placeholder: "Reasoning, limits, or accountable review notes." },
    ],
    "Save OA pilot authorisation",
  );
};

const renderMetrics = () => {
  const summary = state.portal?.summary;
  if (!summary) {
    portalMetrics.innerHTML = "";
    return;
  }

  const cards = [
    {
      label: "Total Records",
      value: summary.totalDocuments,
      meta: "All OA, insurance, and supporting records for the loaded organisation.",
    },
    {
      label: "Missing Source Uploads",
      value: summary.missingSourceUploads,
      meta: "Documents that still need source file metadata recorded for later review and extraction.",
    },
    {
      label: "Expiring Soon",
      value: summary.expiringSoon,
      meta: "Records with expiry inside the next 30 days so renewal pressure is visible early.",
    },
    {
      label: "Supporting Records",
      value: summary.supportingDocuments,
      meta: "Certificates, manuals, training, maintenance, policies, and other supporting documents.",
    },
  ];

  portalMetrics.innerHTML = cards
    .map(
      (card) => `
        <article class="metric">
          <div class="label">${escapeHtml(card.label)}</div>
          <div class="value">${escapeHtml(String(card.value))}</div>
          <div class="meta">${escapeHtml(card.meta)}</div>
        </article>
      `,
    )
    .join("");
};

const buildFileActionMarkup = (item) => {
  if (!item?.uploadedFileId) {
    return `<div class="status-text">No stored source file is attached yet.</div>`;
  }

  if (!state.sessionToken) {
    return `<div class="status-text">Login is required before metadata, preview, or download actions are available.</div>`;
  }

  return `
    <div class="doc-action-row">
      <button class="doc-action-link" type="button" data-file-action="metadata" data-file-id="${escapeHtml(item.uploadedFileId)}">Open metadata</button>
      <button class="doc-action-link" type="button" data-file-action="preview" data-file-id="${escapeHtml(item.uploadedFileId)}">Preview / open</button>
      <button class="doc-action-link" type="button" data-file-action="download" data-file-id="${escapeHtml(item.uploadedFileId)}">Download</button>
    </div>
  `;
};

const renderDocumentCards = (items, emptyMessage, titleBuilder, detailBuilder = null) => {
  if (!items || items.length === 0) {
    return `<div class="empty-state">${escapeHtml(emptyMessage)}</div>`;
  }

  return `
    <div class="doc-list">
      ${items
        .map(
          (item) => `
            <article class="doc-card">
              <h4>${escapeHtml(titleBuilder(item))}</h4>
              <div>${renderBadge(item.status ?? "Unknown")}</div>
              <div class="doc-meta">
                Reference: ${escapeHtml(item.referenceNumber ?? item.policyNumber ?? "Not recorded")}<br />
                Effective: ${escapeHtml(formatDate(item.effectiveFrom))}<br />
                Expires: ${escapeHtml(formatDate(item.expiresAt))}<br />
                Source file: ${escapeHtml(item.uploadedFileName ?? item.uploadedFileId ?? "Not recorded")}
                ${detailBuilder ? `<br />${detailBuilder(item)}` : ""}
              </div>
              <div class="doc-chip-row">
                ${renderBadge(item.sourceDocumentType ?? "source pending")}
                ${renderBadge(item.uploadedBy ?? "uploader pending")}
              </div>
              ${buildFileActionMarkup(item)}
            </article>
          `,
        )
        .join("")}
    </div>
  `;
};

const renderPilotAuthorisationList = () => {
  if (!state.oaPilotAuthorisations) {
    oaPilotAuthorisationList.innerHTML =
      '<div class="empty-state">Load an OA profile to review pilot authorisations.</div>';
    return;
  }

  const items = state.oaPilotAuthorisations.authorisations ?? [];
  if (items.length === 0) {
    oaPilotAuthorisationList.innerHTML =
      '<div class="empty-state">No pilot authorisations are currently recorded for this OA profile.</div>';
    return;
  }

  oaPilotAuthorisationList.innerHTML = `
    <div class="doc-list">
      ${items
        .map(
          (item) => `
            <article class="doc-card">
              <h4>Pilot ${escapeHtml(item.pilotId)}</h4>
              <div class="status-text">${escapeHtml(getPilotLabel(item.pilotId))}</div>
              <div class="doc-chip-row">
                ${renderBadge(item.authorisationState)}
                ${renderBadge(item.bvlosAuthorised ? "BVLOS authorised" : "BVLOS not authorised")}
                ${renderBadge(item.requiresAccountableReview ? "Accountable review" : "No extra review")}
              </div>
              <div class="doc-meta">
                Authorisation ID: ${escapeHtml(item.id)}<br />
                Allowed operation types: ${escapeHtml((item.allowedOperationTypes ?? []).join(", ") || "Not limited")}<br />
                Pending amendment ref: ${escapeHtml(item.pendingAmendmentReference ?? "Not recorded")}<br />
                Pending submitted: ${escapeHtml(formatDate(item.pendingSubmittedAt))}<br />
                Approved at: ${escapeHtml(formatDate(item.approvedAt))}
              </div>
              <form class="nested-review-form" data-authorisation-review-form="${escapeHtml(item.id)}">
                <div class="form-grid compact-form">
                  <div class="field">
                    <label for="review-decision-${escapeHtml(item.id)}">Review decision</label>
                    <select id="review-decision-${escapeHtml(item.id)}" name="decision">
                      <option value="accepted_for_tracking">Accepted for tracking</option>
                      <option value="deferred">Deferred</option>
                      <option value="not_accepted">Not accepted</option>
                      <option value="amendment_approved">Amendment approved</option>
                    </select>
                  </div>
                  <div class="field">
                    <label for="reviewed-by-${escapeHtml(item.id)}">Reviewed by</label>
                    <input id="reviewed-by-${escapeHtml(item.id)}" name="reviewedBy" type="text" placeholder="Accountable manager" />
                  </div>
                  <div class="field">
                    <label for="review-evidence-${escapeHtml(item.id)}">Evidence ref</label>
                    <input id="review-evidence-${escapeHtml(item.id)}" name="evidenceRef" type="text" placeholder="Meeting minute / amendment ref" />
                  </div>
                  <div class="field full">
                    <label for="review-rationale-${escapeHtml(item.id)}">Rationale</label>
                    <textarea id="review-rationale-${escapeHtml(item.id)}" name="reviewRationale" placeholder="Record the accountable review rationale and limits."></textarea>
                  </div>
                  <button type="submit">Record review</button>
                </div>
              </form>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
};

const renderPortal = () => {
  renderMetrics();

  const portal = state.portal;
  if (!portal) {
    oaList.innerHTML =
      '<div class="empty-state">Load an organisation to review Operational Authorisation records.</div>';
    insuranceList.innerHTML =
      '<div class="empty-state">Load an organisation to review insurance records.</div>';
    supportingList.innerHTML =
      '<div class="empty-state">Load an organisation to review supporting records.</div>';
    renderPilotAuthorisationList();
    return;
  }

  const profileByDocumentId = new Map(
    (portal.sections.operationalAuthorityProfiles ?? []).map((profile) => [
      profile.operationalAuthorityDocumentId,
      profile,
    ]),
  );

  oaList.innerHTML = renderDocumentCards(
    portal.sections.operationalAuthorityDocuments,
    "No OA records are currently stored for this organisation.",
    (item) => item.authorityName,
    (item) => {
      const profile = profileByDocumentId.get(item.id);
      return `Profile ID: ${escapeHtml(profile?.id ?? "Not recorded")}`;
    },
  );
  insuranceList.innerHTML = renderDocumentCards(
    portal.sections.insuranceDocuments,
    "No insurance records are currently stored for this organisation.",
    (item) => item.providerName,
  );
  supportingList.innerHTML = renderDocumentCards(
    portal.sections.supportingDocuments,
    "No supporting records are currently stored for this organisation.",
    (item) => `${item.category} - ${item.title}`,
  );
  renderPilotAuthorisationList();
  renderForms();
};

const readCsv = (value) =>
  String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const openTextWindow = (title, content) => {
  const win = window.open("", "_blank", "noopener");
  if (!win) {
    setPortalStatus("Popup blocked while opening document detail", "tone-warn");
    return;
  }

  win.document.write(`
    <html>
      <head><title>${escapeHtml(title)}</title></head>
      <body style="background:#09111b;color:#edf3fb;font-family:monospace;padding:24px;white-space:pre-wrap;">${escapeHtml(content)}</body>
    </html>
  `);
  win.document.close();
};

const openBlobFromResponse = async (response, fileName, mode) => {
  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);

  if (mode === "preview") {
    window.open(objectUrl, "_blank", "noopener");
  } else {
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 10_000);
};

const handleFileAction = async (event) => {
  const button = event.target.closest("[data-file-action]");
  if (!button) {
    return;
  }

  try {
    requireSessionToken();
  } catch (error) {
    setPortalStatus(error instanceof Error ? error.message : "Login required", "tone-warn");
    return;
  }

  const fileId = button.getAttribute("data-file-id");
  const action = button.getAttribute("data-file-action");

  if (!fileId || !action) {
    return;
  }

  try {
    if (action === "metadata") {
      const payload = await fetchAuthJson(`/files/${encodeURIComponent(fileId)}`);
      openTextWindow(
        `Stored file ${fileId}`,
        JSON.stringify(payload, null, 2),
      );
      return;
    }

    const disposition = action === "preview" ? "inline" : "attachment";
    const response = await fetch(
      `/files/${encodeURIComponent(fileId)}/content?disposition=${disposition}`,
      {
        headers: {
          ...getSessionHeaders(),
        },
      },
    );

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error?.message || `Request failed with ${response.status}`);
    }

    const contentDisposition = response.headers.get("content-disposition") || "";
    const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/i);
    const fileName = fileNameMatch?.[1] || `${fileId}.bin`;
    await openBlobFromResponse(response, fileName, action === "preview" ? "preview" : "download");
  } catch (error) {
    setPortalStatus(
      error instanceof Error ? error.message : "File action failed",
      "tone-bad",
    );
  }
};

const createOaRecord = async () => {
  const organisationId = state.organisationId;
  const uploadedBy = document.getElementById("oa-uploaded-by").value || null;
  const file = document.getElementById("oa-upload-file").files?.[0];
  const sourceDocumentType =
    document.getElementById("oa-source-document-type").value ||
    "operational_authorisation_pdf";
  const storedFile = await uploadBinaryFile({
    organisationId,
    file,
    sourceDocumentType,
    uploadedBy,
  });
  const createResponse = await fetchJson(
    `/organisations/${organisationId}/operational-authority-documents`,
    {
      method: "POST",
      headers: getSessionHeaders(),
      body: JSON.stringify({
        authorityName: document.getElementById("oa-authority-name").value,
        referenceNumber: document.getElementById("oa-reference-number").value,
        issueDate: document.getElementById("oa-issue-date").value,
        effectiveFrom: document.getElementById("oa-effective-from").value,
        expiresAt: document.getElementById("oa-expires-at").value,
        uploadedBy,
        conditions: [],
      }),
    },
  );

  await fetchJson(
    `/operational-authority-documents/${createResponse.document.id}/upload`,
    {
      method: "POST",
      headers: getSessionHeaders(),
      body: JSON.stringify({
        uploadedFileId: storedFile.id,
        sourceDocumentType,
        uploadedFileName: storedFile.originalFileName,
        uploadedFileChecksum: storedFile.fileChecksum,
        sourceClauseRefs: readCsv(document.getElementById("oa-source-clause-refs").value),
        documentReviewNotes: document.getElementById("oa-review-notes").value || null,
        uploadedBy,
      }),
    },
  );
};

const createInsuranceRecord = async () => {
  const organisationId = state.organisationId;
  const uploadedBy = document.getElementById("insurance-uploaded-by").value || null;
  const sourceDocumentType =
    document.getElementById("insurance-source-document-type").value ||
    "policy_schedule";
  const file = document.getElementById("insurance-upload-file").files?.[0];
  const storedFile = await uploadBinaryFile({
    organisationId,
    file,
    sourceDocumentType,
    uploadedBy,
  });
  const createResponse = await fetchJson(
    `/organisations/${organisationId}/insurance-documents`,
    {
      method: "POST",
      headers: getSessionHeaders(),
      body: JSON.stringify({
        providerName: document.getElementById("insurance-provider-name").value,
        policyNumber: document.getElementById("insurance-policy-number").value,
        issueDate: document.getElementById("insurance-issue-date").value,
        effectiveFrom: document.getElementById("insurance-effective-from").value,
        expiresAt: document.getElementById("insurance-expires-at").value,
        uploadedBy,
        conditions: [],
      }),
    },
  );

  await fetchJson(`/insurance-documents/${createResponse.document.id}/upload`, {
    method: "POST",
    headers: getSessionHeaders(),
    body: JSON.stringify({
      uploadedFileId: storedFile.id,
      sourceDocumentType,
      uploadedFileName: storedFile.originalFileName,
      uploadedFileChecksum: storedFile.fileChecksum,
      policyScheduleRefs: readCsv(
        document.getElementById("insurance-policy-schedule-refs").value,
      ),
      documentReviewNotes: document.getElementById("insurance-review-notes").value || null,
      uploadedBy,
    }),
  });
};

const createSupportingRecord = async () => {
  const organisationId = state.organisationId;
  const uploadedBy =
    document.getElementById("supporting-uploaded-by").value || null;
  const sourceDocumentType =
    document.getElementById("supporting-source-document-type").value || "pdf";
  const file = document.getElementById("supporting-upload-file").files?.[0];
  const storedFile = await uploadBinaryFile({
    organisationId,
    file,
    sourceDocumentType,
    uploadedBy,
  });
  const createResponse = await fetchJson(`/organisations/${organisationId}/documents`, {
    method: "POST",
    headers: getSessionHeaders(),
    body: JSON.stringify({
      category: document.getElementById("supporting-category").value,
      title: document.getElementById("supporting-title").value,
      issuingBody: document.getElementById("supporting-issuing-body").value || null,
      referenceNumber: document.getElementById("supporting-reference-number").value || null,
      issueDate: document.getElementById("supporting-issue-date").value || null,
      effectiveFrom: document.getElementById("supporting-effective-from").value || null,
      expiresAt: document.getElementById("supporting-expires-at").value || null,
      tags: readCsv(document.getElementById("supporting-tags").value),
      uploadedBy,
    }),
  });

  await fetchJson(`/organisation-documents/${createResponse.document.id}/upload`, {
    method: "POST",
    headers: getSessionHeaders(),
    body: JSON.stringify({
      uploadedFileId: storedFile.id,
      sourceDocumentType,
      uploadedFileName: storedFile.originalFileName,
      uploadedFileChecksum: storedFile.fileChecksum,
      reviewNotes: document.getElementById("supporting-review-notes").value || null,
      uploadedBy,
    }),
  });
};

const loadOaPilotAuthorisations = async (profileId) => {
  if (!profileId) {
    state.oaPilotAuthorisations = null;
    renderPilotAuthorisationList();
    return;
  }

  state.oaPilotAuthorisations = await fetchAuthJson(
    `/operational-authority-profiles/${profileId}/pilot-authorisations`,
  );
  renderPilotAuthorisationList();
};

const saveOaPilotAuthorisation = async () => {
  const profileId = document.getElementById("oa-pilot-profile-id").value.trim();
  if (!profileId) {
    throw new Error("OA profile ID is required before saving pilot authorisations.");
  }

  const body = {
    pilotId: document.getElementById("oa-pilot-pilot-id").value.trim(),
    authorisationState: document.getElementById("oa-pilot-state").value,
    allowedOperationTypes: readCsv(
      document.getElementById("oa-pilot-allowed-operation-types").value,
    ),
    bvlosAuthorised:
      document.getElementById("oa-pilot-bvlos-authorised").value === "true",
    requiresAccountableReview:
      document.getElementById("oa-pilot-accountable-review").value === "true",
    pendingAmendmentReference:
      document.getElementById("oa-pilot-pending-reference").value || null,
    pendingSubmittedAt:
      document.getElementById("oa-pilot-pending-submitted-at").value || null,
    approvedAt: document.getElementById("oa-pilot-approved-at").value || null,
    notes: document.getElementById("oa-pilot-notes").value || null,
  };

  await fetchAuthJson(
    `/operational-authority-profiles/${profileId}/pilot-authorisations`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

  await loadOaPilotAuthorisations(profileId);
};

const saveOaPilotAuthorisationReview = async (form) => {
  const authorisationId = form.getAttribute("data-authorisation-review-form");
  if (!authorisationId) {
    throw new Error("Pilot authorisation ID is required before recording review.");
  }

  const formData = new FormData(form);
  const profileId = document.getElementById("oa-pilot-profile-id")?.value.trim();

  await fetchAuthJson(
    `/operational-authority-pilot-authorisations/${authorisationId}/reviews`,
    {
      method: "POST",
      body: JSON.stringify({
        decision: String(formData.get("decision") ?? ""),
        reviewedBy: String(formData.get("reviewedBy") ?? "").trim(),
        reviewRationale: String(formData.get("reviewRationale") ?? "").trim(),
        evidenceRef: String(formData.get("evidenceRef") ?? "").trim() || null,
      }),
    },
  );

  form.reset();
  await loadOaPilotAuthorisations(profileId);
};

const loadPortal = async (organisationId) => {
  if (!organisationId) {
    state.organisationId = "";
    state.portal = null;
    setPortalStatus("Enter an organisation ID", "tone-warn");
    renderPortal();
    return;
  }

  state.organisationId = organisationId;
  setPortalStatus("Loading document portal...", "");
  updateUrl(organisationId);

  try {
    state.portal = await fetchAuthJson(`/organisations/${organisationId}/document-portal`);
    state.oaPilotAuthorisations = null;
    renderPortal();
    const defaultProfileId = getDefaultProfileId();
    const profileInput = document.getElementById("oa-pilot-profile-id");
    if (profileInput && defaultProfileId) {
      profileInput.value = defaultProfileId;
      await loadOaPilotAuthorisations(defaultProfileId);
    }
    setPortalStatus("Document portal loaded", "tone-ok");
  } catch (error) {
    state.portal = null;
    state.oaPilotAuthorisations = null;
    renderPortal();
    setPortalStatus(error instanceof Error ? error.message : "Failed to load portal", "tone-bad");
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
    renderPortal();
  } catch (error) {
    setAuthStatus(
      error instanceof Error ? error.message : "Login failed",
      "tone-bad",
    );
  }
};

renderForms();
renderPortal();
loadStoredSession();
updateAuthStatus();

oaUploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.organisationId) {
    setPortalStatus("Load an organisation before creating OA records", "tone-warn");
    return;
  }
  try {
    await createOaRecord();
    await loadPortal(state.organisationId);
    setPortalStatus("OA record created", "tone-ok");
  } catch (error) {
    setPortalStatus(error instanceof Error ? error.message : "OA record failed", "tone-bad");
  }
});

insuranceUploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.organisationId) {
    setPortalStatus("Load an organisation before creating insurance records", "tone-warn");
    return;
  }
  try {
    await createInsuranceRecord();
    await loadPortal(state.organisationId);
    setPortalStatus("Insurance record created", "tone-ok");
  } catch (error) {
    setPortalStatus(error instanceof Error ? error.message : "Insurance record failed", "tone-bad");
  }
});

supportingUploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.organisationId) {
    setPortalStatus("Load an organisation before creating supporting records", "tone-warn");
    return;
  }
  try {
    await createSupportingRecord();
    await loadPortal(state.organisationId);
    setPortalStatus("Supporting record created", "tone-ok");
  } catch (error) {
    setPortalStatus(
      error instanceof Error ? error.message : "Supporting record failed",
      "tone-bad",
    );
  }
});

oaPilotAuthorisationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await saveOaPilotAuthorisation();
    setPortalStatus("OA pilot authorisation saved", "tone-ok");
  } catch (error) {
    setPortalStatus(
      error instanceof Error ? error.message : "OA pilot authorisation failed",
      "tone-bad",
    );
  }
});

oaPilotAuthorisationForm.addEventListener("change", async (event) => {
  if (event.target?.id !== "oa-pilot-profile-id") {
    return;
  }

  const profileId = event.target.value.trim();
  try {
    await loadOaPilotAuthorisations(profileId);
  } catch (error) {
    setPortalStatus(
      error instanceof Error ? error.message : "Failed to load OA pilot authorisations",
      "tone-bad",
    );
  }
});

oaPilotAuthorisationList.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-authorisation-review-form]");
  if (!form) {
    return;
  }

  event.preventDefault();
  try {
    await saveOaPilotAuthorisationReview(form);
    setPortalStatus("OA pilot amendment review recorded", "tone-ok");
  } catch (error) {
    setPortalStatus(
      error instanceof Error ? error.message : "OA pilot review failed",
      "tone-bad",
    );
  }
});

loginButton.addEventListener("click", login);
authPasswordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    login();
  }
});

loadPortalButton.addEventListener("click", () => {
  loadPortal(organisationIdInput.value.trim());
});

organisationIdInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadPortal(organisationIdInput.value.trim());
  }
});

copyPortalLinkButton.addEventListener("click", async () => {
  const organisationId = organisationIdInput.value.trim();
  const url = new URL(window.location.href);
  if (organisationId) {
    url.searchParams.set("organisationId", organisationId);
  }

  try {
    await navigator.clipboard.writeText(url.toString());
    setPortalStatus("Direct link copied", "tone-ok");
  } catch {
    setPortalStatus("Clipboard write failed", "tone-warn");
  }
});

document.addEventListener("click", handleFileAction);

const initialOrganisationId = getOrganisationIdFromLocation();
if (initialOrganisationId) {
  organisationIdInput.value = initialOrganisationId;
  loadPortal(initialOrganisationId);
}
