# Ultravox Agent Management Guide

Manual playbook for monitoring, analyzing, and patching Ultravox agents outside the Voxray dashboard (Claude Code sessions, scripts, cron checks).

---

## Agent Registry

| Name | Agent ID | Voice |
|------|----------|-------|
| Cold_Outreach_AI | `74c435db-0382-45d4-8f84-65343c0dde5f` | `24095dd2-27c8-4577-89b0-eed6ffb7a3d6` |
| Sales_AI | `65ae3d7d-5a1f-4880-89f4-1ce690efae89` | `73388de4-bc36-4730-b4f1-5b88d12dc1f8` |
| Debt-Collector-Agent-UG | `52db715f-fc68-4265-a354-7f64a27cd3b9` | `73388de4-bc36-4730-b4f1-5b88d12dc1f8` |
| earth_inbound | `10d50547-...` | — |
| edifice_inbound | `67437eda-...` | — |
| nectar_inbound | `24d36589-...` | — |
| fakhruddin_inbound | `6815a11f-...` | — |
| beforward_inbound | `2d72dadf-...` | — |

---

## ⚠️ PATCHING RULE — READ BEFORE EVERY PATCH

**ALWAYS spread the full `callTemplate`. Never send only `systemPrompt`.**

Sending `{"callTemplate": {"systemPrompt": ...}}` **permanently wipes** voice, model, tools, temperature, VAD settings, languageHint, recordingEnabled, inactivityMessages, joinTimeout from the agent.

The Voxray app (`apply-fix/route.ts` lines 132-137) enforces this:
```js
const patchBody = {
  callTemplate: {
    ...agent.callTemplate,   // spread ALL existing fields
    systemPrompt: newPrompt, // only override this one
  },
};
```

**Python equivalent (mandatory pattern for all manual patches):**
```python
import json, urllib.request

API_KEY = "..."
BASE = "https://api.ultravox.ai/api"

# Step 1 — GET and SAVE full agent BEFORE touching anything
req = urllib.request.Request(f"{BASE}/agents/{agent_id}", headers={"X-API-Key": API_KEY})
with urllib.request.urlopen(req) as r:
    agent = json.loads(r.read())

# (optional) save to disk as backup
with open(f"/tmp/{agent_id[:8]}_backup.json", "w") as f:
    json.dump(agent, f)

# Step 2 — Build new prompt (find/replace only)
old_text = "exact text to find"
new_text = "replacement text"
current_prompt = agent["callTemplate"]["systemPrompt"]

if old_text not in current_prompt:
    print("ERROR: find text not in prompt — abort")
    exit(1)

new_prompt = current_prompt.replace(old_text, new_text, 1)

# Step 3 — PATCH with FULL callTemplate spread
patch_body = {
    "callTemplate": {
        **agent["callTemplate"],   # spread ALL existing fields
        "systemPrompt": new_prompt # only override systemPrompt
    }
}

patch_data = json.dumps(patch_body).encode()
req = urllib.request.Request(
    f"{BASE}/agents/{agent_id}",
    data=patch_data,
    headers={"X-API-Key": API_KEY, "Content-Type": "application/json"},
    method="PATCH"
)
with urllib.request.urlopen(req) as r:
    result = json.loads(r.read())

# Step 4 — Verify all critical fields survived
ct = result["callTemplate"]
assert ct.get("voice"), "VOICE WIPED"
assert ct.get("model"), "MODEL WIPED"
assert len(ct.get("selectedTools", [])) > 0, "TOOLS WIPED"
print(f"Patch OK — prompt now {len(ct['systemPrompt'])} chars")
print(f"  voice={ct['voice']}, model={ct['model']}, tools={len(ct['selectedTools'])}")
```

---

## Routine Checkup Protocol

Run at least 3x/week. Covers all 3 main prod agents.

### 1. Fetch calls

```python
# Fetch 300 calls (6 pages × 50), group by agentId
all_calls = []
url = f"{BASE}/calls?pageSize=50"
for _ in range(6):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"X-API-Key": API_KEY})) as r:
        data = json.loads(r.read())
    all_calls.extend(data["results"])
    if not data.get("next"): break
    url = data["next"]  # next is a FULL URL, not a cursor token
```

Note: `agentId` filter on `/calls` does NOT work — fetch all, filter manually by `c["agentId"]`.

### 2. Filter substantive calls (>30s billed duration)

