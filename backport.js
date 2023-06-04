import semver from 'semver'
import fs from 'fs'

/*
if (process.argv.length < 4) {
  console.error('Usage: node index.js <appId> <target>')
  process.exit(1)
}

const appId = process.argv[2]
const target = semver.valid(process.argv[3]) ?? semver.coerce(process.argv[3])
console.log(`Generating backports for app ${appId} down to server ${target.toString()}`)

const apps = JSON.parse(fs.readFileSync('apps.json', 'utf8'))

const branches = getBackportBranches(appId, target, apps)
console.log('Backporting to', branches)
*/

export function getBackportBranches(appId, target, apps) {
  const app = apps.find((app) => app.id === appId)
  //console.log(app)
  if (!app) {
    console.error(`App ${appId} not found`)
    process.exit(1)
  }

  // Gather most recent app version and rc for each server version
  const mostRecentVersionForPlatform = new Map()
  let platform = target
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
    console.debug(
      platform,
      versions.map((v) => v.toString()),
    )
    backportVersions.push(...versions)
  }

  console.log(
    'Backporting to',
    backportVersions.map((v) => v.toString()),
  )

  // Get unique and sorted branches to backport to
  let branches = backportVersions.map((version) => `stable${version.major}.${version.minor}`)
  branches = unique(branches)
  branches.sort()
  return branches
}

function unique(array) {
  return [...new Set(array)]
}
