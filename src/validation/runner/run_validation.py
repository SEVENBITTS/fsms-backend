from pprint import pprint

from src.validation.runner.system_adapter import ValidationSystemAdapter
from src.validation.runner.capture_snapshot import capture_snapshot
from src.validation.scenarios.vertical_breach_scenario import make_vertical_breach_variant
from datetime import datetime
from src.validation.scenarios.borderline_ceiling_scenario import make_borderline_ceiling_variant
from src.validation.scenarios.faster_climb_breach_scenario import make_faster_climb_breach_variant

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
    first_breach_idx = None

    for i in range(len(points)):
        snapshot = capture_snapshot(system, i)

        pred_state = snapshot["prediction"]["classification"]["state"]
        truth_breach = snapshot["truth"]["breach"]

        if first_warning_idx is None and pred_state == "WARNING":
            first_warning_idx = i

        if first_breach_idx is None and truth_breach:
            first_breach_idx = i

    print("\n=== LEAD TIME ANALYSIS ===")

    if first_warning_idx is None:
        print("No WARNING detected")
        return

    if first_breach_idx is None:
        print("No BREACH detected")
        return

    warning_ts = capture_snapshot(system, first_warning_idx)["timestamp"]
    breach_ts = capture_snapshot(system, first_breach_idx)["timestamp"]

    t_warning = datetime.fromisoformat(warning_ts)
    t_breach = datetime.fromisoformat(breach_ts)

    lead_time_s = (t_breach - t_warning).total_seconds()

    print(f"First WARNING at index {first_warning_idx}: {warning_ts}")
    print(f"First BREACH at index {first_breach_idx}: {breach_ts}")
    print(f"Lead time: {lead_time_s:.2f} seconds")

def score_validation(system, min_lead_time_s=5.0):
    points = system.get_all_points()

    first_warning_idx = None
    first_breach_idx = None
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

        if first_breach_idx is None and truth_breach:
            first_breach_idx = i

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

    if first_breach_idx is None:
        print("FAIL: inconsistent state, warning found but breach index missing")
        return

    warning_ts = capture_snapshot(system, first_warning_idx)["timestamp"]
    breach_ts = capture_snapshot(system, first_breach_idx)["timestamp"]

    from datetime import datetime
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

def run() -> None:
    flight_id = "3422422e-f6b4-4059-8de4-93145daecddc"

    base_system = ValidationSystemAdapter(flight_id)
    base_points = base_system.get_all_points()

    scenario_name = "faster_climb_breach"
    scenario_points = make_faster_climb_breach_variant(base_points)

    # scenario_name = "borderline_ceiling"
    # scenario_points = make_borderline_ceiling_variant(base_points)

    # scenario_name = "vertical_breach"
    # scenario_points = make_vertical_breach_variant(base_points)

    system = ValidationSystemAdapter(flight_id, replay_override=scenario_points)

    print(f"Scenario: {scenario_name}")
    print("Replay point count:", len(system.get_all_points()))

    for i in range(len(system.get_all_points())):
        snapshot = capture_snapshot(system, i)
        print(f"\n=== SNAPSHOT {i} ===")
        pprint(snapshot)

    summarize_snapshots(system)
    summarize_validation(system)
    compute_lead_time(system)
    score_validation(system)
            

if __name__ == "__main__":
    run()