```python
import re
def dur_secs(s):
    m = re.match(r"(\d+)s", str(s or ""))
    return int(m.group(1)) if m else 0

substantive = [c for c in calls if dur_secs(c.get("billedDuration")) > 30]
```

### 3. Fetch messages

```python
def get_messages(call_id):
    req = urllib.request.Request(f"{BASE}/calls/{call_id}/messages", headers={"X-API-Key": API_KEY})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read()).get("results", [])

# Use .get("text", "") not ["text"] — some message types lack text field
agent_msgs = [m.get("text","") for m in msgs if m.get("role") == "MESSAGE_ROLE_AGENT"]
user_msgs  = [m.get("text","") for m in msgs if m.get("role") == "MESSAGE_ROLE_USER"]
```

### 4. Error taxonomy

| Error type | Signal |
|-----------|--------|
| `wrong_opening` | Agent says "Am I speaking to..." in cold outreach |
| `clarification_as_rejection` | "What?" / "Pardon?" → agent offers callback |
| `semantic_misread` | Single-word answer read as rejection (e.g. "Apartment" → not interested) |
| `non_engagement_loop` | 3+ consecutive non-answers, agent keeps looping same question |
| `identity_misconfirmation` | Caller uses wrong name, agent confirms it |
| `ai_denial` | Caller says "you're a robot", agent says "I'm a real person" |
| `caller_cant_hear` | Customer says bad signal, agent continues pushing |
| `data_answer_validation` | Vague answer accepted as specific (e.g. "good" as a time) |
| `premature_exit` | Agent exits without saveAnswers |

---

## Diff/Approval Flow

**Always show BEFORE → AFTER diff and wait for explicit "yes/yup/go ahead" before patching.**

Never apply a patch without operator approval. Show exact OLD text and NEW text.

---

## Pagination Note

`/calls` `next` field is a **full URL**, not a cursor. Use it directly:
```python
url = data["next"]  # correct
# NOT: url = f"{BASE}/calls?cursor={data['next']}"  # WRONG
```

---

## Prompt Size Safety

Context window: 128k tokens. Practical safe zone: under 200k chars (~50k tokens, ~39%).

| Agent | Chars | % of 128k token window |
|-------|-------|----------------------|
| Sales_AI | ~57k | ~11% |
| Cold_Outreach_AI | ~45k | ~9% |
| Debt-Collector-Agent-UG | ~49k | ~10% |
| nectar_inbound | ~78k | ~16% (largest — monitor) |

If any agent exceeds 200k chars → compress before adding new rules.

---

## Tool Behavior Deep-Dive

### Tool Reaction Modes

Every tool on Ultravox has a reaction type that controls what the agent does while the tool runs:

| Reaction | Behavior | Use when |
|----------|----------|----------|
| `AGENT_REACTION_LISTENS` (default) | Agent waits silently for tool to return | Tool result needed before agent can speak |
| `AGENT_REACTION_SPEAKS` | Agent generates a response turn immediately, tool runs in parallel | Tool result not needed for next agent turn (e.g. getDateTime — agent can keep talking) |

**Critical:** `AGENT_REACTION_SPEAKS` causes an extra empty agent turn in the message log. That's expected — don't mistake it for a bug.

### staticResponse

When set on a tool, Ultravox fires the HTTP webhook **fire-and-forget** and returns `responseText` to the agent immediately — never waits for webhook response.

```json
{
  "toolId": "...",
  "nameOverride": "saveAnswers",
  "staticResponse": "Answers saved. Continue with call flow."
}
```

Use for `saveAnswers`/`saveDebt` if you want zero latency at call end. Agent gets instant "saved" signal and can proceed to hangUp without waiting for your backend.

**Downside:** You lose any data the webhook would have sent back. Fine for save tools since the agent doesn't need the response — it just needs acknowledgment.

### precomputable: false

Prevents Ultravox from calling the tool at call initialization. Without this, Ultravox may call tools it thinks can be precomputed (e.g. `getDateTime`) before the first user turn.

```json
{ "precomputable": false }
```

**Always set this on `getDateTime`.** Without it, the agent calls it at message 1 before the caller even speaks — wastes a tool call and confuses the transcript.

### endBehavior on inactivityMessages

`END_BEHAVIOR_HANG_UP_SOFT` on an inactivity message ends the call immediately after the message plays. The model **never gets a turn** — meaning saveAnswers/saveDebt is never called.

