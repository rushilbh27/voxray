# Product Requirements Document: Voxray

## Executive Summary

**Product Name:** Voxray  
**Tagline:** X-ray vision for your voice agents  
**Version:** 1.0  
**Target Launch:** 2 weeks from start  
**Built By:** Rushil Bhor (@rushilbhor)

**One-Liner:** Production observability and debugging dashboard for Ultravox voice agents, built on real client data from Uganda deployments (100+ calls/day).

**Strategic Goal:** Build impressive portfolio project to secure $120-200K job at AI infrastructure company (Ultravox, Anthropic, LangChain, voice AI startups).

---

## Problem Statement

### Current Pain Points

1. **No Visibility into Production Voice Agents**
   - Uganda clients (Ramco Gas, Edifice Properties, Davansh Investment) have voice agents in production
   - 100+ calls/day happening with zero observability
   - When calls fail, no way to debug why
   - No insights into agent performance trends

2. **Manual Debugging is Painful**
   - Must manually listen to recordings to find issues
   - Can't identify patterns across many calls
   - No way to track which agents/clients have highest failure rates
   - Cost tracking is manual

3. **No Client-Specific Insights**
   - Each Uganda business needs to see their own metrics
   - Currently sending manual reports
   - No self-serve dashboard for clients

---

## Target Users

### Primary User: Rushil (Developer/Operator)
- **Needs:** Debug failing calls, understand agent performance, optimize costs
- **Use Case:** "Agent failed on 15 calls today - why? What pattern caused this?"

### Secondary User: Uganda Clients (Ramco Gas, Edifice, Davansh)
- **Needs:** See their call success rates, understand customer interactions, justify ROI
- **Use Case:** "How many successful sales calls did we have this week?"

### Tertiary User: Hiring Managers (Future Audience)
- **Needs:** See production-grade observability system with real data
- **Use Case:** "This candidate has built and operated voice AI in production"

---

## Core Features (MVP - 2 Weeks)

### Week 1: Foundation

#### Feature 1.1: Live Call Feed
**Priority:** P0 (Must Have)

**User Story:** As an operator, I want to see all calls in real-time so I can monitor system health.

**Requirements:**
- Display last 100 calls in reverse chronological order
- Show: call_id, agent_id, status, duration, timestamp
- Color-coded status: green (success), red (failed), yellow (in progress)
- Auto-refresh every 30 seconds
- Filter by: date range, client name, status

**Acceptance Criteria:**
- Dashboard shows Uganda production calls within 30 seconds of completion
- Can filter to see only "Ramco Gas" calls
- Can filter to see only "failed" calls

#### Feature 1.2: High-Level Metrics
**Priority:** P0 (Must Have)

**User Story:** As an operator, I want to see overall system health at a glance.

**Requirements:**
- Display cards showing:
  - Total calls (today)
  - Success rate percentage
  - Total cost (USD)
  - Average call duration
  - Active calls (right now)
- Update in real-time

**Acceptance Criteria:**
- Metrics match actual Ultravox API data
- Success rate correctly calculated as (successful calls / total calls)
- Cost calculated based on Ultravox pricing ($0.05/min)

#### Feature 1.3: Call Detail View
**Priority:** P0 (Must Have)

**User Story:** As an operator, I want to see exactly what happened in a failed call so I can debug it.

**Requirements:**
- Click any call → opens detail page
- Shows:
  - Full transcript (agent messages + user messages)
  - Timeline visualization
  - Tool calls made (if any)
  - Error messages (if failed)
  - Audio recording link
  - Metadata (duration, cost, timestamps)

**Acceptance Criteria:**
- Transcript shows all messages in order
- Can play audio recording
- Error messages are prominently displayed

### Week 2: Intelligence Layer

#### Feature 2.1: Call Analysis Integration
**Priority:** P0 (Must Have)

**User Story:** As an operator, I want to see AI-powered insights on each call so I understand quality issues.

**Requirements:**
- Integrate existing call analysis pipeline
- For each call, display:
  - Agent performance score (0-10)
  - Customer sentiment (positive/neutral/negative)
  - Issues detected (e.g., "agent interrupted", "poor audio quality")
  - Suggested improvements
- Store analysis results in Supabase

**Acceptance Criteria:**
- Analysis runs automatically for each completed call
- Insights display in call detail view
- Can filter calls by sentiment or score

