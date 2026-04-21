# Live Operations External Overlay Model

## Summary

This document defines the external overlay model for live operations and replay review.

The goal is to support weather, crewed traffic, and drone traffic as time-aligned overlays without coupling the UI or backend to a single vendor feed or forcing mission telemetry to carry external-context concerns.

This is an architecture/design document only. It does not implement ingestion, storage, replay synthesis, conflict detection, or advisory generation.

## Problem

The live operations surface already supports:

- mission replay
- telemetry-linked status
- alert overlays
- replay timeline review
- mission event correlation

The next likely operational requirements are:

- weather display
- crewed traffic display
- drone traffic display
- future conflict assessment
- future advisory guidance

If those are added ad hoc, the system will degrade in three ways:

1. vendor-specific feed payloads will leak into core UI and service code
2. replay data will be overloaded with non-mission state
3. future hazard/advisory logic will be mixed with raw observations

## Design Goals

The overlay model must:

1. support both live and replay review
2. stay vendor-neutral
3. distinguish raw observations from derived hazards and advisories
4. align cleanly to the mission replay time cursor
5. support both point and geometry-based overlays
6. allow weather, crewed traffic, and drone traffic to share a common envelope
7. make future conflict detection and advisory generation possible without redesign

## Non-Goals

This design does not:

- select a commercial weather provider
- select a commercial crewed-traffic provider
- define a drone Remote ID or UTM integration
- implement collision/conflict detection
- implement avoidance or advisory commands
- define persistent storage strategy in final detail

## Core Separation of Concerns

The system must keep four layers distinct.

### 1. Raw External Overlay Input

Observed or received data from an external source.

Examples:

- wind observation
- precipitation cell
- nearby helicopter position
- nearby drone track point

### 2. Interpreted Hazard or Conflict State

Internal reasoning derived from one or more raw inputs.

Examples:

- weather risk severity increased due to wind gust threshold
- crewed aircraft conflict candidate within mission corridor
- drone proximity conflict candidate

### 3. Advisory Guidance

System guidance derived from hazard/conflict state.

Examples:

- hold launch
- review route segment
- avoid sector north-east of current position

### 4. Command or Operator Action

Actual user or system action taken in response.

Examples:

- mission aborted
- launch held
- reroute accepted

Raw overlays must not directly become commands. Hazard and advisory layers are separate design concerns.

## Recommended Model Boundary

The external overlay model should represent raw observations and optionally reference derived hazard state, but it should not itself encode operator command behavior.

Recommended relationship:

- `ExternalOverlay` is the vendor-neutral envelope
- `HazardAssessment` is a separate derived model
- `OperationalAdvisory` is a separate derived model
- mission actions remain in the existing mission lifecycle/decision flows

## Core External Overlay Envelope

Each overlay record should be representable in a common shape.

```ts
type ExternalOverlayKind = "weather" | "crewed_traffic" | "drone_traffic";

type ExternalOverlaySeverity = "info" | "caution" | "critical";

type ExternalOverlayGeometry =
  | { type: "point"; lat: number; lng: number; altitudeMslFt?: number | null }
  | { type: "polyline"; points: Array<{ lat: number; lng: number; altitudeMslFt?: number | null }> }
  | { type: "polygon"; points: Array<{ lat: number; lng: number }> }
  | { type: "circle"; center: { lat: number; lng: number }; radiusMeters: number };

interface ExternalOverlay {
  id: string;
  missionId?: string | null;
  kind: ExternalOverlayKind;
  source: {
    provider: string;
    sourceType: string;
    sourceRecordId?: string | null;
  };
  observedAt: string;
  validFrom?: string | null;
  validTo?: string | null;
  geometry: ExternalOverlayGeometry;
  headingDegrees?: number | null;
  speedKnots?: number | null;
  altitudeMslFt?: number | null;
  severity?: ExternalOverlaySeverity | null;
  confidence?: number | null;
  freshnessSeconds?: number | null;
  metadata: Record<string, unknown>;
  linkedHazardIds?: string[];
}
```

## Overlay Specializations

The common envelope supports shared rendering and time alignment. Each overlay kind also needs a specialization contract.

### Weather Overlay

Weather overlays should support both point observations and area-based geometry.

Minimum weather metadata fields:

- `windSpeedKnots`
- `windDirectionDegrees`
- `temperatureC`
- `precipitationRateMmHr` or categorical precipitation indicator

Recommended future fields:

- `gustSpeedKnots`
- `visibilityMeters`
- `cloudBaseFt`
- `pressureHpa`

Weather overlays may be:

- station-like point observations
- gridded sample points
- polygon/cell regions
- corridor-level forecast slices

### Crewed Traffic Overlay

Crewed traffic overlays represent external aircraft positions and movement state.

