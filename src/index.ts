#!/usr/bin/env node
import { fetchPR } from "./github";
import { reviewPR, formatMarkdown, analyzePR } from "./review";
import { Octokit } from "@octokit/rest";

async function main() {
  const args = process.argv.slice(2);
  const prUrl = args[0];
  const ghToken = process.env.GITHUB_TOKEN;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  
  const flags = new Set(args.filter(a => a.startsWith("--")));
  const positional = args.filter(a => !a.startsWith("--"));
  const url = positional[0];
  
  const shouldPost = flags.has("--post");
  const heuristic = flags.has("--heuristic");
  const model = (Array.from(flags).find(f => f.startsWith("--model=")) || "--model=claude-sonnet-4-20250514").split("=")[1];

  if (!url) {
    console.error("Usage: claude-review <pr-url> [options]");
    console.error("");
    console.error("Options:");
    console.error("  --post            Post the review as a PR comment (requires GITHUB_TOKEN)");
    console.error("  --heuristic       Skip Claude API, use heuristic analysis only");
    console.error("  --model=<id>      Claude model (default: claude-sonnet-4-20250514)");
    console.error("");
    console.error("Env:");
    console.error("  GITHUB_TOKEN          Required for --post, or for private PRs");
    console.error("  ANTHROPIC_API_KEY     Required unless --heuristic is set");
    console.error("");
    console.error("Example:");
    console.error("  claude-review https://github.com/owner/repo/pull/123 --post");
    process.exit(1);
  }

  try {
    console.error("Fetching PR data...");
    const pr = await fetchPR(url, ghToken);

    console.error(`Analyzing with ${heuristic ? "heuristic" : `Claude (${model})`}...`);
    const review = await reviewPR(pr, { apiKey: anthropicKey, model, useHeuristic: heuristic });

    const md = formatMarkdown(pr, review);
    console.log(md);

    if (shouldPost) {
      if (!ghToken) {
        console.error("\nError: --post requires GITHUB_TOKEN");
        process.exit(1);
      }
      console.error("\nPosting review to PR...");
      const octokit = new Octokit({ auth: ghToken });
      await octokit.rest.issues.createComment({
        owner: pr.owner,
        repo: pr.repo,
        issue_number: pr.prNumber,
        body: md,
      });
      console.error(`✅ Posted to https://github.com/${pr.owner}/${pr.repo}/pull/${pr.prNumber}`);
    }
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

main();