#### Feature 2.2: Error Categorization
**Priority:** P0 (Must Have)

**User Story:** As an operator, I want to understand why calls fail so I can fix systemic issues.

**Requirements:**
- Categorize Ultravox errors into buckets:
  - Tool failures
  - VAD timeouts
  - User hang-ups
  - Agent errors
  - System errors
- Show error breakdown chart
- List common error patterns

**Acceptance Criteria:**
- Pie chart shows error distribution
- Can click error type to see all calls with that error
- Top 5 errors prominently displayed

#### Feature 2.3: Client Dashboards
**Priority:** P1 (Should Have)

**User Story:** As a Uganda client, I want to see my business metrics without developer help.

**Requirements:**
- URL format: `/client/ramco-gas`
- Shows client-specific metrics:
  - Calls this week
  - Success rate trend
  - Peak calling times
  - Top issues
- Exportable report (PDF)

**Acceptance Criteria:**
- Ramco Gas dashboard shows only Ramco calls
- Metrics accurate for 7-day rolling window
- Can generate shareable report

---

## Non-Goals (Not in MVP)

❌ **Auto-fixing agents** - No PATCH API calls to modify production agents  
❌ **Real-time alerts** - No Slack/email notifications (Phase 2)  
❌ **Multi-user auth** - Single dashboard for Rushil only  
❌ **A/B testing framework** - No prompt experimentation (Phase 2)  
❌ **Custom agent builder** - Not building agent creation UI  

---

## Technical Architecture

### Tech Stack
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend:** Next.js API routes, Ultravox REST API
- **Database:** Supabase (PostgreSQL)
- **Hosting:** Vercel (free tier)
- **Charts:** Recharts

### Data Flow

```
Ultravox Production Agents (Uganda)
         ↓
   Ultravox API
         ↓
Sync Script (runs every 5 min)
         ↓
   Supabase Database
         ↓
   Next.js Dashboard
         ↓
      Browser
```

### Database Schema

See `TECHNICAL_SPEC.md` for complete schema.

---

## Success Metrics

### For Portfolio/Hiring
- ✅ Dashboard deployed and working with real data
- ✅ 2-minute demo video showing live production calls
- ✅ GitHub repo with clean README
- ✅ Blog post: "Building Production Observability for Ultravox Agents"
- ✅ 100-500 GitHub stars (if HN launch goes well)
- ✅ 3-5 companies reach out for interviews

### For Product
- ✅ Syncs 100% of Uganda production calls
- ✅ Call detail pages load in <2 seconds
- ✅ Success rate calculation matches Ultravox data
- ✅ Zero data loss (all calls stored)

---

## Timeline & Milestones

### Day 0 (Tonight)
- [ ] Ultravox API connected
- [ ] First call sync working
- [ ] Basic dashboard shows data

### Days 1-3
- [ ] Call detail pages
- [ ] Transcript view
- [ ] Tool call visualization

### Days 4-7
- [ ] Call analysis integration
- [ ] Error categorization
- [ ] Charts/graphs

### Days 8-10
- [ ] Client dashboards
- [ ] Polish UI
- [ ] Performance optimization

### Days 11-14
- [ ] Demo video
- [ ] Blog post
- [ ] Launch (HN, Twitter, Reddit)

---

## Open Questions

1. **Q:** Should we fetch call recordings and store them, or just link to Ultravox?  
   **A:** Link only (storage costs too much)

2. **Q:** How far back should we sync historical calls?  
   **A:** Last 30 days is enough

3. **Q:** Should we build mobile-responsive?  
   **A:** Yes, but desktop-first

---

## Appendix

### Ultravox API Endpoints Used

- `GET /api/calls` - List all calls
- `GET /api/calls/{id}` - Get call details
- `GET /api/calls/{id}/messages` - Get transcript
- `GET /api/calls/{id}/tools` - Get tool calls
- `GET /api/calls/{id}/recording` - Get audio URL

### Uganda Clients

1. **Ramco Gas** (Contact: Susan) - LPG gas sales
2. **Edifice Properties** (Contact: Grace) - Real estate sales
3. **Davansh Investment** (Contact: Priya) - Financial services

### Reference Links

- Ultravox Docs: https://docs.ultravox.ai
- Existing call intelligence: Already built by Rushil
- Production deployment: webagents67.vercel.app
