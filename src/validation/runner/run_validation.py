from datetime import datetime, timezone
from pprint import pprint

import json
import csv
from pathlib import Path

from src.validation.runner.system_adapter import ValidationSystemAdapter
from src.validation.runner.capture_snapshot import capture_snapshot

from src.validation.scenarios.vertical_breach_scenario import make_vertical_breach_variant
from src.validation.scenarios.borderline_ceiling_scenario import make_borderline_ceiling_variant
from src.validation.scenarios.faster_climb_breach_scenario import make_faster_climb_breach_variant
from src.validation.scenarios.envelope_conflict_scenario import make_envelope_conflict_variant
from src.validation.scenarios.four_d_conflict_scenario import make_four_d_conflict_variant




def summarize_snapshots(system):
    points = system.get_all_points()

    print("\n=== SUMMARY ===")
    for i in range(len(points)):
        snapshot = capture_snapshot(system, i)
        truth_breach = snapshot["truth"]["breach"]
        pred_state = snapshot["prediction"]["classification"]["state"]
        ts = snapshot["timestamp"]

        print(f"{i:02d} | {ts} | breach={truth_breach} | pred={pred_state}")


def classify_validation(snapshot):
    truth_breach = snapshot["truth"]["breach"]
    pred_state = snapshot["prediction"]["classification"]["state"]

    if truth_breach and pred_state == "SAFE":
        return "MISS: active breach but prediction safe"

    if truth_breach and pred_state == "BREACH":
        return "CONFIRMED BREACH"

    if truth_breach and pred_state in {"WARNING", "CAUTION"}:
        return "BREACH WITH ACTIVE ALERT"

    if not truth_breach and pred_state == "WARNING":
        return "ANTICIPATORY WARNING"

    if not truth_breach and pred_state == "CAUTION":
        return "RECOVERY / CAUTION"

    if not truth_breach and pred_state == "SAFE":
        return "NORMAL SAFE"

    return "UNCLASSIFIED"


def summarize_validation(system):
    points = system.get_all_points()

    print("\n=== VALIDATION SUMMARY ===")
    for i in range(len(points)):
        snapshot = capture_snapshot(system, i)
        ts = snapshot["timestamp"]
        truth_breach = snapshot["truth"]["breach"]
        pred_state = snapshot["prediction"]["classification"]["state"]
        label = classify_validation(snapshot)

        print(
            f"{i:02d} | {ts} | breach={truth_breach} | pred={pred_state} | {label}"
        )


def compute_lead_time(system):
    points = system.get_all_points()

    first_warning_idx = None
    first_truth_event_idx = None

    for i in range(len(points)):
        snapshot = capture_snapshot(system, i)

        pred_state = snapshot["prediction"]["classification"]["state"]
        truth_breach = snapshot["truth"]["breach"]

        if first_warning_idx is None and pred_state == "WARNING":
            first_warning_idx = i

        if first_truth_event_idx is None and truth_breach:
            first_truth_event_idx = i

    print("\n=== LEAD TIME ANALYSIS ===")

    if first_warning_idx is None:
        print("No WARNING detected")
        return

    if first_truth_event_idx is None:
        print("No BREACH detected")
        return

    warning_ts = capture_snapshot(system, first_warning_idx)["timestamp"]
    breach_ts = capture_snapshot(system, first_truth_event_idx)["timestamp"]

    t_warning = datetime.fromisoformat(warning_ts)
    t_breach = datetime.fromisoformat(breach_ts)

    lead_time_s = (t_breach - t_warning).total_seconds()

    print(f"First WARNING at index {first_warning_idx}: {warning_ts}")
    print(f"First BREACH at index {first_truth_event_idx}: {breach_ts}")
    print(f"Lead time: {lead_time_s:.2f} seconds")


