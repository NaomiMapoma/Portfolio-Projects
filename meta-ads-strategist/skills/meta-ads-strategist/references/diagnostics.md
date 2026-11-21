# Diagnostics: symptom → causes → checks

- **Last verified:** 18-11-2026
- **Confidence:** Medium
- **Used by:** SKILL.md workflow step 3 onward. Start here when the user describes a problem rather than a campaign element.

## How to use this file

1. Match the user's symptom to a section below.
2. Run "Check first" before forming any hypothesis. Most issues are tracking, timing or data problems.
3. Rank likely causes by evidence. Don't present a cause as fact without supporting data.
4. Always judge at campaign level before ad set level (see `delivery-and-algorithm.md`, breakdown effect).
5. Ask for missing data instead of assuming.

## Universal pre-checks (run for every symptom)

- Date range and comparison period are like-for-like (same weekdays, same length)
- Attribution window and setting haven't changed
- Conversion tracking is firing correctly (pixel and Conversions API, deduplication)
- Recent edits: budget, creative, targeting, bid, objective (edits can reset learning)
- Seasonality, promotions or competitor activity in the period
- Site or landing page changes, outages, stock or pricing changes
- Spend level is large enough to draw conclusions (avoid reading noise)
- Ad have been approved and not rejected or flagged by Meta
- There are no reported Meta outages or bugs

---

## 1. CPA rising / ROAS falling

**Check first:** universal pre-checks, then whether the change is in CPM, CTR or conversion rate.

| Signal | Likely cause | Look at | See |
|---|---|---|---|
| CPM up, CTR flat | Auction pressure or seasonality | Q4 / event periods, audience size, placement mix | `delivery-and-algorithm.md` |
| CTR down, frequency up | Creative fatigue | Frequency trend, creative-level CTR, age of ads | `creative.md` |
| CTR fine, conversion rate down | Post-click problem or tracking | Landing page, site speed, offer, pixel/CAPI health | `tracking-and-measurement.md` |
| One ad worse, campaign blended fine | Breakdown effect, not necessarily a problem | Blended campaign CPA, incrementality | `delivery-and-algorithm.md` |
| Everything worse after an edit | Learning reset or structural change | Edit history, learning status | `structure-and-budget.md` |

**Don't:** pause ad sets on marginal CPA or ROAS alone. You shouldn't optimise off of platform metrics only
**Recommend:** the recommended nexts / actions linked to the problem and advise one optimisation at a time

## 2. Creative fatigue

**Check first:** is performance decline concentrated in older ads?
- **Signals:** frequency rising, CTR/hook rate falling, CPA rising, spend concentrating in few ads
- **Distinguish from:** audience saturation (small reach, high frequency across all creative) and seasonality
- **Actions:** introduce new concepts / angles (not just new variants of the same concept), vary format and message angle (aimed to cover customers at each of these stages: problem-aware, product-aware and solution-aware)
- **Confidence note:** the exact fatigue thresholds vary by account. State "threshold" only if backed by the user's data.
- **See:** `creative.md`

## 3. "Learning limited" / unstable delivery

**Check first:** conversion volume per ad set vs what Meta requires for the optimisation event (verify the current figure in official docs).
- **Likely causes:** too many ad sets splitting budget, optimising for an event with very low volumes, budget too low, frequent edits
- **Actions:** consolidate, optimise for a higher-volume event, make fewer and larger edits
- **Trade-off:** consolidation reduces control and specific learnings
- **See:** `structure-and-budget.md`, `objectives-and-bidding.md`

## 4. Ad set or ad not spending / delivery concentrated in one ad

**Check first:** ad status, review status, budget, schedule, bid or cost cap too restrictive, audience too narrow, not enough creative diversity.
- **Concentration in one ad:** often expected behaviour; the system favours what it predicts will perform. Check whether new ads got meaningful delivery before judging them (ideally give ads a chance to spend x3 your target CPA before assessing).
- **Actions:** loosen cost controls, broaden audience, test creative in a structure that gives fair exposure
- **Confidence:** Medium. Mechanism is inferred, not Meta-stated.

## 5. Scaling made performance worse

**Check first:** size and speed of budget changes, learning status, creative supply.
- **Likely causes:** budget jump forcing delivery into costlier auctions, creative can't sustain more spend, audience saturation, diminishing returns
- **Actions:** stagger increases, scale creative alongside budget, assess incrementality of the extra spend
- **Reminder:** average and marginal CPA diverge as you scale. Don't judge on average alone.
- **See:** `tracking-and-measurement.md`

## 6. Meta numbers don't align with backend / GA / CRM

**Check first:** attribution windows, view-through vs click-through, time zone, conversion definition, deduplication, offline and cross-device conversions.
- **Don't:** claim one source is "right". Explain what each measures.
- **Actions:** align definitions, compare trends not absolutes, consider lift or incrementality testing
- **See:** `tracking-and-measurement.md`

## 7. High CTR, low conversions

**Check first:** audience-message mismatch, clickbait creative, landing page continuity, accidental clicks.
- **Actions:** check landing page experience, test different creative angles and hooks

## 8. Lead quality dropped (lead gen)

**Check first:** form type and friction, qualifying questions, optimisation event, CRM feedback loop.
- **Likely causes:** optimising for volume of leads, low-friction forms, no downstream signal sent back
- **Actions:** add qualifying questions, send quality signals back via CRM integration, optimise toward a deeper event
- **Sector note:** for regulated sectors, check policy and compliance first (`policy-and-compliance.md`).

## 9. CPM spike

**Check first:** seasonality and events, audience size, placement shifts, creative relevance, competitor activity.
- **Actions:** compare against the same period last year if available, check placement and audience breakdowns, don't overreact to short-term swings

---

## Output reminder

For every diagnosis, return: **Finding → Evidence → Recommendation → Confidence → How to test**. Label hypotheses as hypotheses.

## Maintenance

- Add a new symptom whenever a real account throws up a case not covered here.
