from pathlib import Path
from flask import Blueprint, jsonify, Response
from datetime import datetime
from zoneinfo import ZoneInfo
import json
import subprocess
import sys

validation_bp = Blueprint("validation", __name__)

REPORT_FILE = Path("validation_report.json")


def get_latest_report_file():
    candidates = sorted(
        Path(".").glob("validation_report_*.json"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )

    if candidates:
        return candidates[0]

    fallback = Path("validation_report.json")
    if fallback.exists():
        return fallback

    return None


def build_summary(results):
    summary = {
        "totals": {
            "pass": 0,
            "review": 0,
            "fail": 0,
        },
        "scenarios": [],
    }

    for index, item in enumerate(results):
        if not isinstance(item, dict):
            continue

        name = item.get("name") or item.get("scenario") or f"scenario_{index + 1}"
        classification = str(item.get("classification", "UNKNOWN")).upper()

        if classification == "PASS":
            summary["totals"]["pass"] += 1
        elif classification == "REVIEW":
            summary["totals"]["review"] += 1
        elif classification == "FAIL":
            summary["totals"]["fail"] += 1

        scenario_id = str(item.get("scenario_id") or name.lower().replace(" ", "_"))

        summary["scenarios"].append({
            "scenario_id": scenario_id,
            "name": name,
            "classification": classification,
            "leadTime": item.get("leadTime") or item.get("lead_time") or item.get("lead_seconds"),
            "firstWarning": item.get("firstWarning") or item.get("first_warning"),
            "firstTruthEvent": item.get("firstTruthEvent") or item.get("first_truth_event"),
            "detail": {
                "firstAlert": item.get("firstAlert") or item.get("first_alert"),
                "firstWarning": item.get("firstWarning") or item.get("first_warning"),
                "firstTruthEvent": item.get("firstTruthEvent") or item.get("first_truth_event"),
                "firstBreach": item.get("firstBreach") or item.get("first_breach"),
                "leadSteps": item.get("leadSteps") or item.get("lead_steps"),
                "leadSeconds": item.get("leadSeconds") or item.get("lead_seconds"),
                "reasoning": item.get("reasoning") or item.get("reason") or "No reasoning provided.",
            }
        })

    return summary


@validation_bp.get("/api/fsms/validation/latest")
def get_latest_validation_report():
    try:
        report_file = get_latest_report_file()

        if report_file is None:
            return jsonify({
                "ok": False,
                "error": "No validation report file found"
            }), 404

        payload = json.loads(report_file.read_text(encoding="utf-8"))

        last_modified = datetime.fromtimestamp(
            report_file.stat().st_mtime,
            tz=ZoneInfo("Europe/London")
        )

        if isinstance(payload, dict) and "results" in payload:
            results = payload.get("results", [])
        else:
            results = payload if isinstance(payload, list) else []

        summary = build_summary(results)

        report = {
            "report_version": "v0.3",
            "generated_at": last_modified.isoformat(),
            "flight_id": "unknown",
            "status": "ok",
            "summary": summary,
            "results": results,
        }

        return jsonify({
            "ok": True,
            "report": report,
            "report_file": str(report_file),
        })

    except Exception as e:
        import traceback
        return jsonify({
            "ok": False,
            "error": str(e),
            "traceback": traceback.format_exc(),
        }), 500


@validation_bp.post("/api/fsms/validation/run")
def run_validation_now():
    try:
        project_root = Path(__file__).resolve().parent.parent

        result = subprocess.run(
            [sys.executable, "-m", "src.validation.runner.run_validation"],
            cwd=str(project_root),
            capture_output=True,
            text=True,
            check=True,
        )

        return jsonify({
            "ok": True,
            "message": "Validation completed",
            "stdout": result.stdout,
        })

    except subprocess.CalledProcessError as e:
        return jsonify({
            "ok": False,
            "error": "Validation run failed",
            "stdout": e.stdout,
            "stderr": e.stderr,
        }), 500

    except Exception as e:
        return jsonify({
            "ok": False,
            "error": str(e),
        }), 500


@validation_bp.get("/validation")
def validation_demo_page():
    html = """
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>FSMS Validation Results</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 24px;
      background: #f7f7f9;
      color: #222;
    }

    h1 {
      margin-bottom: 8px;
    }

    .meta {
      margin-bottom: 20px;
      color: #555;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
    }

    th, td {
      border: 1px solid #ddd;
      padding: 10px 12px;
      text-align: left;
    }

    th {
      background: #f0f2f5;
    }

    .PASS {
      color: #0a7a2f;
      font-weight: bold;
    }

    .REVIEW {
      color: #b26a00;
      font-weight: bold;
    }

    .FAIL {
      color: #b00020;
      font-weight: bold;
    }

    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 12px;
      background: #eef2ff;
    }

    .error {
      color: #b00020;
      font-weight: bold;
    }

    button {
      background: #2563eb;
      color: white;
      border: none;
      padding: 10px 14px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
    }

    button:disabled {
      background: #94a3b8;
      cursor: not-allowed;
    }

    .layout {
      position: relative;
    }

    .main-panel {
      width: 100%;
    }

    .scenario-row {
      cursor: pointer;
    }

    .scenario-row:hover {
      background: #f8fafc;
    }

    .scenario-row.active {
      background: #eef2ff;
    }

    .side-panel {
      position: fixed;
      top: 24px;
      right: 24px;
      left: auto;
      width: 380px;
      max-width: calc(100vw - 48px);
      max-height: calc(100vh - 48px);
      overflow-y: auto;
      background: white;
      border: 1px solid #ddd;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
      z-index: 99999;
    }

    .side-panel.hidden {
      display: none;
    }

    .side-panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .side-panel-close {
      background: transparent;
      color: #475569;
      border: none;
      font-size: 20px;
      cursor: pointer;
      padding: 0 4px;
    }

    .side-panel-close:hover {
      color: #111827;
    }

    .detail-grid {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 8px 12px;
    }

    .detail-label {
      color: #555;
      font-weight: bold;
    }

    .detail-value {
      color: #222;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <h1>FSMS Validation Results</h1>
  <div class="meta" id="meta">Auto-generated validation report</div>

  <div style="margin-bottom: 16px;">
    <button id="runBtn" onclick="runValidation()">Run Validation</button>
    <span id="status" style="margin-left: 12px; color: #555;"></span>
  </div>

  <div id="app">Loading...</div>

  <script>
    let latestScenarios = [];
    let activeScenarioId = null;

    async function runValidation() {
      const btn = document.getElementById("runBtn");
      const status = document.getElementById("status");

      btn.disabled = true;
      btn.innerText = "Running...";
      status.innerText = "Validation in progress...";

      try {
        const res = await fetch("/api/fsms/validation/run", {
          method: "POST"
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
          status.innerText = "Validation failed";
          console.error("Validation run failed:", data);
          alert(data.stderr || data.error || "Validation run failed");
          return;
        }

        status.innerText = "Validation complete";
        await loadReport();
      } catch (err) {
        status.innerText = "Validation failed";
        console.error(err);
      } finally {
        btn.disabled = false;
        btn.innerText = "Run Validation";
      }
    }

    function renderScenarioDetailPanel(scenario) {
      if (!scenario) {
        return `<div class="side-panel hidden" id="detailPanel"></div>`;
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

    function renderReport() {
      const app = document.getElementById("app");

      if (!Array.isArray(latestScenarios)) {
        app.innerHTML = `<div class="error">Unexpected report format</div>`;
        return;
      }

      const activeScenario =
        latestScenarios.find(s => s.scenario_id === activeScenarioId) || null;

      const rows = latestScenarios.map(row => `
        <tr
          class="scenario-row ${row.scenario_id === activeScenarioId ? "active" : ""}"
          onclick="selectScenario('${row.scenario_id}')"
        >
          <td>${row.name ?? "-"}</td>
          <td>${row.firstWarning ?? "-"}</td>
          <td>${row.firstTruthEvent ?? "-"}</td>
          <td>${row.leadTime ?? "-"}</td>
          <td>
            <span class="badge ${row.classification ?? ""}">
              ${row.classification ?? "-"}
            </span>
          </td>
        </tr>
      `).join("");

      app.innerHTML = `
        <div class="layout">
          <div class="main-panel">
            <table>
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th>First Warning</th>
                  <th>First Truth Event</th>
                  <th>Lead Time</th>
                  <th>Classification</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>

          ${renderScenarioDetailPanel(activeScenario)}
        </div>
      `;
    }

    function selectScenario(scenarioId) {
      activeScenarioId = scenarioId;
      renderReport();
    }

    function closeScenarioPanel() {
      activeScenarioId = null;
      renderReport();
    }

    async function loadReport() {
      const app = document.getElementById("app");

      try {
        const res = await fetch("/api/fsms/validation/latest");
        const data = await res.json();

        if (!res.ok || !data.ok) {
          app.innerHTML = `<div class="error">${data.error || "Failed to load report"}</div>`;
          return;
        }

        const report = data.report;
        const summary = report?.summary;
        const scenarios = summary?.scenarios;

        if (!Array.isArray(scenarios)) {
          app.innerHTML = `<div class="error">Unexpected report format</div>`;
          return;
        }

        latestScenarios = scenarios;

        if (report?.generated_at) {
          const ts = report.generated_at;
          let dt = new Date(ts);

          if (isNaN(dt.getTime())) {
            dt = new Date(ts.replace("Z", ""));
          }

          document.getElementById("meta").innerText =
            "Validation run: " + dt.toLocaleString();
        }

        renderReport();
      } catch (err) {
        app.innerHTML = `<div class="error">Error loading report: ${err.message}</div>`;
      }
    }

    loadReport();
  </script>
</body>
</html>
    """
    return Response(html, mimetype="text/html")