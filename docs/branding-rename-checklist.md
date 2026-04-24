# Branding Rename Checklist

This checklist prepares the future rename from `FSMS` to `VerityAtlas` and the company/legal name to `VerityAir Systems Ltd` without breaking the current repo, routes, databases, or CI.

Current decision:
- Product/platform name: `VerityAtlas`
- Company/legal name: `VerityAir Systems Ltd`
- Keep technical repo identity as-is for now: `fsms-backend`

Current findings:
- No product-code hits for `VerityAtlas`
- No product-code hits for `VerityAir Systems Ltd`
- Current repo is still primarily `FSMS` branded

## Rename Now Safely

These are display-only or documentation-only surfaces that can be renamed first with low technical risk.

- [README.md](C:\Users\rabbi\Documents\Codex\fsms-backend\README.md)
  - Line 1: `# FSMS Backend`
  - Line 3: `Flight Safety Monitoring System (FSMS)...`
  - Line 277: `The current FSMS product direction...`
  - Line 285: `Internal project - FSMS prototype.`
- [README2.md](C:\Users\rabbi\Documents\Codex\fsms-backend\README2.md)
  - Line 1: `# FSMS Validation Demo`
- [docs/api.md](C:\Users\rabbi\Documents\Codex\fsms-backend\docs\api.md)
  - Line 1: `# FSMS Backend API`
  - Note: keep route examples unchanged for now if they reflect real endpoints
- [docs/architecture.md](C:\Users\rabbi\Documents\Codex\fsms-backend\docs\architecture.md)
  - Line 1: `# FSMS Backend Architecture`
  - Line 14: `The FSMS backend provides...`
- [docs/FSMS_DIRECTION.md](C:\Users\rabbi\Documents\Codex\fsms-backend\docs\FSMS_DIRECTION.md)
  - File title and body are heavily FSMS-branded
  - Candidate rename later: `docs/VERITYATLAS_DIRECTION.md`
- [docs/roadmap.md](C:\Users\rabbi\Documents\Codex\fsms-backend\docs\roadmap.md)
  - Line 1: `# FSMS Development Roadmap`
  - Line 101+: summary section uses FSMS naming
- [docs/system_diagram.md](C:\Users\rabbi\Documents\Codex\fsms-backend\docs\system_diagram.md)
  - Line 1: `# FSMS System Architecture Diagram`
- [static/operator-live-operations-map.html](C:\Users\rabbi\Documents\Codex\fsms-backend\static\operator-live-operations-map.html)
  - Line 6: browser title `FSMS Operator Live Operations`
- [static/operator-mission-workspace.html](C:\Users\rabbi\Documents\Codex\fsms-backend\static\operator-mission-workspace.html)
  - Line 6: browser title `FSMS Operator Mission Workspace`
- [src/app.ts](C:\Users\rabbi\Documents\Codex\fsms-backend\src\app.ts)
  - Line 264: health response text `FSMS backend is running`

Recommended first-pass replacements:
- `FSMS` -> `VerityAtlas` in headings, browser titles, health text, and narrative docs
- `Flight Safety Monitoring System (FSMS)` -> `VerityAtlas aviation operations platform` or similar approved copy
- Add one transitional phrasing in docs if needed: `VerityAtlas (working name replacing FSMS)`

## Rename Later For Compatibility

These names are technical identifiers and should stay unchanged until there is a deliberate compatibility pass.

- Repo folder and GitHub repo name
  - `C:\Users\rabbi\Documents\Codex\fsms-backend`
- File names with `fsms` in them
  - [fsms-save-point.json](C:\Users\rabbi\Documents\Codex\fsms-backend\fsms-save-point.json)
  - [fsms-save-point.schema.json](C:\Users\rabbi\Documents\Codex\fsms-backend\fsms-save-point.schema.json)
  - [docs/FSMS_DIRECTION.md](C:\Users\rabbi\Documents\Codex\fsms-backend\docs\FSMS_DIRECTION.md)
- API/service identifiers
  - [docs/api.md](C:\Users\rabbi\Documents\Codex\fsms-backend\docs\api.md:22) service name `fsms`
  - [docs/api.md](C:\Users\rabbi\Documents\Codex\fsms-backend\docs\api.md:33) route `/api/fsms/replay/<flight_id>`
