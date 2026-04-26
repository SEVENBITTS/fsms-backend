# VerityAir Systems Ltd Investor Deck

## Naming

- Company: VerityAir Systems Ltd
- Platform: VerityATLAS

## Document Purpose

This deck is the investor-facing narrative for VerityAir Systems Ltd and its platform, VerityATLAS.

It should be updated against the real product build, not aspiration alone.

Use this rule throughout:

- only claim what exists in the FSMS build, supporting docs, or named roadmap
- separate "live now", "in active build", and "future expansion"
- frame VerityATLAS as an assurance-led operating layer for regulated UAS missions

## Deck Structure

### 1. Title

VerityAir Systems Ltd

Platform:

VerityATLAS

Mission assurance software for regulated drone operations

Short line:

VerityATLAS helps operators plan, assess, execute, monitor, and evidence regulated drone missions through one assurance-led workflow.

### 2. Problem

Slide title:

Problem

On-slide text:

As operations scale, complexity rises:

- complex airspace
- repeatable enterprise missions
- BVLOS and beyond
- regulator, customer, and insurer scrutiny

Current operator pain:

- planning, readiness, live ops, and evidence are fragmented
- key decisions sit across spreadsheets, point tools, and judgement
- proving what was checked, approved, and why is difficult
- external context is not tied to one assurance record

Close:

Operators can fly the mission. They still struggle to prove the mission was safe, authorised, and accountable.

Speaker notes:

The operational gap is no longer only flight planning. As missions become more serious and more repeatable, the real problem becomes assurance continuity.

Teams may have flight tools, checklists, approvals, and records, but they often do not have one connected operational record showing what was checked, who approved it, and why the mission proceeded.

### 3. Why Now

- enterprise drone use is expanding beyond simple VLOS jobs
- BVLOS growth increases the need for structured safety and evidence workflows
- regulators and customers increasingly expect traceable operational assurance
- dual-use demand is increasing for systems that combine operational discipline with software-led repeatability

### 4. Solution

Slide title:

Solution

On-slide text:

VerityATLAS is an assurance-led FSMS platform for regulated UAS missions.

It connects one mission record across:

- mission planning
- risk and airspace
- platform readiness
- pilot readiness
- approval and dispatch
- live ops and replay
- audit evidence and sign-off

Close:

One assurance chain from mission intent to auditable evidence.

Speaker notes:

The product is not only a planner and not only a compliance tool. It is designed to connect the operational assurance chain so the mission record survives from planning through execution and into post-operation evidence.

### 5. Product Today

Current product shape, grounded in the build:

- mission planning draft and approval-handoff workflow
- mission lifecycle controls and event history
- mission risk scoring and risk-band outputs
- airspace compliance status assessment
- platform readiness checks linked to maintenance state
- pilot readiness checks linked to evidence currency
- telemetry ingestion and replay
- alerts and mission events
- external overlays for weather, crewed traffic, drone traffic, and area conflict geometry
- traffic conflict assessment using mission telemetry against overlays
- audit evidence snapshots and post-operation evidence flows
- SMS framework and control-to-element mappings
- OA and insurance document lifecycle handling with uploaded source evidence
- organisation document portal with stored file ingestion, preview, and download
- authenticated membership-based access control on document, OA, insurance, governance, and risk-map routes
- combined mission governance assessment across OA, insurance, and pilot readiness
- risk-map early-warning surface for governance, insurance, competency, maintenance, and override pressure
- first OA personnel model for pilot authorisation, including `pending amendment` state

### 6. Why It Wins

Slide title:

Why VerityATLAS Wins

On-slide text:

Not just a planner. Not just a checklist.

VerityATLAS wins through continuity:

- intent to approval
- approval to dispatch
- live ops to replay
- replay to evidence

Why that matters:

- one assurance chain, not point tools
- accountable by design
- built for regulated operators
- expandable into BVLOS and authority-adjacent workflows

Suggested investor line:

The moat is not a single feature. It is the operational assurance chain.

Speaker notes:

Many competitors solve slices of the workflow. VerityATLAS is strongest when the buyer needs continuity, accountability, and evidence across the mission lifecycle.

