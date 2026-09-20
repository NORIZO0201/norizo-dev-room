# NORIZO DEV ROOM / AI WORK FACTORY Architecture

Updated: 2026-09-21

## 1. Purpose

DEV ROOM is not just a browser preview screen.

It is the **control room for NORIZO's distributed AI work environment**.

The infrastructure has two primary missions:

1. **CURRENT WORK OFFLOAD**
   - Move long-running and heavy resident jobs out of ChatGPT / local interactive sessions.
   - First priority: CruX-related work, especially OMNW build pipelines such as M0→M5, discovery, recognition, deduplication, official-source verification and DB updates.

2. **FUTURE INTELLIGENCE BUILD**
   - Keep automated observation running continuously even when NORIZO is not chatting with an AI.
   - Accumulate long-term observations for Japanese wine, tourism, local commerce, food, fisheries and retail.
   - Grow the data foundation used by LOCAL ENGINE / LERIS and DIS.

Target state:

> ChatGPT becomes the control room, not the place where every long-running job physically executes.

---

## 2. Role separation

| Component | Role |
| --- | --- |
| **Mac** | NORIZO's command desk. ChatGPT, planning, approvals, everyday work. |
| **GMKtec Windows PC** | AI WORK PC 01. Windows-only work, JPO patent filing, local browser QA, Playwright, Claude Code / Codex, local builds and tests. |
| **ConoHa VPS** | 24/7 execution factory. Resident workers, batch processing, collectors, Steel self-host, schedulers and monitoring. |
| **DEV ROOM** | Shared operational UI that shows browsers, jobs, nodes, status and AI work. |
| **GitHub** | Source of truth for code, configs and operational documents. |
| **Supabase** | Canonical operational state and long-term structured data. |
| **Steel Cloud** | Optional fallback browser provider when managed cloud capability is needed. |
| **Steel Self-host** | Default low-cost browser provider on VPS once deployed. |
| **DIS CORE** | Intelligence / analytical brain fed by accumulated observations. |
| **LOCAL ENGINE / LERIS** | Customer-facing problem-solving layer for tourism and local commerce. |

---

## 3. Overall architecture

    NORIZO
      │
     Mac
    Command / Decision Desk
      │
    DEV ROOM
      │
      ├──────── GMKtec AI WORK PC 01
      │          ├─ JPO patent filing
      │          ├─ Playwright / browser QA
      │          ├─ Claude Code / Codex
      │          ├─ Git / build / test
      │          └─ Windows-only applications
      │
      ├──────── ConoHa VPS / OBSERVATION NODE 01
      │          ├─ OMNW workers
      │          ├─ Japan Wine Intelligence
      │          ├─ LOCAL ENGINE Observation
      │          ├─ Tourism / Commerce
      │          ├─ Retail / Food / Fisheries
      │          ├─ Scheduler / Queue
      │          ├─ Steel Self-host
      │          └─ Monitoring
      │
      └──────── Steel Cloud
                 fallback

    GitHub = CODE / DOCS
    Supabase = DATA / STATE
         ↓
      DIS CORE
         ↓
    LOCAL ENGINE / LERIS

---

## 4. Business priority

### Priority A — CruX work offload

The first operational priority is to remove heavy background work from the chat workflow.

Initial candidates:

- OMNW Discovery
- OMNW Recognition
- OMNW Master
- M0→M5 processing
- unique wine normalization / deduplication
- official source verification
- label variant handling
- CWS Master synchronization
- CNW / CWS differential detection
- scheduled ETL
- long-running QA
- heartbeat / restart / retry

Guiding rule:

> Heavy resident processing runs as deterministic workers. Claude Code builds, repairs and improves the workers; Claude Code itself is not the permanent crawler.

---

## 5. Observation Node

The second mission is to build data that has future value.

### Initial observation lanes

    LOCAL ENGINE OBSERVATION NODE 01
    │
    ├─ JAPAN WINE
    │  ├─ wineries
    │  ├─ products / vintages
    │  ├─ awards
    │  ├─ events
    │  ├─ retail pricing
    │  ├─ EC listings
    │  ├─ search demand
    │  └─ market signals
    │
    ├─ TOURISM
    │  ├─ accommodation
    │  ├─ events
    │  ├─ transportation
    │  ├─ reviews / public signals
    │  └─ regional demand
    │
    ├─ LOCAL COMMERCE
    │  ├─ businesses
    │  ├─ products
    │  ├─ openings / closings
    │  ├─ EC / retail presence
    │  └─ demand signals
    │
    ├─ FOOD / FISHERIES
    │  ├─ products
    │  ├─ prices
    │  ├─ supply / seasonality
    │  ├─ recipes / use cases
    │  └─ regional competition
    │
    └─ RETAIL
       ├─ search demand
       ├─ market pricing
       ├─ competitor assortment
       ├─ promotion signals
       └─ first-party POS / inventory when available

---

## 6. DIS / LERIS relationship

For the near-term business model:

- **LERIS / LOCAL ENGINE is the visible customer solution.**
- **DIS is the analytical brain behind it.**

