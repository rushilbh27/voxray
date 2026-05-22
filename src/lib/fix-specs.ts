/**
 * Structured fix specs: each error type maps to one or more Find→Replace edits.
 * The `find` string is searched in the CURRENT agent system prompt.
 * If found → show exact patch. If not found → show "Already fixed" badge.
 *
 * Multi-agent support: each error type can have N patches with different find
 * strings targeting different agents. getApplicablePatches() returns only the
 * patches whose find text exists in the current agent's prompt.
 *
 * Verified find strings per agent:
 *   Sales_AI              — accepted_unknown_location, accepted_garbled_audio,
 *                           no_save_answers, no_consultation, stacked_questions,
 *                           skipped_repeat_rule, accepted_past_date,
 *                           accepted_vague_date, broke_promise, wrong_opening,
 *                           restart_loop, no_name_collected, wrong_person_handling,
 *                           wrong_call_type, wrong_info (patch 1)
 *   Debt-Collector-Agent-UG / Debt_Collection_2
 *                         — accepted_past_date, no_save_debt, calculated_balance,
 *                           invented_amount, no_product_context, no_commitment,
 *                           accepted_vague_date (debt patches)
 *   Cold_Outreach_AI      — stacked_questions, skipped_repeat_rule, no_save_answers,
 *                           accepted_garbled_audio (cold patch), wrong_opening (cold),
 *                           pushed_back (cold), no_name_collected (cold),
 *                           restart_loop (cold)
 *   Davansh_Investment_inbound / Edifice_Properties_inbound
 *                         — wrong_info (property patch), no_save_answers (property)
 */

export interface FixPatch {
  label: string;   // e.g. "Add garbled audio counter rule"
  find: string;    // exact text to find in current prompt
  replace: string; // what to replace it with
}

export interface FixSpec {
  patches: FixPatch[];
}

