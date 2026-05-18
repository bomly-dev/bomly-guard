import {spawn} from 'node:child_process'
import type {ActionConfig, DiffResponse} from './types.js'

export async function fetchRefs(base: string, head: string): Promise<void> {
  await run('git', ['fetch', '--no-tags', '--prune', '--depth=1', 'origin', base, head])
}

export async function runDiff(config: ActionConfig, base: string, head: string): Promise<DiffResponse> {
  const args = ['diff', '--base', base, '--head', head, '--enrich', '--audit', '--format', 'json']
  pushList(args, '--fail-on-scope', config.fail_on_scopes)
  pushList(args, '--allow-vulnerability-id', config.allow_ghsas)
  pushList(args, '--allow-license', config.allow_licenses)
  pushList(args, '--deny-license', config.deny_licenses)
  pushList(args, '--license-exempt-package', config.allow_dependencies_licenses)
  pushList(args, '--deny-package', config.deny_packages)
  pushList(args, '--deny-group', config.deny_groups)
  pushList(args, '--protected-package', config.protected_packages)
  if (config.fail_on_severity) args.push('--fail-on', config.fail_on_severity)
  if (config.typosquat_threshold) args.push('--typosquat-threshold', config.typosquat_threshold)
  if (config.typosquat_mode) args.push('--typosquat-mode', config.typosquat_mode)
  if (config.warn_only) args.push('--warn-only')
  const stdout = await run(config.bomly_path, args, true)
  return JSON.parse(stdout) as DiffResponse
}

function pushList(args: string[], flag: string, values?: string[]): void {
  for (const value of values ?? []) args.push(flag, value)
}

function run(command: string, args: string[], allowFailure = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {stdio: ['ignore', 'pipe', 'pipe']})
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => (stdout += chunk))
    child.stderr.on('data', chunk => (stderr += chunk))
    child.on('error', reject)
    child.on('close', code => {
      if (code === 0 || allowFailure) return resolve(stdout)
      reject(new Error(`${command} exited with code ${code}: ${stderr.trim()}`))
    })
  })
}
