import * as core from '@actions/core'
import * as github from '@actions/github'
import semver from 'semver'
import { getBackportBranches } from './backport.js'
import apps from './apps.json'

async function run() {
  try {
    // The YML workflow will need to set githubToken with the GitHub Secret Token
    // githubToken: ${{ secrets.GITHUB_TOKEN }}
    const githubToken = core.getInput('githubToken', { required: true })

    const context = github.context
    const octokit = github.getOctokit(githubToken)

    // The app id can be overwritten for testing and debugging
    const appId = core.getInput('appId') ?? context.repo.repo
    core.info(`Got app id: ${appId}`)

    // Parse server version from comment body
    const commentBody = context.payload.comment.body
    core.info(`Parsing comment: '${commentBody}'`)
    const serverVersion = semver.coerce(parseComment(commentBody))
    core.info(`Requesting backports for ${appId} down to server ${serverVersion.major}`)

    // Generate a list of backport branches
    const branches = getBackportBranches(appId, serverVersion, apps)
    core.info(`Requesting backports for branches ${branches.join(', ')}`)

    core.setOutput('branches', JSON.stringify(branches))

    await octokit.rest.reactions.createForIssueComment({
      comment_id: context.payload.comment.id,
      content: 'eyes',
      owner: context.repo.owner,
      repo: context.repo.repo,
    })
    await octokit.rest.issues.createComment({
      issue_number: context.issue.number,
      owner: context.repo.owner,
      repo: context.repo.repo,
      body: branches.map((branch) => `/backport ${branch}`).join('\n'),
    })
    await octokit.rest.reactions.createForIssueComment({
      comment_id: context.payload.comment.id,
      content: '+1',
      owner: context.repo.owner,
      repo: context.repo.repo,
    })
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()

/**
 * Allowed commands:
 * /gwbackport 24
 * /gwbackport stable24
 * /gwbp 24
 * /gwbp stable24
 *
 * @param {string} commentBody
 * @returns {number} Parsed major server version
 */
export function parseComment(commentBody) {
  const commentRegex = /\/(?:gwbackport|gwbp)\s+(?:stable)?(?<major>[0-9]+)/
  const match = commentRegex.exec(commentBody)
  const major = parseInt(match?.groups?.major)
  if (!major) {
    throw new Error('Failed to parse command in comment body')
  }
  return major
}
