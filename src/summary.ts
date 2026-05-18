import type {AuditFinding, DiffResponse} from './types.js'

export function renderSummary(diff: DiffResponse, showPatchedVersions: boolean): string {
  const dependencies = diff.results.dependencies
  const introduced = diff.audit?.introduced ?? []
  const lines = [
    '# Bomly Review Summary',
    '',
    `Compared \`${diff.comparison.base}\` to \`${diff.comparison.head}\`.`,
    '',
    '## Dependency Changes',
    '',
    `Added: ${dependencies.added?.length ?? 0}`,
    `Removed: ${dependencies.removed?.length ?? 0}`,
    `Changed: ${dependencies.changed?.length ?? 0}`,
    ''
  ]
  appendFindings(lines, 'Vulnerabilities', introduced.filter(f => f.auditor === 'vulnerability'), showPatchedVersions)
  appendFindings(lines, 'License Policy', introduced.filter(f => f.auditor === 'license'), false)
  appendFindings(lines, 'Package Policy', introduced.filter(f => f.auditor === 'package'), false)
  return lines.join('\n')
}

export function fitSummary(markdown: string): string {
  const maxBytes = 1024 * 1024
  if (Buffer.byteLength(markdown, 'utf8') <= maxBytes) return markdown
  return '# Bomly Review Summary\n\nThe full summary exceeded the GitHub job summary limit and was truncated.'
}

function appendFindings(lines: string[], title: string, findings: AuditFinding[], showPatchedVersions: boolean): void {
  lines.push(`## ${title}`, '')
  if (findings.length === 0) {
    lines.push('No introduced findings.', '')
    return
  }
  for (const finding of findings) {
    const patched = showPatchedVersions && finding.fixed_in ? ` (patched in ${finding.fixed_in})` : ''
    lines.push(`- [${finding.disposition ?? 'fail'}] ${finding.package.name}@${finding.package.version ?? ''}: ${finding.title}${patched}`)
  }
  lines.push('')
}