def score_validation(system, min_lead_time_s=5.0):
    points = system.get_all_points()

    first_warning_idx = None
    first_truth_event_idx = None
    any_breach = False
    miss_during_breach = False

    for i in range(len(points)):
        snapshot = capture_snapshot(system, i)

        pred_state = snapshot["prediction"]["classification"]["state"]
        truth_breach = snapshot["truth"]["breach"]

        if truth_breach:
            any_breach = True

        if first_warning_idx is None and pred_state == "WARNING":
            first_warning_idx = i

        if first_truth_event_idx is None and truth_breach:
            first_truth_event_idx = i

        if truth_breach and pred_state == "SAFE":
            miss_during_breach = True

    print("\n=== PASS / FAIL SCORING ===")

    if miss_during_breach:
        print("FAIL: breach occurred while prediction stayed SAFE")
        return

    if not any_breach:
        if first_warning_idx is not None:
            print("REVIEW: no breach occurred, but warning was issued")
        else:
            print("PASS: no breach and no warning")
        return

    if first_warning_idx is None:
        print("FAIL: breach occurred but no prior WARNING was issued")
        return

    if first_truth_event_idx is None:
        print("FAIL: inconsistent state, warning found but breach index missing")
        return

    warning_ts = capture_snapshot(system, first_warning_idx)["timestamp"]
    breach_ts = capture_snapshot(system, first_truth_event_idx)["timestamp"]

    t_warning = datetime.fromisoformat(warning_ts)
    t_breach = datetime.fromisoformat(breach_ts)
    lead_time_s = (t_breach - t_warning).total_seconds()

    if lead_time_s > min_lead_time_s:
        print(f"PASS: warning lead time {lead_time_s:.2f}s (above threshold)")
    elif lead_time_s == min_lead_time_s:
        print(f"PASS (EDGE): warning exactly at threshold {lead_time_s:.2f}s")
    elif lead_time_s >= 0:
        print(f"FAIL: warning too late at {lead_time_s:.2f}s")
    else:
        print(f"FAIL: warning occurred after breach by {-lead_time_s:.2f}s")


def summarize_four_d(system):
    print("\n=== 4D SUMMARY ===")
    for i in range(len(system.get_all_points())):
        snapshot = capture_snapshot(system, i)
        fd_t = snapshot["four_d_truth"]
        fd_p = snapshot["four_d_prediction"]

        if fd_t and fd_p:
            print(
                f"{i:02d} | conflict={fd_t['conflict']} | "
                f"pred={fd_p['state']} | "
                f"h={fd_t['horizontal_m']:.1f}m | v={fd_t['vertical_m']:.1f}m"
            )


def summarize_envelope(system):
    print("\n=== ENVELOPE SUMMARY ===")
    for i in range(len(system.get_all_points())):
        snapshot = capture_snapshot(system, i)
        et = snapshot["envelope_truth"]
        ep = snapshot["envelope_prediction"]

        if et and ep:
            print(
                f"{i:02d} | violated={et['violated']} | "
                f"pred={ep['state']} | "
                f"vs={et['vertical_speed_mps']}"
            )


def compute_envelope_lead_time(system):
    points = system.get_all_points()

    first_alert = None
    first_violation = None

    for i in range(len(points)):
        snapshot = capture_snapshot(system, i)
        ep = snapshot["envelope_prediction"]
        et = snapshot["envelope_truth"]

        if ep and first_alert is None and ep["state"] in {"CAUTION", "WARNING"}:
            first_alert = i

        if et and first_violation is None and et["violated"]:
            first_violation = i

    print("\n=== ENVELOPE LEAD TIME ===")

    if first_alert is None or first_violation is None:
        print("No valid lead time")
        return

    print(f"First ALERT index: {first_alert}")
    print(f"VIOLATION index: {first_violation}")
    print(f"Lead steps: {first_violation - first_alert}")


