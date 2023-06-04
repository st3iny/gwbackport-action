import * as core from '@actions/core'
import * as github from '@actions/github'
import semver from 'semver'
import { getBackportBranches } from './backport.js'
import fs from 'fs'
import apps from './apps.json'

async function run() {
  try {
    // The YML workflow will need to set githubToken with the GitHub Secret Token
    // githubToken: ${{ secrets.GITHUB_TOKEN }}
    const githubToken = core.getInput('githubToken', { required: true })

    const context = github.context
    const octokit = github.getOctokit(githubToken)

    // For testing and debugging
    const appId = core.getInput('appId', { required: true })

    //const commentBody = core.getInput('commentBody', { required: true })
    const commentBody = context.payload.comment.body
    core.info(`Parsing comment: '${commentBody}'`) // debug is only output if you set the secret `ACTIONS_RUNNER_DEBUG` to true

    /*
     * Allowed commands:
     * /gwbackport 24
     * /gwbackport stable24
     * /gwbp 24
     * /gwbp stable24
     */
    const commentRegex = /\/(?:gwbackport|gwbp)\s+(?:stable)?(?<major>[0-9]+)/
    const match = commentRegex.exec(commentBody)
    const major = parseInt(match?.groups?.major)
    if (!major) {
      throw new Error('Failed to parse command in comment body')
    }

    core.info(`Requesting backports for ${appId} down to server ${major}`)

    const serverVersion = semver.coerce(major)
    //const apps = JSON.parse(fs.readFileSync('apps.json', 'utf8'))
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
