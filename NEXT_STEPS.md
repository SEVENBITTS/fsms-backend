# NEXT STEPS

## Audit Read Surface Pause

Stopping the transition-artifact chronology audit-read expansion here for now.

Current coverage is sufficient for deferred consumer discovery:
- single-run summary
- diff
- chronology
- transition drilldown
- artifact query
- filtering
- pagination
- cursor
- bookmark
- export

Further refinements will be driven only by a concrete consumer requirement such as:
- operator UI workflow
- reviewer or audit workflow
- downstream service integration
- compliance or export requirement

No further read-path refinements should be opened until a real consumer and payload requirement is identified.

## Current Backend Priority

Focus should move to authoritative source ingestion robustness.

Recommended areas:
- source freshness and staleness policy
- partial-refresh failure handling
- provenance for failed or partial normalization runs
- validation and reporting for malformed authoritative records

## Reopen Criteria

Reopen the audit-read chain only when all of the following are true:
1. a named consumer exists
2. the exact payload gap is identified
3. the current API cannot satisfy it by composition
4. the new read path is narrower than another generic variant
