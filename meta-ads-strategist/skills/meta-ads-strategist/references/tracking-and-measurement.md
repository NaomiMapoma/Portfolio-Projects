# Tracking and Measurement

- **Last verified:** 18-11-2026
- **Confidence:** Medium
- **Used by:** SKILL.md workflow step 3; `diagnostics.md` sections on reporting mismatches and scaling

## Purpose and scope

Covers pixel and tracking setup, attribution windows, A/B tests, lift tests, incrementality and MMM.
Read when the user asks about measurement, data discrepancies, proving impact or budget decisions.

## Key principles (stable)

1. **Platform-reported results are not the same as incremental impact.** Attribution says which ads were *associated* with conversions. Incrementality says which conversions the ads *caused*.
2. **Triangulate.** No single method is the truth. Use attribution for day-to-day optimisation, incrementality tests to validate causal impact, and MMM for cross-channel budget planning.
3. **Garbage in, garbage out.** Weak or inconsistent tracking undermines attribution, optimisation and every test. Check tracking before interpreting results.
4. **Compare like with like.** Same attribution settings, date ranges and conversion definitions. Compare trends rather than absolute numbers across sources.
5. **Match the method to the decision.** Daily optimisation, budget reallocation, channel mix and proof of value each need a different tool.
6. **Experiments beat inference.** Where a decision is big or contested, a properly designed test beats a model or a platform report.
7. **State uncertainty.** Every measurement has error. Say how confident you are and what would change the conclusion.
8. **Measurement rules change.** Attribution windows, definitions and tools have changed recently and will again. Refer to official Meta documentation in unsure (see Attribution)

## Tracking setup (guidance only)

**What this section is for:** helping Claude judge whether tracking is healthy, ask the right questions and spot likely causes of data problems. It does not tell users how to implement tracking. Point them to Meta's documentation or their developer.
 