export const FIX_SPECS: Record<string, FixSpec> = {

  accepted_unknown_location: {
    patches: [{
      label: 'Enforce location recognition — reject unclear area names',
      find: `LOCATION ANSWER RULE (CRITICAL):
When you ask "Any area in mind?" and the customer's response
does not clearly name a recognizable neighborhood or area
(Bugolobi, Kira, Kiwatule, Naguru, Nalya, Namugongo, etc.):`,
      replace: `LOCATION ANSWER RULE (CRITICAL — READ EVERY TURN WHEN ASKING ABOUT AREA):
When you ask "Any area in mind?" and the customer's response
does not clearly name a recognizable neighborhood or area
(Bugolobi, Kira, Kiwatule, Naguru, Nalya, Namugongo, Kololo, Ntinda, Muyenga, Bukoto, etc.):

DO NOT guess.
DO NOT infer from context.
DO NOT pick a location on their behalf.
DO NOT accept phonetic approximations or partial matches.

If response sounds like a location but is unclear → still ask for clarification.
If response is noise, background audio, or unrelated → treat as garbled audio.

Say: "I'm sorry... I didn't quite catch that...
which area were you thinking of?..."

CONFUSION LOOP PREVENTION for location:
If the customer has failed to name a clear area TWICE in a row:
Say: "Not a problem at all... uhm... if you're not sure about the area yet,
that's perfectly fine — we can discuss that with our team when they follow up."
Then accept null for that field and move on.`,
    }],
  },

  accepted_garbled_audio: {
    patches: [
      // ── Sales AI ──────────────────────────────────────────────────────────
      {
        label: 'Sales AI — Add garbled audio counter rule (second attempt = exit)',
        find: `Do NOT interpret noise as a valid answer under any circumstances.`,
        replace: `Do NOT interpret noise as a valid answer under any circumstances.

GARBLED AUDIO COUNTER RULE:
If this is the SECOND consecutive unclear response to the SAME question, stop re-asking.
Say: "I'm having trouble hearing you clearly... let me have our team follow up at a better time."
Then call saveAnswers with whatever data was collected and call hangUp immediately.
Do NOT loop on a bad line. Two garbled responses in a row = graceful exit.`,
      },
      // ── Cold Outreach AI ──────────────────────────────────────────────────
      {
        label: 'Cold Outreach — Add garbled audio counter rule (second attempt = exit)',
        find: `Do NOT interpret noise as a valid answer.`,
        replace: `Do NOT interpret noise as a valid answer.

GARBLED AUDIO COUNTER RULE:
If this is the SECOND consecutive unclear response to the SAME question, stop re-asking.
Say: "I'm having trouble hearing you clearly... let me have our team follow up at a better time."
Then call saveAnswers with whatever data was collected and call hangUp immediately.
Do NOT loop on a bad line. Two garbled responses in a row = graceful exit.`,
      },
    ],
  },

  no_save_answers: {
    patches: [
      // ── Sales AI / Cold Outreach ───────────────────────────────────────────
      {
        label: 'Enforce saveAnswers on ALL early exit paths',
        find: `CRITICAL: Do NOT say the closing sentence before saveAnswers returns.
Do NOT call hangUp before saveAnswers returns.
Speaking the closing before saving is a FAILURE.`,
        replace: `CRITICAL: Do NOT say the closing sentence before saveAnswers returns.
Do NOT call hangUp before saveAnswers returns.
Speaking the closing before saving is a FAILURE.

EARLY EXIT RULE — ALL CALL PATHS:
No matter how the call ends — busy, wrong number, not interested, or fully completed —
saveAnswers MUST be called before hangUp. There are NO exceptions.
Busy customer  → save with call_status = "callback_scheduled" then hangUp.
Not interested → save with call_status = "not_interested" then hangUp.
Wrong number   → save with is_lead = false then hangUp.
A call without saveAnswers is complete data loss.`,
      },
      // ── Davansh Investment inbound ────────────────────────────────────────
      {
        label: 'Davansh — Enforce saveAnswers on ALL early exit paths',
        find: `Never call hangUp before saveAnswers.`,
        replace: `Never call hangUp before saveAnswers.

EARLY EXIT RULE — ALL CALL PATHS:
No matter how the call ends — caller hangs up early, wrong number, not interested,
or fully completed — saveAnswers MUST be called before hangUp. No exceptions.
Wrong number       → save with is_lead = false, call_status = "not_interested"
Caller not interested → save with call_status = "not_interested", is_lead = false
Caller busy / asks callback → save with call_status = "callback_scheduled"
A call that ends without saveAnswers is complete data loss.`,
      },
      // ── Edifice Properties inbound ────────────────────────────────────────
      {
        label: 'Edifice — Enforce saveAnswers on ALL early exit paths',
        find: `Never call hangUp before saveAnswers completes successfully.`,
        replace: `Never call hangUp before saveAnswers completes successfully.

EARLY EXIT RULE — ALL CALL PATHS:
No matter how the call ends — caller hangs up early, wrong number, not interested,
or fully completed — saveAnswers MUST be called before hangUp. No exceptions.
Wrong number          → save with is_lead = false, call_status = "not_interested"
Caller not interested → save with call_status = "not_interested", is_lead = false
Caller busy / requests callback → save with call_status = "callback_scheduled"
A call that ends without saveAnswers is complete data loss.`,
      },
    ],
  },

  no_save_debt: {
    patches: [
      // ── Debt-Collector-Agent-UG / Debt_Collection_2 ───────────────────────
      {
        label: 'Debt Collector — Enforce saveDebt on ALL early exit paths',
        find: `✗ You MUST NOT call hangUp before saveDebt`,
        replace: `✗ You MUST NOT call hangUp before saveDebt

EARLY EXIT RULE — ALL CALL PATHS:
Every call path — busy, wrong number, stop-calling request, no commitment, Luganda redirect,
payment confirmed, commitment given — MUST call saveDebt before hangUp. No exceptions.
Busy              → call_status = "callback_scheduled", action = "followup"
Not paying        → action = "escalate", escalation_reason = specific reason
Wrong number      → action = "escalate", escalation_reason = "Wrong number — remove from records"
Stop calling      → call_status = "answered", call_frequency_action = "pause", action = "escalate"
A call that ends without saveDebt is complete data loss — treat as CRITICAL FAILURE.`,
      },
    ],
  },

  no_consultation: {
    patches: [{
      label: 'Make value-add mandatory after Q3 (not skippable)',
      find: `AFTER COLLECTING 3-4 KEY ANSWERS:

Pause and provide relevant suggestions based on their responses.`,
      replace: `AFTER COLLECTING 3-4 KEY ANSWERS (MANDATORY — DO NOT SKIP):

After the customer answers question 3, STOP. Do NOT ask question 4 yet.
Review what you have collected. Use {{context}} to identify 1-2 best matching options.
Share ONE option in 1-2 sentences, then ask a check-in question.
ONLY after the customer responds do you continue to question 4.
Skipping this value-add and going straight to question 4 is a violation.`,
    }],
  },

  stacked_questions: {
    patches: [{
      label: 'Add self-correction rule for stacked questions',
      find: `✓ Ask ONLY ONE QUESTION AT A TIME`,
      replace: `✓ Ask ONLY ONE QUESTION AT A TIME — if you catch yourself combining two questions into one sentence, stop mid-sentence and say "Uhm, sorry — let me take that one at a time..." then re-ask only the first question`,
    }],
  },

  skipped_repeat_rule: {
    patches: [{
      label: 'Strengthen confusion handling — make advancing a named violation',
      find: `1. Repeat the EXACT last sentence or question you just said — word for word
2. Do NOT advance to the next question
3. Do NOT assume an answer was given
4. Do NOT summarize or paraphrase — repeat it exactly`,
      replace: `1. Repeat the EXACT last sentence or question you just said — word for word
2. Do NOT advance to the next question
3. Do NOT assume an answer was given
4. Do NOT summarize or paraphrase — repeat it exactly

CONFUSION = FULL STOP.
The only valid next output is the exact sentence you just said — same words, same order.
Advancing to a new question after confusion is a CRITICAL VIOLATION.
Even if you think the customer understood — if they said sorry/pardon/huh, repeat first.`,
    }],
  },

  accepted_past_date: {
    patches: [{
      // Works for both Sales AI and Debt-Collector-Agent-UG (same text in both)
      label: 'Enforce past date rejection even when customer confirms',
      find: `CHECK 1 — DATE IN THE PAST:
If resolved date is BEFORE {{current_date}} → REJECT`,
      replace: `CHECK 1 — DATE IN THE PAST (ENFORCE STRICTLY — NO EXCEPTIONS):
If resolved date is BEFORE {{current_date}} → REJECT IMMEDIATELY.
If the customer confirms a past date ("yes that's right") → STILL REJECT.
Never save a past date under any circumstances, even with customer confirmation.`,
    }],
  },

  accepted_vague_date: {
    patches: [
      // ── Sales AI ──────────────────────────────────────────────────────────
      {
        label: 'Sales AI — Add explicit vague date rejection with required script',
        find: `"in a few days"   → DO NOT RESOLVE — ask for a specific date (too vague)
"sometime next week" → DO NOT RESOLVE — ask for a specific day`,
        replace: `"in a few days"        → DO NOT RESOLVE — ask for a specific date (too vague)
"sometime next week"   → DO NOT RESOLVE — ask for a specific day
"soon" / "later"       → DO NOT RESOLVE — ask for a specific date
"end of month"         → DO NOT RESOLVE — ask for a specific date
"next week"            → DO NOT RESOLVE — ask for a specific day of the week

VAGUE DATE ENFORCEMENT SCRIPT (mandatory):
Say: "I need a specific date so our team can plan for you —
what exact date works? Like the 15th of June, for example?"
Do NOT move forward until the customer provides a date you can resolve to YYYY-MM-DD.`,
      },
      // ── Debt-Collector-Agent-UG / Debt_Collection_2 ───────────────────────
      {
        label: 'Debt Collector — Add explicit vague date rejection with required script',
        find: `- The date is ambiguous (e.g., "sometime next month")`,
        replace: `- The date is ambiguous (e.g., "sometime next month")
- The customer says "soon", "later", "end of month" without a day number
- The customer says "next week" without naming a specific day
- The customer says "I don't know yet" or gives no date at all

VAGUE DATE ENFORCEMENT (mandatory — 2 attempts):
Attempt 1: "I understand... uhm... just to make sure I record this correctly...
which exact date were you thinking? Like the tenth of June, for example?"

Attempt 2 (if still vague): "No problem at all... let me just note a specific date
so I don't have to call you again... which day this month works best for you?"

If BOTH attempts get vague answers → escalate:
Set action = "escalate", escalation_reason = "Customer unable to commit to specific date after two attempts"
Call saveDebt and close the call.
NEVER save a vague phrase in promised_date — only YYYY-MM-DD.`,
      },
    ],
  },

  broke_promise: {
    patches: [{
      label: 'Add forbidden phrases list with approved replacements',
      find: `Never make promises you cannot keep.`,
      replace: `Never make promises you cannot keep.

FORBIDDEN PHRASES — never say any of these:
- "I will send you the floor plans"
- "I will send you photos on WhatsApp"
- "I will send you details on WhatsApp right now"
- "Let me connect you with our manager now"
- "I will transfer you to someone"
- "I can arrange that for you right now"

APPROVED REPLACEMENT for all of the above:
"Our team will follow up with you with the full details after this call."
This is the ONLY promise you are allowed to make about future actions.`,
    }],
  },

  wrong_opening: {
    patches: [
      // ── Sales AI ──────────────────────────────────────────────────────────
      {
        label: 'Sales AI — Add cold call guard: block identity-check when no name available',
        find: `Step 1 - Greeting:
"Hello... Good {{time}}... Am I speaking to {{client_name}}?"`,
        replace: `Step 1 - Greeting:
"Hello... Good {{time}}... Am I speaking to {{client_name}}?"

COLD CALL GUARD: Before saying the greeting, check {{client_name}}.
If {{client_name}} is empty, null, or not provided:
→ DO NOT say "Am I speaking to [name]?" — there is no name available.
→ USE instead: "Hello... Good {{time}}... My name is {{agent_name}}...
   calling from {{company_name}}... Is this a good time to talk?"`,
      },
      // ── Cold Outreach AI ──────────────────────────────────────────────────
      {
        label: 'Cold Outreach — Strengthen no-identity-check enforcement',
        find: `DO NOT say "Am I speaking to..." — there is no client name.`,
        replace: `DO NOT say "Am I speaking to..." — there is no client name.
DO NOT say "Is this [name]?" or any identity-check phrasing at the opening.
DO NOT reference client_name in any form at call start.
VIOLATION: Any form of identity verification in the cold opening is a CRITICAL ERROR.
If you have already said the identity check → do not correct yourself mid-call.
Instead, proceed with the script from wherever you paused.`,
      },
    ],
  },

  restart_loop: {
    patches: [
      // ── Sales AI patch 1 ──────────────────────────────────────────────────
      {
        label: 'Sales AI — Add opening interrupt handler: acknowledge mid-opening, never restart',
        find: `Step 2 - Introduction with Lead Source Context:`,
        replace: `OPENING INTERRUPT RULE (read before first word):
If the customer says ANYTHING — "Hello", "Yes", "Morning", "Go on", "Speaking" —
while you are still delivering the opening:
→ Say "uhm..." and CONTINUE from exactly where you paused.
→ Do NOT go back to "Hello Good morning..."
→ Do NOT repeat your name or company name again.
→ Restarting the greeting from the top is a CRITICAL VIOLATION — it creates a VAD loop
  where every customer breath triggers a full restart.

Step 2 - Introduction with Lead Source Context:`,
      },
      // ── Sales AI patch 2 ──────────────────────────────────────────────────
      {
        label: 'Sales AI — Add VAD interrupt guidance to FIRST UTTERANCE RULE',
        find: `IF call_type is empty or missing:
Wait for the customer to speak first. Say nothing until they speak.`,
        replace: `IF call_type is empty or missing:
Wait for the customer to speak first. Say nothing until they speak.

VAD INTERRUPT RULE (applies to ALL call types):
If the customer makes ANY sound mid-sentence (even background noise or "Hello"):
→ Pause, acknowledge with "uhm...", then continue the sentence you were saying.
→ Never restart. Never repeat from the beginning.
→ The VAD system may trigger mid-word — treat partial customer audio as an interrupt, not a full response.`,
      },
      // ── Cold Outreach AI ──────────────────────────────────────────────────
      {
        label: 'Cold Outreach — Strengthen no-restart rule with violation naming',
        find: `✓ DO NOT restart from "Hello..."`,
        replace: `✓ DO NOT restart from "Hello..."  ← CRITICAL VIOLATION if broken
✓ DO NOT repeat your name after being interrupted
✓ DO NOT repeat the company name after being interrupted
✓ DO NOT repeat the time greeting after being interrupted

RESTART = CRITICAL VIOLATION.
Every customer interruption ("Hello", "Yes", "Okay", any sound) → acknowledge with "uhm..."
and continue the EXACT sentence you were on. Starting over creates an infinite loop
where every customer breath restarts the opening.`,
      },
    ],
  },

  no_name_collected: {
    patches: [
      // ── Sales AI ──────────────────────────────────────────────────────────
      {
        label: 'Sales AI — Add mandatory name gate before question 1',
        find: `Step 3 - Ask reason:`,
        replace: `NAME COLLECTION GATE (cold outreach only):
When customer responds positively to opening (says "Yes" / "I'm listening" / "Go ahead"):
→ Your VERY NEXT sentence MUST be: "That's great... uhm... could I get your name first?"
→ ONLY after they provide their name do you proceed to question 1.
→ Asking question 1 before collecting a name is a violation.

Step 3 - Ask reason:`,
      },
      // ── Cold Outreach AI ──────────────────────────────────────────────────
      {
        label: 'Cold Outreach — Add question gate: cannot ask Q1 before name collection',
        find: `NAME COLLECTION (COLD OUTREACH — MANDATORY BEFORE QUESTIONS):`,
        replace: `NAME COLLECTION (COLD OUTREACH — MANDATORY BEFORE QUESTIONS):

QUESTION GATE (non-negotiable):
You MAY NOT ask Question 1 (or any question from {{question1}}–{{question10}})
until name collection is complete or the customer has explicitly declined to share.
If you are about to ask a survey question and client_name is still null AND you have
not yet asked for the name → STOP and ask for name first.
"That's great... uhm... may I know your name before I continue?"
Only after they answer (or decline) may you proceed to QUESTION INTAKE.`,
      },
    ],
  },

  calculated_balance: {
    patches: [
      // ── Sales AI ──────────────────────────────────────────────────────────
      {
        label: 'Sales AI — Prohibit all arithmetic: read-only access to three context values',
        find: `2. NEVER calculate remaining balance (only read 3 values: amount_due, total_purchase_value, paid_till_now)`,
        replace: `2. NEVER calculate remaining balance (only read 3 values: amount_due, total_purchase_value, paid_till_now)
   — You are NOT allowed to subtract, add, or derive any fourth number from these three.
   — If the customer asks "how much is left?", say: "I only have the current installment amount —
     our team can confirm the full breakdown for you."
   — Stating any calculated or derived figure is a CRITICAL VIOLATION.`,
      },
      // ── Debt-Collector-Agent-UG / Debt_Collection_2 ───────────────────────
      {
        label: 'Debt Collector — Prohibit all arithmetic: read balance values only',
        find: `Do NOT subtract, add, or compute any figure.`,
        replace: `Do NOT subtract, add, or compute any figure.
Do NOT derive a "remaining balance" or any fourth number from the three context values.
Do NOT even attempt mental arithmetic — if the answer is not one of the three given values, you do not have it.

CONTEXT VARIABLE CHECK (mandatory before stating any number):
Before saying any monetary figure, ask yourself:
"Is this number exactly as written in amount_due, total_purchase_value, or paid_till_now?"
If YES → say it in words.
If NO  → say: "I only have the installment details with me...
our team can give you the full breakdown..."`,
      },
    ],
  },

  invented_amount: {
    patches: [
      // ── Sales AI ──────────────────────────────────────────────────────────
      {
        label: 'Sales AI — Add context-only amount rule: no estimating or guessing',
        find: `3. NEVER invent amounts — only use values from context`,
        replace: `3. NEVER invent amounts — only use values from context
   — Before stating any monetary amount, ask yourself: "Which exact variable in my templateContext is this?"
   — If you cannot name the variable, do NOT say the amount.
   — If the amount is missing from context, say: "I want to give you the exact figures —
     let me have our team confirm the amount and call you back."`,
      },
      // ── Debt-Collector-Agent-UG / Debt_Collection_2 ───────────────────────
      {
        label: 'Debt Collector — Add missing-context script for unverifiable amounts',
        find: `Do NOT state a "remaining balance" — you are not authorized to calculate.`,
        replace: `Do NOT state a "remaining balance" — you are not authorized to calculate.
Do NOT invent, estimate, or approximate any monetary figure.

MISSING CONTEXT SCRIPT (use when customer asks for a figure you do not have):
"Uhm... I want to give you the exact number... I only have the installment details here...
let me have our team confirm the full breakdown and get back to you."

Before stating ANY monetary figure:
1. Identify which context variable it comes from (amount_due / total_purchase_value / paid_till_now).
2. If you cannot name the variable → do NOT state the figure.`,
      },
    ],
  },

  no_product_context: {
    patches: [
      // ── Sales AI ──────────────────────────────────────────────────────────
      {
        label: 'Sales AI — Enforce product-name-before-amount rule in debt opener',
        find: `1. State {{product_name}} BEFORE the amount — customer needs context`,
        replace: `1. State {{product_name}} BEFORE the amount — customer needs context
   — Your FIRST sentence after confirming identity MUST follow this exact structure:
     "I'm calling about your {{product_name}} purchase...
      you have an installment of {{amount_due}} that is due."
   — The product name MUST come before ANY number. The amount means nothing without context.
   — If you are about to say a number, ask yourself: "Have I said the product name this turn?"
     If not — state the product name first.`,
      },
      // ── Debt-Collector-Agent-UG / Debt_Collection_2 ───────────────────────
      {
        label: 'Debt Collector — Enforce product name before amount in all call paths',
        find: `Use this info ONLY if user explicitly asks about it.
Do not volunteer this information unless requested.`,
        replace: `Use this info ONLY if user explicitly asks about it.
Do not volunteer this information unless requested.

PRODUCT NAME GATE (applies to EVERY call path — not just default script):
Before stating any monetary amount (amount_due, installment, total value):
→ You MUST have already named {{product_name}} in this call.
→ If you have not yet said the product name, say it first:
  "I'm calling about your {{product_name}}..."
→ Only THEN say the amount.
Stating an amount before naming the product leaves the customer confused about what they owe for.
This gate applies even when {{agent_script}} is provided — product name ALWAYS comes first.`,
      },
    ],
  },

  spoke_luganda: {
    patches: [
      {
        label: 'Mark Luganda as NOT supported — redirect only',
        find: `SUPPORTED LANGUAGES:
- English (default)
- Swahili
- Luganda`,
        replace: `SUPPORTED LANGUAGES:
- English (default)
- Swahili

LUGANDA — NOT SUPPORTED (REDIRECT ONLY):
If the customer speaks Luganda or explicitly requests Luganda at any point:
Say: "I'm sorry... uhm... I'm not able to assist in Luganda right now...
but don't worry... someone from our team who speaks Luganda will call you back shortly..."
Then IMMEDIATELY:
- Set language_used = "Luganda"
- Set call_status = "callback_scheduled"
- Set action = "escalate"
- Set escalation_reason = "Luganda-speaking client — requires Luganda-speaking agent callback"
- Call saveDebt with ALL fields populated
- ONLY AFTER saveDebt returns → call hangUp`,
      },
      {
        label: 'Update language_used field to include Luganda as valid value',
        find: `- language_used          ("English", "Swahili", or "Luganda")`,
        replace: `- language_used          ("English", "Swahili", or "Luganda" — use "Luganda" if customer spoke or requested Luganda, even if call was redirected)`,
      },
    ],
  },

  wrong_person_handling: {
    patches: [{
      label: 'Enforce saveAnswers before hangUp on wrong number',
      find: `WRONG NUMBER / WRONG PERSON HANDLING (OUTBOUND):`,
      replace: `WRONG NUMBER / WRONG PERSON HANDLING (OUTBOUND — saveAnswers REQUIRED):`,
    }],
  },

  no_commitment: {
    patches: [
      // ── Sales AI ──────────────────────────────────────────────────────────
      {
        label: 'Sales AI — Add escalation gate after 2 failed commitment attempts',
        find: `4. Get an EXACT commitment date — "end of month", "soon", "later" are NOT acceptable`,
        replace: `4. Get an EXACT commitment date — "end of month", "soon", "later" are NOT acceptable
   — You have 2 attempts to get a specific date. If both fail:
     Say: "I completely understand — let me pass this to our team so they can work out
     a payment plan that suits you."
     Then set action = "escalate", call saveDebt, and close the call.
   — A call that ends without either a promise_date OR an escalation is a failure.`,
      },
      // ── Debt-Collector-Agent-UG / Debt_Collection_2 ───────────────────────
      {
        label: 'Debt Collector — Enforce commitment gate: 2 attempts then escalate',
        find: `NEVER store relative terms like "tomorrow", "next week", or "later" 
in promised_date or followup_date.`,
        replace: `NEVER store relative terms like "tomorrow", "next week", or "later" 
in promised_date or followup_date.

COMMITMENT ENFORCEMENT RULE (mandatory — applies to every call):
Your goal is an EXACT promised_date in YYYY-MM-DD format before ending the call.
If the customer gives a vague answer ("soon", "later", "sometime"), you have 2 attempts:

Attempt 1: "I understand... uhm... could you give me a specific date so I can update
our records properly? Even just a rough date — like the fifteenth?"

Attempt 2: "No problem at all... uhm... just to avoid another call —
is there any particular day this month that might work for you?"

If BOTH attempts fail → escalate:
Set promised_date = null, action = "escalate"
Set escalation_reason = "Customer did not commit to a payment date after two attempts"
Call saveDebt and proceed to closing.
NEVER end a call with promised_date = null AND action ≠ "escalate".`,
      },
    ],
  },

  pushed_back: {
    patches: [
      // ── Sales AI ──────────────────────────────────────────────────────────
      {
        label: 'Sales AI — Add hard stop on re-pitch after rejection',
        find: `6. If customer not interested → don't push back, give WhatsApp redirect and close`,
        replace: `6. If customer not interested → FULL STOP. Do NOT counter-offer. Do NOT re-explain.
   Say EXACTLY: "I completely understand — let me just send you some details on WhatsApp
   in case it's useful later... have a wonderful day."
   Then call saveAnswers with interest = "cold", call_status = "not_interested", and hangUp.
   Any attempt to re-pitch after a clear rejection is a violation.`,
      },
      // ── Cold Outreach AI ──────────────────────────────────────────────────
      {
        label: 'Cold Outreach — Add hard stop on re-pitch after disengagement',
        find: `- If they disengage → save and close immediately, no pushback, no arguing`,
        replace: `- If they disengage → FULL STOP. Do NOT counter-offer. Do NOT re-explain the product.

DISENGAGEMENT = IMMEDIATE CLOSE (non-negotiable):
When the customer says "not interested", "no thank you", "I don't want this", "please don't call again",
or shows any clear disengagement:
→ Say EXACTLY: "No problem at all... thank you so much for your time today...
   have a wonderful and blessed day..."
→ THEN: Set call_status = "not_interested", is_lead = false, interest = "cold"
→ Call saveAnswers → hangUp
→ DO NOT add "but just let me tell you one thing..."
→ DO NOT ask "Are you sure?"
→ DO NOT offer a WhatsApp follow-up unless customer asks
Any attempt to re-engage after clear rejection is a CRITICAL VIOLATION.`,
      },
    ],
  },

  wrong_call_type: {
    patches: [{
      label: 'Add explicit call type check as absolute first instruction',
      find: `CRITICAL DETECTION RULE — READ AND OBEY BEFORE ANYTHING ELSE:`,
      replace: `CRITICAL DETECTION RULE — READ AND OBEY BEFORE ANYTHING ELSE — THIS IS STEP ZERO:
BEFORE you say a single word, BEFORE you read any other section:
1. Read call_type
2. If call_type = "outbound" → skip INBOUND MODE entirely, go to PRIMARY GOAL
3. If call_type is missing/null/empty → skip ALL outbound sections, execute INBOUND MODE only
These two flows share ZERO steps. Mixing them is a CRITICAL VIOLATION.`,
    }],
  },

  wrong_info: {
    patches: [
      // ── Sales AI patch 1 ──────────────────────────────────────────────────
      {
        label: 'Sales AI — Add context-only information rule: no estimating or guessing',
        find: `8. NEVER invent property/price details not in context`,
        replace: `8. NEVER invent property/price details not in context
   — Before stating any price, sq footage, floor number, availability, or feature,
     ask yourself: "Is this word-for-word in my {{context}}?"
   — If not in context → say: "That's a great question — I want to give you exact details,
     so let me have our team confirm that and follow up with you directly."
   — Log the unanswered question in the unanswered_questions field.
   — Do NOT estimate, approximate, or infer from context. Guessing destroys trust.`,
      },
      // ── Sales AI patch 2 ──────────────────────────────────────────────────
      {
        label: 'Sales AI — Add context verification gate before any factual claim',
        find: `ALWAYS refer to context when:
- You want to suggest relevant options
- You need to provide accurate information
- A customer asks you a question`,
        replace: `ALWAYS refer to context when:
- You want to suggest relevant options
- You need to provide accurate information
- A customer asks you a question

CONTEXT VERIFICATION GATE:
Before stating any fact (price, size, date, availability, feature):
1. Locate the EXACT line in context where this information appears.
2. If you cannot locate it → do NOT state it.
3. State only what is explicitly written. Never rephrase to sound more specific.`,
      },
      // ── Davansh Investment / Edifice Properties / similar inbound agents ──
      {
        label: 'Property agent — Add context verification gate for all factual claims',
        find: `Never invent information not in the knowledge base.`,
        replace: `Never invent information not in the knowledge base.

CONTEXT VERIFICATION GATE (mandatory before any factual claim):
Before stating any price, availability, timeline, feature, size, or specification:
1. Ask yourself: "Is this word-for-word in my knowledge base?"
2. If YES → state it exactly as written.
3. If NO  → say: "That's a great question — I want to give you the most accurate answer,
   so let me have our team confirm that and get back to you directly."
Never estimate. Never approximate. Never infer from similar properties.
Inventing details — even plausible ones — destroys trust and creates liability.`,
      },
    ],
  },

};

