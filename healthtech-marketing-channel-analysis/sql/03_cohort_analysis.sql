-- Cohort Analysis
-- Purpose: Retention and lifetime value analysis by channel


-- SECTION 1 : CHANNEL RETENTION SUMMARY
-- Retention view by channel

WITH channel_cohort_summary AS (
  SELECT
    acquisition_channel,
    SUM(users)                                          AS total_users,
    ROUND(SUM(m1_retention_pct * users) / SUM(users), 2) AS weighted_m1_retention,
    ROUND(SUM(m2_retention_pct * users) / SUM(users), 2) AS weighted_m2_retention,
    ROUND(SUM(m3_retention_pct * users) / SUM(users), 2) AS weighted_m3_retention,
    ROUND(SUM(avg_ltv_brl * users) / SUM(users), 2)      AS weighted_ltv,
    ROUND(SUM(avg_cac_brl * users) / SUM(users), 2)      AS weighted_cac
  FROM cohort
  GROUP BY acquisition_channel
),
channel_cohort_ratios AS (
  SELECT
    acquisition_channel,
    total_users,
    weighted_m1_retention,
    weighted_m2_retention,
    weighted_m3_retention,
    weighted_ltv,
    weighted_cac,
    ROUND(weighted_ltv / NULLIF(weighted_cac, 0), 2)      AS ltv_cac_ratio,

    CASE
      WHEN weighted_ltv / NULLIF(weighted_cac, 0) >= 6 THEN 'Strong — 6:1+'
      WHEN weighted_ltv / NULLIF(weighted_cac, 0) >= 3 THEN 'Healthy — 3:1+'
      ELSE 'Below benchmark'
    END                                                  AS ltv_cac_status
  FROM channel_cohort_summary
)
SELECT * FROM channel_cohort_ratios
ORDER BY ltv_cac_ratio DESC;


-- SECTION 2 : RETENTION DECAY BY CHANNEL
-- M1 to M2 and M2 to M3 drop-off 

WITH decay_curve AS (
  SELECT
    acquisition_channel,
    SUM(users)                                          AS total_users,
    ROUND(SUM(m1_retention_pct * users) / SUM(users), 2) AS m1,
    ROUND(SUM(m2_retention_pct * users) / SUM(users), 2) AS m2,
    ROUND(SUM(m3_retention_pct * users) / SUM(users), 2) AS m3
  FROM cohort
  GROUP BY acquisition_channel
),
decay_rates AS (
  SELECT
    acquisition_channel,
    total_users,
    m1, m2, m3,
    ROUND(m1 - m2, 2)                                   AS m1_to_m2_drop,
    ROUND(m2 - m3, 2)                                   AS m2_to_m3_drop,
    ROUND((m1 - m3) / NULLIF(m1, 0) * 100, 2)            AS pct_decay_m1_to_m3
  FROM decay_curve
)
SELECT * FROM decay_rates
ORDER BY pct_decay_m1_to_m3 ASC;


-- SECTION 3 : COHORT MONTH TREND BY CHANNEL
-- Identifying whether retention is improving, stable or decreasing over the 6 cohort months

WITH monthly_cohort_trend AS (
  SELECT
    acquisition_channel,
    cohort_month,
    SUM(users)                                          AS total_users,
    ROUND(SUM(m1_retention_pct * users) / SUM(users), 2) AS m1,
    ROUND(SUM(m2_retention_pct * users) / SUM(users), 2) AS m2,
    ROUND(SUM(m3_retention_pct * users) / SUM(users), 2) AS m3,
    ROUND(SUM(avg_ltv_brl * users) / SUM(users), 2)      AS ltv
  FROM cohort
  GROUP BY acquisition_channel, cohort_month
),
monthly_trend_change AS (
  SELECT
    acquisition_channel,
    cohort_month,
    total_users,
    m1, m2, m3, ltv,
    LAG(m1) OVER (
      PARTITION BY acquisition_channel
      ORDER BY FIELD(cohort_month,
        'April','May','June','July','August','September')
    )                                                    AS prior_month_m1,
    ROUND(
      m1 - LAG(m1) OVER (
        PARTITION BY acquisition_channel
        ORDER BY FIELD(cohort_month,
          'April','May','June','July','August','September')
      ), 2
    )                                                    AS m1_mom_change
  FROM monthly_cohort_trend
)
SELECT * FROM monthly_trend_change
ORDER BY
  acquisition_channel,
  FIELD(cohort_month, 'April','May','June','July','August','September');