```json
// BAD — agent can't save before hangup
{ "duration": "20s", "message": "Our team will follow up shortly.", "endBehavior": "END_BEHAVIOR_HANG_UP_SOFT" }

// GOOD — remove endBehavior, handle in prompt instead
{ "duration": "20s", "message": "Since I have not received a response, our team will follow up with you shortly. Thank you." }
// Then in prompt: "If inactivity timeout → call saveAnswers with call_status='no_response' → then call hangUp"
```

### Tool nameOverride

`nameOverride` sets the name the model sees and uses in function calls. Always set it — don't leave tool with its internal Ultravox name.

```json
{
  "toolId": "461f7f18-...",
  "nameOverride": "saveAnswers",
  "descriptionOverride": "Stores answers collected from dynamic question intake..."
}
```

If Ramco Gas/inbound agent shows `hangUp_1` / `saveAnswers_1` — that means the tool was added twice and Ultravox auto-suffixed. Fix: remove duplicate, keep one with clean nameOverride.

### Reading Tool Calls in Message Logs

`toolName` is a **top-level field** on the message object, NOT inside the `text` JSON:

```python
# CORRECT
for msg in msgs:
    if msg.get("role") == "MESSAGE_ROLE_TOOL_CALL":
        print(msg.get("toolName"))  # top-level

# WRONG — this field doesn't exist inside text
text = json.loads(msg.get("text", "{}"))
print(text.get("toolName"))  # always None
```

Message roles:
- `MESSAGE_ROLE_AGENT` — agent speech turn
- `MESSAGE_ROLE_USER` — caller speech turn
- `MESSAGE_ROLE_TOOL_CALL` — agent calling a tool
- `MESSAGE_ROLE_TOOL_RESULT` — tool response returned

---

## Inbound Agent Configuration

### Standard Template for New Inbound Agents

```bash
curl -X POST "https://api.ultravox.ai/api/agents" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
  "name": "companyname_inbound",
  "callTemplate": {
    "systemPrompt": "PASTE_FULL_PROMPT_HERE",
    "model": "ultravox-v0.7",
    "voice": "24095dd2-27c8-4577-89b0-eed6ffb7a3d6",
    "languageHint": "en-UG",
    "temperature": 0.4,
    "maxDuration": "3600s",
    "recordingEnabled": true,
    "firstSpeakerSettings": { "agent": { "text": "Thank you for calling COMPANY NAME, how can I help you today?" } },
    "vadSettings": { "turnEndpointDelay": "0.400s", "minimumInterruptionDuration": "0.800s" },
    "inactivityMessages": [
      { "duration": "10s", "message": "Hello, are you there?" },
      { "duration": "20s", "message": "Since I have not received a response, our team will follow up with you shortly. Thank you." }
    ],
    "selectedTools": [
      { "toolId": "1aa4feb7-5e11-42ab-add0-957680e0973d", "nameOverride": "getDateTime", "descriptionOverride": "Returns current date (YYYY-MM-DD), day, and time (HH:MM 24hr) in Kampala EAT (UTC+3). Call ONLY when caller mentions relative date/time (tomorrow, next week, next Monday). Never call at start." },
      { "toolId": "56294126-5a7d-4948-b67d-3b7e13d55ea7", "nameOverride": "hangUp", "descriptionOverride": "Ends the current call once completed." },
      { "toolId": "461f7f18-8385-44d9-b1b6-8eb0fc36780a", "nameOverride": "saveAnswers", "descriptionOverride": "Stores answers collected during inbound call. Supports partial completion." }
    ]
  }
}'
```

**Tool IDs (production):**
| Tool | ID |
|------|----|
| getDateTime v3 | `1aa4feb7-5e11-42ab-add0-957680e0973d` |
| hangUp | `56294126-5a7d-4948-b67d-3b7e13d55ea7` |
| saveAnswers | `461f7f18-8385-44d9-b1b6-8eb0fc36780a` |
| saveDebt | `52db715f-...` (debt agents only) |

### firstSpeakerSettings

For inbound agents, **always hardcode the greeting** in `firstSpeakerSettings.agent.text`. Do NOT let the model generate the first greeting from the systemPrompt — it causes inconsistency and sometimes the model skips it.

```json
"firstSpeakerSettings": { "agent": { "text": "Thank you for calling Shell Gas Uganda, how can I help you today?" } }
```

The systemPrompt for inbound should start STEP 1 with **"Greeting already spoken. Ask for caller's name."** Not a scripted greeting.

### VAD Settings

