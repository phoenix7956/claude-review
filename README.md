# claude-review

Claude Code agent that reviews GitHub PRs and posts structured Markdown review comments.

## Features

- **CLI Tool**: `claude-review <pr-url>` — analyze any GitHub PR
- **GitHub Action**: Add automated PR reviews to your CI pipeline
- **Structured Output**: Summary, risks, suggestions, and confidence score

## Installation

\`\`\`bash
npm install -g claude-review
\`\`\`

## Usage

### CLI

\`\`\`bash
claude-review https://github.com/owner/repo/pull/123
\`\`\`

Requires `GITHUB_TOKEN` environment variable for private repos.

### GitHub Action

\`\`\`yaml
- name: PR Review
  uses: your-org/claude-review@v1
  with:
    pr_url: \${{ github.event.pull_request.html_url }}
\`\`\`

## Output Format

The review includes:
- **Summary**: 2-3 sentence overview of the PR
- **Risks**: Identified security/code quality risks
- **Suggestions**: Improvement recommendations
- **Confidence Score**: Low / Medium / High

## Sample Output

## 📋 PR Review: Add user authentication

### Summary
Add user authentication modifies 8 file(s) with 150 additions and 20 deletions. This is a small change.

### 🔍 Risks
- Hardcoded credentials or API keys detected

### 💡 Suggestions
- No test changes detected - consider adding tests

### ✅ Confidence Score: **High**

---

## Architecture

- `src/github.ts` — GitHub API integration via Octokit
- `src/review.ts` — Heuristic analysis of PR diff
- `src/index.ts` — CLI entry point