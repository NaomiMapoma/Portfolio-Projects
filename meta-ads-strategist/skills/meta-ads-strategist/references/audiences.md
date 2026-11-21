# Audiences

- **Last verified:** 18-11-2026
- **Confidence:** Medium
- **Used by:** SKILL.md workflow steps 4 and 5; `diagnostics.md` sections on saturation and CPM

## Purpose and scope

Covers broad vs Advantage+ audience, lookalikes, retargeting, exclusions and first-party data.
Read when the user asks about targeting, audience strategy, saturation or data inputs.

## Key principles (stable)

1. **Audience inputs are increasingly signals, not fences.** Meta now treats many targeting inputs as suggestions that guide delivery rather than hard limits. Plan for the system to go beyond what you specify.
2. **Creative and signal quality do more of the targeting work.** When the system expands beyond your inputs, the ad itself and your conversion signals shape who sees it. See `creative.md` and `tracking-and-measurement.md`.
3. **Know which controls are hard and which are soft.** Be clear about what you can actually enforce. (see Audience approaches)
4. **First-party data is an asset only if it's clean, consented and current.**
5. **Don't confuse reach with relevance.** A narrower audience isn't automatically better, and a broader one isn't automatically worse. Decide using data.
6. **Overlap and fragmentation cost money.** Many ad sets built around different interests can end up reaching the same people while splitting data.
7. **Exclusions are only as good as the data behind them.** Incomplete or unmatched lists leave gaps.
8. **Retargeting looks better in the platform than it often is in reality.** Oftentimes retargeting is targeting the lowest hanging fruit of users who would have converted anyway, so not a strong incremental targeting strategy
9. **Rules differ by sector and market.** Special ad categories, consent and sensitive-data restrictions change what's allowed. See `policy-and-compliance.md`.
10. **Names and options change.** Treat feature names (Advantage+ audience, Advantage+ lookalike, original audience options) as facts for now unless otherwise stated by official Meta documentation

## Audience approaches

**What's a hard control and what's a suggestion**
- **Hard controls:** location, languages, minimum age, exclusions, and special ad category restrictions.
- **Suggestions:** age, gender, detailed targeting, custom audiences and lookalike audiences. These share information with Meta's algorithm about who you want to reach. Meta describes them as showing ads to people matching your suggestion, "and other audiences when it's likely to improve performance."
- For many performance goals, detailed targeting and lookalike inputs are treated as suggestions that can't be switched off. A shrinking set of goals still allows turning suggestions off.

| Approach | What it is | Use when | Avoid when | Notes |
|---|---|---|---|---|
| **Advantage+ audience** | Meta finds the audience using your suggestions as a starting point. | Default for most prospecting; enough conversion volume; strong creative | You need a hard restriction Meta won't honour as a suggestion | Treat inputs as hints. Control comes from hard controls and creative. |
| **Original audience options** | Manual setup with detailed targeting, custom and lookalike audiences. | You need more explicit inputs or are testing a specific segment | Assuming it gives strict control (it may still treat inputs as suggestions) | Check what the performance goal does to your inputs. |
| **Broad** | Minimal inputs; location, age minimum and exclusions only. | Strong creative, healthy signal, scale | In most cases or when there is very low volume or weak tracking | Usually paired with creative-led segmentation. |
| **Detailed targeting (interests, behaviours)** | Inputs that suggest who to start with. | Low data, new accounts, narrow B2B or niche products as a starting point | Believing it limits delivery | Meta has reduced the list of available options over time. |
| **Lookalikes** | Meta finds people similar to a source audience. | Strong seed data (customers, high-value customers) | Weak or small seed; assuming it's a hard limit | Lookalike expansion became **Advantage+ lookalike**, and in many cases it's applied automatically. |
| **Custom audiences** | Built from your data (customer lists, site visitors, engagement, app activity). | Retargeting, exclusions, seeds for lookalikes | Poor data quality or no consent | See "First-party data". |
 
**Guidance on choosing**
- Start from conversion volume and creative supply. With strong volume and creative, broad or Advantage+ audience often works.
- Use one or two clear audience approaches, not many near-identical ad sets.
- Segment by **creative angle / persona and message** where you can, rather than by interest stacks that end up overlapping.
- Decide how you'll test audience approaches (A/B test or separate campaigns). See `tracking-and-measurement.md`.

