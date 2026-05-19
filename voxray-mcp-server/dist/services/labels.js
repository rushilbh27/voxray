export const HUMAN_LABELS = {
    accepted_garbled_audio: 'Accepted unclear audio as a valid answer',
    no_save_answers: 'Call ended without saving answers — data lost',
    no_consultation: 'No value-add after collecting requirements',
    stacked_questions: 'Asked multiple questions at once',
    no_product_context: 'Stated amount before explaining the product',
    no_save_debt: 'Call ended without saving debt data — data lost',
    accepted_past_date: 'Accepted a date that already passed',
    skipped_repeat_rule: "Didn't repeat after customer said 'sorry?'",
    broke_promise: "Promised something the agent can't deliver",
    wrong_opening: "Used 'Am I speaking with?' on a cold call",
    restart_loop: 'Restarted full greeting after customer interrupted',
    no_name_collected: 'Collected answers without getting customer name first',
    calculated_balance: 'Calculated remaining balance (explicitly forbidden)',
    invented_amount: 'Stated an amount not from context variables',
    accepted_vague_date: "Accepted vague date like 'soon' or 'next week'",
    wrong_person_handling: 'Wrong number not closed with WhatsApp redirect',
    spoke_luganda: 'Used Luganda instead of redirect script',
    no_commitment: 'Call ended with no payment commitment or escalation',
    pushed_back: 'Argued or re-pitched after customer said not interested',
    wrong_info: 'Stated incorrect property or price details',
    wrong_call_type: 'Executed wrong call flow (inbound vs outbound)',
};
export const FIX_SUGGESTIONS = {
    accepted_garbled_audio: "The GARBLED AUDIO RULE is already in the prompt — the agent is ignoring it. Add a counter rule: 'If this is the SECOND consecutive unclear response to the SAME question, stop re-asking. Say: I'm having trouble hearing you clearly — let me have our team follow up at a better time. Then call saveAnswers with whatever data was collected and hang up. Do not loop more than once on a bad line.' Also check VAD sensitivity in Ultravox settings — overly aggressive VAD triggers the model before the customer finishes speaking.",
    no_save_answers: "Agent is exiting via an early path (busy, objection, wrong number) without hitting the COMPLETION section. Add to LEAD HANDLING LOGIC: 'No matter how the call ends — busy, not interested, wrong number, or completed — saveAnswers MUST be called before hangUp. There is no exception. Even if you only collected 1 answer, save what you have with call_status = needs_followup.'",
    no_consultation: "Add a hard gate after Q3: 'After the customer answers Q3, STOP before asking Q4. Review what you have collected. Use context to identify 2-3 relevant matches. Share ONE match in 1-2 sentences and ask a check-in question. Only after their response continue to Q4.' If context has no match: 'Based on what you've shared, our team will prepare specific options for you.'",
    stacked_questions: "Review every {{question1}}-{{question10}} for compound phrasing using 'and' or 'or'. Split into separate slots. Add: 'If you catch yourself asking two questions in one sentence, stop, say Uhm sorry — let me take that one at a time, and re-ask only the first.'",
    no_product_context: "Fix the debt opener: 'Your FIRST sentence after confirming identity MUST follow this structure: I'm calling about your [product_name] purchase... you have an installment of [amount_due] due. The product name must come first — the amount means nothing to the customer without that context.'",
    no_save_debt: "Same root cause as no_save_answers — early exits bypass the save gate. Add: 'Every call path ends with saveDebt before hangUp — no exceptions. Busy: call_status = callback_scheduled. Not interested: call_status = not_interested. Wrong number: is_lead = false. A call without saveDebt is complete data loss.'",
    accepted_past_date: "Before confirming any date back to the customer, silently compare to {{current_date}}. If resolved date < {{current_date}}, do NOT confirm it. Say: 'That date would actually be in the past — could you give me a future date that works?' NEVER confirm a past date even if the customer insists.",
    skipped_repeat_rule: "CONFUSION = FULL STOP. Add: 'When the customer says sorry/pardon/what/huh — the ONLY valid response is the EXACT sentence you just said, unchanged. Not a paraphrase. Not a summary. Word for word. Advancing after confusion is a CRITICAL VIOLATION.'",
    broke_promise: "Add FORBIDDEN PHRASES list: 'NEVER say: I will send you floor plans, I will send you photos, I will connect you now, Let me transfer you. Replace ALL with: Our team will follow up with you with full details after this call.'",
    wrong_opening: "Add self-check before first word: 'Check: do I have a {{client_name}} value? If empty or null, do NOT use identity-check opening. Start with: Hello... Good {{time}}... My name is {{agent_name}}... calling from {{company_name}}.'",
    restart_loop: "Add: 'If the customer says Hello/Yes/Morning during opening — acknowledge with uhm and continue from exactly where you left off. Do NOT restart from Hello. Restarting the greeting is a CRITICAL VIOLATION that creates a VAD loop.'",
    no_name_collected: "Add gate: 'When customer responds positively to opening, your VERY NEXT sentence must be: That's great... uhm... could I get your name first? Only after they give their name do you proceed to question 1.'",
    calculated_balance: "Add: 'You have exactly THREE numbers: amount_due, total_purchase_value, paid_till_now. You are allowed to READ these. NEVER subtract, add, or derive a fourth number. If customer asks how much is left, say: I only have the current installment amount — our team can confirm the full breakdown.'",
    invented_amount: "Add: 'Before stating any monetary amount, ask yourself: where exactly in my context does this number appear? If you cannot point to the exact variable it came from, do NOT say it.'",
    accepted_vague_date: "Add: 'Vague date phrases are NOT valid inputs. When customer says soon/later/sometime next week/end of month — do NOT save. Say: I need a specific date — what exact date works? Like the 15th of June, for example?'",
    wrong_person_handling: "Add emphasis: '(1) Say the exact phrase: I sincerely apologize for the confusion — I will make sure this is corrected — have a great day. (2) Call saveAnswers with is_lead = false, call_status = not_interested, all q/a slots null. (3) ONLY after saveAnswers returns, call hangUp.'",
    spoke_luganda: "Add: 'If the customer speaks Luganda or requests it, do NOT attempt any Luganda words. Say exactly: I'm sorry — I don't speak Luganda, but I will arrange for someone from our team who does to call you back.'",
    no_commitment: "Add escalation gate: 'If after 2 attempts to get a commitment date the customer still deflects, say: I completely understand — let me pass this to our team so they can work out a plan that suits you. Set action = escalate, call saveDebt, close the call.'",
    pushed_back: "Add: 'If customer says not interested — do NOT counter-offer. Say exactly: I completely understand — let me just send you some details on WhatsApp in case it's useful later... have a wonderful day. Then call saveAnswers with interest = cold.'",
    wrong_info: "Add: 'NEVER state a price, sq footage, floor number, availability, or feature not explicitly written in your context. If the detail is missing, say: That is a great question — let me have our team confirm that and follow up directly. Log in unanswered_questions.'",
    wrong_call_type: "Add decision checkpoint as first instruction: 'Read call_type. If call_type = outbound, skip INBOUND MODE entirely. If call_type is null/empty/missing, skip OUTBOUND sections. These two flows share zero steps.'",
};
export function humanLabel(type) {
    return HUMAN_LABELS[type] ?? type.replace(/_/g, ' ');
}
export function fixSuggestion(type) {
    return FIX_SUGGESTIONS[type] ?? null;
}
//# sourceMappingURL=labels.js.map