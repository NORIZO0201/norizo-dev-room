# RELIS Benchmark Unit 01

**Status:** Fixed experimental specification  
**Date:** 2026-09-23  
**Project:** RELIS / NORIZO LAB  
**Execution machine:** GMKtec Windows 11 / WSL / NORIZO LAB  

---

## 1. Purpose

This test is **not the start of full RELIS production operation**.

The purpose is to run one small, real RELIS research batch on the GMKtec machine and obtain actual measurements for:

- processing speed per research job
- safe jobs per hour
- storage volume per job
- Supabase growth rate
- duplicate rate
- fetch / parse / DB error rate
- GMK CPU / RAM / temporary disk load
- practical need for Claude Code intervention

The measured values from this benchmark will be used to estimate:

- how many jobs RELIS can process per hour / day
- how long research through LEVEL 8 may take
- how much Supabase Database / Storage capacity will be required
- where the real bottleneck exists before scaling concurrency

No estimate for LEVEL 8 should be treated as reliable before this benchmark is completed.

---

## 2. Fixed Role Separation

### ChatGPT / Chatty

Role: **experiment designer and supervisor**

Responsibilities:

- define what the benchmark measures
- define one RELIS research job
- define success criteria
- define required output format
- review the final benchmark result
- calculate LEVEL 8 time / storage projections from measured values
- decide the next test configuration, such as 1 → 2 → 4 workers

ChatGPT does **not** perform the bulk crawl itself.

### Claude Code

Role: **implementation, execution support, repair, and result formatting for this benchmark only**

Claude Code is used at these points:

1. Write or adapt the Python benchmark runner according to this specification.
2. Start and supervise the one benchmark run.
3. Repair the runner only if an implementation/runtime error prevents completion.
4. Read the machine-generated benchmark output after completion.
5. Format the result into the fixed RELIS BENCHMARK UNIT 01 report format.

Claude Code must **not** become the bulk research worker.

Claude Code must not repeatedly read, summarize, classify, or reason over every source when normal Python code can perform the work.

### Python / normal program execution

Role: **actual research worker**

The benchmark should be designed so normal collection requires no LLM reasoning.

Python should perform:

- queue/job loading
- URL normalization
- HTTP fetch
- content-type detection
- RAW collection
- hashing / dedupe checks
- basic parsing
- basic metadata extraction
- deterministic classification where possible
- provenance creation
- Supabase Database write
- Supabase Storage write
- checkpoint/status update
- metric collection
- local temporary-file cleanup

### Supabase

Role: **persistent canonical storage**

Use Supabase for:

- research job state
- lightweight metadata
- provenance
- hashes / dedupe information
- benchmark run metrics where appropriate
- RAW source objects in Storage

GMKtec is an execution machine, not the primary data warehouse.

---

## 3. Definition of One Research Job

For benchmark purposes, **one job** means:

> One queued RELIS source/job is fetched and processed through RAW preservation, basic parsing/metadata extraction, dedupe handling, provenance generation, Supabase persistence, and final job status update.

A job is not merely one HTTP request or one page download.

Standard job flow:

```text
QUEUE
  ↓
FETCH
  ↓
NORMALIZE / HASH
  ↓
RAW SAVE
  ↓
PARSE
  ↓
BASIC METADATA / CLASSIFICATION
  ↓
PROVENANCE
  ↓
SUPABASE DATABASE + STORAGE
  ↓
CHECKPOINT / STATUS
  ↓
DONE
```

---

## 4. Benchmark Dataset

Use **real RELIS work**, not synthetic test pages.

### Initial sample size

Target: **10 jobs**

The 10 jobs should come from the existing RELIS research queue or equivalent existing source list.

Do not create a new unrelated research theme merely for benchmarking.

### Preferred source mix

To avoid measuring only easy pages, the sample should include approximately:

| Source type | Target count | Purpose |
|---|---:|---|
| Normal HTML pages | 4 | baseline case |
| PDF / public documents | 2 | document-processing load |
| Tables / statistics / structured pages | 2 | parser workload |
| Slightly difficult / irregular sources | 2 | real failure/retry behavior |

If the existing queue does not contain this exact mix, use the closest practical sample and report the actual composition.

---

## 5. Execution Conditions

### Benchmark Unit 01 configuration

- Workers: **1**
- Parallelism: **none / single worker baseline**
- Jobs: **10 target jobs**
- LLM research during normal collection: **disabled**
- Paid external APIs: **prohibited**
- Automatic next batch: **disabled**
- Automatic scale-up: **disabled**
- GitHub Actions: **prohibited**
- Production deployment: **not required**
- Vercel Preview: **not required**