Minimum crewed traffic metadata fields:

- `trafficId`
- `callsign`
- `trackSource`
- `aircraftCategory` where available

Recommended motion fields:

- `headingDegrees`
- `speedKnots`
- `verticalRateFpm`
- `altitudeMslFt`

This model must not assume a single vendor such as FlightRadar24. `provider` and `sourceType` must absorb that variability.

### Drone Traffic Overlay

Drone traffic overlays represent external unmanned aircraft positions and movement state.

Minimum drone traffic metadata fields:

- `trafficId`
- `trackSource`
- `vehicleType` where available
- `operatorReference` where available

Recommended motion fields:

- `headingDegrees`
- `speedKnots`
- `altitudeMslFt`
- `verticalRateFpm`

This model should support future Remote ID, UTM, or internal fleet sources without forcing a redesign.

## Time Alignment

The model must align to both live and replay review.

### Required Time Fields

- `observedAt` is mandatory
- `validFrom` and `validTo` are optional but recommended for forecast or window-based overlays

### Replay Alignment Rules

During replay, an overlay is considered relevant when:

- `observedAt <= replayCursorTime`, for point-in-time observations where persistence rules apply
- or `validFrom <= replayCursorTime <= validTo`, for explicitly windowed overlays

### Live Review Rules

During live review, freshness matters. Consumers should consider:

- age from `observedAt`
- `freshnessSeconds`
- `validTo`, if present

The UI should be able to display stale vs current overlays without changing the core data shape.

## Geometry Expectations

The model must support:

- point markers
- track/polylines
- polygons
- area circles

This is required because:

- weather may be regional
- crewed traffic is often point/motion based
- drone traffic may be point or track based
- future conflict or advisory layers may derive corridor or area cues from raw overlays

## Recommended API Boundary

Three options were considered.

### Option A: Extend Existing Mission Live-Ops Read Models

Embed overlays inside existing mission live-ops responses.

Pros:

- simplest short-term wiring

Cons:

- grows live-ops aggregate into a catch-all payload
- harder to evolve independent overlay refresh behavior

### Option B: Dedicated Mission Overlay Endpoint

Expose mission-linked external overlays through a dedicated read endpoint.

Example:

`GET /missions/:missionId/external-overlays`

Pros:

- clear contract boundary
- easy to refresh independently from replay or workspace state
- clean separation between mission aggregate and external context

Cons:

- one more read surface to manage

### Option C: Supporting Aggregation Layer Behind Live-Ops View

Create a supporting internal aggregation layer and keep the public API decision deferred.

Pros:

- flexible internal evolution

Cons:

- less explicit contract unless paired with a public schema

### Recommendation

Recommend Option B:

- create a dedicated mission-linked external overlay read endpoint
- allow the operator live-ops page to consume it alongside replay, alerts, and mission aggregates

This keeps the boundary explicit and avoids polluting replay or mission workspace contracts with third-party overlay shape concerns.

## Relationship to Existing Models

The external overlay model should align with, but remain separate from:

- mission replay points
- mission telemetry
- mission alerts
- planning workspace
- dispatch workspace
- operations timeline

Suggested relationship:

- replay/telemetry provide mission-owned motion state
- external overlays provide non-mission context
- mission alerts remain a mission-level signal surface
- future hazard assessments may combine telemetry plus external overlays

## Future Hazard and Advisory Integration

The model should support future derived linkage without embedding the derived logic in the raw overlay itself.

Recommended future pattern:

- `ExternalOverlay`
- `HazardAssessment`
  - references one or more overlay ids
  - references relevant mission telemetry points or time windows
- `OperationalAdvisory`
  - references hazard assessment ids

This allows auditability:

- what was observed
- what the system inferred
- what the system advised
- what the operator did

## Phase Order

Recommended implementation sequence:

1. Weather overlay ingestion and display
2. Crewed traffic overlay ingestion and display
3. Drone traffic overlay ingestion and display
4. Conflict detection derived from mission telemetry plus traffic/weather overlays
5. Advisory generation derived from conflict/hazard assessments

This order keeps raw input handling separate from derived reasoning and avoids prematurely mixing detection and action logic.

## Decision Summary

Adopt a vendor-neutral, time-aware external overlay envelope for live operations with these rules:

- represent weather, crewed traffic, and drone traffic in one shared overlay contract
- keep raw overlay input separate from hazard, advisory, and action models
- align overlays to replay and live time through `observedAt` and optional validity windows
- support geometry beyond simple points
- prefer a dedicated mission-linked external overlay endpoint
- implement raw overlay display before any conflict detection or advisory logic

## Immediate Follow-On

The first implementation issue after this design should be:

`Add weather external overlay ingestion and live operations display using the mission-linked external overlay model.`
