/**
 * Structured fix specs: each error type maps to one or more Find→Replace edits.
 * The `find` string is searched in the CURRENT agent system prompt.
 * If found → show exact patch. If not found → show "Already fixed" badge.
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
    patches: [{
      label: 'Add garbled audio counter rule (second attempt = exit)',
      find: `DO NOT interpret noise as a valid answer under any circumstances.`,
      replace: `DO NOT interpret noise as a valid answer under any circumstances.

GARBLED AUDIO COUNTER RULE:
If this is the SECOND consecutive unclear response to the SAME question, stop re-asking.
Say: "I'm having trouble hearing you clearly... let me have our team follow up at a better time."
Then call saveAnswers with whatever data was collected and call hangUp immediately.
Do NOT loop on a bad line. Two garbled responses in a row = graceful exit.`,
    }],
  },

  no_save_answers: {
    patches: [{
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
    }],
  },

  no_save_debt: {
    patches: [{
      label: 'Enforce saveDebt on ALL early exit paths',
      find: `NEVER call hangUp before saveDebt even on wrong number calls.`,
      replace: `NEVER call hangUp before saveDebt even on wrong number calls.

EARLY EXIT RULE — ALL CALL PATHS:
Every call path — busy, wrong number, not interested, commitment given, no commitment —
MUST call saveDebt before hangUp. No exceptions exist.
Busy         → call_status = "callback_scheduled"
Not paying   → action = "escalate"
Wrong number → is_lead = false
A call that ends without saveDebt is complete data loss.`,
    }],
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
    patches: [{
      label: 'Add explicit vague date rejection with required script',
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
    }],
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
    patches: [{
      label: 'Add cold call guard — block identity-check when no name is available',
      find: `Step 1 - Greeting:
"Hello... Good {{time}}... Am I speaking to {{client_name}}?"`,
      replace: `Step 1 - Greeting:
"Hello... Good {{time}}... Am I speaking to {{client_name}}?"

COLD CALL GUARD: Before saying the greeting, check {{client_name}}.
If {{client_name}} is empty, null, or not provided:
→ DO NOT say "Am I speaking to [name]?" — there is no name available.
→ USE instead: "Hello... Good {{time}}... My name is {{agent_name}}...
   calling from {{company_name}}... Is this a good time to talk?"`,
    }],
  },

  restart_loop: {
    patches: [
      {
        label: 'Add opening interrupt handler — acknowledge mid-opening, never restart',
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
      {
        label: 'Add VAD interrupt guidance to FIRST UTTERANCE RULE',
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
    ],
  },

  no_name_collected: {
    patches: [{
      label: 'Add mandatory name gate before question 1',
      find: `Step 3 - Ask reason:`,
      replace: `NAME COLLECTION GATE (cold outreach only):
When customer responds positively to opening (says "Yes" / "I'm listening" / "Go ahead"):
→ Your VERY NEXT sentence MUST be: "That's great... uhm... could I get your name first?"
→ ONLY after they provide their name do you proceed to question 1.
→ Asking question 1 before collecting a name is a violation.

Step 3 - Ask reason:`,
    }],
  },

  calculated_balance: {
    patches: [{
      label: 'Prohibit all arithmetic — read-only access to three context values',
      find: `2. NEVER calculate remaining balance (only read 3 values: amount_due, total_purchase_value, paid_till_now)`,
      replace: `2. NEVER calculate remaining balance (only read 3 values: amount_due, total_purchase_value, paid_till_now)
   — You are NOT allowed to subtract, add, or derive any fourth number from these three.
   — If the customer asks "how much is left?", say: "I only have the current installment amount —
     our team can confirm the full breakdown for you."
   — Stating any calculated or derived figure is a CRITICAL VIOLATION.`,
    }],
  },

  invented_amount: {
    patches: [{
      label: 'Add context-only amount rule — no estimating or guessing',
      find: `3. NEVER invent amounts — only use values from context`,
      replace: `3. NEVER invent amounts — only use values from context
   — Before stating any monetary amount, ask yourself: "Which exact variable in my templateContext is this?"
   — If you cannot name the variable, do NOT say the amount.
   — If the amount is missing from context, say: "I want to give you the exact figures —
     let me have our team confirm the amount and call you back."`,
    }],
  },

  no_product_context: {
    patches: [{
      label: 'Enforce product-name-before-amount rule in debt opener',
      find: `1. State {{product_name}} BEFORE the amount — customer needs context`,
      replace: `1. State {{product_name}} BEFORE the amount — customer needs context
   — Your FIRST sentence after confirming identity MUST follow this exact structure:
     "I'm calling about your {{product_name}} purchase...
      you have an installment of {{amount_due}} that is due."
   — The product name MUST come before ANY number. The amount means nothing without context.
   — If you are about to say a number, ask yourself: "Have I said the product name this turn?"
     If not — state the product name first.`,
    }],
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
    patches: [{
      label: 'Add escalation gate after 2 failed commitment attempts',
      find: `4. Get an EXACT commitment date — "end of month", "soon", "later" are NOT acceptable`,
      replace: `4. Get an EXACT commitment date — "end of month", "soon", "later" are NOT acceptable
   — You have 2 attempts to get a specific date. If both fail:
     Say: "I completely understand — let me pass this to our team so they can work out
     a payment plan that suits you."
     Then set action = "escalate", call saveDebt, and close the call.
   — A call that ends without either a promise_date OR an escalation is a failure.`,
    }],
  },

  pushed_back: {
    patches: [{
      label: 'Add hard stop on re-pitch after rejection',
      find: `6. If customer not interested → don't push back, give WhatsApp redirect and close`,
      replace: `6. If customer not interested → FULL STOP. Do NOT counter-offer. Do NOT re-explain.
   Say EXACTLY: "I completely understand — let me just send you some details on WhatsApp
   in case it's useful later... have a wonderful day."
   Then call saveAnswers with interest = "cold", call_status = "not_interested", and hangUp.
   Any attempt to re-pitch after a clear rejection is a violation.`,
    }],
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
      {
        label: 'Add context-only information rule — no estimating or guessing',
        find: `8. NEVER invent property/price details not in context`,
        replace: `8. NEVER invent property/price details not in context
   — Before stating any price, sq footage, floor number, availability, or feature,
     ask yourself: "Is this word-for-word in my {{context}}?"
   — If not in context → say: "That's a great question — I want to give you exact details,
     so let me have our team confirm that and follow up with you directly."
   — Log the unanswered question in the unanswered_questions field.
   — Do NOT estimate, approximate, or infer from context. Guessing destroys trust.`,
      },
      {
        label: 'Add context verification gate before any factual claim',
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
    ],
  },

};

/**
 * Given an error type and the current agent system prompt text,
 * returns patches filtered to only those whose `find` text still exists in the prompt.
 * Patches where `find` is NOT found = already fixed.
 */
export function getApplicablePatches(
  errorType: string,
  promptText: string
): { patch: FixPatch; alreadyFixed: boolean }[] {
  const spec = FIX_SPECS[errorType];
  if (!spec) return [];

  return spec.patches.map((patch) => ({
    patch,
    alreadyFixed: promptText.length > 0 && !promptText.includes(patch.find),
  }));
}