This test measures the safe baseline of one normal worker, not maximum possible throughput.

---

## 6. Python Processing Boundary

The Python runner should handle as much as practical without LLM reasoning.

Expected deterministic pipeline:

1. Read one queued job.
2. Normalize URL.
3. Check fetch preconditions where required.
4. Fetch source.
5. Record HTTP status and timing.
6. Identify content type.
7. Preserve RAW bytes.
8. Generate content hash.
9. Check existing captures / duplicates.
10. Extract basic fields such as title, text, publication date when mechanically available.
11. Attach known source_type.
12. Attach known region/entity identifiers when available from queue context or deterministic mapping.
13. Attach RELIS LEVEL candidate only when deterministically available; do not force semantic inference.
14. Generate provenance metadata.
15. Write lightweight metadata to Supabase Database.
16. Write RAW object to Supabase Storage where appropriate.
17. Update job status / checkpoint.
18. Record benchmark metrics.
19. Confirm persistence.
20. Delete local temporary object after successful persistence.
21. Move to next job.

Semantic interpretation, strategy, summarization, policy evaluation, or other high-level reasoning is not part of this benchmark.

---

## 7. Metrics to Record

### 7.1 Throughput and timing

Per job and total:

- run_started_at
- run_finished_at
- total_elapsed_ms
- fetch_ms
- parse_ms
- database_write_ms
- storage_write_ms
- total_job_ms
- jobs_per_hour

Primary throughput KPI:

**jobs/hour**

### 7.2 Processing outcome

Record:

- total_jobs
- fetched
- fetch_success
- parse_success
- stored_success
- duplicate
- skipped
- retried
- failed

Do not collapse all outcomes into one generic success/failure field.

### 7.3 Data volume

Record per job where possible:

- raw_bytes
- parsed_text_bytes
- metadata_bytes or reasonable DB payload estimate
- uploaded_storage_bytes
- temporary_local_bytes_peak

Calculate:

- RAW total
- RAW average/job
- RAW median/job
- RAW P95/job where sample size permits
- maximum RAW/job
- estimated DB payload/job

### 7.4 GMK resource usage

Measure:

- CPU average
- CPU peak
- RAM average
- RAM peak
- temporary local disk peak
- downloaded network bytes
- uploaded network bytes

### 7.5 Error profile

Separate:

- HTTP errors
- timeout/network errors
- parse errors
- duplicate events
- Supabase DB errors
- Supabase Storage errors
- checkpoint/status errors
- uncategorized errors

A source-side 404 or unavailable page should not automatically mean the benchmark system itself failed.

The system should record the source failure and continue.

### 7.6 Claude Code intervention

Record:

- used_for_implementation: YES/NO
- used_during_normal_collection: must be NO
- recovery_interventions
- reason for each intervention
- whether Python resumed from checkpoint after repair

The target steady-state architecture is that Claude Code is rarely needed after implementation stabilizes.

---

## 8. Supabase Persistence Design

### Database: lightweight canonical metadata

Store or map equivalent existing fields such as:

- capture_id
- job_id
- source_url
- canonical_url
- source_type
- level / level_candidate
- region_id
- entity_id
- fetched_at
- http_status
- content_hash
- raw_size
- parsed_size
- processing_ms
- collector_version
- status
- error_code
- retry_count
- storage_path
- provenance

Existing RELIS schema takes priority. Do not create duplicate tables merely because field names differ.

### Storage: heavy RAW source material

Examples:

- HTML
- JSON
- PDF
- CSV
- XML
- other source files that need preservation

Reason:

RELIS processing logic will evolve. Preserving the original source allows re-processing without necessarily re-fetching the source.

---

## 9. GMK Local Storage Policy

GMK is an execution worker, not the archive.

Keep locally only:

- code
- configuration
- small operational logs
- current temporary download
- minimal checkpoint/cache data

After successful Supabase persistence:

```text
confirm DB metadata
      ↓
confirm Storage object where required
      ↓
confirm checkpoint/status
      ↓
delete local temporary data
```

The benchmark must therefore report temporary disk peak rather than accumulating permanent RAW data on GMK.

---

## 10. Claude Code Failure / Repair Role

Claude Code should only intervene during the run when a program/runtime problem prevents safe continuation.

Examples:

- Python process crashes
- repeated parser exception
- Supabase schema incompatibility
- Storage write implementation error
- dead queue/checkpoint logic
- runner cannot resume safely

Expected recovery flow:

```text
Python worker
   ↓ error
Watch / error evidence
   ↓
Claude Code
   ↓
minimal diagnosis + repair
   ↓
test
   ↓
restart/resume from checkpoint
   ↓
continue benchmark
```

