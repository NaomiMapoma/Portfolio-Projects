# Structure and Budget

- **Last verified:** 18-11-2026
- **Confidence:** Medium
- **Used by:** SKILL.md workflow steps 4 and 5; `diagnostics.md` sections on learning limited, scaling and delivery

## Purpose and scope

Covers campaign and ad set structure, CBO vs ad set budgets, Advantage+ campaigns and consolidation.
Read when the user asks about structure, budget allocation or scaling

## Key principles (stable)

1. **Structure exists to concentrate signal, not to organise your thinking.** Fewer campaigns and ad sets mean more conversion volume per learning unit. Split only when there's a clear reason (different objective, market, product economics, budget ring-fencing).
2. **Every split has a cost.** More ad sets divide budget and data, so each new one needs a reason.
3. **Separate jobs shouldn't share a budget.** Finding winners (testing) and scaling proven concepts usually work better in separate campaigns, so test noise doesn't disturb a stable one.
4. **Judge at campaign level when budgets are shared.** With a campaign-level budget, unequal spend across ad sets is normal and isn't a verdict on any single ad set. See the breakdown effect in `delivery-and-algorithm.md`.
5. **Structure and creative supply must match.** Consolidated structure only works if there's enough distinct creative to feed it. See `creative.md`.

## Campaign structure

**The hierarchy**
- **Campaign:** objective and, increasingly, the budget strategy.
- **Ad set:** audience, placements, schedule and (if not using a campaign-level budget) the budget.
- **Ad:** the creative and copy.
- Each level controls a different lever. Mixing them up is a common source of account problems.

**Principles for structure**
1. Start simple and add complexity only when there's a clear reason.
2. Each campaign should have one clear job (e.g. driving awareness, driving conversions).
3. Each split should be justified by something that changes the decision (e.g. objective, market, economics, test, compliance).
4. Make structure match conversion volume and creative supply. More splits need more of both.
5. Keep a stable core and test around it, not inside it.
6. Document the structure and the reason for each part, so changes can be judged later.

**Scenario blueprints**

| Scenario | Suggested structure | Why |
|---|---|---|
| Daily spend under £1k / day | One CBO campaign, 1 ad set, several distinct creatives | Concentrates signal with lower budgets |
| £1-5k spend / day (single product / offering) | 1 structured ABO campaign, 3-5 ad sets (ad set per persona / angle), several distinct creatives per ad set | Enough budget for creative rotation |
| £1-5k spend / day (multi product / offering)| 1 CBO campaign for scaling, 1 ABO campaign for testing, ad sets per persona / angle, several distinct creatives per ad set  | Enough budget for creative rotation, testing and scaling |
| £5-10k spend / day and £10k+ spend / day | Advantage+ sale campaign (ASC) for scale, CBO for retargeting and high-intent or testing, large creative volume | Focus on automation and creative diversity at scale |
 
**When to separate** (ad account, campaign or ad set)
- Different **objectives** or conversion events
- Different **markets**, languages or currencies
- Different **products or offers** with different margins or targets
- **Budget ring-fencing** (a segment must get guaranteed spend)
- **Prospecting vs retargeting**, where you need to control the mix
- **Compliance or special ad category** requirements
- **Testing vs scaling**, so tests don't disturb proven performers
- Different **measurement needs** (e.g. a lift test or holdout)
- Different **attribution or reporting** requirements

**When to consolidate**
- Conversion volume is low or the ad set is "learning limited" (see `delivery-and-algorithm.md`)
- Ad sets have **similar audiences** and the same goal
- The budget per ad set is too small to deliver meaningful results
- The only difference between ad sets is a minor targeting tweak
- You can't explain what decision each separate ad set informs

**Ad set level**
- Number of ad sets: 1 ad set per persona / angle (as budget allows).
- How to calculate the max number of ad sets for your campaign: `Max # of ad sets = Total weekly budget / Cost per result * 50`
- Audience approach: see `audiences.md`.
- Placements: consider letting Meta choose unless there's a specific reason to restrict. Recommeded to exclude Audience network placements
- Avoid duplicating the same audience across multiple ad sets without a reason, since it can split data and delivery.

**Ad level**
- Number of ads per ad set: minimum 6-9 (dependent on the budget, more if budget allows). Don't state a universal number.
- Focus on distinct concepts rather than minor variants. See `creative.md`.
- Keep ads in the same ad set only where it makes sense to compare them.

**Naming conventions** (optional but useful)
- Pattern example: `Year_Market_Business Name_Channel_Platform_Objective_Optimisation_Audience_Format_Creative Name_Creative Version`
- Keep names consistent so reporting and filters work.
- Include a version or date so changes are traceable.

**Structure and automation**
- Advantage+ options (campaign budget, audience, placements, sales campaigns) automate parts of structure. The more automation, the fewer structural decisions remain, but the less control you have. See "Budget approaches".
- Meta has merged manual and Advantage+ campaign creation into a single unified setup flow in Ads Manager. Rather than choosing between two separate campaign types up front, new Sales, Leads, and App campaigns start with Advantage+ automation switched on by default, while allowing you to toggle individual controls back to manual