def score_envelope_validation(system):
    print("\n=== ENVELOPE SCORING ===")

    points = system.get_all_points()

    first_alert = None
    first_warning = None
    first_violation = None

    for i in range(len(points)):
        snapshot = capture_snapshot(system, i)
        et = snapshot["envelope_truth"]
        ep = snapshot["envelope_prediction"]

        if ep and first_alert is None and ep["state"] in {"CAUTION", "WARNING"}:
            first_alert = i

        if ep and first_warning is None and ep["state"] == "WARNING":
            first_warning = i

        if et and first_violation is None and et["violated"]:
            first_violation = i

    if first_violation is None:
        if first_alert is not None:
            print("REVIEW: alert issued but no envelope violation occurred")
        else:
            print("PASS: no envelope violation and no alert")
        return

    if first_alert is None:
        print("FAIL: breach without prior alert")
        return

    if first_warning is not None and first_warning < first_violation:
        print(
            f"PASS: warning-before-violation "
            f"(warning index {first_warning}, violation index {first_violation})"
        )
        return

    if first_alert < first_violation:
        print(
            f"PASS: alert-before-violation "
            f"(alert index {first_alert}, violation index {first_violation})"
        )
        return

    print("FAIL: envelope violation occurred without anticipatory alerting")

def compute_four_d_lead_time(system):
    points = system.get_all_points()

    first_warning = None
    first_conflict = None

    for i in range(len(points)):
        snapshot = capture_snapshot(system, i)
        fp = snapshot["four_d_prediction"]
        ft = snapshot["four_d_truth"]

        if fp and first_warning is None and fp["state"] == "WARNING":
            first_warning = i

        if ft and first_conflict is None and ft["conflict"]:
            first_conflict = i

    print("\n=== 4D LEAD TIME ===")

    if first_warning is None or first_conflict is None:
        print("No valid lead time")
        return

    print(f"WARNING index: {first_warning}")
    print(f"CONFLICT index: {first_conflict}")
    print(f"Lead steps: {first_conflict - first_warning}")


def score_four_d_validation(system):
    print("\n=== 4D SCORING ===")

    points = system.get_all_points()

    for i in range(len(points)):
        snapshot = capture_snapshot(system, i)
        ft = snapshot["four_d_truth"]
        fp = snapshot["four_d_prediction"]

        if ft and ft["conflict"]:
            if fp["state"] == "SAFE":
                print("FAIL: conflict occurred with SAFE prediction")
                return

    print("PASS: 4D conflict detected correctly")


def build_system_for_scenario(flight_id: str, scenario_name: str) -> ValidationSystemAdapter:
    base_system = ValidationSystemAdapter(flight_id)
    base_points = base_system.get_all_points()

    if scenario_name == "baseline":
        return ValidationSystemAdapter(flight_id, replay_override=base_points)

    if scenario_name == "vertical_breach":
        scenario_points = make_vertical_breach_variant(base_points)
        return ValidationSystemAdapter(flight_id, replay_override=scenario_points)

    if scenario_name == "borderline_ceiling":
        scenario_points = make_borderline_ceiling_variant(base_points)
        return ValidationSystemAdapter(flight_id, replay_override=scenario_points)

    if scenario_name == "faster_climb_breach":
        scenario_points = make_faster_climb_breach_variant(base_points)
        return ValidationSystemAdapter(flight_id, replay_override=scenario_points)

    if scenario_name == "envelope_conflict":
        scenario_points = make_envelope_conflict_variant(base_points)
        return ValidationSystemAdapter(flight_id, replay_override=scenario_points)

    if scenario_name == "four_d_conflict":
        tracks = make_four_d_conflict_variant(base_points)
        system = ValidationSystemAdapter(flight_id, replay_override=tracks["ownship"])
        system.set_intruder_track(tracks["intruder"])
        return system

    raise ValueError(f"Unknown scenario: {scenario_name}")

