# Fantasy AI Analyst — Full Build Spec for GitHub Copilot

## Role
You are my senior staff engineer pair-programmer. Your job is to help me build a serious portfolio-grade project called **Fantasy AI Analyst**.

This project must look like a real **AI-powered product + backend engineering system**, not a toy demo.

You should act like:
- a pragmatic backend architect
- a senior NestJS engineer
- an AI systems engineer
- a product-minded builder
- a reviewer who prefers production-quality code over hacks

Your responsibilities:
- generate code incrementally and safely
- keep architecture clean and modular
- explain major tradeoffs briefly when needed
- prefer maintainable implementations
- avoid unnecessary abstractions early
- keep the project highly presentable for GitHub, LinkedIn, CV, and interviews

---

## Project Objective
Build an **AI-powered fantasy football backend platform** that helps users answer questions like:

- Which players should I pick this week?
- Which players are undervalued?
- Should I captain player A or player B?
- Which picks have the best upside based on recent form and fixtures?
- What are the best differentials this week?
- Who are the best transfer targets for the next 3 gameweeks?

The system must combine:
- structured sports data
- backend APIs
- feature engineering
- recommendation logic
- LLM reasoning
- optional retrieval / memory
- explainable outputs

This should feel like a serious **Applied AI / AI Systems / Backend Engineering** portfolio project.

---

## Product Framing

### One-line description
**Fantasy AI Analyst** is an AI-powered backend platform that combines sports data pipelines, player projections, recommendation engines, and LLM reasoning to generate explainable fantasy football decisions.

### Problem
Fantasy football users rely on scattered data, manual research, opinion-based content, and spreadsheets. Decision-making is slow, inconsistent, and difficult to personalize.

### Solution
Provide a backend system and optional lightweight UI that:
- ingests fantasy football and match/stat data
- computes player form and fixture-based signals
- generates recommendation candidates programmatically
- uses an LLM to explain and compare recommendations
- supports natural-language Q&A over current fantasy insights

### Why this project matters for recruiters
This project demonstrates:
- backend engineering in NestJS + TypeScript
- AI product engineering
- LLM orchestration
- tool-based reasoning
- data modeling
- asynchronous jobs / pipelines
- clean API design
- real-world engineering tradeoffs
- deployable full-stack system design

---

## Core Technical Thesis
This is **not** “just call OpenAI on top of some sports text.”

This system must be designed as a **hybrid architecture**:

1. **Programmatic reasoning layer**
   - computes rankings, metrics, projections, differential scores
   - handles deterministic logic
   - ensures system reliability and explainability

2. **AI reasoning layer**
   - compares players
   - explains tradeoffs
   - answers natural-language questions
   - converts structured signals into human-readable analysis

3. **Optional retrieval layer**
   - retrieves supporting records, historical analyses, reports, or notes
   - useful for conversational answers and grounding

### Architectural recommendation
Use a **hybrid of programmatic logic + AI agent**, with light retrieval where useful.

Do **not** overuse RAG for data that is already structured in PostgreSQL.
Use SQL and services for structured analytics.
Use retrieval only for:
- generated insight documents
- news summaries
- scouting reports
- stored recommendation artifacts
- prior conversations / saved analyses

---

## Final Architecture to Build

### High-level components
1. **NestJS backend API**
2. **PostgreSQL database**
3. **Prisma ORM**
4. **Python AI service** for AI workflows and analytics-heavy tasks
5. **Qdrant or pgvector** for retrieval memory (optional in MVP, stronger in v2)
6. **Redis** for cache / queues (optional MVP, recommended in strong version)
7. **Job layer / schedulers** for ingestion and periodic recomputation
8. **Optional Next.js frontend** with a simple dashboard + chat

### Recommended architecture style
- Monorepo
- apps/api → NestJS backend
- apps/ai-service → Python FastAPI or lightweight service
- apps/web → optional Next.js frontend
- packages/shared → shared DTOs/types/constants if useful
- docs/ → architecture and diagrams

### Communication pattern
- frontend calls NestJS API
- NestJS handles auth, business logic, DB access, orchestration
- NestJS calls Python AI service for advanced AI tasks
- Python AI service calls LLM + retrieval + analytics tools
- both services run with Docker Compose locally