**How Claude should talk about structure**
- Ask about conversion volume, creative supply, budget, markets and constraints before recommending a structure.
- Present the recommendation as a simple outline and explain why each split exists.
- State the trade-off (control vs data concentration) and the confidence level.
- Don't prescribe one structure for every account.

## Budget approaches

| Approach | How it works | Use when | Risks |
|---|---|---|---|
| **Advantage+ campaign budget** (formerly CBO) | One budget at campaign level, distributed across ad sets in real time by Meta. | Scaling proven concepts; enough conversion volume; no single ad set needs protecting. | Spend can concentrate heavily in one ad set; less control over testing. |
| **Ad set budgets** (often called ABO) | Each ad set has its own budget; money isn't moved between ad sets. | Testing with fixed spend per ad set; guaranteeing minimum spend for a segment (e.g. persona, angle). | More manual management; fragmenting budget across many ad sets can limit learning. |
| **Ad set budget sharing** | Meta can share part of an ad set's budget with other ad sets when likely to improve performance. Reported cap: up to 20% of an ad set's budget. | You want some control but some automation. | Unclear how different it is in practice from campaign budget with min/max limits; verify current availability. |
| **Advantage+ sales / leads campaigns** (formerly Advantage+ shopping) | Automated campaign type covering audience, placements, budget distribution and creative. | Ecommerce and other sales goals with strong creative and conversion volume. | Less transparency and control |

## Scaling

- **Scale on evidence, not impatience.** Check the data is sufficient and tracking is healthy before increasing budget. See `tracking-and-measurement.md`.
- **Increase in stages.** Big jumps can destabilise delivery. Typical practitioner increments are modest steps with time to settle: (Example: e.g. increasing by 15-20% increments).
- **Scale creative with budget.** More spend needs more distinct concepts, or frequency rises and efficiency falls. See `creative.md`.
- **Expect marginal CPA to exceed average CPA as spend grows.** Judge scaling decisions on marginal efficiency and incrementality, not average CPA alone.
- **Choose the scaling route deliberately:** increase the budget on the winning campaign, duplicate winning ads into a scaling campaign, or add new concepts. Note that if you duplicate a winning ad into a new campaign, you are resetting learnings and it may not perform the same in a new environment set up
- **Know when to hold.** Signals to pause scaling: rising frequency with falling CTR or unstable delivery after a change.
- **Protect the baseline.** Keep a stable core campaign while you test changes elsewhere.

## Decision guidance

- **If** conversion volume or budget is low **then** consolidate ad sets and consider a higher-volume optimisation event before segmenting further. *Why:* fragmented data slows learning.
- **If** you need guaranteed spend on a segment (e.g. existing customers, a market, a regulated product) **then** use ad set budgets or a separate campaign. *Why:* campaign budgets may not spend equally.
- **If** one ad set takes most of a shared budget **then** don't call the others failures. Check whether they're distinct concepts and whether they had a fair chance. *Why:* uneven spend is normal.
- **If** you're testing creative or audiences with fixed spend per variant **then** use ad set budgets or a dedicated test campaign. *Why:* control over exposure.
- **If** a proven concept is ready to scale **then** move it into a consolidated scaling campaign with a campaign budget. *Why:* gives delivery room to allocate.
- **If** performance drops straight after a budget or structure change **then** check recent edits and monitor stability for minimum 1-2 weeks before blaming audiences or creative.
- **If** the user asks "should I use CBO or ad set budgets?" **then** ask: what's the goal, the conversion volume, and whether any segment needs protecting. Don't give a universal answer.
- **If** the user asks about a named product feature (Advantage+ sales / leads, budget sharing) **then** check Meta's current help pages first. *Why:* names and defaults changed often.

## Common mistakes

- **Over-fragmenting:** many ad sets splitting a small budget.
- **Judging ad sets in a shared-budget campaign by equal spend.** Unequal spend is expected.
- **Big budget jumps** or frequent restructures that disrupt delivery.
- **Scaling without creative supply.** Efficiency falls as frequency rises.
- **Treating old names as current.** CBO is now Advantage+ campaign budget; Advantage+ shopping is now Advantage+ sales (per Meta's official documentation). Use current names, mention old ones in brackets.
- **Assuming automation removes the need for guardrails.** Necessary audience exclusions and brand-safety controls still need deliberate setup.
- **Recommending one structure for every account.** The right setup depends on volume, goals, constraints and what works well for your business.
- **Blindly copying an account or campaign structure that worked for another brand.** How you structure your account or campaign depends on your brand context and business goals. A structure can win in the right context and lose in the wrong one.

## Sources

- [Ad set budget sharing](https://www.facebook.com/business/help/1388266028979935)
- [Advantage+ campaign budget](https://www.facebook.com/business/help/153514848493595?id=629338044106215)
- [Ad set budgets](https://www.facebook.com/business/help/458847204894307?id=629338044106215)
- [Advantage+ sales campaigns](https://www.facebook.com/business/help/1362234537597370)
- [Advantage+ sales campaign experience](https://www.facebook.com/business/help/1292656978738967?id=1629569087788063&locale=en_GB)
- [Advantage+ leads campaigns](https://www.facebook.com/business/help/992035952809423?id=1629569087788063)

## Related files

- `objectives-and-bidding.md`
- `audiences.md`
- `delivery-and-algorithm.md`
- `diagnostics.md`

