export interface CallError {
  type: string;
  severity: 'critical' | 'major' | 'minor';
  agent_line: string;
  what_went_wrong: string;
  should_have_said: string;
  timestamp_index: number;
}

export interface ErrorAnalysis {
  errors: CallError[];
  goal_achieved: boolean;
  goal_outcome: string;
  missed_opportunities: string[];
  summary: string;
  error_count: number;
  critical_error_count: number;
}

export interface CallRow {
  call_id: string;
  client_name: string;
  status: string;
  ended_reason: string | null;
  duration_seconds: number | null;
  cost_usd: number | null;
  error_count: number | null;
  critical_error_count: number | null;
  analysis_status: string | null;
  call_errors: ErrorAnalysis | null;
  created_at: string;
  ended_at: string | null;
}

export interface MessageRow {
  role: string;
  text: string;
  ordinal: number;
}

export interface ErrorFrequency {
  type: string;
  human_label: string;
  count: number;
  critical_count: number;
  fix_suggestion: string | null;
  agents: string[];
  example_call_id: string;
}

export interface PaginatedResult<T> {
  total: number;
  count: number;
  offset: number;
  items: T[];
  has_more: boolean;
  next_offset?: number;
}
