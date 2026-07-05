-- Exploratory Analysis
-- Purpose: Initial data investigation before structured analysis
-- Note: Data confirmed clean on import - no date conversion required, nulls only present on Organic ROAS as expected

-- SECTION 1 : DATASET OVERVIEW
-- Confirming structure of both tables

WITH performance_summary AS (
  SELECT
    'performance'                           AS table_name,
    COUNT(*)                                AS total_rows,
    COUNT(DISTINCT channel)                 AS channels,
    COUNT(DISTINCT week_start_date)         AS weeks,
    COUNT(DISTINCT price_point_brl)         AS price_points,
    COUNT(DISTINCT creative_variant)        AS creative_variants,
    MIN(week_start_date)                    AS date_from,
    MAX(week_start_date)                    AS date_to
  FROM performance
),
cohort_summary AS (
  SELECT
    'cohort'                                AS table_name,
    COUNT(*)                                AS total_rows,
    COUNT(DISTINCT acquisition_channel)     AS channels,
    COUNT(DISTINCT cohort_month)            AS weeks,
    COUNT(DISTINCT price_point_brl)         AS price_points,
    NULL                                    AS creative_variants,
    NULL                                    AS date_from,
    NULL                                    AS date_to
  FROM cohort
)
SELECT * FROM performance_summary
UNION ALL
SELECT * FROM cohort_summary;


-- SECTION 2 : NULL & DATA QUALITY CHECKS
-- Confirms only ROAS on Organic rows contains NULLS

WITH null_summary AS (
  SELECT
    SUM(CASE WHEN roas IS NULL AND channel != 'organic' 
        THEN 1 ELSE 0 END)                  AS unexpected_null_roas,
    SUM(CASE WHEN spend_brl = 0 
        AND channel != 'organic' 
        THEN 1 ELSE 0 END)                  AS paid_channel_zero_spend,
    SUM(CASE WHEN acquisitions > checkouts 
        THEN 1 ELSE 0 END)                  AS acq_exceeds_checkouts,
    SUM(CASE WHEN checkouts > questionnaire_starts 
        THEN 1 ELSE 0 END)                  AS checkouts_exceed_q_starts,
    SUM(CASE WHEN clicks > impressions 
        THEN 1 ELSE 0 END)                  AS clicks_exceed_impressions,
    SUM(CASE WHEN revenue_brl = 0 
        AND acquisitions > 0 
        THEN 1 ELSE 0 END)                  AS acq_with_no_revenue
  FROM performance
),
quality_flags AS (
  SELECT
    'Unexpected null ROAS on paid channels'  AS check_name,
    unexpected_null_roas                     AS flagged_rows
  FROM null_summary
  UNION ALL
  SELECT 'Paid channel rows with zero spend',
    paid_channel_zero_spend FROM null_summary
  UNION ALL
  SELECT 'Acquisitions exceeding checkouts',
    acq_exceeds_checkouts FROM null_summary
  UNION ALL
  SELECT 'Checkouts exceeding questionnaire starts',
    checkouts_exceed_q_starts FROM null_summary
  UNION ALL
  SELECT 'Clicks exceeding impressions',
    clicks_exceed_impressions FROM null_summary
  UNION ALL
  SELECT 'Acquisitions with zero revenue',
    acq_with_no_revenue FROM null_summary
)
SELECT
  check_name,
  flagged_rows,
  CASE WHEN flagged_rows = 0 THEN 'Clear' ELSE 'Review' END AS status
FROM quality_flags;


-- SECTION 3 : CHANNEL & CAMPAIGN TYPE BREAKDOWN
-- Confirming channel naming conventions and campaign type classification

WITH channel_breakdown AS (
  SELECT
    channel,
    campaign_type,
    COUNT(DISTINCT week_start_date)         AS weeks_active,
    ROUND(SUM(spend_brl), 0)                AS total_spend,
    SUM(acquisitions)                       AS total_acquisitions,
    ROUND(SUM(spend_brl) 
      / NULLIF(SUM(acquisitions), 0), 2)    AS blended_cac,
    ROUND(SUM(revenue_brl) 
      / NULLIF(SUM(spend_brl), 0), 2)       AS blended_roas
  FROM performance
  GROUP BY channel, campaign_type
)
SELECT * FROM channel_breakdown
ORDER BY total_spend DESC;


