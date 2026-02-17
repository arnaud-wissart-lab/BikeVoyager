import { execSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { extname } from 'node:path'

const formatExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
])

const ignoredPrefixes = [
  'dist/',
  'node_modules/',
  'obj/',
  'bin/',
  'playwright-report/',
  'test-results/',
]

const runGitCommand = (command) => {
  try {
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return output.trim()
  } catch {
    return ''
  }
}

const splitChangedFiles = (rawOutput) =>
  rawOutput
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0)

const normalizeFrontendPath = (filePath) =>
  filePath.startsWith('frontend/') ? filePath.slice('frontend/'.length) : filePath

const isEligibleFile = (filePath) => {
  if (ignoredPrefixes.some((prefix) => filePath.startsWith(prefix))) {
    return false
  }

  if (!existsSync(filePath)) {
    return false
  }

  return formatExtensions.has(extname(filePath).toLowerCase())
}

const collectChangedFiles = () => {
  const isCi = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'
  const baseRef = process.env.GITHUB_BASE_REF?.trim()
  if (isCi && baseRef) {
    runGitCommand(`git fetch --no-tags --depth=1 origin ${baseRef}`)
    const mergeBase = runGitCommand(`git merge-base HEAD origin/${baseRef}`)
    if (mergeBase) {
      const fromBase = runGitCommand(
        `git diff --name-only --diff-filter=ACMR ${mergeBase}...HEAD -- .`,
      )
      const files = splitChangedFiles(fromBase)
      if (files.length > 0) {
        return files
      }
    }
  }

  if (isCi) {
    const fromHeadCommit = runGitCommand(
      'git diff --name-only --diff-filter=ACMR HEAD~1...HEAD -- .',
    )
    const headCommitFiles = splitChangedFiles(fromHeadCommit)
    if (headCommitFiles.length > 0) {
      return headCommitFiles
    }
  }

  const staged = runGitCommand('git diff --name-only --diff-filter=ACMR --cached -- .')
  const stagedFiles = splitChangedFiles(staged)
  if (stagedFiles.length > 0) {
    return stagedFiles
  }

  const workingTree = runGitCommand('git diff --name-only --diff-filter=ACMR -- .')
  return splitChangedFiles(workingTree)
}

const changedFiles = collectChangedFiles()
const filesToCheck = changedFiles
  .map(normalizeFrontendPath)
  .filter(isEligibleFile)
  .filter((value, index, array) => array.indexOf(value) === index)

if (filesToCheck.length === 0) {
  console.log('Prettier: aucun fichier modifie a verifier.')
  process.exit(0)
}

console.log(`Prettier: verification de ${filesToCheck.length} fichier(s) modifies.`)
const result = spawnSync(
  'npx',
  ['prettier', '--check', ...filesToCheck],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
)

process.exit(result.status ?? 1)