## Retargeting

**What it is**
- Showing ads to people who have already interacted with the brand (site visitors, engaged users, video viewers, leads, past customers).

**Building blocks**
- Source types: website activity, engagement (video, Page, Instagram, lead forms), app activity, customer lists.
- Recency windows (e.g. 7, 14, 30, 90 days)
- Funnel segments: viewers, engagers, cart or application starters, past purchasers or customers. Message each segment differently.

**Strategy points**
- Tailor creative to the stage: reassurance, proof, offers or reminders rather than repeating the prospecting message.
- Keep retargeting budgets proportionate to audience size. A small pool can't absorb a large budget efficiently.
- Separate retargeting from prospecting so budget doesn't get pulled into the easier pool. See `structure-and-budget.md`.

**Risks**
- **Over-frequency** and ad fatigue in small pools.
- **Cannibalising prospecting** or taking credit for conversions that would have happened anyway.
- **Low incrementality:** attribution tends to flatter retargeting. Check with a holdout or lift test. See `tracking-and-measurement.md`.
- **Shrinking pools:** tracking and consent loss reduce audience size.
- **Compliance:** retargeting uses sensitive data. See "First-party data" and `policy-and-compliance.md`.

**Retargeting in long or regulated journeys**
- For high-consideration products (e.g. financial services, B2B), use staged messaging over a longer window, but check any special ad category or consent limits first.

## Exclusions

**What still works**
- Custom audience exclusions (customer lists, website visitors, engagement, lead form audiences) still work.
- Meta introduced **exclusion-only custom audiences** to define who shouldn't receive ads (existing customers, opt-outs, age-restricted groups).
- Detailed targeting exclusions were reported as removed or restricted as part of 2025 and 2026 targeting changes.
- Exclusions are described as a hard control, alongside location, language, minimum age and special ad category restrictions.

**Existing customer controls**
- **Customer lifecycle strategy** lets you choose between acquiring only new customers or reaching all audiences. With it, Meta may automatically create exclusions such as "Customers from your conversion data (730 days)".
- **Existing customer budget cap** in Advantage+ sales campaigns limits spend on existing customers rather than excluding them outright.
- Why excluded customers can still be reached: incomplete customer lists, low match rates, different emails used, opt-outs removed from lists, or reliance on a budget cap rather than a hard exclusion.

**Practical guidance**
- First confirm there's a real problem (are existing customers actually receiving ads?) before building complex exclusions.
- Combine **website** and **customer list** audiences for exclusions, since each has gaps.
- Define "existing customer" precisely (e.g. all-time buyers, recent buyers, active subscribers, approved applicants).
- Review and refresh exclusion lists regularly.
- **When exclusions hurt:** over-excluding can shrink reach and raise costs, and excluding people who could buy again may reduce revenue. Judge by business model.

## First-party data

**Sources and uses**
- Customer lists, leads, CRM segments, subscribers, app users, website events, offline conversions.
- Uses: retargeting, exclusions, lookalike seeds, signal for optimisation.

**Customer list basics**
- Meta hashes and matches your contacts to accounts. Match rates vary widely
- Adding more identifiers (phone number, name, location) generally helps matching.
- Lists marked **Outdated** (not updated for over 30 days) may affect delivery.
- Clean, correctly formatted, deduplicated data matches better. Refresh lists on a regular schedule.

**Data quality checklist**
- Is the list complete for the purpose (e.g. all customers for exclusion)?
- Is it recent, correctly formatted and deduplicated?
- Does it include multiple identifiers?
- Are opt-outs and deletions removed? Meta's terms reportedly require dropping people who opted out.
- Is there a clear lawful basis and consent wording for using the data for advertising?
- Is the seed for a lookalike high quality (e.g. high-value customers rather than all leads)?

**Consent and privacy**
- Uploading customer data to Meta needs a lawful basis and suitable notices. In the UK and EU that usually means checking consent wording and collection basis. See `policy-and-compliance.md`.
- Avoid sensitive personal data in lists or events.
- If unsure, refer them to reach out to their legal team or Meta representative