-- SECTION 4 : KEY METRIC DISTRIBUTIONS
-- Spend, acquisitions, CAC, ROAS, LTV at a glance

WITH metric_distributions AS (
  SELECT
    channel,
    ROUND(SUM(spend_brl), 0)                AS total_spend,
    SUM(acquisitions)                        AS total_acquisitions,
    ROUND(SUM(revenue_brl), 0)               AS total_revenue,
    ROUND(MIN(cac_brl), 2)                   AS min_cac,
    ROUND(MAX(cac_brl), 2)                   AS max_cac,
    ROUND(SUM(spend_brl) 
      / NULLIF(SUM(acquisitions), 0), 2)     AS weighted_cac,
    ROUND(AVG(roas), 2)                      AS avg_roas,
    ROUND(AVG(ltv_brl), 2)                   AS avg_ltv,
    ROUND(AVG(approval_rate_pct), 1)         AS avg_approval_rate
  FROM performance
  GROUP BY channel
)
SELECT * FROM metric_distributions
ORDER BY total_spend DESC;


-- SECTION 5 : COHORT DATA VALIDATION
-- Channel name consistency between tables

WITH performance_channels AS (
  SELECT DISTINCT channel AS channel_name 
  FROM performance
),
cohort_channels AS (
  SELECT DISTINCT acquisition_channel AS channel_name 
  FROM cohort
),
consistency_check AS (
  SELECT 
    COALESCE(p.channel_name, c.channel_name)  AS channel,
    CASE 
      WHEN p.channel_name IS NOT NULL 
       AND c.channel_name IS NOT NULL THEN 'In both tables'
      WHEN p.channel_name IS NOT NULL THEN 'Performance only'
      ELSE 'Cohort only'
    END AS status
  FROM performance_channels p
  LEFT JOIN cohort_channels c 
    ON p.channel_name = c.channel_name
  UNION
  SELECT 
    COALESCE(p.channel_name, c.channel_name),
    CASE 
      WHEN p.channel_name IS NOT NULL 
       AND c.channel_name IS NOT NULL THEN 'In both tables'
      WHEN c.channel_name IS NOT NULL THEN 'Cohort only'
      ELSE 'Performance only'
    END
  FROM cohort_channels c
  LEFT JOIN performance_channels p 
    ON c.channel_name = p.channel_name
)
SELECT DISTINCT * FROM consistency_check
ORDER BY status, channel;

-- Retention decay validation

WITH cohort_analysis AS (
  SELECT
    acquisition_channel,
    cohort_month,
    SUM(users)                               AS total_users,
    ROUND(AVG(m1_retention_pct), 1)          AS avg_m1_retention,
    ROUND(AVG(m2_retention_pct), 1)          AS avg_m2_retention,
    ROUND(AVG(m3_retention_pct), 1)          AS avg_m3_retention,
    ROUND(AVG(m1_retention_pct) 
      - AVG(m2_retention_pct), 1)            AS m1_to_m2_drop,
    ROUND(AVG(m2_retention_pct) 
      - AVG(m3_retention_pct), 1)            AS m2_to_m3_drop,
    ROUND(AVG(avg_ltv_brl), 2)               AS avg_ltv,
    ROUND(AVG(avg_cac_brl), 2)               AS avg_cac,
    ROUND(AVG(avg_ltv_brl) 
      / NULLIF(AVG(avg_cac_brl), 0), 2)      AS ltv_cac_ratio,
    CASE
      WHEN AVG(m2_retention_pct) > AVG(m1_retention_pct) THEN 'M2 > M1'
      WHEN AVG(m3_retention_pct) > AVG(m2_retention_pct) THEN 'M3 > M2'
      ELSE 'Normal decay'
    END AS decay_status
  FROM cohort
  GROUP BY acquisition_channel, cohort_month
)
SELECT * FROM cohort_analysis
ORDER BY 
  FIELD(cohort_month, 
    'April', 'May', 'June', 
    'July', 'August', 'September'
  ),
  acquisition_channel;