def get_vertical_metrics(system):
    points = system.get_all_points()

    first_alert = None
    first_warning = None
    first_truth_event = None

    for i in range(len(points)):
        snapshot = capture_snapshot(system, i)
        pred_state = snapshot["prediction"]["classification"]["state"]
        truth_breach = snapshot["truth"]["breach"]

        if first_alert is None and pred_state in {"CAUTION", "WARNING"}:
            first_alert = i

        if first_warning is None and pred_state == "WARNING":
            first_warning = i

        if first_truth_event is None and truth_breach:
            first_truth_event = i

    lead_steps = None
    lead_seconds = None
    anchor_idx = None

    if first_warning is not None and first_truth_event is not None:
        anchor_idx = first_warning
        lead_steps = first_truth_event - first_warning
    elif first_alert is not None and first_truth_event is not None:
        anchor_idx = first_alert
        lead_steps = first_truth_event - first_alert

    if anchor_idx is not None and first_truth_event is not None:
        start_ts = capture_snapshot(system, anchor_idx)["timestamp"]
        end_ts = capture_snapshot(system, first_truth_event)["timestamp"]
        lead_seconds = (
            datetime.fromisoformat(end_ts) - datetime.fromisoformat(start_ts)
        ).total_seconds()

    if first_truth_event is None:
        if first_warning is not None:
            score = "REVIEW"
        else:
            score = "PASS"
    else:
        if first_warning is None:
            score = "FAIL"
        elif lead_steps is not None and lead_steps >= 1:
            score = "PASS"
        else:
            score = "FAIL"

    classification = classify_timing(lead_steps, lead_seconds, score)

    return {
        "first_alert": first_alert,
        "first_warning": first_warning,
        "first_truth_event": first_truth_event,
        "lead_steps": lead_steps,
        "lead_seconds": lead_seconds,
        "score": score,
        "classification": classification,
    }

def get_envelope_metrics(system):
    points = system.get_all_points()

    first_alert = None
    first_warning = None
    first_truth_event = None

    for i in range(len(points)):
        snapshot = capture_snapshot(system, i)
        ep = snapshot["envelope_prediction"]
        et = snapshot["envelope_truth"]

        if ep and first_alert is None and ep["state"] in {"CAUTION", "WARNING"}:
            first_alert = i

        if ep and first_warning is None and ep["state"] == "WARNING":
            first_warning = i

        if et and first_truth_event is None and et["violated"]:
            first_truth_event = i

    lead_steps = None
    lead_seconds = None
    anchor_idx = None

    if first_warning is not None and first_truth_event is not None:
        anchor_idx = first_warning
        lead_steps = first_truth_event - first_warning
    elif first_alert is not None and first_truth_event is not None:
        anchor_idx = first_alert
        lead_steps = first_truth_event - first_alert

    if anchor_idx is not None and first_truth_event is not None:
        start_ts = capture_snapshot(system, anchor_idx)["timestamp"]
        end_ts = capture_snapshot(system, first_truth_event)["timestamp"]
        lead_seconds = (
            datetime.fromisoformat(end_ts) - datetime.fromisoformat(start_ts)
        ).total_seconds()

    if first_truth_event is None:
        if first_alert is not None:
            score = "REVIEW"
        else:
            score = "PASS"
    else:
        if first_alert is None:
            score = "FAIL"
        elif first_warning is not None and first_warning < first_truth_event:
            score = "PASS"
        elif first_alert < first_truth_event:
            score = "PASS"
        else:
            score = "FAIL"

    classification = classify_timing(lead_steps, lead_seconds, score)

    return {
        "first_alert": first_alert,
        "first_warning": first_warning,
        "first_truth_event": first_truth_event,
        "lead_steps": lead_steps,
        "lead_seconds": lead_seconds,
        "score": score,
        "classification": classification,
    }

def classify_timing(lead_steps, lead_seconds, score):
    if lead_steps is None:
        if score == "PASS":
            return "NO-EVENT"
        if score == "REVIEW":
            return "NO-BREACH"
        if score == "FAIL":
            return "MISS"
        return "UNKNOWN"

    if lead_seconds is None:
        return "UNKNOWN"

    if lead_seconds >= 10:
        return "EARLY"
    elif lead_seconds > 5:
        return "ON-TIME"
    elif lead_seconds == 5:
        return "EDGE"
    elif lead_seconds > 0:
        return "LATE"
    else:
        return "MISS"

