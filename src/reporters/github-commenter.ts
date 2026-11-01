import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import pc from 'picocolors';

export interface GitHubCommentOptions {
  pr?: number;
  repo?: string;
  token?: string;
}

export class GitHubCommenter {
  /**
   * Retrieves GitHub authentication token from environment or GitHub CLI
   */
  public static getAuthToken(overrideToken?: string): string | undefined {
    if (overrideToken) return overrideToken;
    if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
    if (process.env.GH_TOKEN) return process.env.GH_TOKEN;

    // Fallback: check if GitHub CLI is authenticated in the current runner
    try {
      const output = execSync('gh auth token', { stdio: ['pipe', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
      if (output) return output;
    } catch {
      // gh cli not installed or not authenticated
    }

    return undefined;
  }

  /**
   * Identifies repository and PR number from environment or GitHub Actions event payload
   */
  public static getPRContext(options?: GitHubCommentOptions): { repo?: string; prNumber?: number } {
    let repo = options?.repo || process.env.GITHUB_REPOSITORY;
    let prNumber = options?.pr;

    if (!prNumber && process.env.GITHUB_EVENT_PATH && fs.existsSync(process.env.GITHUB_EVENT_PATH)) {
      try {
        const eventData = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
        if (eventData.pull_request?.number) {
          prNumber = eventData.pull_request.number;
        } else if (eventData.issue?.number) {
          prNumber = eventData.issue.number;
        } else if (eventData.number) {
          prNumber = eventData.number;
        }
      } catch {
        // failed to parse event payload
      }
    }

    return { repo, prNumber };
  }

  /**
   * Appends report to GitHub Actions Step Summary if running in CI
   */
  public static writeStepSummary(markdown: string): void {
    const summaryFile = process.env.GITHUB_STEP_SUMMARY;
    if (summaryFile) {
      try {
        fs.appendFileSync(summaryFile, `\n${markdown}\n`, 'utf8');
        console.log(pc.green('✓ Report added to GitHub Actions Step Summary.'));
      } catch {
        // ignore summary write error
      }
    }
  }

  /**
   * Posts or updates the comment directly on the GitHub PR
   */
  public static async postOrUpdateComment(markdown: string, options?: GitHubCommentOptions): Promise<boolean> {
    // 1. Always append to GitHub Step Summary if running in Actions
    this.writeStepSummary(markdown);

    const token = this.getAuthToken(options?.token);
    const { repo, prNumber } = this.getPRContext(options);

    if (!token) {
      console.log(pc.yellow('ℹ No GITHUB_TOKEN or gh CLI auth detected. Skipped posting PR comment (printed to console).'));
      return false;
    }

    if (!repo || !prNumber) {
      console.log(pc.yellow(`ℹ Not running in a pull request context (repo=${repo || 'none'}, pr=${prNumber || 'none'}). Skipped posting comment.`));
      return false;
    }

    const apiUrl = process.env.GITHUB_API_URL || 'https://api.github.com';
    const commentHeaderTag = '## 🤖 Playwright Smart Regression Selection Report';

    try {
      // 2. Fetch existing comments to see if we should update or create
      const listRes = await fetch(`${apiUrl}/repos/${repo}/issues/${prNumber}/comments?per_page=100`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'playwright-smart-test',
        },
      });

      if (!listRes.ok) {
        console.error(pc.red(`Failed to fetch existing PR comments: ${listRes.status} ${listRes.statusText}`));
        return false;
      }

      const comments = (await listRes.json()) as Array<{ id: number; body: string }>;
      const existingComment = comments.find((c) => c.body && c.body.includes(commentHeaderTag));

      if (existingComment) {
        // Update existing comment
        const updateRes = await fetch(`${apiUrl}/repos/${repo}/issues/comments/${existingComment.id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'User-Agent': 'playwright-smart-test',
          },
          body: JSON.stringify({ body: markdown }),
        });

        if (updateRes.ok) {
          console.log(pc.green(`✓ Updated Smart Regression comment on PR #${prNumber} in ${repo}`));
          return true;
        } else {
          console.error(pc.red(`Failed to update PR comment: ${updateRes.status} ${updateRes.statusText}`));
        }
      } else {
        // Create new comment
        const postRes = await fetch(`${apiUrl}/repos/${repo}/issues/${prNumber}/comments`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'User-Agent': 'playwright-smart-test',
          },
          body: JSON.stringify({ body: markdown }),
        });

        if (postRes.ok) {
          console.log(pc.green(`✓ Created Smart Regression comment on PR #${prNumber} in ${repo}`));
          return true;
        } else {
          console.error(pc.red(`Failed to post PR comment: ${postRes.status} ${postRes.statusText}`));
        }
      }
    } catch (err) {
      console.error(pc.red(`Error posting GitHub PR comment: ${err instanceof Error ? err.message : String(err)}`));
    }

    return false;
  }
}