---

## Recommended Tech Stack

### Backend
- **Node.js**
- **TypeScript**
- **NestJS**
- **Prisma**
- **PostgreSQL**
- **Swagger/OpenAPI**
- **Jest**
- **Docker**

### AI service
- **Python 3.11+**
- **FastAPI**
- **Pydantic**
- **pandas**
- **numpy**
- **httpx**
- **LangGraph** or minimal custom orchestration
- **OpenAI SDK**

### Retrieval / vector search
Preferred options:
- **Qdrant**
- or **pgvector** if wanting simpler infra

Recommendation:
- MVP: start with PostgreSQL only
- Strong version: add Qdrant or pgvector for conversation memory / insights retrieval

### Frontend (optional but useful)
- **Next.js**
- **TypeScript**
- **Tailwind CSS**
- minimal UI only

### Infra / DevEx
- Docker Compose
- ESLint
- Prettier
- Husky (optional)
- GitHub Actions CI
- environment variables with `.env.example`

---

## What to Optimize For
This project must optimize for:
- recruiter appeal
- code clarity
- system design credibility
- practical deliverability in 1–2 weeks
- presentable GitHub repo quality
- easy demoability

Avoid building too much UI. The value is in:
- architecture
- API quality
- data model quality
- recommendation engine
- AI orchestration
- explanations

---

## Functional Scope

### Required core capabilities
1. ingest player/team/fixture/stat data
2. store normalized data in PostgreSQL
3. compute player metrics and recommendation scores
4. expose public/read APIs
5. expose AI-powered analysis endpoints
6. support player comparison
7. support captain recommendation
8. support differential recommendation
9. support transfer target recommendation
10. support conversational Q&A endpoint

### Nice-to-have
- watchlist support
- user accounts
- saved conversations
- recommendation history
- confidence score
- explanation trace
- background jobs
- cached responses
- lightweight dashboard

---

## Functional Modules

### 1. Data ingestion module
Responsibilities:
- fetch raw data from fantasy / sports APIs
- normalize payloads
- upsert entities into database
- track ingestion runs
- handle retries and errors

### 2. Domain data module
Responsibilities:
- players
- teams
- fixtures
- gameweeks
- player match stats
- injuries / availability if available
- prices and ownership if available

### 3. Metrics and feature engineering module
Responsibilities:
- rolling form score
- fixture difficulty score
- consistency score
- differential score
- upside score
- minutes security score
- captaincy score
- transfer desirability score

### 4. Recommendation engine module
Responsibilities:
- rank players by use case
- generate top captain recommendations
- generate undervalued player recommendations
- generate differential picks
- generate transfer suggestions
- generate structured reasons

### 5. AI analysis module
Responsibilities:
- compare players
- explain recommendations
- answer natural-language questions
- summarize statistical tradeoffs
- produce recruiter-friendly “AI system” value

### 6. Conversation module
Responsibilities:
- accept user query
- gather context via tools
- call AI service
- store answer optionally
- return answer + sources + metrics used

---

## Product Decisions

### Why this should be hybrid, not pure RAG
Do not frame structured sports records as documents first.

For example:
- player stats → SQL / services
- fixture difficulty → computed service
- differential ranking → deterministic engine
- captain recommendation → scoring + AI explanation

The LLM should not invent rankings from scratch.

### Correct division of labor

#### Programmatic logic should handle
- feature generation
- ranking formulas
- score calculation
- filtering by position/price/team
- lineup-related deterministic logic
- data validation
- explainability metadata

#### LLM should handle
- natural-language answers
- comparison narratives
- user-friendly explanations
- strategy framing
- uncertainty communication
- multi-factor summarization

#### Retrieval should handle
- prior recommendation artifacts
- stored weekly analyses
- scouting notes
- textual context documents
- optional external news summaries

---

## Suggested Repository Structure

