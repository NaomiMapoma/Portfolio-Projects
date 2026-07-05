-- Channel performance
-- Purpose: Core channel performance metrics
-- Covers: CAC, CVR, ROAS, CTR, approval rate trends


-- SECTION 1 : CHANNEL OVERVIEW
-- Total spend, acquisitions, revenue and efficiency metrics across the 12-week period

WITH channel_totals AS (
  SELECT
    channel,
    campaign_type,
    SUM(spend_brl)                                      AS total_spend,
    SUM(impressions)                                    AS total_impressions,
    SUM(clicks)                                         AS total_clicks,
    SUM(questionnaire_starts)                           AS total_q_starts,
    SUM(checkouts)                                      AS total_checkouts,
    SUM(acquisitions)                                   AS total_acquisitions,
    SUM(revenue_brl)                                    AS total_revenue
  FROM performance
  GROUP BY channel, campaign_type
),
channel_metrics AS (
  SELECT
    channel,
    campaign_type,
    ROUND(total_spend, 0)                               AS total_spend,
    total_acquisitions,
    ROUND(total_revenue, 0)                             AS total_revenue,
    ROUND(total_spend
      / NULLIF(total_acquisitions, 0), 2)               AS weighted_cac,
    ROUND(total_revenue
      / NULLIF(total_spend, 0), 2)                      AS blended_roas,
    100 * ROUND(total_acquisitions
      / NULLIF(total_q_starts, 0), 4)                   AS funnel_cvr_pct,
    100 * ROUND(total_acquisitions
      / NULLIF(total_checkouts, 0), 4)                  AS checkout_cvr_pct,
    100 * ROUND(total_clicks
      / NULLIF(total_impressions, 0), 4)                AS blended_ctr_pct
  FROM channel_totals
)
SELECT * FROM channel_metrics
ORDER BY total_spend DESC;


-- SECTION 2 : WEEKLY CAC BY CHANNEL
-- Identifying where CAC is most & least efficient 

WITH weekly_totals AS (
  SELECT
    week_start_date,
    channel,
    SUM(spend_brl)                                      AS weekly_spend,
    SUM(acquisitions)                                   AS weekly_acquisitions,
    SUM(revenue_brl)                                    AS weekly_revenue,
    SUM(impressions)                                    AS weekly_impressions,
    SUM(clicks)                                         AS weekly_clicks
  FROM performance
  GROUP BY week_start_date, channel
),
weekly_metrics AS (
  SELECT
    week_start_date,
    channel,
    ROUND(weekly_spend, 0)                              AS weekly_spend,
    weekly_acquisitions,
    ROUND(weekly_spend
      / NULLIF(weekly_acquisitions, 0), 2)              AS weekly_cac,
    ROUND(weekly_revenue
      / NULLIF(weekly_spend, 0), 2)                     AS weekly_roas,
    100 * ROUND(weekly_clicks
      / NULLIF(weekly_impressions, 0), 4)               AS weekly_ctr_pct
  FROM weekly_totals
),
weekly_cac_change AS (
  SELECT
    week_start_date,
    channel,
    weekly_spend,
    weekly_acquisitions,
    weekly_cac,
    weekly_roas,
    weekly_ctr_pct,
    LAG(weekly_cac) OVER (
      PARTITION BY channel
      ORDER BY week_start_date
    )                                                   AS prior_week_cac,
    100 * ROUND(
      (weekly_cac - LAG(weekly_cac) OVER (
        PARTITION BY channel ORDER BY week_start_date)
      )
      / NULLIF(LAG(weekly_cac) OVER (
        PARTITION BY channel ORDER BY week_start_date), 0)
    , 4)                                               AS cac_wow_change_pct
  FROM weekly_metrics
)
SELECT * FROM weekly_cac_change
ORDER BY channel, week_start_date;


-- SECTION 3 : WEEKLY ROAS BY CHANNEL
-- Identifying where channels are driving value vs destroying value

WITH weekly_roas AS (
  SELECT
    week_start_date,
    channel,
    ROUND(SUM(spend_brl), 2)                            AS weekly_spend,
    ROUND(SUM(revenue_brl), 2)                          AS weekly_revenue,
    ROUND(SUM(revenue_brl)
      / NULLIF(SUM(spend_brl), 0), 2)                   AS weekly_roas,
    CASE
      WHEN SUM(revenue_brl)
        / NULLIF(SUM(spend_brl), 0) < 1.0
      THEN 'Below 1.0 — value destruction'
      WHEN SUM(revenue_brl)
        / NULLIF(SUM(spend_brl), 0) < 2.0
      THEN 'Below 2.0 — watch'
      ELSE 'Healthy'
    END                                                 AS roas_status
  FROM performance
  WHERE channel != 'Organic'
  GROUP BY week_start_date, channel
)
SELECT * FROM weekly_roas
ORDER BY channel, week_start_date;


-- SECTION 4 : FUNNEL ANALYSIS BY CHANNEL
-- Identifying where traffic quality breaks down by channel

