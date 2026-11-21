# Policy and Compliance

- **Last verified:** 18-11-2026
- **Confidence:** Medium
- **Used by:** SKILL.md guardrails; `creative.md` and `audiences.md`

> This skill flags risks only. It does not approve creative or give legal advice. Final sign-off belongs to the user's compliance or legal team.

## Purpose and scope

Covers ad policies and special ad categories rules.
Read when the sector is regulated or targeting may be restricted.

## Key principles (stable)

1. **Flag, don't approve.** The skill identifies risks and asks the user to involve compliance or legal. It never signs off ads, claims or targeting.
2. **Check policy before optimising.** There's no point improving the performance of an ad that may be rejected, restricted or non-compliant.
3. **Meta's rules are the minimum, not the full picture.** Advertisers must also follow applicable law and sector regulation (e.g. UK financial promotions rules). Meta says advertisers are responsible for complying with applicable law.
4. **Regulated sectors need extra care.** Financial services, health, housing, employment and political content carry added rules on claims, targeting and verification.
5. **Policy depends on the market.** Rules differ by country and change over time. Always ask where ads will run.
6. **The advertiser carries privacy and consent responsibility, not Meta.** Meta's developer guidance tells advertisers to gate pixel use behind consent and says each company is responsible for its own GDPR compliance.
7. **Track record matters.** Repeated violations can restrict ad accounts, Pages and assets. Meta's advertising standards cover advertiser behaviour that may lead to restrictions.
8. **Policies change.** Treat specifics (category names, targeting limits, verification steps) as dated facts. Check Meta's official pages first.

## Meta ad policies

**Overview**
- Advertisers must follow Meta's **Community Standards** and **Advertising Standards**.
- The Advertising Standards set out what content is allowed or prohibited, and guidance on advertiser behaviour that may lead to restrictions on a Business Account, ad account, Page or user account.
- Meta reviews ads before and after they run. Ads can be rejected or removed, and accounts can be restricted for repeated issues.

**Policy areas that commonly cause problems**
- Misleading or exaggerated claims; guarantees of results
- Personal attributes (ads implying you know a person's characteristics or circumstances)
- Sensitive topics and restricted products or services
- Before-and-after or unrealistic outcome imagery
- Landing page mismatch or poor user experience
- Fake urgency or misleading offers
- Use of third-party names, logos or people without permission
- Broken or invalid URL

**Review and appeals**
- Keep records of approvals, claim substantiation and landing page versions.
- If an ad is rejected, read the stated reason, check the policy page cited, fix the issue and appeal only if you believe it was a mistake. Don't keep resubmitting similar ads. If you need to escalate for urgency, reach out to a Meta representative.

## Special ad categories

**What they are**
- A label advertisers must attach to a campaign when the ad promotes **housing, employment, financial products and services, or social issues, elections or politics**.
- The financial category (**financial products and services**) replaced the older **credit** category to encompass all financial advertising.
- Advertisers who are running ads about social issues, elections or politics may be required to get authorised in the country they want to run ads in and confirm their identity.

**Restrictions**
- Targeting options are limited in housing, employment and financial products and services categories. Age, gender, ZIP code or postcode, audience exclusion targeting, lookalike audiences, saved audiences and some interests are limited or unavailable. These restrictions apply to advertisers based in the US or US territories and advertisers showing their ads to audiences in the US, US territories, Canada and certain European countries and territories.
- **Location targeting**: You can target your ads to people by geographic location (such as country, region, county, town or city), but not by postcode. You also can't exclude locations.
- **Age targeting**: Options are generally fixed to include ages 18 to 65+ for housing, employment and credit ads. However, advertisers running credit ads in Europe can select a different age range to meet their industry and local requirements for this special ad category.
- **Gender targeting**: Audiences must include all genders. You can't edit this option.
- **Detailed targeting and audience exclusion**: Some demographic, behaviour and interest options are unavailable. Excluding any detailed targeting selections is also unavailable.
- **Advantage+ lookalike**: Advantage+ lookalike is unavailable
- Once a category is selected, restrictions can be enforced by the system.

**Practical implications**
- Select the category at campaign creation (sometimes it is applied at ad account level). Don't skip it to preserve targeting options. Mislabelling can lead to rejections or account restrictions.
- The restrictions affect structure and audience strategy. Plan for broad targeting and creative-led segmentation. See `audiences.md` and `structure-and-budget.md`.
- Category definitions can be broader than expected (for example, some insurance products may fall under housing or financial categories). Check Meta's definitions.
- Applicability varies by country. Ask which markets are targeted.

## Decision guidance

- **If** a campaign promotes financial products and services, housing or employment **then** check the special ad category requirement for the targeted markets before recommending audiences or structures.
- **If** the user wants to use lookalikes, detailed exclusions, age or gender targeting in a special ad category **then** warn that restrictions may apply and check the current rules.
- **If** the user asks for ad copy or claims in a regulated sector **then** avoid guarantees, unsubstantiated claims and omitted risk warnings, and flag items for compliance review. Don't present copy as approved.
- **If** an ad is rejected **then** ask for the rejection reason and policy cited, check the relevant policy page, and suggest a fix. Don't suggest evading review (cloaking, rotating accounts, disguising content).
- **If** the user asks how to work around a policy or restriction **then** decline the workaround and explain compliant options.
- **If** a performance drop coincides with consent banner or privacy changes **then** check consent-driven event loss before changing creative or structure.
- **If** the user asks for a legal interpretation **then** say this skill isn't legal advice and recommend qualified legal or compliance input.
- **If** the policy answer depends on a recent change **then** check Meta's current pages to verify before answering.

## Common mistakes

- **Not selecting the special ad category** (or choosing the wrong one) and then being surprised by rejections or restrictions.
- **Treating Meta's rules as the whole compliance picture** and ignoring sector regulation such as financial promotions rules.
- **Assuming the platform checks everything.** Meta puts responsibility for legal compliance on advertisers.
- **Firing the pixel before consent** in the UK/EU, or hardcoding it outside the consent platform.
- **Assuming the Conversions API bypasses consent.**
- **Uploading customer lists without checking consent and collection basis.**
- **Sending sensitive data in events or custom parameters.**
- **Using guarantees, exaggerated claims or missing risk warnings** in regulated sectors.
- **Resubmitting rejected ads repeatedly** without addressing the reason.
- **Using old category names (credit)** or old targeting rules from out-of-date guides.
- **Assuming US rules apply everywhere,** or that UK/EU rules match US ones.

## Sources

- [How to choose a Special Ads Category](https://www.facebook.com/business/help/298000447747885)
- [About audiences for Speical Ads Categories](https://www.facebook.com/business/help/2220749868045706)
- [Meta developers: special ad categories](https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/special-ad-category)
- [Meta Advertising Standards](https://www.facebook.com/business/help/488043719226449?id=434838534925385)
- [Meta Transparency Centre](https://transparency.meta.com/policies/ad-standards/)
- [Meta developers: Pixel and GDPR](https://developers.facebook.com/docs/meta-pixel/implementation/gdpr)

## Related files

- `creative.md`
- `audiences.md`
- `diagnostics.md`