```text
fantasy-ai-analyst/
├─ apps/
│  ├─ api/
│  │  ├─ src/
│  │  │  ├─ main.ts
│  │  │  ├─ app.module.ts
│  │  │  ├─ config/
│  │  │  ├─ common/
│  │  │  ├─ health/
│  │  │  ├─ prisma/
│  │  │  ├─ auth/
│  │  │  ├─ players/
│  │  │  ├─ teams/
│  │  │  ├─ fixtures/
│  │  │  ├─ stats/
│  │  │  ├─ gameweeks/
│  │  │  ├─ ingestion/
│  │  │  ├─ metrics/
│  │  │  ├─ recommendations/
│  │  │  ├─ comparisons/
│  │  │  ├─ conversations/
│  │  │  ├─ ai/
│  │  │  └─ jobs/
│  │  ├─ test/
│  │  ├─ Dockerfile
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  │
│  ├─ ai-service/
│  │  ├─ app/
│  │  │  ├─ main.py
│  │  │  ├─ api/
│  │  │  ├─ agents/
│  │  │  ├─ tools/
│  │  │  ├─ services/
│  │  │  ├─ prompts/
│  │  │  ├─ retrieval/
│  │  │  ├─ schemas/
│  │  │  └─ utils/
│  │  ├─ tests/
│  │  ├─ requirements.txt
│  │  └─ Dockerfile
│  │
│  └─ web/
│     ├─ app/
│     ├─ components/
│     ├─ lib/
│     ├─ package.json
│     └─ Dockerfile
│
├─ packages/
│  ├─ shared-types/
│  └─ eslint-config/
│
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.ts
│
├─ docs/
│  ├─ architecture.md
│  ├─ api-design.md
│  ├─ data-model.md
│  ├─ ai-system.md
│  ├─ roadmap.md
│  └─ diagrams/
│
├─ scripts/
│  ├─ bootstrap.sh
│  ├─ dev-up.sh
│  └─ seed-demo-data.sh
│
├─ .github/
│  ├─ workflows/
│  └─ ISSUE_TEMPLATE/
│
├─ docker-compose.yml
├─ .env.example
├─ README.md
└─ AGENT_CONTEXT.md
```

---

## Implementation Requirements

### Engineering standards
All generated code should follow these principles:
- strongly typed
- modular
- well-named functions and files
- thin controllers
- service-oriented business logic
- DTO validation
- consistent error handling
- good README and docs
- production-style environment config
- no giant files
- no dead code
- no placeholder comments unless explicitly marked TODO

### Backend standards
- Use NestJS modules cleanly
- Use DTOs + class-validator where appropriate
- Keep controllers thin
- Keep business logic in services
- Use Prisma cleanly with repository/service abstraction if useful
- Add pagination/filtering on read endpoints where appropriate
- Return predictable response shapes
- Add Swagger documentation
- Implement structured logging where easy

### AI service standards
- Keep prompts versioned in separate files
- Keep tool functions explicit and testable
- Use response schemas where possible
- Avoid hidden magic
- Return structured outputs, not only raw text
- Separate orchestration from tool implementations

---

## Database Design
Use PostgreSQL with Prisma.

### Core entities

#### Team
Fields:
- id
- externalId
- name
- shortName
- strengthAttack
- strengthDefense
- createdAt
- updatedAt

#### Player
Fields:
- id
- externalId
- teamId
- firstName
- lastName
- displayName
- position
- price
- ownershipPct
- status
- minutesSeason
- selectedByPct
- createdAt
- updatedAt

#### Gameweek
Fields:
- id
- externalId
- number
- deadlineAt
- isCurrent
- isFinished
- createdAt
- updatedAt

#### Fixture
Fields:
- id
- externalId
- gameweekId
- homeTeamId
- awayTeamId
- kickoffAt
- homeDifficulty
- awayDifficulty
- isFinished
- createdAt
- updatedAt

#### MatchStat / PlayerFixtureStat
Fields:
- id
- playerId
- fixtureId
- minutes
- goals
- assists
- cleanSheet
- xg
- xa
- shots
- keyPasses
- yellowCards
- redCards
- saves
- bonus
- fantasyPoints
- createdAt
- updatedAt

#### PlayerMetric
Represents computed/derived scores.
Fields:
- id
- playerId
- gameweekId
- formScore
- fixtureScore
- upsideScore
- consistencyScore
- differentialScore
- captaincyScore
- transferScore
- valueScore
- minutesSecurityScore
- projectedPoints
- confidenceScore
- createdAt
- updatedAt

