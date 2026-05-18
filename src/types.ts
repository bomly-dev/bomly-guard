export interface PackageRef {
  name: string
  version?: string
  scope?: string
  id?: string
}

export interface AuditFinding {
  id: string
  kind: string
  severity: string
  title: string
  auditor?: string
  disposition?: string
  fixed_in?: string
  package: PackageRef
}

export interface DiffResponse {
  comparison: {base: string; head: string}
  results: {
    dependencies: {
      added?: Array<{package: PackageRef}>
      removed?: Array<{package: PackageRef}>
      changed?: Array<{before: PackageRef; after: PackageRef}>
    }
  }
  audit?: {
    introduced?: AuditFinding[]
    persisted?: AuditFinding[]
    resolved?: AuditFinding[]
  }
}

export interface ActionConfig {
  bomly_path: string
  base_ref?: string
  head_ref?: string
  fail_on_severity?: string
  fail_on_scopes?: string[]
  allow_licenses?: string[]
  deny_licenses?: string[]
  allow_dependencies_licenses?: string[]
  allow_ghsas?: string[]
  deny_packages?: string[]
  deny_groups?: string[]
  protected_packages?: string[]
  typosquat_threshold?: string
  typosquat_mode?: string
  warn_only: boolean
  comment_summary_in_pr: 'never' | 'always' | 'on-failure'
  show_patched_versions: boolean
}
