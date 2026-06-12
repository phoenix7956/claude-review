import { PRInfo } from "./github";

export interface ReviewOutput {
  summary: string;
  risks: string[];
  suggestions: string[];
  confidence: "Low" | "Medium" | "High";
  filesAnalyzed: number;
  model: string;
}

interface ClaudeResponse {
  content: { type: string; text: string }[];
  stop_reason: string;
  model: string;
}

async function callClaude(pr: PRInfo, apiKey: string, model = "claude-sonnet-4-20250514"): Promise<ReviewOutput> {
  const prompt = `You are a senior code reviewer. Analyze the following GitHub PR and produce a STRICT JSON review.

PR title: ${pr.title}
PR description: ${pr.body}
Files changed: ${pr.filesChanged.length}
Additions: ${pr.additions}, Deletions: ${pr.deletions}

Diff (truncated to 12000 chars):
\`\`\`diff
${pr.diff.slice(0, 12000)}
\`\`\`

Return ONLY valid JSON in this exact shape (no prose, no markdown fence):
{
  "summary": "<2-3 sentence overview of the change>",
  "risks": ["<risk 1>", "<risk 2>"],
  "suggestions": ["<suggestion 1>", "<suggestion 2>"],
  "confidence": "Low" | "Medium" | "High",
  "filesAnalyzed": ${pr.filesChanged.length}
}

Rules:
- Be concise. summary <= 280 chars.
- risks: real, specific issues (security, correctness, performance, breaking change). Empty array if none.
- suggestions: actionable improvements. Empty array if none.
- confidence: Low if diff is huge (>10k chars) or unclear intent, Medium if normal, High if small and well-scoped.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Claude API ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = (await resp.json()) as ClaudeResponse;
  const text = data.content.find((b) => b.type === "text")?.text ?? "";
  
  // Strip code fence if present
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    // Fallback: heuristic if Claude returns invalid JSON
    return analyzePR(pr);
  }

  return {
    summary: String(parsed.summary ?? "").slice(0, 280),
    risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map(String) : [],
    confidence: ["Low", "Medium", "High"].includes(parsed.confidence) ? parsed.confidence : "Medium",
    filesAnalyzed: pr.filesChanged.length,
    model: data.model ?? model,
  };
}

export function analyzePR(pr: PRInfo): ReviewOutput {
  // Heuristic fallback (used when no API key or Claude call fails)
  const riskPatterns: [RegExp, string][] = [
    [/password|secret|token|api_key|apikey|auth/i, "Hardcoded credentials or API keys detected"],
    [/\.env|\.local\.ini|config.*password/i, "Potential config file with sensitive data"],
    [/DROP TABLE|DELETE FROM.*WHERE|truncate/i, "Potentially destructive database operation"],
    [/eval\(|new Function\(|exec\(/i, "Dynamic code execution (security risk)"],
    [/console\.log|print\(|debugger/i, "Debug code left in production"],
    [/TODO|FIXME|HACK|XXX/i, "Unresolved code comments"],
  ];

  const risks: string[] = [];
  for (const [pattern, message] of riskPatterns) {
    if (pattern.test(pr.diff)) risks.push(message);
  }

  const totalChanges = pr.additions + pr.deletions;
  const complexity = totalChanges > 500 ? "large" : totalChanges > 100 ? "medium" : "small";
  let confidence: "Low" | "Medium" | "High" = "Medium";
  if (pr.diff.length < 2000) confidence = "High";
  else if (pr.diff.length > 50000) confidence = "Low";

  const suggestions: string[] = [];
  if (pr.body.length < 20) suggestions.push("PR description is very brief - add more context");
  if (pr.additions > 300) suggestions.push("Large PR - consider splitting into smaller changes");
  if (!pr.diff.includes("test")) suggestions.push("No test changes detected - consider adding tests");

  return {
    summary: `${pr.title} modifies ${pr.filesChanged.length} file(s) with ${pr.additions} additions and ${pr.deletions} deletions. This is a ${complexity} change.`,
    risks: risks.length > 0 ? risks : ["No obvious security risks detected in the diff."],
    suggestions: suggestions.length > 0 ? suggestions : ["Code looks reasonable - standard review practices apply."],
    confidence,
    filesAnalyzed: pr.filesChanged.length,
    model: "heuristic",
  };
}

export async function reviewPR(pr: PRInfo, opts: { apiKey?: string; model?: string; useHeuristic?: boolean } = {}): Promise<ReviewOutput> {
  if (opts.useHeuristic || !opts.apiKey) {
    return analyzePR(pr);
  }
  try {
    return await callClaude(pr, opts.apiKey, opts.model);
  } catch (err) {
    console.error(`[claude-review] Claude call failed, falling back to heuristic: ${err instanceof Error ? err.message : err}`);
    return analyzePR(pr);
  }
}

export function formatMarkdown(pr: PRInfo, review: ReviewOutput): string {
  const risks = review.risks.length > 0 ? review.risks : ["No obvious risks identified."];
  const suggestions = review.suggestions.length > 0 ? review.suggestions : ["Looks good - standard review practices apply."];
  return `## 📋 PR Review: ${pr.title}

### Summary
${review.summary}

### 🔍 Risks
${risks.map((r) => `- ${r}`).join("\n")}

### 💡 Suggestions
${suggestions.map((s) => `- ${s}`).join("\n")}

### ✅ Confidence Score: **${review.confidence}**

---
*Analyzed ${review.filesAnalyzed} file(s) | ${pr.additions} additions / ${pr.deletions} deletions | model: ${review.model}*`;
}