Do not perform broad refactoring during the benchmark unless absolutely required to complete it safely.

---

## 11. PASS / WARN / FAIL Criteria

### PASS

Benchmark is considered PASS when:

- the benchmark runner completes the target batch or correctly records legitimate unavailable sources and continues
- normal collection is performed by Python, not Claude Code
- Supabase writes are successful for processable jobs
- RAW source data is preserved where required
- provenance is present for all stored captures
- no unintended duplicate records are created
- checkpoint/status handling works
- temporary local data is cleaned after confirmed persistence
- the process does not require manual command-by-command intervention
- all required benchmark metrics are produced

### WARN

Use WARN when the benchmark completes but reveals a fixable scaling/reliability issue, such as:

- high retry rate
- parser weakness for one source type
- excessive temporary disk use
- CPU/RAM pressure
- storage overhead larger than expected
- Supabase latency
- one or more Claude recovery interventions

### FAIL

Use FAIL when:

- the benchmark cannot complete or safely resume
- persistent data is lost
- provenance is missing
- duplicate control is broken
- Supabase persistence is unreliable
- normal operation depends on repeated Claude Code intervention
- metrics are insufficient to estimate performance

---

## 12. Required Final Report Format

Claude Code must format the final benchmark result in exactly this logical structure after reading the machine-generated metrics.

```text
RELIS BENCHMARK UNIT 01

STATUS:
PASS / WARN / FAIL

JOBS:
Total:
Success:
Duplicate:
Skipped:
Failed:

TIME:
Total elapsed:
Average/job:
Jobs/hour:

STORAGE:
RAW total:
RAW average/job:
RAW median/job:
RAW P95/job:
Parsed total:
DB estimated/job:
Temporary disk peak:

GMK:
CPU average:
CPU peak:
RAM average:
RAM peak:

NETWORK:
Downloaded:
Uploaded:

ERRORS:
HTTP errors:
Network/timeout errors:
Parse errors:
DB errors:
Storage errors:
Other:

SUPABASE:
Rows inserted:
Storage objects:
Provenance missing:
Duplicate insertions:

CLAUDE CODE:
Used for implementation: YES/NO
Used during normal collection: NO
Used for recovery: YES/NO
Number of recovery interventions:
Recovery reasons:

OBSERVED BOTTLENECK:
...

RAW RESULT FILE:
...

RECOMMENDATION FOR NEXT TEST:
Keep 1 worker / Test 2 workers / Fix before scaling
```

Claude Code may add concise factual notes, but must not independently decide the overall LEVEL 8 research strategy.

---

## 13. What Happens After Benchmark Unit 01

After the final report is returned to ChatGPT:

1. ChatGPT reviews measured jobs/hour.
2. ChatGPT reviews success and failure rates.
3. ChatGPT reviews storage bytes/job.
4. ChatGPT reviews CPU/RAM/disk headroom.
5. ChatGPT estimates practical 24-hour throughput using a safety factor rather than theoretical maximum.
6. ChatGPT estimates Database and Storage volume at larger scale.
7. ChatGPT maps these measurements against expected research job counts through LEVEL 8.
8. ChatGPT decides whether Benchmark Unit 02 should remain at one worker or move to two workers.

Expected scaling sequence, if safe:

```text
1 worker → 2 workers → 4 workers → determine practical ceiling
```

Do not jump directly to maximum concurrency.

---

## 14. Core Architecture Principle

RELIS bulk research must not become a system in which an AI model reasons through every source.

The intended division is:

```text
ChatGPT
= decides what RELIS should investigate and how the system should evolve

Claude Code
= implements, supervises the benchmark, repairs failures, formats the measured result

Python / normal software
= repeatedly fetches, parses, stores, checkpoints, and continues

Supabase
= preserves state, provenance, metadata, and RAW research assets

GMKtec
= runs the factory continuously
```

The long-term target is a RELIS Factory that can process large research queues for days without human intervention and without routine LLM consumption.

---

## 15. Explicit Non-Goals for Unit 01

Do not use this benchmark to:

- redesign all of RELIS
- audit every LEVEL
- process all existing queues
- perform semantic analysis across all sources
- begin LEVEL 8 full production research
- optimize for maximum speed before establishing the baseline
- add unrelated MCPs or external services
- introduce paid APIs
- deploy web applications
- use GitHub Actions
- accumulate permanent RAW data on GMK

**Unit 01 is one small measurement run only.**

Its value is the measured baseline from which the real RELIS Factory can be sized and scaled.
