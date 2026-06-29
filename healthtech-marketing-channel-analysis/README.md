# 🩺 &nbsp; Heathtech Marketing Channel Analysis

## 📚 &nbsp; Overview

SQL and Tableau analysis investigating which marketing channels are driving growth and which are destroying efficiency for a D2C healthtech subscription business. Identifies why performance has plateaued and surfaces the top efficiency and scaling levers.

## 📝 &nbsp; Business Questions

- Which channels are driving acquisition growth?
- Which channels are destroying efficiency on a CAC and ROAS basis?
- Why has performance plateaued across the 12-week period?
- What are the top three efficiency levers?
- What are the top three scaling levers?

## 🔢 &nbsp; Dataset

Performance table:
| column | definition |
|---|---|
| `week_start_date` | date of the week commencing |
| `channel` | marketing channel |
| `campaign_type` | acquisition / lifecycle / organic |
| `price_point_brl` | price of the product |
| `creative_variant` | A / B |
| `spend_brl` | amount spent in Brazilian Real |
| `impressions` | how many times ad was shown |
| `clicks` | count of user interactions where ad is clicked |
| `ctr` | percentage of who clicked on a link/ad/email out of those who saw it |
| `cpc_brl` | cost per click |
| `questionnaire_starts` | count of users who started the questionnaire |
| `checkouts` | count of completed transactions |
| `acquisitions` | count of new customers |
| `approval_rate` | percentage of checkouts that approved acquisitions |
| `cac_brl` | customer acquisition cost |
| `ltv_brl` | total estimated revenue a customer will generate over the time they use the product |
| `revenue_brl` | total amount the business earns from selling its products before expenses |
| `roas` | total revenue earned for every amount spent on advertising |
| `nb_attr_acq` | new buyer attributed acquisitions |
| `last_click_attr_acq` | last click attributed acquisitions |
| `coupon_attr_acq` | coupon attributed acquisitions |

Cohort table:
| column | definition |
|---|---|
| `price_point_brl` | price of the product |
| `cohort_month` | grouped customers by month |
| `acquisition_channel` | marketing channel |
| `users` | count of users |
| `m1_retention_pct` | percentage of users who return one month after their first purchase |
| `m2_retention_pct` | percentage of users who return two months after their first purchase |
| `m3_retention_pct` | percentage of users who return three months after their first purchase |
| `avg_ltv_brl` | average lifetime value cost |
| `avg_cac_brl` | average customer acquisition cost |

## 🛠️ &nbsp; Tools

- MySQL
- Tableau
- SQL

## 💡 &nbsp; Key Findings

- Performance has plateaued due to creative fatigue on Meta, underinvestment in demand generation channels (TikTok, Creators, Affiliates) in comparison to Meta & Google. Lifecycle channels (CRM & RAF) are underleveraged depsite strong ROAS and revenue growth
- Programmatic consistently delivers low ROAS (<1) and the most inefficient CAC in comparison to all other channels
- M3 retention is relatively consistent across channels, indicating retention is product-driven rather than channel-driven

## 📌 &nbsp; Methodology Notes

- All rate & cost metrics (CPC, LTV, CTR, CAC, CVR, ROAS) recalculated from summed components to avoid averaging errors
- LTV weighted by acqusition volume per channel
- Organic channel excluded from ROAS comparisons due to zero ad spend