- CI and workflow identifiers
  - [.github/workflows/fsms-savepoint.yml](C:\Users\rabbi\Documents\Codex\fsms-backend\.github\workflows\fsms-savepoint.yml)
  - [.github/workflows/integration-tests.yml](C:\Users\rabbi\Documents\Codex\fsms-backend\.github\workflows\integration-tests.yml)
    - `fsms_test`
    - `<!-- fsms-nextbuildstep-comment -->`
- Database and environment naming
  - CI uses `fsms_test`
  - Local migration/testing also uses `timeline_dev_db` and `timeline_test_db`
  - Do not rename DB names casually without checking migrations, scripts, and existing dumps

When to do this phase:
- after brand is secured
- after deciding whether the public API should change
- after planning redirects/aliases for CI, docs, saved URLs, and automation

## Manual Review Required

These items likely contain branding, but they are not safe to bulk rename automatically because they are binary, generated, or historical.

- Root `.docx` files with FSMS in the filename
  - [FSMS @stage and bidding.docx](C:\Users\rabbi\Documents\Codex\fsms-backend\FSMS%20@stage%20and%20bidding.docx)
  - [FSMS Backend Build Board.docx](C:\Users\rabbi\Documents\Codex\fsms-backend\FSMS%20Backend%20Build%20Board.docx)
  - [Fsms System Architecture Blueprint.docx](C:\Users\rabbi\Documents\Codex\fsms-backend\Fsms%20System%20Architecture%20Blueprint.docx)
  - [Investor pitch for UAV Operations FSMS.docx](C:\Users\rabbi\Documents\Codex\fsms-backend\Investor%20pitch%20for%20UAV%20Operations%20FSMS.docx)
- Experimental static HTML copies
  - [replay fixed, strengthend working - Copy.html](C:\Users\rabbi\Documents\Codex\fsms-backend\static\replay%20fixed,%20strengthend%20working%20-%20Copy.html)
  - [replay scenario card with all fields filled - Copy.html](C:\Users\rabbi\Documents\Codex\fsms-backend\static\replay%20scenario%20card%20with%20all%20fields%20filled%20-%20Copy.html)
  - [replay working with scenario cards and sidebar functionality - Copy.html](C:\Users\rabbi\Documents\Codex\fsms-backend\static\replay%20working%20with%20scenario%20cards%20and%20sidebar%20functionality%20-%20Copy.html)
- Generated or historical outputs
  - validation reports
  - save-point artifacts
  - archived migration notes

Recommendation:
- decide whether these are still active deliverables
- if yes, rebrand them manually
- if not, archive them as historical FSMS material

## Company Name Placement

`VerityAir Systems Ltd` does not currently appear in the product code. Add it only where legal/company identity belongs.

Safe future placements:
- About/help page
- footer or product metadata
- proposal/pitch documents
- legal templates
- privacy/terms pages

Avoid placing the legal company name inside:
- API route names
- package/script names
- database names
- migration filenames
- test fixture identifiers

## Suggested Rollout Order

1. Introduce central display constants for brand strings.
2. Rebrand user-facing UI titles and health text.
3. Rebrand README and product docs.
4. Decide whether to rename `docs/FSMS_DIRECTION.md` or keep it as a historical filename.
5. Review binary `.docx` and static copy files manually.
6. Only then consider repo, API, CI, and DB renames.

## Concrete Checklist

- [ ] Add central display constants for `VerityAtlas` and `VerityAir Systems Ltd`
- [ ] Update browser titles in operator HTML pages
- [ ] Update health/status display text in `src/app.ts`
- [ ] Update top-level README branding
- [ ] Update architecture, roadmap, and direction docs
- [ ] Decide whether `/api/fsms/*` remains unchanged for compatibility
- [ ] Decide whether `docs/FSMS_DIRECTION.md` stays as a legacy filename
- [ ] Review `.docx` files for product/legal naming
- [ ] Review workflow, CI, and DB identifiers separately before any rename
- [ ] Prepare a later technical rename plan if the repo/API name should change too