#### Recommendation
Stores generated recommendation records.
Fields:
- id
- gameweekId
- type
- playerId
- score
- confidenceScore
- title
- explanation
- explanationJson
- modelVersion
- createdAt
- updatedAt

Types:
- captain
- differential
- transfer_in
- budget_pick
- undervalued
- wildcard

#### Conversation
Fields:
- id
- userId nullable
- message
- answer
- answerJson
- createdAt

#### InsightDocument
For optional retrieval.
Fields:
- id
- gameweekId nullable
- playerId nullable
- title
- content
- embeddingStatus
- sourceType
- createdAt
- updatedAt

#### IngestionRun
Fields:
- id
- source
- status
- startedAt
- completedAt
- recordsProcessed
- errorMessage nullable
- createdAt

---

## Entity Relationships
- Team has many Players
- Gameweek has many Fixtures
- Fixture belongs to one Gameweek
- Fixture belongs to homeTeam and awayTeam
- Player has many MatchStats
- Player has many PlayerMetrics
- Player has many Recommendations
- Gameweek has many Recommendations
- Conversation is independent
- InsightDocument may reference Player and/or Gameweek

---

## Initial Prisma Guidance
When creating the Prisma schema:
- use enums for player position and recommendation type
- add indexes on externalId, gameweekId, playerId, fixtureId
- add unique constraints where appropriate
- support upsert-based ingestion

Potential enums:
- Position: GK, DEF, MID, FWD
- RecommendationType: CAPTAIN, DIFFERENTIAL, TRANSFER_IN, BUDGET_PICK, UNDERVALUED, WILDCARD
- IngestionStatus: PENDING, RUNNING, SUCCESS, FAILED

---

## Recommendation Logic Design

### General principle
Recommendations must come from a scoring engine first, then optionally be explained by AI.

### Example scores

#### Form score
Potential inputs:
- fantasy points last 3/5 matches
- xG + xA trend
- minutes trend
- shot involvement

#### Fixture score
Potential inputs:
- opponent defensive rank
- home vs away
- clean sheet odds / attack odds if available
- fixture difficulty rating

#### Differential score
Potential inputs:
- upside score
- low ownership
- strong short-term fixtures

#### Value score
Potential inputs:
- projected points / price
- recent output / price

#### Captaincy score
Potential inputs:
- projected points
- minutes security
- xG/xA involvement
- fixture quality
- penalty duty flag if data exists

### Implementation guidance
Create a dedicated service in backend:
- `RecommendationEngineService`

Responsibilities:
- compute candidate pool
- calculate weighted scores
- produce sorted results
- persist recommendations

Keep formulas transparent and easy to tweak.
Document formulas in code comments and docs.

---

## AI System Design

### Purpose of the LLM
The LLM is **not** the source of truth.
It is a reasoning and explanation layer.

### The LLM should do these tasks
- compare two or more players
- explain why a recommendation makes sense
- summarize tradeoffs clearly
- respond to a user question in natural language
- communicate confidence and uncertainty
- produce concise fantasy-strategy narratives

### The LLM should not do these tasks by itself
- fetch canonical data directly without tools
- invent player metrics
- rank players from memory
- create facts without structured context

---

## AI Tools the Agent Should Have
In the Python AI service, implement explicit tools such as:

1. `get_player_profile(player_name_or_id)`
2. `get_player_recent_stats(player_id, last_n=5)`
3. `get_player_metrics(player_id, gameweek_id)`
4. `compare_players(player_a_id, player_b_id, gameweek_id)`
5. `get_top_captains(gameweek_id, limit=5)`
6. `get_top_differentials(gameweek_id, limit=5)`
7. `get_transfer_targets(gameweek_id, budget=None, position=None)`
8. `get_fixture_context(player_id, next_n_fixtures=3)`
9. `search_insight_documents(query)` for optional retrieval
10. `save_analysis_artifact(...)` optionally

These tools should be deterministic wrappers around backend data or direct DB/service access.

---

## AI Flow for Key Query Types

### Query type: captain decision
Example:
> Should I captain Haaland or Salah this week?