**What "good" looks like**
- The key conversion events are tracked **reliably** and match the business definition (e.g. a purchase or a qualified lead, not just a page view).
- **Browser and server signals both exist** (Pixel and Conversions API) and are **deduplicated**, so each conversion is counted once.
- Events carry the **parameters that matter** (e.g. value, currency, product or lead-quality info).
- **Event quality is monitored** (Meta's Events Manager shows quality indicators such as event match quality).
- **Consent** is handled for the markets served. See `policy-and-compliance.md`.
- **Offline or CRM outcomes** are fed back where lead quality or sales are determined after the click.
- **Tracking is tested** after site, tag, consent or checkout changes.

**Questions Claude should ask**
- Which events are tracked, and which is used for optimisation?
- Pixel only, or Pixel plus Conversions API? Is deduplication set up?
- Any recent site, tag manager, consent banner or checkout changes?
- Are results compared with backend or analytics data? How closely do they align?
- Is there a CRM feedback loop for lead quality or offline sales?
- Which markets, and how is consent handled?

**Common symptoms and what they might mean**
| Symptom | Possible tracking causes | Where to look |
|---|---|---|
| Conversions suddenly drop | Tag removed, dropped, stopped firing or broken, consent change, checkout change, event renamed | Events Manager, recent site/tag changes, Meta Ads Data Advisor (previously Meta Pixel Helper) |
| Conversions double | Duplicate events, no deduplication | Event IDs, Pixel and API both firing |
| Meta shows far more than backend | Overlapping attribution windows, view-through, duplicate counting | See Attribution |
| Meta shows far less than backend | Consent loss, blocked browser signals, missing server events | Consent setup, Conversions API |
| Value or ROAS looks wrong | Missing or wrong value/currency parameters | Event parameters |
 
**Out of scope for this file:** step-by-step implementation, code and platform configuration. Link to Meta's developer docs instead.

## Attribution

**What it is**
- An attribution window is the period after a click or view in which a conversion can be credited to an ad. The attribution setting affects both reporting and, with standard attribution, how delivery is optimised.

**Current state**
- Default setting for website conversions is reported as **7-day click and 1-day view** (with 1-day engage-through).
- Windows reported as still available: **1-day click, 7-day click, 28-day click, 1-day engaged view and 1-day view.**
- The **7-day and 28-day view** window is reported as no longer available as an optimisation setting or viewable via Compare Attribution Settings.
- Meta have changed the definition of click-through attribution for website and in-store conversions to exclusively include link clicks and moved non-link interactions (like likes, shares, saves, comments, and qualifying short video views) into a 1-day engage-through category.

**How to talk about attribution**
- Always state the window and setting behind any number.
- Compare periods before and after the January 2026 change with care, since reported conversions may differ for reasons unrelated to performance.
- Explain why Meta, analytics and backend numbers differ: different windows, view-through credit, last-click vs multi-touch, timing, deduplication, and consent loss. See `diagnostics.md`.
- Never declare one source "right". Explain what each measures.
- For upper-funnel activity, shorter view windows mean attribution will understate impact. Use lift or MMM to assess it.

## A/B tests

**What they're for**
- Comparing two (or more) versions of one variable (creative, audience, bid approach, landing page) under controlled conditions.
- A/B tests answers the question is A better than B. Lift tests measure **what happened** because of our ads or our media investment versus doing nothing. Don't confuse them.

**Meta's A/B test tool vs manual duplication**
- Meta's built-in A/B test tool splits the audience randomly into non-overlapping groups, so each person sees only one version.
- Duplicating ad sets manually can leave audiences overlapping and delivery uneven, which weakens the comparison.

**Design principles**
1. **One variable** at a time, so you know what caused the difference.
2. **Define the hypothesis and success metric before launch** (e.g. cost per qualified lead).
3. **Plan sample size and duration up front.** Run a power analysis where possible. A test that can only detect large effects isn't worth running if you expect a small one.
4. **Don't edit during the test.** Changes reset learning and contaminate results.
5. **Don't call winners early.** Wait until the planned duration and sample size, and avoid stopping on the first good day.
6. **Use a meaningful metric.** Cost per outcome further down the funnel is usually better than clicks or CTR.
7. **Record the result and the decision**, including inconclusive outcomes.

**Creative testing caveat**
- Delivery tends to concentrate on some ads, so a test inside a normal campaign may not give each ad a fair chance. Use a dedicated test structure or the A/B tool. See `creative.md` and `delivery-and-algorithm.md`.

**Read results with care**
- Report the difference, the uncertainty and whether it was statistically meaningful, not only "variant B won".
- A win on a test doesn't guarantee the same result at scale.

**Practitioner guidance**
- Minimum test duration: 4-6 weeks
- Significance approach you use: 95% confidence interval

## Lift tests and incrementality

**Core idea**
- Compare a group exposed to ads (test) with a comparable group not exposed (control). The difference is the incremental effect.

**Formulas**
```
Incremental conversions = Test conversions − Expected conversions without ads (from control)
Lift (%)                = (Test conversion rate − Control conversion rate) / Control conversion rate
iROAS                   = Incremental revenue / Spend
Incremental CPA         = Spend / Incremental conversions
```
Always give the confidence interval or uncertainty around lift, not just the point estimate.
 
**Test types**

| Type | How it works | Best for | Watch out for |
|---|---|---|---|
| **Conversion Lift (Meta)** | Randomised test run within Meta; free; mainly for comparing ads vs no ads within Meta. | Proving Meta's incremental impact | Meta-only view; eligibility requirements |
| **Geo-lift / matched-market** | Compare the treatment vs control regions (ads vs no ads) matched by baseline characteristics and parallel conversion trends | Total causal impact of channel performance | Needs enough comparable regions, a power analysis and a cooldown period |
| **Holdout tests** | Withhold ads from a random group of customers or users | Measuring true incremental impact | Needs scale and clean randomisation |
 
**Meta Conversion Lift requirements (reported)**
- A campaign that started in the past year with spend of about $5,000 USD or more.
- For self-serve tests, the Conversions API sending an event with an event match quality score above 5.
- No extra cost for the test itself, though campaigns may have budget requirements.

**Design guidance**
- Run a **power analysis** before spending: estimate the minimum detectable effect at your budget and duration.
- Geo-lift guidance: identify matched pairs of geographic markets that are as similar as possible on baseline characteristics and validate the matching by running a pre-test period. Run for a minimum of six weeks.
- Include a **cooldown period** after the main test, since delayed conversions can still arrive.
- Keep other major changes stable during the test.
- Pre-register the metric and decision rule.

**Using the results**
- Calibrate platform-reported ROAS or CPA with the incrementality result (e.g. an adjustment factor), noting its limits.
- Use lift results to set budget and targets, not to micromanage ad sets.
- Re-test periodically. Incrementality changes with spend level, creative and market.
- Retargeting and brand campaigns often shows lower incrementality than platform attribution suggests. Test before assuming.

**What to ask the data science teams regarding your incrementality/holdout studies**
1. **Ask about MAPE (mean absolute percentage error)**: MAPE basically tells you how far off the model’s prediction is compared to the actual. So a good model should have a low MAPE, usually you want somewhere in the range of 8-12% that is considered excellent
2. **R-squared**: R-squared tells you how well does the model explain the variance in the data, meaning if revenue goes up then goes back down, the R-squared should tell you the model understands why revenue is going up then going down. As there are some things you may want to add to your model like confounding variables (e.g. a limited time offer happened that caused revenue to spike). You want to aim for an R-squared above 0.7, the higher the better (the closer to 1 the better); however, anything above 0.92 could be considered overfitted but it doesn’t always mean this. Anything below a 0.69 you need to throw out.
3. **Statistical significance**: Statistical significance means you rejected the null hypothesis. The null hypothesis is usually that the effect is zero. So 99% stat sig means that we are 99% sure that this effect isn’t nothing.
4. **Confidence bands**: Your iROAS is never just one number, it’s a median that falls on a range, above and below a bell curve.
5. **What do we do next?**: Incrementality studies are a snapshot in time. So we want to know what happens next. What levers do I pull in the ad account to increase incrementality? What happens if we double spend? Will our iROAS still be the same if we triple spend? Are we already at a point of saturation/diminishing returns 

**Limitations**
- A single test describes one moment, one audience and one spend level at one particular point in time.
- Results can be inconclusive. Say so rather than force a conclusion.
- A Meta conversion lift study measures incrementality only within Meta's own ecosystem and cannot capture cross-channel effects, multi-touch attribution shifts, or diminishing returns at different spend levels

## MMM

**What it is**
- Marketing mix modelling uses aggregate historical data (spend, sales, seasonality, promotions, external factors) to estimate each channel's contribution and diminishing returns. A good MMM can help answer much broader questions: When should we spend? The same amount of media spend can produce very different results depending on timing, seasonality, and the customer journey. Where are we reaching saturation? More spend doesn't always mean more incremental outcomes. MMM can help identify where additional investment is producing diminishing returns. What is actually driving demand?

**What it can and can't answer**
| Good for | Not good for |
|---|---|
| Cross-channel budget allocation | Ad-level or creative-level decisions |
| Diminishing returns by channel | Fast daily optimisation |
| Long-term and offline effects | Proving causality on its own |
| Planning scenarios | Small or very new accounts without enough history |
 
**Data needed**
- Typically 2 to 3 years of aggregate data (weekly is common), spend by channel, outcome data, promotions, pricing, seasonality and external factors.
- A realistic build can take weeks or months, not days

**Open-source tools**
- **Robyn** (Meta, R with Python availability)
- **Meridian** (Google)
- **PyMC-Marketing** (PyMC Labs)
- Plus commercial platforms (e.g. Stella). Treat vendor claims with care.

**Combining MMM with experiments**
- Calibrate MMM with lift tests, either qualitatively (do they point the same way?) or by building experiment results into the model.
- MMMs can overfit. Experiments give external evidence.
- Geo experiments are often used as the calibration source.

**Cautions**
- Results depend on assumptions and priors. Make them explicit.
- Correlated spend patterns (everything goes up in Q4) make channels hard to separate.
- MMM gives ranges, not exact answers. Report uncertainty.
- Don't present MMM output as ad-level truth.

**What the skill should do**
- Advise on when MMM is appropriate and what's needed.
- Explain how to read results and their limits.
- Don't claim to build or validate a model in chat.
- Refer the user to their data science team for any technical explanations

## Decision guidance

- **If** the user asks "is Meta working?" **then** ask what decision it informs, and recommend the appropriate method (attribution for monitoring, downstream and revenue impacts / results, lift test for causal proof, MMM for mix).
- **If** Meta and backend or analytics numbers disagree **then** compare windows, settings, definitions, deduplication and consent before concluding anything. Don't declare one right.
- **If** conversions changed around January 2026 or after an attribution setting change **then** check whether the change is a reporting effect before diagnosing performance.
- **If** the user is making a **budget reallocation** or scaling decision **then** prefer incrementality evidence over platform-reported ROAS where available.
- **If** the user wants to prove value of upper-funnel or retargeting spend **then** recommend a lift or holdout test, since attribution will mislead.
- **If** the user wants to run a test **then** ask for the hypothesis, the metric, expected effect size, budget and duration, and run a power check before launch.
- **If** a test is underpowered **then** say so and recommend a larger effect, longer duration, fewer variants or a different method.
- **If** the user stops a test early because a variant looks ahead **then** warn about false positives and recommend completing the plan.
- **If** tracking changed during a test **then** treat the results as unreliable.
- **If** the user asks about MMM **then** ask about data history, channels, spend variation and decision needs. Warn that small or flat-spend accounts may not support a reliable model. Anything technical, refer them to their data science / marketing measurement team
- **If** MMM and platform attribution disagree **then** treat that as a signal to run an experiment, not to pick a winner.
- **If** the user has no tracking or measurement basics **then** fix tracking before testing or modelling.
- **If** a policy or privacy issue affects tracking (consent in UK/EU) **then** see `policy-and-compliance.md`.
- **If** details of a Meta measurement feature may have changed **then** check Meta's current pages first.

## Common mistakes

- **Treating platform-reported ROAS as incremental ROAS.**
- **Comparing numbers with different attribution windows or settings,**
- **Declaring one data source "right"** instead of explaining what each measures.
- **Ignoring deduplication,** so conversions are double counted.
- **Ignoring consent loss** in UK/EU, then misreading the drop as performance.
- **Testing without a hypothesis, metric or power estimate.**
- **Testing several variables at once** and being unable to say what worked.
- **Calling winners early,** or editing during a test.
- **Running a lift test with too little spend or event volume** to detect a realistic effect.
- **Over-trusting a single test** or a single MMM run.
- **Treating MMM as ad-level truth,** or building one on too little data.
- **Judging upper-funnel activity on last-click or short windows.**
- **Reporting a point estimate without uncertainty.**
- **Using old window names** (7-day view, 28-day view) from outdated guides.

## Sources

- [Event Match Quality](https://www.facebook.com/business/help/765081237991954?id=818859032317965)
- [Conversions API](https://www.facebook.com/business/help/308855623839366?id=818859032317965)
- [Meta Attribuiton Models](https://www.facebook.com/business/help/460276478298895?id=561906377587030)
- [Meta's Click Attribution](https://www.facebook.com/business/news/click-attribution)
- [Meta Attribution Settings](https://en-gb.facebook.com/business/help/654970342692714)
- [Meta for Developers: Ads Insights API metric availability updates (Oct 2025)](https://developers.facebook.com/blog/post/2025/10/16/ads-insights-api-metric-availability-updates/)
- [Meta Conversion Lift](https://www.facebook.com/business/help/221353413010930?id=547299432790676)
- [How to set up Conversion Lift](https://www.facebook.com/business/help/1598740610886911)
- [Meta A/B testing](https://www.facebook.com/business/help/1738164643098669?id=445653312788501)
- [CRM system integration for lead ads](https://www.facebook.com/business/help/301355140655035?id=735435806665862)
- [CRM for qualified leads](https://www.facebook.com/business/help/279369167153556?id=735435806665862)

## Related files

- `objectives-and-bidding.md`
- `structure-and-budget.md`
- `diagnostics.md`