Customers do not need to buy “an AI dashboard.”

They need answers to problems such as:

- How can Hamada fish sell much more?
- How can Matsue Shinjiko Onsen increase visitors and spending?
- Which products should a retailer carry and promote?
- What is changing in the local market right now?

DIS should therefore grow first as a brain capable of producing answers for tourism, local commerce, food / fisheries, retail and regional promotion.

Japanese wine remains the most mature vertical dataset and serves as the first proving ground for the architecture.

---

## 7. 2027 validation fields

| Field | Validation role |
| --- | --- |
| **CruX** | Japanese wine / EC / media / distribution intelligence |
| **Shizutetsu Store** | Retail Intelligence: POS × inventory × external demand |
| **Hamada fish project** | Fisheries × commerce × tourism intelligence |
| **Matsue Shinjiko Onsen** | Tourism × food × mobility × local commerce intelligence |

This combination proves that DIS is not a wine-only product.

---

## 8. Browser provider policy

    DEV ROOM
       ↓
    Browser Provider
       ├─ Steel Self-host on ConoHa   ← normal use
       ├─ Playwright Local on GMKtec  ← local QA / Windows worker
       └─ Steel Cloud                 ← fallback / managed capability

Principles:

- Prefer self-host / local execution for routine QA.
- Use Steel Cloud only when its managed capabilities are actually needed.
- Keep the provider abstraction already introduced in DEV ROOM.
- Do not hard-code DEV ROOM to one provider.

---

## 9. DEV ROOM UI wireframe

The daily control room should show five things immediately:

1. **Node status**
   - Mac
   - GMKtec AI WORK PC 01
   - ConoHa Observation Node 01
   - Supabase
   - GitHub

2. **Browser room**
   - PC live browser
   - SP live browser
   - active provider
   - session age
   - URL sync
   - human takeover

3. **Resident work**
   - OMNW current stage
   - running workers
   - queue
   - last success
   - errors / retries
   - CPU / RAM / disk

4. **Observation**
   - new observations today
   - Japan Wine
   - Tourism
   - Commerce
   - Retail
   - Food / Fisheries
   - notable signals

5. **Projects**
   - CruX
   - OMNW
   - JP / CNW / CWS
   - LOCAL ENGINE / LERIS
   - DIS
   - Hamada
   - Matsue
   - Shizutetsu

See: docs/dev-room-wireframe.svg

---

## 10. GMKtec policy

GMKtec is not a replacement for the VPS.

It is the **local companion node**.

### Immediate first priority

1. Windows 11 setup
2. Mac → Windows App remote access
3. JPO Internet Filing Software
4. File Patent 01
5. File Patent 02

### After patent filing

Turn it into AI WORK PC 01:

- Playwright local provider
- Windows browser QA
- Claude Code / Codex
- local builds / tests
- Git clone workspace
- Windows-only business applications
- optional WSL2 / Docker

Do not use it as the only always-on production collector.

---

## 11. ConoHa policy

ConoHa is the **24/7 AI execution factory**.

Initial target class discussed:

- Ubuntu LTS
- approximately 6 vCPU / 12 GB RAM class
- Docker-based service isolation
- low-concurrency polite collection
- checkpoint / resume
- idempotent jobs
- health monitoring
- snapshot / backup strategy

Claude Code is the implementation and maintenance agent.

Resident work should remain standard services / containers / workers so that jobs continue even when Claude Code is not actively running.

---

## 12. Data principle

The long-term asset is not simply “scraped pages.”

    Entity
      ↓
    Observation
      ↓
    Change
      ↓
    Relationship
      ↓
    Confidence
      ↓
    Intelligence

Repeated observations of the same entity over months and years are more valuable than one-time collection volume.

---

## 13. Operating constitution

- Protect source sites: low concurrency, sensible intervals and backoff.
- API / RSS / sitemap / structured data before browser automation.
- Respect robots.txt, terms and access restrictions.
- Do not automate CAPTCHA bypass.
- On 403 / CAPTCHA / suspicious blocking, hold for review.
- Store provenance for every observation.
- Separate canonical DB from raw temporary cache.
- GitHub is code truth.
- Supabase is data/state truth.
- VPS workers must survive disconnects from ChatGPT.
- Browser QA should default to local/self-hosted providers.
- Vercel workflow remains:
  **Local QA → Preview only when needed → NORIZO confirmation → Production.**

---

## 14. Target experience

When NORIZO opens DEV ROOM in the morning, the ideal state is:

    Good morning.

    OMNW
    +184 candidates
    +63 recognized wines
    M0→M5: running normally

    Japan Wine Intelligence
    +27 new market signals

    LOCAL ENGINE Observation
    Tourism +41
    Commerce +22
    Retail +18
    Food / Fisheries +7

    System
    ConoHa: healthy
    GMKtec: online
    Steel Self-host: ready
    Critical errors: 0

At that point ChatGPT is no longer where all work happens.

It is the place where NORIZO **commands, interprets and decides**.