Flow:
1. identify entities
2. fetch metrics for both players
3. fetch next fixture context
4. compare projected points, form, fixture quality, minutes security
5. LLM writes decision with reasons
6. output structured result with confidence

### Query type: undervalued picks
Example:
> Which players are undervalued this week?

Flow:
1. fetch candidate players
2. filter by price and value score
3. rank by value + upside + fixture score
4. LLM summarizes top picks with reasons

### Query type: best differential
Example:
> What are the best differentials this week?

Flow:
1. find low ownership players above a threshold score
2. rank by differential score
3. return top candidates with justification

### Query type: transfer advice
Example:
> Who should I buy for the next 3 gameweeks under 8.0?

Flow:
1. detect constraints
2. query metrics and fixtures
3. rank by projected short-term output + value + minutes security
4. LLM presents shortlist and tradeoffs

---

## AI API Contract
The AI service should return structured responses.

### Example response shape
```json
{
  "queryType": "captain_decision",
  "answer": "I would captain Erling Haaland this week.",
  "confidence": 0.78,
  "reasoning": [
    "He has the higher projected points over the next fixture.",
    "His recent xG trend is stronger.",
    "The opponent has a weaker defensive profile."
  ],
  "entities": {
    "players": ["Erling Haaland", "Mohamed Salah"],
    "gameweek": 30
  },
  "dataPoints": {
    "haalandProjectedPoints": 8.4,
    "salahProjectedPoints": 6.9
  },
  "sources": [
    "player_metrics",
    "fixtures",
    "player_recent_stats"
  ]
}
```

---

## NestJS API Design

### Health
- `GET /health`

### Players
- `GET /players`
- `GET /players/:id`
- `GET /players/:id/stats`
- `GET /players/:id/metrics?gameweek=30`
- `GET /players/search?q=salah`

### Teams
- `GET /teams`
- `GET /teams/:id`

### Fixtures
- `GET /fixtures`
- `GET /fixtures/:id`
- `GET /gameweeks/current`
- `GET /gameweeks/:id/fixtures`

### Recommendations
- `GET /recommendations/captains?gameweek=30`
- `GET /recommendations/differentials?gameweek=30`
- `GET /recommendations/transfers?gameweek=30&budget=8.0&position=MID`
- `POST /recommendations/recompute?gameweek=30`

### Comparisons
- `POST /comparisons/players`

Example request:
```json
{
  "playerAId": 101,
  "playerBId": 205,
  "gameweek": 30
}
```

### Conversations / AI
- `POST /ai/query`
- `POST /ai/explain-recommendation`
- `GET /conversations`
- `GET /conversations/:id`

### Admin / ingestion
- `POST /ingestion/bootstrap`
- `POST /ingestion/sync/players`
- `POST /ingestion/sync/fixtures`
- `POST /ingestion/sync/stats`
- `GET /ingestion/runs`

---

## Authentication Guidance
For MVP:
- auth is optional
- can keep public read endpoints
- can omit login initially

For stronger version:
- add simple JWT auth
- support saved conversations, watchlists, and user preferences

Recommendation:
- do **not** block MVP with auth
- add auth only after the core recommendation + AI flow works

---

## Example API Response Shapes

### GET /recommendations/captains?gameweek=30
```json
{
  "gameweek": 30,
  "type": "captain",
  "items": [
    {
      "playerId": 1,
      "playerName": "Erling Haaland",
      "team": "Manchester City",
      "score": 91.2,
      "confidence": 0.81,
      "projectedPoints": 8.4,
      "reasons": [
        "Strong recent xG trend",
        "Favorable home fixture",
        "High minutes security"
      ]
    }
  ]
}
```

### POST /ai/query
Request:
```json
{
  "message": "Which midfielders under 8.0 are the best differentials this week?",
  "gameweek": 30
}
```

Response:
```json
{
  "answer": "The best midfield differential options under 8.0 this week are ...",
  "confidence": 0.74,
  "queryType": "differential_search",
  "items": [
    {
      "playerName": "Player X",
      "price": 7.6,
      "ownershipPct": 5.1,
      "differentialScore": 84.2,
      "projectedPoints": 6.1
    }
  ],
  "reasoning": [
    "These players combine low ownership with strong short-term fixture quality.",
    "They also have better upside than similarly priced alternatives."
  ]
}
```