def get_four_d_metrics(system):
    points = system.get_all_points()

    first_alert = None
    first_warning = None
    first_truth_event = None

    for i in range(len(points)):
        snapshot = capture_snapshot(system, i)
        fp = snapshot["four_d_prediction"]
        ft = snapshot["four_d_truth"]

        if fp and first_alert is None and fp["state"] in {"CAUTION", "WARNING"}:
            first_alert = i

        if fp and first_warning is None and fp["state"] == "WARNING":
            first_warning = i

        if ft and first_truth_event is None and ft["conflict"]:
            first_truth_event = i

    lead_steps = None
    lead_seconds = None
    anchor_idx = None

    if first_warning is not None and first_truth_event is not None:
        anchor_idx = first_warning
        lead_steps = first_truth_event - first_warning
    elif first_alert is not None and first_truth_event is not None:
        anchor_idx = first_alert
        lead_steps = first_truth_event - first_alert

    if anchor_idx is not None and first_truth_event is not None:
        start_ts = capture_snapshot(system, anchor_idx)["timestamp"]
        end_ts = capture_snapshot(system, first_truth_event)["timestamp"]
        lead_seconds = (
            datetime.fromisoformat(end_ts) - datetime.fromisoformat(start_ts)
        ).total_seconds()

    if first_truth_event is None:
        if first_alert is not None:
            score = "REVIEW"
        else:
            score = "PASS"
    else:
        if first_alert is None:
            score = "FAIL"
        elif lead_steps is not None and lead_steps >= 1:
            score = "PASS"
        else:
            score = "FAIL"

    classification = classify_timing(lead_steps, lead_seconds, score)

    return {
        "first_alert": first_alert,
        "first_warning": first_warning,
        "first_truth_event": first_truth_event,
        "lead_steps": lead_steps,
        "lead_seconds": lead_seconds,
        "score": score,
        "classification": classification,
    }

def run_all_scenarios_report(flight_id: str):
    scenario_names = [
        "baseline",
        "borderline_ceiling",
        "vertical_breach",
        "faster_climb_breach",
        "envelope_conflict",
        "four_d_conflict",
    ]

    results = []

    print("\n=== COMPACT VALIDATION REPORT ===")
    print("scenario               | alert | warn | truth | lead | lead_s | score  | class")
    print("-----------------------+-------+------+-------+------+--------+--------+--------")

    for scenario_name in scenario_names:
        system = build_system_for_scenario(flight_id, scenario_name)

        if scenario_name in {
            "baseline",
            "borderline_ceiling",
            "vertical_breach",
            "faster_climb_breach",
        }:
            metrics = get_vertical_metrics(system)
        elif scenario_name == "envelope_conflict":
            metrics = get_envelope_metrics(system)
        elif scenario_name == "four_d_conflict":
            metrics = get_four_d_metrics(system)
        else:
            metrics = {
                "first_alert": None,
                "first_warning": None,
                "first_truth_event": None,
                "lead_steps": None,
                "lead_seconds": None,
                "score": "UNKNOWN",
                "classification": "UNKNOWN",
            }

        row = {
            "scenario": scenario_name,
            "first_alert": metrics["first_alert"],
            "first_warning": metrics["first_warning"],
            "first_truth_event": metrics["first_truth_event"],
            "lead_steps": metrics["lead_steps"],
            "lead_seconds": metrics["lead_seconds"],
            "score": metrics["score"],
            "classification": metrics["classification"],
        }

        results.append(row)

        def fmt(v): return "-" if v is None else str(v)
        def fmt_s(v): return "-" if v is None else f"{v:.1f}"

        print(
            f"{scenario_name:<23} | "
            f"{fmt(row['first_alert']):>5} | "
            f"{fmt(row['first_warning']):>4} | "
            f"{fmt(row['first_truth_event']):>5} | "
            f"{fmt(row['lead_steps']):>4} | "
            f"{fmt_s(row['lead_seconds']):>6} | "
            f"{row['score']:<6} | "
            f"{row['classification']}"
        )

    return results

def export_report_json(results):
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"validation_report_{ts}.json"

    path = Path(filename)
    with path.open("w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\nSaved JSON report to {path.resolve()}")

def export_report_csv(results):
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"validation_report_{ts}.csv"

    path = Path(filename)

    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=results[0].keys())
        writer.writeheader()
        writer.writerows(results)

    print(f"Saved CSV report to {path.resolve()}")


def run() -> None:
    flight_id = "3422422e-f6b4-4059-8de4-93145daecddc"

    results = run_all_scenarios_report(flight_id)

    export_report_json(results)
    export_report_csv(results)

   


if __name__ == "__main__":
    run()