**Offline and CRM signals**
- For long sales cycles, feeding back quality outcomes improves optimisation and seeds. See `objectives-and-bidding.md` and `tracking-and-measurement.md`.

## Decision guidance

- **If** the user asks "what audience should I target?" **then** ask about conversion volume, creative supply, sector, markets, objective and whether any hard restrictions apply. Don't give a universal answer.
- **If** the user wants to restrict delivery to a specific interest or lookalike **then** explain that these are often suggestions, and offer what's actually enforceable (location, language, minimum age, exclusions) plus creative-led approaches.
- **If** conversion volume is healthy and creative is strong **then** consider broad or Advantage+ audience. In most cases, broad audiences should be the starting strategy and recommendation
- **If** the user has many ad sets with different interest stacks **then** warn they may overlap and split data, and consider consolidating.
- **If** the user wants retargeting **then** ask about pool size, recency window, message by stage and how they'll measure incrementality.
- **If** retargeting looks highly efficient **then** question it. Recommend a holdout or lift test as retargeting often can't be scaled
- **If** existing customers are still being reached despite exclusions **then** check list completeness, match rate, recency, definition of "existing customer" and whether a budget cap (not an exclusion) is in use.
- **If** a customer list has a low match rate **then** check formatting, identifiers, freshness and whether the list is the right one.
- **If** the user wants to upload customer data **then** ask about consent, lawful basis and opt-out handling, and refer to `policy-and-compliance.md`.
- **If** the campaign is in a special ad category **then** check which audience tools are restricted before recommending lookalikes, custom audiences or exclusions. See `policy-and-compliance.md`.
- **If** performance falls after audience changes **then** check for learning resets and overlap before blaming the audience. See `delivery-and-algorithm.md`.
- **If** the user relies on an older audience feature name or option **then** check current availability through Meta's official documentation.

## Common mistakes

- **Treating detailed targeting or lookalikes as hard restrictions** when they're suggestions.
- **Building many near-identical ad sets** around different interests that reach the same people.
- **Over-narrow targeting** that restricts delivery and raises cost.
- **Weak or small lookalike seeds** (e.g. all leads instead of customers who matter).
- **Assuming exclusions are perfect.** Lists have gaps, match rates are below 100%, and opt-outs have to be removed.
- **Relying on the automatic existing-customer exclusions** without checking them.
- **Over-retargeting a small pool,** leading to fatigue and wasted spend.
- **Judging retargeting on platform alone.** Retargeting is often non-incremental, this should be determined by lift or incrementality studies.
- **Using stale or badly formatted customer lists.**
- **Uploading customer data without checking consent** or including opted-out people.
- **Ignoring special ad category limits** on audience tools.
- **Changing audiences often,** resetting learning.
- **Using old terminology and assuming old options still exist.**

## Sector or market notes

- Special ad category rules may restrict audience tools (for example advantage+ tools, lookalikes, saved audiences, certain exclusions and customer-list use) depending on the market. See `policy-and-compliance.md`.

## Sources

- [Meta Advantage+ Audiences](https://www.facebook.com/business/help/273363992030035?id=1629569087788063)
- [Meta Audience controls and suggestions](https://www.facebook.com/business/help/938372127764391?id=1629569087788063&locale=en_GB)
- [Meta Detailed targeting](https://www.facebook.com/business/help/182371508761821)
- [Using Detailed targeting](https://www.facebook.com/business/help/440167386536513)
- [Advantage+ lookalikes](https://www.facebook.com/business/help/1212225059146059?id=1629569087788063)
- [Meta Lookalike Audiences](https://www.facebook.com/business/help/164749007013531?id=401668390442328&locale=en_GB)
- [Meta Custom Audiences](https://www.facebook.com/business/help/610516375684216?id=2469097953376494)
- [Customer Lists](https://www.facebook.com/business/help/170456843145568?id=2469097953376494)
- [Customer list best practices](https://www.facebook.com/business/help/606443329504150?id=2469097953376494)

## Related files

- `creative.md`
- `structure-and-budget.md`
- `policy-and-compliance.md`
- `diagnostics.md`
