from pathlib import Path
from flask import Blueprint, jsonify, Response
from datetime import datetime
from zoneinfo import ZoneInfo
import json
import subprocess
import sys

validation_bp = Blueprint("validation", __name__)

REPORT_FILE = Path("validation_report.json")


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

        report = {
            "report_version": "v0.3",
            "generated_at": last_modified.isoformat(),
            "flight_id": "unknown",
            "status": "ok",
            "results": payload if isinstance(payload, list) else [],
        }

        return jsonify({
            "ok": True,
            "report": report,
            "report_file": str(report_file),
            "results": report["results"],        # temporary compatibility
            "generated_at": report["generated_at"]
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
    .EARLY { background: #e6f4ea; color: #0a7a2f; }
      .EDGE { background: #fff4e5; color: #b26a00; }
      .NO-BREACH { background: #eef2ff; color: #334155; }

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

  async function loadReport() {
    const app = document.getElementById("app");

    try {
      const res = await fetch("/api/fsms/validation/latest");
      const data = await res.json();

      if (!res.ok) {
        app.innerHTML = `<div class="error">${data.error || "Failed to load report"}</div>`;
        return;
      }

      const rowsData = Array.isArray(data) ? data : data.results;

      if (!Array.isArray(rowsData)) {
        app.innerHTML = `<div class="error">Unexpected report format</div>`;
        return;
      }

      const rows = rowsData.map(row => `
        <tr>
          <td>${row.scenario ?? "-"}</td>
          <td>${row.first_alert ?? "-"}</td>
          <td>${row.first_warning ?? "-"}</td>
          <td>${row.first_truth_event ?? "-"}</td>
          <td>${row.lead_steps ?? "-"}</td>
          <td>${row.lead_seconds ?? "-"}</td>
          <td class="${row.score ?? ""}">${row.score ?? "-"}</td>
          <td>
            <span class="badge ${row.classification ?? ""}">
              ${row.classification ?? "-"}
            </span>
          </td>
        </tr>
      `).join("");

      app.innerHTML = `
        <table>
          <thead>
            <tr>
              <th>Scenario</th>
              <th>First Alert</th>
              <th>First Warning</th>
              <th>First Truth Event</th>
              <th>Lead Steps</th>
              <th>Lead Seconds</th>
              <th>Score</th>
              <th>Classification</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;

      if (data.generated_at) {
        const ts = data.generated_at;

        let dt = new Date(ts);

        if (isNaN(dt.getTime())) {
          dt = new Date(ts.replace("Z", ""));
        }

        document.getElementById("meta").innerText =
          "Validation run: " + dt.toLocaleString();
      }
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