export interface PatchVerification {
  exists: boolean;
  lineNumber: number;
  contextBefore: string;
  contextAfter: string;
}

export function verifyPatch(patch: FixPatch, prompt: string): PatchVerification {
  const idx = prompt.indexOf(patch.find);
  if (idx === -1) return { exists: false, lineNumber: 0, contextBefore: '', contextAfter: '' };

  const before = prompt.substring(0, idx);
  const after = prompt.substring(idx + patch.find.length);
  const lineNumber = before.split('\n').length;
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');

  return {
    exists: true,
    lineNumber,
    contextBefore: beforeLines.slice(-3).join('\n'),
    contextAfter: afterLines.slice(0, 3).join('\n'),
  };
}

/**
 * Given an error type and the current agent system prompt text,
 * returns patches filtered to only those whose `find` text still exists in the prompt.
 * Patches where `find` is NOT found = already fixed.
 */
export function getApplicablePatches(
  errorType: string,
  promptText: string
): { patch: FixPatch; alreadyFixed: boolean; verification: PatchVerification }[] {
  const spec = FIX_SPECS[errorType];
  if (!spec) return [];

  return spec.patches.map((patch) => {
    const verification = verifyPatch(patch, promptText);
    return {
      patch,
      alreadyFixed: promptText.length > 0 && !verification.exists,
      verification,
    };
  });
}

/**
 * Per-agent patch check: for each agent that has this error,
 * check which patches match that agent's prompt.
 * Returns only agents where at least one patch find-text exists.
 */
export interface AgentPatchResult {
  agentName: string;
  patches: { patch: FixPatch; alreadyFixed: boolean }[];
  hasApplicablePatches: boolean; // at least one find-text exists in prompt
}

export function getAgentPatches(
  errorType: string,
  agents: string[],
  agentPrompts: Record<string, string>
): AgentPatchResult[] {
  const spec = FIX_SPECS[errorType];
  if (!spec) return [];

  return agents
    .filter((a) => agentPrompts[a] && agentPrompts[a].length > 0)
    .map((agentName) => {
      const promptText = agentPrompts[agentName];
      const patches = spec.patches.map((patch) => {
        const verification = verifyPatch(patch, promptText);
        return {
          patch,
          alreadyFixed: !verification.exists,
        };
      });
      const hasApplicablePatches = patches.some((p) => !p.alreadyFixed);
      return { agentName, patches, hasApplicablePatches };
    })
    .filter((r) => r.patches.length > 0);
}
