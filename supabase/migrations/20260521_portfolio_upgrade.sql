-- ═══════════════════════════════════════════════════════════════
-- Voxray Portfolio Upgrade Migration
-- Tracks 1 (perf), 2 (observability), 3 (eval), 4 (versioning)
-- ═══════════════════════════════════════════════════════════════

-- ── Track 2: LLM observability ──────────────────────────────────
CREATE TABLE IF NOT EXISTS llm_traces (
  id              UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id         TEXT,
  model           TEXT          NOT NULL,
  purpose         TEXT          NOT NULL,
  agent_type      TEXT,
  input_tokens    INT,
  output_tokens   INT,
  latency_ms      INT,
  cost_usd        DECIMAL(10,8),
  success         BOOLEAN       NOT NULL DEFAULT true,
  error_message   TEXT,
  prompt_hash     TEXT,
  created_at      TIMESTAMPTZ   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_llm_traces_created_at ON llm_traces(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_traces_call_id    ON llm_traces(call_id);

-- ── Track 4: Prompt versioning ──────────────────────────────────
ALTER TABLE ultravox_calls
  ADD COLUMN IF NOT EXISTS prompt_hash TEXT;

CREATE TABLE IF NOT EXISTS prompt_versions (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id     TEXT        NOT NULL,
  prompt_hash  TEXT        NOT NULL,
  first_seen   TIMESTAMPTZ DEFAULT NOW(),
  last_seen    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, prompt_hash)
);

-- ── Track 1: RPC 1 — dashboard aggregates ──
CREATE OR REPLACE FUNCTION get_dashboard_aggregates()
RETURNS TABLE (
  total_calls       BIGINT,
  ended_count       BIGINT,
  successful_count  BIGINT,
  active_calls      BIGINT,
  total_analyzed    BIGINT,
  calls_with_errors BIGINT,
  total_cost        DOUBLE PRECISION,
  avg_duration      DOUBLE PRECISION
) LANGUAGE sql STABLE AS $$
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE status = 'ended')::BIGINT,
    COUNT(*) FILTER (
      WHERE status = 'ended'
        AND ended_reason NOT IN ('error', 'unjoined')
    )::BIGINT,
    COUNT(*) FILTER (WHERE status = 'active')::BIGINT,
    COUNT(*) FILTER (WHERE analysis_status = 'complete')::BIGINT,
    COUNT(*) FILTER (
      WHERE analysis_status = 'complete' AND error_count > 0
    )::BIGINT,
    COALESCE(SUM(cost_usd), 0)::DOUBLE PRECISION,
    COALESCE(
      AVG(CASE WHEN duration_seconds > 0 THEN duration_seconds::DOUBLE PRECISION END),
      0
    )::DOUBLE PRECISION
  FROM ultravox_calls;
$$;

-- ── Track 1: RPC 2 — error frequency from JSONB ──
CREATE OR REPLACE FUNCTION get_error_frequency(
  p_since TIMESTAMPTZ DEFAULT NULL,
  p_agent TEXT        DEFAULT NULL
)
RETURNS TABLE (
  error_type      TEXT,
  count           BIGINT,
  critical_count  BIGINT,
  cost_usd        DOUBLE PRECISION,
  example_call_id TEXT,
  example_line    TEXT,
  agents          TEXT[]
) LANGUAGE sql STABLE AS $$
  SELECT
    (err->>'type')::TEXT,
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE err->>'severity' = 'critical')::BIGINT,
    COALESCE(SUM(c.cost_usd), 0)::DOUBLE PRECISION,
    MIN(c.call_id)::TEXT,
    MIN(err->>'agent_line')::TEXT,
    ARRAY_AGG(DISTINCT c.client_name)::TEXT[]
  FROM ultravox_calls c
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(c.call_errors->'errors') = 'array'
      THEN c.call_errors->'errors'
      ELSE '[]'::jsonb
    END
  ) AS err
  WHERE c.analysis_status = 'complete'
    AND c.error_count > 0
    AND (p_since IS NULL OR c.created_at > p_since)
    AND (p_agent IS NULL OR p_agent = '' OR c.client_name = p_agent)
  GROUP BY err->>'type'
  ORDER BY COUNT(*) DESC;
$$;

