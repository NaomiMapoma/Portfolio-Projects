# 📝 Meta Ads Strategist: a Claude Skill for Paid Social

## 📚 Overview

A Claude skill that turns Claude into a Meta (Facebook and Instagram) paid social strategist. It helps marketers brainstorm, plan, optimise and troubleshoot Meta campaigns using a structured knowledge base, clear decision rules and honest confidence levels.

It covers campaign structure, budgets, bidding, audiences, creative, measurement, Meta's delivery system (Andromeda, Lattice, GEM) and policy considerations for regulated sectors.

## 💡 Why I Built This

- Meta changes fast. Delivery systems, audience controls and creative guidance have all shifted recently, and with much of the advice online it can be hard to decipher what is true and what actually works.
- I've spent 8+ years in performance marketing and wanted to consolidate the all the knowledge I've built and learnings I've gained over the years in one place from someone who has actually done the work.
- Building it was also a way to turn my paid social and measurement experience into something reusable, and to learn how to build AI workflows and skills.

## 📝 Questions It Helps Answer

- How should I structure a Meta account for my budget and conversion volume?
- Why has CPA risen or ROAS fallen, and what should I check first?
- Is this creative fatigue, audience saturation, a tracking issue or something else?
- How many distinct creative concepts should I run, and how do I test them?
- Should I use campaign budgets or ad set budgets? Do I need a cost goal?
- How do Andromeda, Lattice, GEM and the breakdown effect affect my decisions?
- Why don't Meta's numbers match my analytics or backend data?
- When is a lift test or incrementality test worth running?
- What should I flag before running ads in a regulated sector?

## 🔢 What's Inside

```
portfolio-projects/
└── meta-ads-strategist/
    ├── README.md
    ├── LICENSE
    ├── CHANGELOG.md
    └── skills/
        └── meta-ads-strategist/
            ├── SKILL.md
            └── references/
```

`SKILL.md` holds the workflow, decision rules, output formats and guardrails. The reference files hold the detail and are only loaded when relevant.

| file | summary |
|---|---|
| `SKILL.md` | The core instructions: when to use the skill, inputs needed, workflow, decision rules, output format, guardrails and limitations |
| `references/objectives-and-bidding.md` | Campaign objectives, conversion event selection, bid strategies and cost controls |
| `references/structure-and-budget.md` | Campaign structure, budget approaches (Advantage+ campaign budget vs ad set budgets) and scaling |
| `references/audiences.md` | Advantage+ audience, broad vs detailed targeting, lookalikes, retargeting, exclusions and first-party data |
| `references/creative.md` | Creative diversity, formats (including catalog and collection ads), fatigue signals and testing frameworks |
| `references/tracking-and-measurement.md` | Tracking health, attribution windows, A/B tests, lift tests, incrementality and MMM |
| `references/delivery-and-algorithm.md` | How Andromeda, Lattice and GEM fit together, the auction and the breakdown effect |
| `references/diagnostics.md` | Symptom to likely causes to what to check, linking to the other files |
| `references/policy-and-compliance.md` | Ad policies, special ad categories, financial services considerations and privacy and consent |

## 🧭 How It Works

- **Mode first.** The skill identifies whether you want to plan, diagnose or understand something, then asks only for the inputs it needs.
- **Evidence over assumptions.** It asks for missing data and says when data is too thin to conclude anything.
- **Confidence levels.** Every finding comes with High, Medium or Low confidence and a way to test it.
- **Campaign level first.** Decision rules protect against common mistakes, such as pausing an ad set on marginal CPA alone.
- **Progressive loading.** Claude only opens the reference files a question needs.

## 🛠️ Install

The skill is plain Markdown. It contains no scripts or code.

### Claude.ai (web and desktop)

1. Download `meta-ads-strategist.zip` from the [Releases page](https://github.com/NaomiMapoma/portfolio-projects/releases) (look for the `meta-ads-strategist-v…` tag)..
2. Open **Settings** and go to **Capabilities** (or **Customize** then **Skills**, depending on your layout).
3. Make sure code execution and file creation is switched on.
4. Choose **Upload a skill** and select the zip.
5. Switch the skill on.

Skills are available on certain plans. Check Anthropic's current documentation for requirements.

### Claude Code

1. Clone this repository:

```
git clone https://github.com/NaomiMapoma/portfolio-projects.git 
```

2. Copy the skill folder into your personal skills folder:

```
cp -r portfolio-projects/meta-ads-strategist/skills/meta-ads-strategist ~/.claude/skills/ 
```

3. Start Claude Code. The skill loads automatically when relevant.

> The folder name must match the skill name (`meta-ads-strategist`), and the zip must contain the folder itself, not just its contents.

## 🚀 Example Prompts

- "My CPA has risen 30% week on week on a lead gen campaign. What should I check?"
- "Help me structure a prospecting campaign for a new product with a daily budget of £500."
- "One ad set has a higher CPA than the others. Should I pause it?"
- "How many creative concepts should I run, and how should I test them?"
- "Explain what Andromeda means for how I build creative."
- "Why do Meta and Google Analytics show different conversion numbers?"

## 🔄 Keeping It Current

- Each reference file carries a **last verified** date and a list of items to verify.
- Anything dated or volatile (feature names, attribution windows, policy details) is separated from stable principles.
- The skill is told to check official sources when a file is stale or a question concerns a recent change.
- Changes are recorded in [CHANGELOG.md](CHANGELOG.md).

## ⚠️ Limitations and Disclaimer

- This is an independent project. It isn't affiliated with, endorsed by or sponsored by Meta. Meta, Facebook and Instagram are trademarks of Meta Platforms, Inc.
- Meta doesn't publish the full workings of its ranking systems. Explanations of mechanisms are informed interpretation unless a Meta source is cited.
- The skill can't see your ad account and relies on the data you give it.
- It is not legal, financial or compliance advice. For regulated sectors it flags risks only and never approves creative. Always involve your compliance or legal team.
- Meta's products, policies and rules change often. Verify anything important against Meta's current documentation.
- Examples and thresholds are illustrative. Test against your own data.

## 🛡️ Safety

- The repository contains Markdown only, with no scripts, credentials or client data.
- Skills can influence what Claude does, so it's good practice to read any skill before installing it, including this one.

## 🤝 Contributing

Spotted something out of date or inaccurate? Open an issue or pull request. Please include a link to an official source where you can.

## 📄 License

Released under the [MIT License](LICENSE).