---

## Frontend Scope (Optional)
If frontend is added, keep it intentionally small.

### Pages
- home / landing page
- players page
- recommendations page
- compare players page
- AI chat page

### UI priority
Minimal and polished.
Do not spend too much time on frontend complexity.

### Recommended components
- leaderboard cards
- player comparison table
- recommendation cards
- chat panel
- small fixture / metrics summary blocks

---

## Background Jobs / Schedulers
Recommended jobs:
- daily player sync
- fixture sync
- weekly recommendations recomputation
- metric recomputation
- optional embedding sync for insight documents

Possible implementation:
- NestJS schedule module for MVP
- BullMQ + Redis for stronger version

---

## Caching Strategy
Use cache where it adds value:
- current gameweek
- top recommendations
- player profile lookups
- AI explanations for repeated queries if useful

Can be added in v2.
Do not overcomplicate MVP.

---

## Testing Requirements

### Backend tests
Implement:
- unit tests for recommendation formulas
- unit tests for services
- basic integration tests for key endpoints
- validation tests for DTOs

### AI service tests
Implement:
- tool tests
- response schema tests
- parser tests
- prompt smoke tests where useful

### Minimum recruiter-friendly testing target
The repo should clearly show:
- there is a testing strategy
- critical logic is tested
- the project is not just prompt glue

---

## Logging and Observability
At minimum:
- structured logs for ingestion runs
- logs for AI queries
- logs for recommendation recomputation
- error handling with actionable messages

Optional stronger version:
- request IDs
- timing metrics
- AI latency logs

---

## Deployment Strategy

### Local development
Use Docker Compose to run:
- postgres
- api
- ai-service
- qdrant optional
- web optional

### Production-ish deployment options
Recommended simple choices:
- Railway / Render for API and DB
- Fly.io for services
- Vercel for web

Do not over-optimize deployment early.

---

## MVP Scope (3–5 days)
Goal: deliver a convincing working system quickly.

### MVP must include
1. monorepo scaffold
2. NestJS API scaffold
3. Prisma schema + PostgreSQL
4. seed/demo data or ingestion from one sports API
5. players/teams/fixtures endpoints
6. recommendation engine with captain + differentials
7. Python AI service with one or two endpoints
8. `/ai/query` endpoint that answers at least captain and differential questions
9. Swagger docs
10. strong README

### MVP should avoid
- full auth
- complex frontend
- too many data sources
- too much infra complexity

---

## Strong Version Scope (1–2 weeks)
After MVP, add:
- transfer recommendation engine
- saved weekly analyses
- retrieval over insight documents
- conversation persistence
- compare players endpoint + AI explanation
- Redis queue for recomputation
- CI pipeline
- deployed demo
- screenshots / walkthrough video

---

## Future Extensions
- team optimizer
- wildcard planner
- chip strategy simulator
- betting EV module
- tennis fantasy adaptation
- Bayesian / ML point projection model
- Monte Carlo simulation for expected outcomes
- user-specific team personalization

---

## README Requirements
The final README must include:

1. strong title
2. project one-liner
3. why this project exists
4. system architecture diagram
5. core features
6. tech stack
7. how the recommendation engine works
8. how the AI system works
9. local setup steps
10. API endpoints summary
11. screenshots or demo GIFs
12. recruiter-facing section: “Why this project is interesting”

### README tone
- polished
- concise but technical
- product-minded
- impressive to recruiters without sounding inflated

---

## Documentation Requirements
Generate these docs gradually in `/docs`:

### `architecture.md`
Should describe:
- system components
- communication patterns
- why hybrid AI architecture was chosen

### `data-model.md`
Should describe:
- entities
- relationships
- indexing decisions
- why metrics are stored separately

### `api-design.md`
Should describe:
- endpoint groups
- request/response conventions
- AI endpoint behavior

### `ai-system.md`
Should describe:
- tool-based architecture
- LLM responsibilities vs deterministic services
- why this is not pure RAG