-- ── Track 1: RPC 3 — client breakdown ──
CREATE OR REPLACE FUNCTION get_client_breakdown()
RETURNS TABLE (
  client_name TEXT,
  count       BIGINT
) LANGUAGE sql STABLE AS $$
  SELECT client_name::TEXT, COUNT(*)::BIGINT
  FROM ultravox_calls
  GROUP BY client_name
  ORDER BY COUNT(*) DESC;
$$;

-- ── Track 1: RPC 4 — weekly trend ──
CREATE OR REPLACE FUNCTION get_weekly_trend()
RETURNS TABLE (
  week     TEXT,
  agent    TEXT,
  analyzed BIGINT,
  errors   BIGINT
) LANGUAGE sql STABLE AS $$
  SELECT
    TO_CHAR(DATE_TRUNC('week', created_at), 'IYYY-"W"IW')::TEXT,
    client_name::TEXT,
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE error_count > 0)::BIGINT
  FROM ultravox_calls
  WHERE analysis_status = 'complete'
    AND created_at > NOW() - INTERVAL '12 weeks'
  GROUP BY DATE_TRUNC('week', created_at), client_name
  ORDER BY DATE_TRUNC('week', created_at) ASC;
$$;

-- ── Track 1: RPC 5 — before/after comparison ──
CREATE OR REPLACE FUNCTION get_comparison_data(p_date TIMESTAMPTZ)
RETURNS TABLE (
  error_type   TEXT,
  before_count BIGINT,
  after_count  BIGINT
) LANGUAGE sql STABLE AS $$
  SELECT
    (err->>'type')::TEXT,
    COUNT(*) FILTER (WHERE c.created_at < p_date)::BIGINT,
    COUNT(*) FILTER (WHERE c.created_at >= p_date)::BIGINT
  FROM ultravox_calls c
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(c.call_errors->'errors') = 'array'
      THEN c.call_errors->'errors'
      ELSE '[]'::jsonb
    END
  ) AS err
  WHERE c.analysis_status = 'complete'
    AND c.error_count > 0
  GROUP BY err->>'type';
$$;

-- ── Track 2: RPC 6 — AI pipeline stats ──
CREATE OR REPLACE FUNCTION get_pipeline_stats()
RETURNS TABLE (
  p50_latency_ms   DOUBLE PRECISION,
  p95_latency_ms   DOUBLE PRECISION,
  cost_today       DOUBLE PRECISION,
  success_rate_7d  DOUBLE PRECISION,
  traces_today     BIGINT
) LANGUAGE sql STABLE AS $$
  SELECT
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms)::DOUBLE PRECISION,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::DOUBLE PRECISION,
    COALESCE(
      SUM(cost_usd) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours'),
      0
    )::DOUBLE PRECISION,
    COALESCE(
      AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END)
        FILTER (WHERE created_at > NOW() - INTERVAL '7 days'),
      1.0
    )::DOUBLE PRECISION,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::BIGINT
  FROM llm_traces
  WHERE latency_ms IS NOT NULL;
$$;

-- ── Track 3: RPC 7 — eval stats (FP rate) ──
CREATE OR REPLACE FUNCTION get_eval_stats()
RETURNS TABLE (
  error_type   TEXT,
  total_flags  BIGINT,
  fp_count     BIGINT
) LANGUAGE sql STABLE AS $$
  SELECT
    (err->>'type')::TEXT,
    COUNT(*)::BIGINT,
    COUNT(fp.call_id)::BIGINT
  FROM ultravox_calls c
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(c.call_errors->'errors') = 'array'
      THEN c.call_errors->'errors'
      ELSE '[]'::jsonb
    END
  ) AS err
  LEFT JOIN false_positives fp
    ON fp.call_id = c.call_id
    AND fp.error_type = err->>'type'
  WHERE c.analysis_status = 'complete'
  GROUP BY err->>'type';
$$;

-- ── Track 4: RPC 8 — prompt version trend ──
CREATE OR REPLACE FUNCTION get_prompt_version_trend(p_agent TEXT)
RETURNS TABLE (
  prompt_hash  TEXT,
  first_used   TIMESTAMPTZ,
  total        BIGINT,
  with_errors  BIGINT
) LANGUAGE sql STABLE AS $$
  SELECT
    prompt_hash::TEXT,
    MIN(created_at)::TIMESTAMPTZ,
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE error_count > 0)::BIGINT
  FROM ultravox_calls
  WHERE analysis_status = 'complete'
    AND prompt_hash IS NOT NULL
    AND client_name = p_agent
  GROUP BY prompt_hash
  ORDER BY MIN(created_at);
$$;