That is the wedge. The moat is not one feature. The moat is the operational assurance chain.

### 7. Market Entry Wedge

Slide title:

Market Entry Wedge

On-slide text:

Primary wedge:

Audit-ready mission assurance for commercial operators working inside an Operational Authorisation and insurance-controlled envelope

Why this wedge:

- immediate operational pain
- clear buyer story
- expandable into readiness, live ops, and evidence

Secondary wedge options if needed:

- approval and dispatch evidence
- readiness gating across pilot, platform, airspace, and risk
- live ops context with replay-linked evidence

Close:

Start where regulated operators already feel the pain. Expand from there.

Speaker notes:

The wedge should stay narrow enough to be credible and strong enough to expand. Mission assurance inside the OA and insurance-controlled operating envelope is the best starting point because it is specific, painful, and easy to explain.

### 8. Customer Segments

Slide title:

Customer Segments

On-slide text:

Near-term:

- enterprise drone operators
- inspection and infrastructure operators
- emergency service drone teams
- regulated commercial operators with OA, insurance, and audit burden

Later:

- BVLOS programme operators
- UTM or airspace integration partners
- defence and security users where dual-use assurance is relevant

Close:

Start with serious operators. Expand into higher-complexity environments later.

Speaker notes:

The product should start with buyers who already feel the cost of readiness, evidence, and regulatory burden. That keeps the commercial story disciplined and aligned to where VerityATLAS is strongest today.

### 9. Market Size

Use market numbers carefully and distinguish revenue markets from economic impact.

Suggested framing:

- the commercial drone market is large and growing
- the commercial drone software market is the best broad TAM reference
- VerityATLAS's beachhead is the mission-assurance layer inside that broader software market

Working numbers:

- global commercial drone software market estimated at USD 4.89 billion in 2024 and USD 12.72 billion by 2030
- UK government states commercial drones could be worth GBP 45 billion to the UK economy by 2030
- UK CAA roadmap targets routine BVLOS operations in the UK by 2027

Presenter note:

- use `docs/investor/MARKET_SURVEY.md` for detailed competitor and market references
- do not present the GBP 45 billion economic impact figure as VerityATLAS's software TAM

### 10. Business Model

Working commercial model:

- SaaS platform subscription
- pricing by operator, fleet, mission volume, or assurance tier
- onboarding and configuration for regulatory profile and operating workflow
- future premium modules for advanced live ops, audit exports, or multi-authority profiles

### 11. Deployment Model

Primary delivery model:

- multi-tenant cloud SaaS

Why it fits:

- fastest commercial onboarding
- scalable recurring revenue model
- supports multiple companies and concurrent operations from one platform
- current build now includes the first real tenant-isolation and membership-enforcement slice across files, OA, insurance, mission governance, and risk map

Expansion options:

- single-tenant hosted for higher-assurance enterprise customers
- private or defence deployment for sensitive environments later

Investor line:

VerityATLAS is being built cloud-first for commercial scale, with higher-isolation delivery options for enterprise and defence customers as the market expands.

Exact on-slide text:

Slide title:

Deployment Model

Slide subtitle:

Cloud-first for commercial scale. Higher-isolation delivery where the customer or mission demands it.

Left column:

Multi-Tenant Cloud SaaS

- default commercial model
- multiple companies and missions on one platform
- fastest onboarding
- strongest recurring revenue fit

Middle column:

Single-Tenant Hosted

- premium enterprise option
- dedicated customer environment
- stronger isolation and procurement fit
- same core product, higher assurance posture

Right column:

Private / Defence Deployment

- later-stage sensitive deployment option
- private cloud or customer-controlled environment
- supports government and defence use cases
- used where shared SaaS is not acceptable

Footer line:

One platform strategy. Three delivery models aligned to customer assurance needs.

Speaker notes:

VerityATLAS is being built cloud-first because that is the best route to commercial scale. The default model is multi-tenant SaaS, which lets us serve multiple operators, fleets, and concurrent operations efficiently from one platform.

For larger or higher-assurance customers, we can support a single-tenant hosted model. That gives stronger isolation without changing the core product story.