Steal these from Sales_AI — they're tuned for Uganda callers:
```json
"vadSettings": {
  "turnEndpointDelay": "0.400s",
  "minimumInterruptionDuration": "0.800s"
}
```

- `turnEndpointDelay`: How long silence before agent takes turn. 0.4s is natural without being twitchy.
- `minimumInterruptionDuration`: Caller must speak for at least 0.8s to interrupt agent. Prevents background noise cutting agent off mid-sentence.

---

## Prompt Engineering Learnings

### The Two-TTS-Turn Problem (Late Call Ending)

**Symptom:** Call ends 8–12s after caller says goodbye. Dead air at end.

**Root cause:** Two sequential blocking events:
1. Agent says pre-close acknowledgment ("Perfect, I have everything I need!")
2. saveAnswers tool fires (blocking HTTP round-trip, waits for webhook)
3. Agent says closing ("Thank you for calling, goodbye!")
4. hangUp tool fires (another blocking round-trip)

Total: ~4s for two blocking saves + ~4s for two TTS turns = ~8-12s dead air.

**Fix:** Remove pre-close acknowledgment speech entirely. Go directly from data collection → saveAnswers → closing in one move. Example:

```
❌ BAD:
STEP 7: "Perfect, I have everything I need. Let me save your details."
STEP 8: Call saveAnswers.
STEP 9: "Thank you for calling COMPANY, have a great day!" then hangUp.

✅ GOOD:
STEP 7: Call saveAnswers. While it processes, say: "Thank you for calling COMPANY, our team will follow up shortly. Have a great day!"
STEP 8: Call hangUp.
```

Or use `staticResponse` on saveAnswers so it returns instantly and the blocking round-trip is eliminated.

### Conditional Steps with Template Variables

If a step should only run when a template variable has content, add an explicit guard:

```
STEP 4 — QUALIFICATION (only if QUALIFICATION_QUESTIONS is non-empty):
If {{QUALIFICATION_QUESTIONS}} is empty or not provided, skip STEP 4 and proceed directly to STEP 5.
```

Without the guard, the agent will try to "qualify" the caller even when there are no questions, either making them up or awkwardly skipping.

### getDateTime — On-Demand Only

**Never** write a prompt rule like "call getDateTime silently before calling saveAnswers." This creates a contradictory instruction with "don't call at start." The model follows whichever instruction is last or most prominent — usually the wrong one.

**Correct pattern:**
```
Use the getDateTime tool ONLY when the caller mentions a relative date or time 
(e.g. "tomorrow", "next Monday", "next week"). Use the result to resolve the 
exact date for call_date and call_time fields in saveAnswers.
Do NOT call getDateTime at the start of the call.
Do NOT call getDateTime for any other reason.
```

If you need current date/time statically (not from caller), use template variables `{{current_date}}` and `{{current_time}}` injected at call creation — no tool call needed.

### Inactivity Handling

With `END_BEHAVIOR_HANG_UP_SOFT` removed from the 20s inactivity message, the model gets a turn after the message plays. Add this rule to the prompt's EARLY EXIT section:

```
Caller unresponsive / inactivity timeout → call saveAnswers with:
  call_status = "no_response"
  is_lead = false
  interest = "cold"
  lead_score = 1
  client_name = whatever was collected (null if none)
  all other fields = null
Then call hangUp immediately.
```

### No Contradictions in Tool Instructions

Common trap: writing one rule that says "don't call X at start" and another rule that says "always call X before step Y." The model can't resolve this. Always make one rule win clearly.

Bad: "Don't call getDateTime at the start" + "Call getDateTime silently before saving."
Good: "Call getDateTime ONLY when caller says a relative date. No other time."

### Prompt Rule for Robustness

Before adding any new rule, ask:
1. Does this contradict an existing rule? (Search prompt for keywords)
2. Is there an edge case where both rules fire at once?
3. Can the model satisfy both rules simultaneously, or does it have to choose?

If the model has to choose → rewrite to eliminate the ambiguity.

---

## requestContext Variables

| Variable | Source |
|---------|--------|
| `{{agent_name}}` | Set per-campaign. If empty → agent must use hardcoded fallback name |
| `{{company_name}}` | Business name |
| `{{product_or_service}}` | What's being sold/offered |
| `{{offer_statement}}` | The pitch line |
| `{{call_type}}` | `"marketing"` = cold outreach, `"outbound"` = treat same as marketing, empty = inbound |
| `{{time}}` | morning/afternoon/evening |
| `{{country_name}}` | e.g. Uganda |
