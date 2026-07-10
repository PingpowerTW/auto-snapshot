# Auto-Snapshot Performance & Mechanism Evaluation Report

## 1. Executive Summary
`auto-snapshot` is a zero-dependency, local-first persistent memory engine designed specifically for AI coding agents (such as Claude Code, Cursor, Windsurf, etc.). It addresses the prevalent issue of "AI amnesia"—where agents lose context between distinct chat sessions—without incurring high resource footprints, token bloat, or complex vector database setups. 

By utilizing an append-only JSONL format (`SNAPSHOT.jsonl`) combined with Model Context Protocol (MCP) standards, `auto-snapshot` provides lightweight, agent-agnostic memory tracking. 

This evaluation report analyzes two primary resource-saving mechanisms implemented in the core engine:
1. **Episodic Compression (Hot Distillation)**: Automatically condenses historic snapshots to prevent token overflow.
2. **Keyword Fingerprinting (Local Context Sufficiency)**: Efficiently determines if local context is sufficient, bypassing remote database queries.

Key findings indicate that the episodic compression mechanism achieves a **97.61% token saving** while retaining high-level chronological context. In addition, the keyword fingerprinting routine operates within **0.02ms to 0.3ms**, proving that the local adequacy check adds negligible overhead to the prompt assembly process. With an active memory footprint of only **~4.8MB heap usage**, `auto-snapshot` is an extremely lightweight and effective solution for workspace memory management.

---

## 2. Analysis of Mechanisms

### A. Episodic Compression (Hot Distillation)
As an agent interacts with a codebase, it captures milestones, technical decisions, task handoffs, and periodic checkpoints. Over time, these snapshots accumulate in the local `.agent/SNAPSHOT.jsonl` file. Without management, this file would cause severe context bloat and token exhaustion.

```
[Snapshot Captures] ──► .agent/SNAPSHOT.jsonl (Append-Only)
                             │
                      Exceeds 200 lines?
                             │
            ┌────────────────┴────────────────┐
            ▼ (Yes)                           ▼ (No)
   [Episodic Compression]                 [Continue]
            │
            ├─► Slice oldest 150 entries
            ├─► distillKnowledge() ──► Generate Supabase Payload
            ├─► Write single 'compressed_archive' entry
            └─► Retain newest 50+ entries
```

The compression algorithm functions as follows:
1. **Log Format**: Every snapshot is captured as a serialized JSON object appended to the local log file.
2. **Threshold Check**: Every new capture triggers a condition check. If the snapshot log exceeds a hard limit of **200 entries**, compression is initiated.
3. **Hot Distillation (`distillKnowledge`)**:
   - The engine slices the oldest **150 entries** from the log file.
   - It iterates over these entries and extracts all `milestone` summaries and `decision` logs.
   - All tags assigned to these 150 entries are compiled into a unique tag set.
   - It computes the date boundary (start and end timestamps) for the compressed block.
   - It generates a structured `supabasePayload` JSON object (representing the "hot distillation") to be persisted into a long-term remote database (e.g. Supabase `knowledge_items` table).
   - The payload format is structured as follows:
     ```json
     {
       "issue": "期間 2026/7/10~2026/7/10 工作摘要",
       "solution": "里程碑：Milestone 1 | Milestone 2 | ... | 決策：Decision 1 | ...",
       "confidence": 0.8,
       "tags": ["tag1", "tag2", ...],
       "source": "auto-snapshot:compression",
       "created_at": "ISO-TIMESTAMP"
     }
     ```
4. **Archive Reduction**: The 150 individual entries are deleted from the local log file and replaced with a single `compressed_archive` snapshot summarizing the date range and milestone/decision counts. The latest 50+ snapshots are preserved.

### B. Keyword Fingerprinting (Local Context Sufficiency)
When restoring context via `recoverContext()`, the engine must determine whether the local memory is adequate or if it needs to query the remote vector database/Supabase store. Querying a remote database introduces latency and API cost.

`auto-snapshot` employs local keyword fingerprinting to determine context sufficiency:
1. **Tokenization and Normalization**: The user's query is converted to lowercase and split using the regex pattern `/[\s,，。、！？\-_/\\]+/` to tokenize English words and handle Chinese punctuation and boundary characters.
2. **Stop-word Filtering**: High-frequency, low-meaning words (stop-words) are filtered out. The engine maintains a pre-defined set of English and Chinese stop-words (e.g. `the`, `a`, `is`, `of`, `的`, `了`, `是`, `在`, `我`, `你`). Any token matching these words, or having a length of 1 or less, is discarded.
3. **Keyword Fingerprint Matching**:
   - The remaining tokens form a query keyword set.
   - The engine collects all tags associated with the **last 10 local snapshots** (the most recent entries in `.agent/SNAPSHOT.jsonl`).
   - If there is any intersection (case-insensitive) between the query keyword set and the recent tags set, the local context is flagged as sufficient (`locallyAdequate = true`).