For defence, government, or sensitive environments, the longer-term path is private or customer-controlled deployment. The important point for investors is that we do not need to become a bespoke deployment business on day one. We can scale commercially first, while retaining a credible path into higher-assurance markets later.

### 12. Validation Plan

Slide title:

Validation Plan

On-slide text:

Proof path:

- operator design partners
- pilot deployments
- measured operational outcomes
- documented reduction in planning and evidence burden

Metrics to gather:

- time saved in mission preparation
- time saved in approval and dispatch review
- fewer missing evidence items at go or no-go
- fewer fragmented workflow steps
- stronger confidence in auditability

Close:

Turn product depth into measurable operator proof.

Speaker notes:

The point of this slide is to make the next stage feel concrete. Investors should see that the product does not need a leap of faith. It needs design partners, live use, and measured outcomes that prove the operational value.

### 13. Go-To-Market

Slide title:

Go-To-Market

On-slide text:

- founder-led sales into regulated operators
- start with high-consequence users, not hobby markets
- use design partners to sharpen wedge and proof
- expand from readiness and evidence into broader mission assurance

Close:

Win credibility first. Scale from proof, not pitch alone.

Speaker notes:

This should be a disciplined go-to-market motion. Start with serious operators who need the product now, use them to generate measurable proof, then expand across adjacent workflows and higher-complexity mission environments.

### 14. Market Map

Direct competitors:

- Aloft
- FlyFreely
- DroneDeploy
- Airspace Link
- AirData

Adjacent competitors:

- Unifly
- SkyGrid
- OneSky
- Droniq

Historical UK benchmark:

- Altitude Angel, important UK benchmark, not a current live competitor

Why VerityATLAS wins:

- one assurance chain, not point tools
- stronger readiness and accountability logic
- built for regulated operators who need evidence
- expandable into BVLOS and authority-adjacent workflows

Positioning line:

Most competitors manage parts of drone operations. VerityATLAS is designed to become the mission-assurance system of record.

Presenter note:

- use `docs/investor/MARKET_MAP_SLIDE.md` for the one-slide version
- use `docs/investor/MARKET_SURVEY.md` for deeper competitor references

### 15. Competition Section Flow

Recommended sequence for the competition section:

1. Market Map
2. Competitor Reviews
3. Competitor Scale Signals

Why this order:

- `Market Map` explains who is in the field and how the category is structured
- `Competitor Reviews` shows what buyers seem to value in the visible public review evidence
- `Competitor Scale Signals` shows who looks large, while making clear that size does not equal ownership of the assurance-led category

Presenter note:

- keep these three slides together with no unrelated slide between them
- use them to move from `who competes`, to `what buyers value`, to `why the opening still exists`

### 16. Competition Framing

Position against categories, not brand names alone when speaking:

- enterprise drone operations management
- compliance and workflow platforms
- flight-data and fleet intelligence tools
- UTM, U-Space, and BVLOS-enablement platforms
- internal spreadsheet and document processes

Key message:

Most alternatives solve slices of the workflow. VerityATLAS ties the mission assurance record together.

### 17. Competitor Reviews

Slide title:

Competitor Reviews: What Buyers Seem To Value, And Where VerityATLAS Can Win

On-slide text:

What Buyers Value

- easy workflow
- responsive support
- clear operational visibility
- practical field usefulness

Public Review Signals

- DroneDeploy: deepest review base, strong usability signal
- FlyFreely: credible workflow and compliance signal
- Aloft: important platform, mixed app sentiment
- AirData and Airspace Link: useful, but thin review evidence

Where VerityATLAS Can Win

- assurance chain, not point features
- OA, insurance, and personnel-aware logic
- planning-to-audit evidence continuity
- accountable-manager risk visibility

Close

Buyers reward usability and trust, but the market still lacks a dominant assurance-led system of record.

Speaker notes:

This is not a slide about star ratings alone. It is about what the visible review evidence suggests buyers care about in this category.

Where review depth exists, especially with DroneDeploy, the same themes keep appearing: ease of use, workflow clarity, and customer support matter a lot. Buyers do not only want power. They want operational confidence without friction.