WITH funnel_stages AS (
  SELECT
    channel,
    SUM(impressions)                                    AS impressions,
    SUM(clicks)                                         AS clicks,
    SUM(questionnaire_starts)                           AS q_starts,
    SUM(checkouts)                                      AS checkouts,
    SUM(acquisitions)                                   AS acquisitions
  FROM performance
  GROUP BY channel
),
funnel_rates AS (
  SELECT
    channel,
    impressions,
    clicks,
    q_starts,
    checkouts,
    acquisitions,

    -- Stage 1: Impression to click
    100 * ROUND(clicks / NULLIF(impressions, 0), 4)       AS ctr_pct,

    -- Stage 2: Click to questionnaire start
    -- Measures landing page and ad relevance quality
    100 * ROUND(q_starts / NULLIF(clicks, 0), 4)          AS click_to_q_start_pct,

    -- Stage 3: Questionnaire start to checkout
    -- Measures intent quality of traffic entering the funnel
    100 * ROUND(checkouts / NULLIF(q_starts, 0), 4)       AS q_start_to_checkout_pct,

    -- Stage 4: Checkout to acquisition (approval rate)
    -- Low approval rate = channel driving low quality traffic
    100 * ROUND(acquisitions / NULLIF(checkouts, 0), 4)   AS approval_rate_pct,

    -- Full funnel: impression to acquisition
    100 * ROUND(acquisitions / NULLIF(q_starts, 0), 4)    AS cvr_pct
  FROM funnel_stages
)
SELECT * FROM funnel_rates
ORDER BY acquisitions DESC;



-- SECTION 5 : ATTRIBUTION COMPARISON
-- Comparing the three attribution methodologies in the dataset
-- nb_attr_acq = new buyer attributed acquisitions
-- last_click_attr_acq = last click attributed acquisitions
-- coupon_attr_acq = coupon attributed acquisitions

WITH attribution_comparison AS (
  SELECT
    channel,
    SUM(acquisitions)                                   AS reported_acquisitions,
    SUM(nb_attr_acq)                                    AS new_buyer_attributed,
    SUM(last_click_attr_acq)                            AS last_click_attributed,
    SUM(coupon_attr_acq)                                AS coupon_attributed,
    SUM(acquisitions) - SUM(last_click_attr_acq)        AS last_click_gap,
    100 * ROUND(SUM(nb_attr_acq)
      / NULLIF(SUM(acquisitions), 0), 4)                AS new_buyer_rate_pct
  FROM performance
  GROUP BY channel
)
SELECT * FROM attribution_comparison
ORDER BY reported_acquisitions DESC;


-- SECTION 6 : CHANNEL SCORECARD
-- Unified channel summary view

WITH performance_base AS (
  SELECT
    channel,
    campaign_type,
    SUM(spend_brl)                                        AS total_spend,
    SUM(acquisitions)                                     AS total_acquisitions,
    SUM(revenue_brl)                                      AS total_revenue,
    SUM(impressions)                                      AS total_impressions,
    SUM(clicks)                                           AS total_clicks,
    SUM(questionnaire_starts)                             AS total_q_starts,
    SUM(checkouts)                                        AS total_checkouts
  FROM performance
  GROUP BY channel, campaign_type
),
channel_scorecard AS (
  SELECT
    channel,
    campaign_type,
    total_acquisitions,
    ROUND(total_acquisitions
      / SUM(total_acquisitions) OVER () * 100, 2)         AS acquisition_share_pct,
    ROUND(total_spend
      / NULLIF(total_acquisitions, 0), 2)                 AS cac,
    ROUND(total_revenue
      / NULLIF(total_spend, 0), 2)                        AS roas,
    ROUND(total_acquisitions
      / NULLIF(total_q_starts, 0) * 100, 2)               AS cvr_pct,
    ROUND(total_clicks
      / NULLIF(total_impressions, 0) * 100, 2)            AS ctr_pct,
    ROUND(total_acquisitions
      / NULLIF(total_checkouts, 0) * 100, 2)              AS approval_rate_pct,
    ROUND(total_revenue
      / NULLIF(total_acquisitions, 0), 2)                 AS revenue_per_acquisition,
    CASE
      WHEN total_spend = 0
        THEN 'Organic — no spend baseline'
      WHEN total_revenue / NULLIF(total_spend, 0) >= 10
        THEN 'Tier 1 — Scale immediately'
      WHEN total_revenue / NULLIF(total_spend, 0) >= 2
        THEN 'Tier 2 — Maintain and optimise'
      WHEN total_revenue / NULLIF(total_spend, 0) >= 1
        THEN 'Tier 3 — Review and test'
      ELSE
        'Tier 4 — Reallocate budget'
    END                                                   AS channel_tier

  FROM performance_base
)
SELECT * FROM channel_scorecard
ORDER BY
  CASE channel_tier
    WHEN 'Tier 1 — Scale immediately'     THEN 1
    WHEN 'Tier 2 — Maintain and optimise' THEN 2
    WHEN 'Tier 3 — Review and test'       THEN 3
    WHEN 'Organic — no spend baseline'    THEN 4
    ELSE 5
  END,
  roas DESC;