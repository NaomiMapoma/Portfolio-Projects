# Delivery and Algorithm

- **Last verified:** 18-11-2026
- **Confidence:** Medium
- **Used by:** SKILL.md workflow steps 4 and 5; most sections of `diagnostics.md`

## Purpose and scope

Covers Andromeda, Lattice, GEM, auction basics and the breakdown effect.
Read when the user asks how Meta's delivery works or why delivery behaves a certain way.

## Key principles (stable)

- **Advertiser levers are inputs, not switches.** You can't toggle Andromeda, Lattice or GEM. These are just the components that make up Meta's AI and ad delivery system. You influence them through conversion signals, creative, structure and budget.
- **Judge at campaign level before ad set or ad level.** Delivery is optimised across the whole set of options, so per-ad averages can mislead (breakdown effect).
- Creative matters more because the algorithm models are more sophisticated now and have more context to judge it.
- Account simplification matters because the system is doing more of the decisioning.
- Manual optimisation matters less because you are increasingly competing against real-time model allocation.

## Systems overview

| System | What it is (one line) | Source | Practical implication |
|---|---|---|---|---|
| Andromeda | Andromeda is Meta's machine learning system for personalised ads retrieval | [Engineering at Meta](https://engineering.fb.com/2026/10/28/ml-applications/meta-andromeda-next-gen-ads-retrieval-gpu-co-design/) | Means better performance automatically from the retrieval system matching ads across a larger candidate pool |
| Lattice | Lattice is Meta's ad ranking architecture that allows it to generalise learnings across campaign objectives and surfaces | [Archiv](https://arxiv.org/abs/2512.09200) | Meta’s Lattice recommendation framework brings together different types of data and learning, so ads recommendations get better, faster, and more relevant |
| Adaptive Ranking Model | The decision layer, dynamically choosing when to apply heavy LLM-level compute vs a faster path | [Engineering at Meta](https://engineering.fb.com/2026/03/31/ml-applications/meta-adaptive-ranking-model-bending-the-inference-scaling-curve-to-serve-llm-scale-models-for-ads/) | Instead of scoring every ad independently, Meta now processes a user’s intent once, then applies that context across multiple ad candidates |
| GEM | GEM is Meta's central brain for ad recommendations and ranking system | [Engineering at Meta](https://engineering.fb.com/2026/10/13/ml-applications/generative-ads-model-gem-scaling-frontier-ads-ai/) | Means stronger advertising outcomes and better ad matching to what people are looking for|

## Auction basics

- The learning phase: Meta requires 50 conversions in a week per ad set for it to exit the learning phase. If an ad set enters learning limited, this means you ad sets aren't generating enough results to exit the learning phase in order to deliver your ads properly
- Seasonality and auction pressure: Black Friday and in the lead up to Christmas or across other key calendar periods, auction competition increases and you may see your CPMs and overall costs inflate.

## Breakdown effect

- What it is: The "breakdown effect" refers to the misinterpretation that Meta's system shifts impressions and spending into underperforming ad sets, placements or ads. In reality, the system is designed to maximise the number of results for your campaign dependent on the ad set optimisation you choose.
- Why average CPA can look worse while the overall result improves: When you launch a Meta campaign, Meta will start spending across all your selected placements and all of your ads. As it learns what performs best, it starts moving more budget to that specific ad/placement/audience. As low hanging fruit or cheap CPA gets exhausted, CPA will go up even though you might be scaling spend. This is because your audience, placements or ads are reaching a point of saturation meaning spending more on those will actually hurt your campaign performance, hitting a point of diminishing returns. This shift makes it look like Meta is spending worse but in reality it is just scaling on what is driving the most volume even at a higher cost.
- How to evaluate (campaign-level, incrementality): When using Advantage+ campaign budget / CBO, evaluate results at campaign level. When using Advantage+ placements (without Advantage+ campaign budget), evaluate at ad set level. When running multiple ads in one ad set, evaluate your results at ad set level.
- What not to do (e.g. pause on marginal CPA alone): You should only be evaluating performance at either a campaign or ad set level. Do not pause what seems to be a bad ad too quickly as it might not actually be a bad ad. Other metrics you should be looking at other than CPA are Frequency & Engagement, if Frequency for an ad is low (1.3), that shows the ad is top of funnel being served to new audiences, introducing the brand. If, on that top of funnel ad, there is good engagement, then the audience is finding a lot of value in that ad so you should probably keep it live. The ads that you should be pausing are the ones that have a high CPA, high frequency (1.8+) and low engagement.

## Decision guidance

- **If** the user asks how to "optimise for Andromeda/GEM/Lattice" **then** give input-based advice (signal quality, creative diversity, consolidated campaign structure) and label it as inference. *Why:* Meta doesn't publish an advertiser checklist.
- **If** the user states a mechanic as fact (e.g. "Andromeda penalises X") **then** ask for the source and classify it as Stated or Inferred before using it. *Why:* much online commentary is third-party interpretation.
- **If** one ad takes most of the spend **then** don't conclude the others are "bad". Check whether they were meaningfully different concepts and whether they received enough delivery to judge. *Why:* concentration is expected behaviour; the exact mechanism is inferred.
- **If** an ad's CPA looks worse than its siblings **then** check blended campaign performance, frequency and engagement before recommending a pause. *Why:* breakdown effect.
- **If** conversion signals are weak or inconsistent (tracking gaps, low match quality) **then** fix tracking before changing creative or structure. *Why:* the models learn from those signals.
- **If** the question concerns a recent change **then** check Meta's Engineering blog first.
- **If** the user's campaign is in limited learning **then** suggest consolidation or increase in budget depending on the context (Meta requires 50 conversions per ad set in one week to exit learning)

## Common mistakes

- **Treating third-party blogs as Meta-stated.** Many articles blend Meta's engineering posts with speculation. Cite Meta's own posts for stated claims.
- **Presenting precise rules as facts** (e.g. "you need exactly N creatives"). No Meta source supports a universal number, so label it as practitioner guidance.
- **Promising outcomes.** Meta's aggregate gains aren't a guarantee for an individual account.

## Sources

- [Meta's Andromeda](https://engineering.fb.com/2026/10/28/ml-applications/meta-andromeda-next-gen-ads-retrieval-gpu-co-design/) 
- [Meta's GEM](https://engineering.fb.com/2026/10/13/ml-applications/generative-ads-model-gem-scaling-frontier-ads-ai/)
- [Meta's Lattice](https://arxiv.org/abs/2512.09200)
- [Breakdown Effect](https://www.facebook.com/business/help/770303663944673)
- [Learning Phase](https://www.facebook.com/business/help/112167992830700?id=561906377587030)

## Related files

- `creative.md`
- `structure-and-budget.md`
- `diagnostics.md`

