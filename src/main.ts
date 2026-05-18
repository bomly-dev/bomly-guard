import * as core from '@actions/core'
import {fetchRefs, runDiff} from './cli.js'
import {commentOnPr} from './comment.js'
import {readConfig} from './config.js'
import {getRefs} from './refs.js'
import {fitSummary, renderSummary} from './summary.js'
import type {AuditFinding} from './types.js'

async function run(): Promise<void> {
  try {
    const config = await readConfig()
    const refs = getRefs(config)
    await fetchRefs(refs.base, refs.head)
    const diff = await runDiff(config, refs.base, refs.head)
    const introduced = diff.audit?.introduced ?? []
    const vulnerable = introduced.filter(f => f.auditor === 'vulnerability')
    const invalidLicenses = introduced.filter(f => f.auditor === 'license')
    const denied = introduced.filter(f => f.auditor === 'package' && f.id.includes('denied-'))
    const suspicious = introduced.filter(f => f.auditor === 'package' && f.id.includes('suspicious-package'))
    const failing = introduced.filter(isFailing)
    const summary = fitSummary(renderSummary(diff, config.show_patched_versions))

    core.setOutput('dependency-changes', JSON.stringify(diff.results.dependencies))
    core.setOutput('vulnerable-changes', JSON.stringify(vulnerable))
    core.setOutput('invalid-license-changes', JSON.stringify(invalidLicenses))
    core.setOutput('denied-changes', JSON.stringify(denied))
    core.setOutput('suspicious-package-changes', JSON.stringify(suspicious))
    core.setOutput('comment-content', summary)
    core.summary.addRaw(summary)
    await commentOnPr(summary, config, failing.length > 0)

    if (failing.length > 0 && !config.warn_only) {
      core.setFailed(`Bomly detected ${failing.length} introduced failing finding(s).`)
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : 'Unexpected bomly review failure')
  } finally {
    await core.summary.write()
  }
}

function isFailing(finding: AuditFinding): boolean {
  return !finding.disposition || finding.disposition === 'fail'
}

void run()