### `roadmap.md`
Should describe:
- MVP
- strong version
- future features

---

## How Copilot Should Work With Me
When helping me build this project, follow this working style:

1. Always propose the next implementation step clearly.
2. Prefer small, shippable increments.
3. Before generating a large file, state what it will contain.
4. When creating architecture-critical code, include a brief rationale.
5. If there are multiple options, recommend one and explain why in 2–4 bullets.
6. Keep code ready to run.
7. Avoid fake placeholders unless absolutely necessary.
8. If a dependency or API is uncertain, mark it explicitly.
9. If the codebase risks becoming overengineered, simplify.
10. Prioritize developer experience and readability.

---

## Delivery Order
Build the project in this order unless I explicitly change it:

### Phase 1 — bootstrap
1. initialize monorepo structure
2. create NestJS app
3. create Python AI service
4. create Docker Compose with postgres
5. create `.env.example`
6. create Prisma schema
7. run initial migration

### Phase 2 — domain model
1. teams module
2. players module
3. gameweeks module
4. fixtures module
5. stats module
6. seed / ingestion bootstrap

### Phase 3 — recommendation engine
1. metrics service
2. captain score
3. differential score
4. value score
5. recommendation persistence
6. recommendations endpoints

### Phase 4 — AI integration
1. AI service endpoint
2. tools for player stats and recommendations
3. AI query orchestration
4. `/ai/query` endpoint in backend
5. structured AI response schema

### Phase 5 — polish
1. Swagger improvements
2. tests
3. docs
4. CI
5. README
6. optional minimal frontend

---

## First Tasks To Execute
Start with these exact tasks:

### Task 1
Create the monorepo folder structure and baseline config files.

### Task 2
Scaffold a NestJS API app in `apps/api` with modules for:
- health
- players
- teams
- fixtures
- recommendations
- ai
- ingestion
- prisma

### Task 3
Create a Python FastAPI app in `apps/ai-service` with:
- health endpoint
- `/analyze` endpoint placeholder
- Pydantic schemas
- modular folders

### Task 4
Create `docker-compose.yml` with:
- postgres
- api
- ai-service

### Task 5
Create Prisma schema for:
- Team
- Player
- Gameweek
- Fixture
- MatchStat
- PlayerMetric
- Recommendation
- Conversation
- IngestionRun

### Task 6
Create an initial seed script with demo fantasy data if no external API is yet connected.

---

## Coding Preferences
Use these preferences when generating code:
- language: TypeScript for backend, Python for AI
- package manager: pnpm preferred if easy, otherwise npm
- ORM: Prisma
- validation: class-validator in NestJS
- API docs: Swagger
- style: clean enterprise-style but not overengineered
- tests: Jest for NestJS, pytest for Python if tests added
- comments: brief and useful, not verbose

---

## Non-Goals
Do not spend time on these early:
- full fantasy team optimizer
- advanced auth flows
- payment systems
- excessive UI polish
- event sourcing
- microservices beyond what is useful
- overly generic abstractions
- “AI magic” without structured grounding

---

## Recruiter Optimization Checklist
Use this checklist while building:
- Does this show backend depth?
- Does this show AI systems thinking?
- Does this show data modeling skill?
- Does this show API design quality?
- Does this show production-minded engineering?
- Does this show more than “I used OpenAI once”?
- Does this make for strong GitHub screenshots and README sections?

If not, improve the implementation.

---

## Resume / Interview Framing
The final project should support bullets like:
- Designed and built a hybrid AI-powered fantasy football intelligence platform using NestJS, PostgreSQL, Prisma, and a Python AI service.
- Implemented recommendation pipelines for captaincy, transfer targets, and differential picks using structured player metrics and fixture analysis.
- Built a tool-based LLM analysis layer that converted structured sports analytics into explainable natural-language recommendations.
- Architected a production-style backend with modular APIs, scheduled ingestion workflows, containerized local development, and documented system design.

Keep this framing in mind when generating code and docs.

---

## Final Instruction
Do not start by generating everything at once.
Start by scaffolding the repo cleanly and then build module by module.
At each step, prefer code that can actually run.

When I ask for the next step, continue from the current state of the repository instead of restarting.