That matters for VerityATLAS. An assurance-led platform cannot become heavy or bureaucratic in the user experience.

The second takeaway is that public review coverage is actually thin across much of the relevant competitor set. That means the market still looks fragmented. There is not a universally obvious winner for the full mission-assurance category.

That helps VerityATLAS. The strongest opening is not trying to be another generic drone operations app. The strongest opening is becoming the most trusted assurance-led operating and evidence layer for serious regulated operators.

Presenter note:

- use `docs/investor/COMPETITOR_REVIEW_NOTE.md` for the fuller source-backed summary
- use `docs/investor/COMPETITOR_REVIEW_SLIDE.md` for the standalone one-slide version

### 18. Competitor Scale Signals

Slide title:

Competitor Scale Signals: Who Looks Large, And Why The Category Is Still Open

On-slide text:

Visible Public Scale

- Aloft: `100,000+ customers`
- Airspace Link: `89,145 monthly active users`, `6,343 agencies`
- AirData: `452,897 active pilots`, `61.7M+ flights`
- DroneDeploy: `3M+ sites`
- Unifly: `10+ countries`, `5M+ flights`, `8 live deployments`
- OneSky: `50,000 users`, `700 organizations`

What This Really Means

- real scale exists
- metrics are mixed and not directly comparable
- scale does not equal category ownership

Why The Category Is Still Open

- no clear assurance-led system of record
- most leaders still own slices, not the full chain
- VerityATLAS can win the regulated assurance niche first

Close

The market has scaled players, but no clearly dominant assurance-led platform for serious regulated operators.

Speaker notes:

This slide is meant to show maturity in the market, not to pretend there are no scaled competitors.

There are real scale signals here. Aloft has one of the clearest customer-count claims. Airspace Link shows meaningful agency and active-user adoption. AirData has major pilot and flight volume. DroneDeploy has very large site footprint. Unifly and OneSky show strong infrastructure and aerospace-grade deployment signals.

But the important investor point is that these numbers are not directly comparable. One company reports customers, another agencies, another pilots, another sites, another deployments.

That means public scale alone does not answer the category question.

The category VerityATLAS is targeting is narrower and more specific: assurance-led, regulated mission operations with evidence continuity and accountable oversight.

So the market is not empty, but it is still open.

Presenter note:

- use `docs/investor/MARKET_SURVEY.md` for the fuller scale-signal references
- use `docs/investor/COMPETITOR_SCALE_SIGNALS_SLIDE.md` for the standalone one-slide version

### 19. Founder-Market Fit

Founder strengths:

- deep military aerospace operations background
- civilian route planning and airline operations experience
- management and organisational capability grounding
- direct understanding of operational discipline, assurance, and decision accountability

### 20. Roadmap

Slide title:

Roadmap

On-slide text:

Near-term:

- convert build strength into customer proof
- keep hardening the TypeScript product core
- sharpen the commercial wedge
- continue multi-tenant and access-control hardening
- mature OA personnel workflows in product

Later:

- broader regulatory profiles
- deeper live-ops and advisory support
- larger-scale multi-mission and organisational workflows
- defence-aligned extensions where appropriate

Close:

Prove the wedge first. Expand the platform second.

Speaker notes:

The roadmap should feel disciplined. The near-term job is not to become everything at once. It is to turn a serious build into customer proof, tighten the wedge, and keep hardening the platform where that directly supports deployment readiness.

### 21. Ask

Slide title:

Ask

On-slide text:

Raise capital to convert product substance into:

- customer proof
- early revenue
- product hardening
- pilot deployment support
- design partner onboarding
- early commercial execution

Close:

The build is ahead. The ask is to turn that into proof and traction.

Speaker notes:

This should feel grounded. The ask is not to fund a concept. It is to fund the conversion of a substantial build into live proof, customer traction, and a more durable commercial position.

## Presenter Notes

- do not overclaim legal automation where the product is still evidence-led rather than regulator-connected
- do not imply defence revenue unless there is proof
- keep the commercial story first, defence second
- always distinguish current build from future roadmap
- use `docs/investor/DEPLOYMENT_MODEL.md` for the investor-facing deployment summary
