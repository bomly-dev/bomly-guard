import * as core from '@actions/core'
import * as github from '@actions/github'
import type {ActionConfig} from './types.js'

const marker = '<!-- bomly-review-action-comment -->'

export async function commentOnPr(markdown: string, config: ActionConfig, issueFound: boolean): Promise<void> {
  if (config.comment_summary_in_pr === 'never') return
  if (config.comment_summary_in_pr === 'on-failure' && !issueFound) return
  const pr = github.context.payload.pull_request
  if (!pr) {
    core.warning('Skipping PR comment because this workflow is not running for a pull request.')
    return
  }
  const octokit = github.getOctokit(core.getInput('repo-token', {required: true}))
  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: pr.number
  })
  const commentBody = markdown.length > 65000 ? '# Bomly Review Summary\n\nThe full summary is available in the workflow job summary.' : markdown
  const body = `${commentBody}\n\n${marker}`
  const existing = comments.find(comment => comment.body?.includes(marker))
  if (existing) {
    await octokit.rest.issues.updateComment({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      comment_id: existing.id,
      body
    })
    return
  }
  await octokit.rest.issues.createComment({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: pr.number,
    body
  })
}
