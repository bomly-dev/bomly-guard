import * as core from '@actions/core'
import * as github from '@actions/github'
import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import type {ActionConfig} from './types.js'

type PartialConfig = Partial<ActionConfig>

export async function readConfig(): Promise<ActionConfig> {
  const fileConfig = await readConfigFile(optionalInput('config-file'))
  const inlineConfig = readInlineConfig()
  return normalizeConfig({...fileConfig, ...inlineConfig})
}

function readInlineConfig(): PartialConfig {
  return compact({
    bomly_path: optionalInput('bomly-path'),
    base_ref: optionalInput('base-ref'),
    head_ref: optionalInput('head-ref'),
    fail_on_severity: optionalInput('fail-on-severity'),
    fail_on_scopes: parseList(optionalInput('fail-on-scopes')),
    allow_licenses: parseList(optionalInput('allow-licenses')),
    deny_licenses: parseList(optionalInput('deny-licenses')),
    allow_dependencies_licenses: parseList(optionalInput('allow-dependencies-licenses')),
    allow_ghsas: parseList(optionalInput('allow-ghsas')),
    deny_packages: parseList(optionalInput('deny-packages')),
    deny_groups: parseList(optionalInput('deny-groups')),
    protected_packages: parseList(optionalInput('protected-packages')),
    typosquat_threshold: optionalInput('typosquat-threshold'),
    typosquat_mode: optionalInput('typosquat-mode'),
    warn_only: optionalBoolean('warn-only'),
    comment_summary_in_pr: optionalInput('comment-summary-in-pr') as PartialConfig['comment_summary_in_pr'],
    show_patched_versions: optionalBoolean('show-patched-versions')
  })
}

async function readConfigFile(configFile?: string): Promise<PartialConfig> {
  if (!configFile) return {}
  const remote = /^(?<owner>[^/]+)\/(?<repo>[^/]+)\/(?<path>[^@]+)@(?<ref>.+)$/.exec(configFile)
  const raw = remote?.groups ? await fetchRemoteConfig(remote.groups) : fs.readFileSync(path.resolve(configFile), 'utf8')
  const parsed = YAML.parse(raw) as Record<string, unknown>
  const normalized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parsed ?? {})) {
    normalized[key.replace(/-/g, '_')] = normalizeListValue(value)
  }
  return normalized as PartialConfig
}

async function fetchRemoteConfig(parts: Record<string, string>): Promise<string> {
  const token = optionalInput('external-repo-token') ?? core.getInput('repo-token', {required: true})
  const octokit = github.getOctokit(token)
  const {data} = await octokit.rest.repos.getContent({
    owner: parts.owner,
    repo: parts.repo,
    path: parts.path,
    ref: parts.ref,
    mediaType: {format: 'raw'}
  })
  if (typeof data !== 'string') throw new Error('External config did not resolve to a text file')
  return data
}

function normalizeConfig(config: PartialConfig): ActionConfig {
  const mode = config.comment_summary_in_pr ?? 'never'
  if (!['never', 'always', 'on-failure'].includes(mode)) {
    throw new Error('comment-summary-in-pr must be one of never, always, or on-failure')
  }
  return {
    bomly_path: config.bomly_path ?? 'bomly',
    base_ref: config.base_ref,
    head_ref: config.head_ref,
    fail_on_severity: config.fail_on_severity,
    fail_on_scopes: config.fail_on_scopes,
    allow_licenses: config.allow_licenses,
    deny_licenses: config.deny_licenses,
    allow_dependencies_licenses: config.allow_dependencies_licenses,
    allow_ghsas: config.allow_ghsas,
    deny_packages: config.deny_packages,
    deny_groups: config.deny_groups,
    protected_packages: config.protected_packages,
    typosquat_threshold: config.typosquat_threshold,
    typosquat_mode: config.typosquat_mode,
    warn_only: config.warn_only ?? false,
    comment_summary_in_pr: mode as ActionConfig['comment_summary_in_pr'],
    show_patched_versions: config.show_patched_versions ?? false
  }
}

function normalizeListValue(value: unknown): unknown {
  if (typeof value === 'string' && value.includes(',')) return parseList(value)
  return value
}

function parseList(value?: string): string[] | undefined {
  return value ? value.split(',').map(item => item.trim()).filter(Boolean) : undefined
}

function optionalInput(name: string): string | undefined {
  const value = core.getInput(name)
  return value.length > 0 ? value : undefined
}

function optionalBoolean(name: string): boolean | undefined {
  const value = core.getInput(name)
  return value.length > 0 ? core.getBooleanInput(name) : undefined
}

function compact<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>
}
