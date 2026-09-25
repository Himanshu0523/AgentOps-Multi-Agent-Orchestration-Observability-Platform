# AgentOps — Multi-Agent Orchestration & Observability Platform

> A full-stack platform where specialized AI agents collaborate on complex tasks, with complete reasoning-trace logging, cost tracking, and human-in-the-loop approval gates — the "mission control" layer that real companies need to run agentic AI safely in production.

---

## 1. Why This Project

 **agentic pipelines**: multiple LLM-driven agents that plan, call tools, write code, browse the web, and hand off work to each other. The unsolved problem isn't "can an agent do a task" — it's **can you trust, monitor, and control a fleet of agents in production**. This project builds that control layer, which maps directly to real roles: AI Platform Engineer, Agent Infrastructure Engineer, LLMOps Engineer.

---

## 2. Core Features

- Define a task in natural language → system decomposes it into subtasks and assigns them to specialized agents (Researcher, Coder, Data-Analyst, Reviewer).
- Every agent decision (prompt, tool call, output, cost, latency) is logged and visualized as a trace tree.
- Human approval gate before any "risky" action (sending an email, writing a file, spending money, hitting an external API).
- Live cost dashboard (tokens × price per model) and per-agent budget caps.
- Replay mode: re-run any past trace step-by-step to debug why an agent made a decision.

---

## 3. System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLIENT (Next.js)                          │
│  Task Composer │ Live Trace Viewer │ Cost Dashboard │ Approval UI │
└───────────────────────────┬────────────────────────────────────--┘
                            │ WebSocket + REST
┌───────────────────────────▼────────────────────────────────────┐
│                    API GATEWAY (FastAPI)                        │
│   /tasks   /agents   /traces   /approvals   /costs   (REST)     │
│              /ws/traces (WebSocket stream)                      │
└───────────────────────────┬───────────────────────────────────-┘
                            │
        ┌───────────────────┼────────────────────┐
        ▼                   ▼                     ▼
┌───────────────┐   ┌───────────────┐    ┌──────────────────┐
│  Orchestrator  │   │  Agent Pool    │    │  Approval Queue   │
│  (LangGraph)   │◄─►│ Researcher     │    │  (Redis list)     │
│  - planner     │   │ Coder          │    │  human decides    │
│  - router      │   │ Data Analyst   │    │  before execute   │
│  - state machine│  │ Reviewer       │    └──────────────────┘
└───────┬───────┘   └───────┬───────┘
        │                   │
        ▼                   ▼
┌────────────────┐  ┌──────────────────┐
│ Vector Memory   │  │ Tool Execution    │
│ (Qdrant)        │  │ Sandbox (Docker)  │
│ - task context  │  │ - code exec       │
│ - past traces   │  │ - web search      │
└────────────────┘  │ - file I/O         │
                     └──────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│   Observability Layer (Langfuse / OTel)       │
│   - every LLM call, tool call, cost, latency  │
└─────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│   Postgres (tasks, traces, users, budgets)    │
└─────────────────────────────────────────────┘
```

---

## 4. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 14 + Tailwind + shadcn/ui | Fast, server components for trace streaming |
| Realtime | WebSocket (Socket.IO) | Push live agent steps to the trace viewer |
| Backend API | FastAPI (Python) | Native async, plays well with agent frameworks |
| Agent Framework | LangGraph (open source) | Explicit state machine — easier to reason about than pure ReAct loops |
| Vector store | Qdrant | Fast, self-hostable, good filtering |
| Observability | Langfuse (self-hosted) or OpenTelemetry + Jaeger | Purpose-built for LLM tracing |
| Sandbox execution | Docker-in-Docker / Firecracker microVM | Isolate code the Coder agent writes |
| Queue | Redis | Approval queue + task queue (Celery/RQ) |
| Database | PostgreSQL | Tasks, traces metadata, users, budgets |
| Auth | Clerk / Auth.js | Don't hand-roll auth |
| Deployment | Docker Compose → Fly.io / Railway | Cheap, simple multi-service deploy |

---

## 5. Data Model (simplified)

```sql
tasks(id, user_id, goal_text, status, created_at, total_cost)
agent_runs(id, task_id, agent_type, parent_run_id, status, started_at, ended_at)
trace_steps(id, agent_run_id, step_type, input, output, tokens_in, tokens_out, cost, latency_ms)
approvals(id, trace_step_id, action_description, risk_level, status, decided_by, decided_at)
budgets(id, task_id, max_cost, spent_cost)
```

`trace_steps.parent_run_id` self-references so you can render a full tree (task → subtask → tool call).

---

## 6. Agent Design

- **Planner** — decomposes the user's goal into an ordered/parallel subtask graph (LangGraph `StateGraph`).
- **Researcher** — web search + summarization tool calls.
- **Coder** — writes/executes code in the sandbox, returns diffs not raw file overwrites.
- **Data Analyst** — runs pandas/duckdb queries against uploaded data.
- **Reviewer** — critiques other agents' outputs before final delivery (a cheap but very convincing "quality gate" to demo).

Each agent step that is flagged `risk_level != "low"` (file write, external send, spend) pushes to the **Approval Queue** and blocks until a human resolves it in the UI — this is the single most interview-worthy feature since most agent demos skip safety entirely.

---


## 9. Stretch Goals

- Multi-tenant billing (Stripe metered billing on token cost).
- Agent-to-agent negotiation protocol (A2A-style message passing).
- Fine-tune a small router model to pick which agent handles a subtask instead of using the LLM planner every time (cheaper, faster).
