CREATE OR REPLACE FUNCTION get_agent_error_summary()
RETURNS TABLE (
  client_name TEXT,
  total_calls BIGINT,
  analyzed_calls BIGINT,
  calls_with_errors BIGINT,
  error_rate NUMERIC,
  critical_count BIGINT,
  top_error_type TEXT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.client_name,
    COUNT(*) AS total_calls,
    COUNT(*) FILTER (WHERE c.analysis_status = 'complete') AS analyzed_calls,
    COUNT(*) FILTER (WHERE c.error_count > 0) AS calls_with_errors,
    ROUND(
      COUNT(*) FILTER (WHERE c.error_count > 0)::NUMERIC /
      NULLIF(COUNT(*) FILTER (WHERE c.analysis_status = 'complete'), 0) * 100, 1
    ) AS error_rate,
    COALESCE(SUM(c.critical_error_count), 0) AS critical_count,
    (
      SELECT e.type
      FROM ultravox_calls c2,
           jsonb_array_elements(c2.call_errors->'errors') AS e_raw,
           LATERAL (SELECT e_raw->>'type' AS type) e
      WHERE c2.client_name = c.client_name AND c2.analysis_status = 'complete'
      GROUP BY e.type
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) AS top_error_type
  FROM ultravox_calls c
  WHERE c.status = 'ended'
  GROUP BY c.client_name
  ORDER BY calls_with_errors DESC;
$$;
