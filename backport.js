import * as core from '@actions/core'
import semver from 'semver'

/**
 * Get a list of backport branches for a given app, server version and parsed apps.json.
 *
 * @param {string} appId
 * @param {semver.SemVer} target Target server version
 * @param {object[]} apps Parsed snapshot of apps.json
 * @returns {string[]} List of backport target branches
 */
export function getBackportBranches(appId, target, apps) {
  const app = apps.find((app) => app.id === appId)
  if (!app) {
    throw new Error(`App ${appId} not found`)
  }

  // Gather most recent app version and rc for each server version
  const mostRecentVersionForPlatform = new Map()
  let platform = target
  /* eslint-disable-next-line no-constant-condition */
  while (true) {
    let mostRecentVersion = undefined
    let mostRecentRc = undefined
    for (const release of app.releases) {
      if (release.isNightly) {
        continue
      }

      if (!semver.satisfies(platform, release.platformVersionSpec)) {
        continue
      }

      const version = semver.parse(release.version)
      const isRc = !!version.prerelease.find(
        (v) => typeof v === 'string' && v.toLowerCase().indexOf('rc') !== -1,
      )
      if (version.prerelease.length > 0 && !isRc) {
        continue
      }

      if (isRc) {
        if (!mostRecentRc || semver.gt(version, mostRecentRc)) {
          mostRecentRc = version
        }
      } else {
        if (!mostRecentVersion || semver.gt(version, mostRecentVersion)) {
          mostRecentVersion = version
        }
      }
    }

    if (!mostRecentVersion && !mostRecentRc) {
      break
    }

    // Mutate array instead of inserting a new one each time
    if (!mostRecentVersionForPlatform.has(platform.toString())) {
      mostRecentVersionForPlatform.set(platform.toString(), [])
    }
    const versions = mostRecentVersionForPlatform.get(platform.toString())

    if (mostRecentVersion) {
      versions.push(mostRecentVersion)
    }

    // Only respect an rc if it's newer than the most recent final version.
    // This indicates that branch off has already happened and the branch should be included.
    if (
      (!mostRecentVersion && mostRecentRc) ||
      (mostRecentVersion && mostRecentRc && semver.gt(mostRecentRc, mostRecentVersion))
    ) {
      versions.push(mostRecentRc)
    }

    // Check next major server version
    platform = semver.inc(platform, 'major')
  }

  // Gather all backport version targets from platform map
  const backportVersions = []
  for (const [platform, versions] of mostRecentVersionForPlatform) {
    core.info(`${platform} ${JSON.stringify(versions)}}`)
    backportVersions.push(...versions)
  }

  // Get unique and sorted branches to backport to
  let branches = backportVersions.map((version) => `stable${version.major}.${version.minor}`)
  branches = unique(branches)
  branches.sort()
  return branches
}

/**
 * Create a new array with unique values.
 *
 * @template T
 * @param {T[]} array
 * @returns {T[]} New array with unique values
 */
function unique(array) {
  return [...new Set(array)]
}
