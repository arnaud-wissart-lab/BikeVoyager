import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dirname, '..')

const readText = (relativePath) => readFileSync(resolve(repositoryRoot, relativePath), 'utf8')

const fail = (message) => {
  console.error(`[toolchain] ${message}`)
  process.exitCode = 1
}

const expectMatch = (content, pattern, message) => {
  if (!pattern.test(content)) {
    fail(message)
  }
}

const nodeVersion = readText('.nvmrc').trim()
const nodeMajor = nodeVersion.split('.')[0]
const packageManifest = JSON.parse(readText('frontend/package.json'))
const packageLock = JSON.parse(readText('frontend/package-lock.json'))
const frontendDockerfile = readText('Dockerfile.frontend')
const backendDockerfile = readText('Dockerfile.backend')
const globalJson = JSON.parse(readText('global.json'))

if (packageManifest.engines?.node !== `${nodeMajor}.x`) {
  fail(`frontend/package.json doit cibler Node ${nodeMajor}.x comme .nvmrc (${nodeVersion}).`)
}

if (packageLock.packages?.['']?.engines?.node !== packageManifest.engines.node) {
  fail('package-lock.json doit reprendre la contrainte Node de package.json.')
}

if (process.versions.node !== nodeVersion) {
  fail(`La validation doit s'exécuter avec Node ${nodeVersion}.`)
}

if (!packageManifest.devDependencies?.['@types/node']?.startsWith(`^${nodeMajor}.`)) {
  fail(`@types/node doit rester sur la ligne ${nodeMajor}.x.`)
}

expectMatch(
  frontendDockerfile,
  new RegExp(`^FROM node:${nodeVersion.replaceAll('.', '\\.')}-alpine AS build$`, 'm'),
  `Dockerfile.frontend doit utiliser node:${nodeVersion}-alpine.`,
)

const dotnetSdkVersion = globalJson.sdk?.version
if (!dotnetSdkVersion) {
  fail('global.json doit définir sdk.version.')
} else {
  expectMatch(
    backendDockerfile,
    new RegExp(
      `^FROM mcr\\.microsoft\\.com/dotnet/sdk:${dotnetSdkVersion.replaceAll('.', '\\.')}`,
      'm',
    ),
    `Dockerfile.backend doit utiliser le SDK .NET ${dotnetSdkVersion}.`,
  )
}

if (!process.exitCode) {
  console.log(
    `[toolchain] Alignement vérifié : Node ${nodeVersion}, @types/node ${nodeMajor}.x, SDK .NET ${dotnetSdkVersion}.`,
  )
}