4. **Bypassing Remote Queries**: If `locallyAdequate` is `true`, the engine informs the agent and user that the local context is sufficient, bypassing remote calls. If `false`, it suggests executing a remote query on the Supabase Memory Engine.

---

## 3. Performance and Token Saving Metrics

The following metrics were obtained by running the programmatic simulation script `evaluate.js` on 210 historical snapshots.

### A. Context Size and Token Savings
By condensing 150 verbose historical entries into a single archive entry, the local prompt context file (`SNAPSHOT.jsonl`) is drastically reduced in size.

| Metric | Before Compression (150 snapshots) | After Compression (1 archive snapshot) | Savings / Reduction |
| :--- | :--- | :--- | :--- |
| **Character Count** | 35,761 characters | 854 characters | **97.61% Reduction** |
| **Estimated Tokens** *(4 chars/token)* | ~8,940.25 tokens | ~213.50 tokens | **~8,726.75 Tokens Saved** |

### B. Execution Efficiency
The engine's overhead is negligible, ensuring it does not slow down agent operations or workspace builds.

- **Episodic Compression Run Time**: **~22.73 ms** (well below the typical 50–100ms threshold for interactive agent commands).
- **Keyword Fingerprint Check Time**:
  - **Scenario A (With Tag Overlap)**: **~0.31 ms** (Fast keyword lookup, returns `true`).
  - **Scenario B (Without Tag Overlap)**: **~0.02 ms** (Ultra-fast fail, returns `false`).
- **Context Recovery Command (`recoverContext`) Total Time**: **~0.97 ms to 1.19 ms**.

### C. System Resource Footprint
Because the engine is implemented as a lightweight CLI in Node.js reading localized flat files, resource consumption is minimal.

- **RSS (Resident Set Size) Change**: **~8.06 MB** (primarily due to initial file I/O operations and Node.js module compilation).
- **Heap Used Change**: **-0.22 MB** (Garbage collector reclaimed transient objects).
- **End Heap Size**: **~4.81 MB** (indicating extremely lightweight active memory usage).

---

## 4. Optimization Recommendations

To further enhance the token savings, memory footprint, and contextual relevance of `auto-snapshot`, the following concrete optimizations are recommended:

### 1. Implement Dynamic Compression Thresholds
*   **Problem**: Currently, the compression threshold is static (triggered when exceeding 200 entries and compressing the oldest 150). However, the content size of individual snapshots can vary widely (e.g. detailed `handoff` snapshots with list structures vs. simple `periodic` checkpoints).
*   **Solution**: Transition from line-count thresholds to token/character count thresholds. For example, trigger compression when the total size of `SNAPSHOT.jsonl` exceeds **50,000 characters** (approx. 12.5k tokens), and compress until the size is reduced below **15,000 characters**. This guarantees that the snapshot log never consumes more than a fixed, predictable portion of the LLM context window.

### 2. Introduce Hybrid / Semantic Local Fingerprint Matching
*   **Problem**: Keyword fingerprinting is limited to exact string matches against tags. If a query uses synonyms (e.g. "authentication" instead of the tag "auth" or "ui" instead of "frontend"), the lookup fails (`locallyAdequate = false`), resulting in unnecessary remote DB calls.
*   **Solution**: 
    1. Implement a lightweight local synonym mapping or stemmer (e.g. Porter Stemmer) for common tags.
    2. Alternatively, compute Jaccard Similarity between the query words and snapshot tag sets, or utilize a small local TF-IDF model to match keywords across snapshot summaries, rather than tags alone. This increases the accuracy of local sufficiency checks.

### 3. Structured Markdown Tables for Compressed Archives
*   **Problem**: Currently, the `distillKnowledge` output is formatted as a single dense paragraph string for the `compressed_archive` summary. Dense paragraph text is less readable for LLMs and can lead to lower recall when the agent parses the context.
*   **Solution**: Format the `compressed_archive` summary as a structured Markdown table or markdown bullet list within `PROJECT_CONTEXT.md` or the snapshot output. For example:
    ```markdown
    | Date Range | Milestones | Key Decisions | Tags |
    | :--- | :--- | :--- | :--- |
    | 2026/7/10 - 2026/7/10 | - Completed OAuth integration<br>- Added CLI testing | - Chose Firebase Auth over custom JWT | auth, firebase, cli |
    ```
    This significantly improves readability and structured retrieval for LLMs during context recovery.

### 4. Local SQLite / LevelDB Fallback Cache
*   **Problem**: Distilled snapshots are output to `stdout` for manual or agent-driven insertion into Supabase. If the network is offline or the Supabase endpoint fails, this distilled knowledge is lost once the local file is overwritten.
*   **Solution**: Incorporate a local SQLite or LevelDB fallback cache in `.agent/`. When episodic compression occurs, write the distilled payload to a local SQLite database before truncation. This allows the system to support local semantic/keyword search over the entire history offline, providing a robust backup before pushing to the cloud database.
