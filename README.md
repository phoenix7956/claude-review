# claude-review

> Claude Code agent that reviews GitHub PRs and posts structured Markdown review comments.
> **Built for [BOUNTY #4 ($150)](https://github.com/claude-builders-bounty/claude-builders-bounty/issues/4)** of the [claude-builders-bounty](https://github.com/claude-builders-bounty/claude-builders-bounty) repo.

A Claude Code agent that takes a PR diff, analyzes it via the **Claude API**, and returns a structured Markdown review with **Summary / Risks / Suggestions / Confidence**.

---

## ✨ Features

- **CLI Tool**: `claude-review <pr-url>` — analyze any public GitHub PR
- **Post to PR**: `claude-review <pr-url> --post` — posts the review as a PR comment
- **GitHub Action**: drop-in workflow for auto-review on every PR
- **Claude API** by default; falls back to heuristic analysis if `ANTHROPIC_API_KEY` is missing
- **Structured output**: Summary (2-3 sentences) / Risks / Suggestions / Confidence (Low/Medium/High)

---

## 🚀 Quick Start

### CLI

```bash
# 1. Install
npm install -g @phoenix7956/claude-review
# or directly:
npm install -g github:phoenix7956/claude-review#v1

# 2. Set API keys
export GITHUB_TOKEN=ghp_...           # for private repos / --post
export ANTHROPIC_API_KEY=sk-ant-...   # for real Claude review

# 3. Review a PR
claude-review https://github.com/owner/repo/pull/123

# 4. Review + post as a PR comment
claude-review https://github.com/owner/repo/pull/123 --post
```

### Heuristic Mode (no Claude API)

```bash
claude-review https://github.com/owner/repo/pull/123 --heuristic
```

Uses regex-based pattern detection (credentials, eval, destructive DB ops, TODO/FIXME, etc.) — useful for offline testing.

### GitHub Action

```yaml
# .github/workflows/claude-review.yml
name: Claude PR Review
on:
  pull_request:
    types: [opened, synchronize, reopened]
permissions:
  contents: read
  pull-requests: write
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm install -g github:phoenix7956/claude-review#v1
      - name: Run review
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          claude-review "${{ github.event.pull_request.html_url }}" --post
```

---

## 📋 Output Format

```markdown
## 📋 PR Review: <PR title>

### Summary
<2-3 sentence overview>

### 🔍 Risks
- <risk 1>
- <risk 2>

### 💡 Suggestions
- <suggestion 1>
- <suggestion 2>

### ✅ Confidence Score: **<Low|Medium|High>**

---
*Analyzed N file(s) | X additions / Y deletions | model: <claude-sonnet-4-20250514|heuristic>*
```

See [`samples/`](./samples/) for real outputs on:
- [`samples/bounty4-pr-review-sub-agent.md`](./samples/bounty4-pr-review-sub-agent.md) — Bounty #4 PR #2707
- [`samples/bounty5-n8n-workflow.md`](./samples/bounty5-n8n-workflow.md) — Bounty #5 PR #2700

---

## 🏗️ Architecture

```
src/
├── github.ts    # Octokit-based PR fetch (metadata + diff + files)
├── review.ts    # Claude API caller + heuristic fallback + JSON parser
└── index.ts     # CLI entry: parse args, fetch, analyze, optionally post
```

**How it works:**
1. Parse `<owner>/<repo>/pull/<n>` from URL
2. Fetch PR metadata, file list, and full diff in parallel
3. Send title + body + diff (truncated 12K) to Claude API with strict JSON prompt
4. Parse Claude's JSON response (or fall back to heuristic if parse fails)
5. Format as Markdown; optionally post as a PR comment

**Why heuristic fallback?**
- `ANTHROPIC_API_KEY` not set → free offline review
- Claude API rate-limited / down → degrade gracefully
- Lets you test the CLI + GitHub Action plumbing without burning API credits

---

## 🔧 Options

```
claude-review <pr-url> [options]

Options:
  --post            Post the review as a PR comment (requires GITHUB_TOKEN)
  --heuristic       Skip Claude API, use heuristic analysis only
  --model=<id>      Claude model (default: claude-sonnet-4-20250514)

Env:
  GITHUB_TOKEN          Required for --post, or for private PRs
  ANTHROPIC_API_KEY     Required unless --heuristic is set
```

---

## 🧪 Local Dev

```bash
git clone https://github.com/phoenix7956/claude-review.git
cd claude-review
npm install
npm run build
node dist/index.js https://github.com/claude-builders-bounty/claude-builders-bounty/pull/2707 --heuristic
```

---

## 📦 Bounty Submission

This is the submission for **[Bounty #4 — $150](https://github.com/claude-builders-bounty/claude-builders-bounty/issues/4)**.

**Acceptance Criteria coverage:**

| Criterion | Status |
|---|---|
| CLI: `claude-review <pr-url>` | ✅ `node dist/index.js <url>` |
| GitHub Action workflow YAML | ✅ `.github/workflows/claude-review.yml` |
| Structured Markdown (Summary/Risks/Suggestions/Confidence) | ✅ `formatMarkdown()` + `claude-review --format=markdown` (default) |
| Tested on ≥2 real GitHub PRs | ✅ `samples/bounty4-pr-review-sub-agent.md` + `samples/bounty5-n8n-workflow.md` |
| README with setup and usage | ✅ this file |

---

## 📄 License

MIT

---

Built by [@phoenix7956](https://github.com/phoenix7956) for the [claude-builders-bounty](https://github.com/claude-builders-bounty/claude-builders-bounty) program.
