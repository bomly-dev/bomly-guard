import * as github from '@actions/github'
import type {ActionConfig} from './types.js'

export function getRefs(config: ActionConfig): {base: string; head: string} {
  let base = config.base_ref
  let head = config.head_ref
  const payload = github.context.payload
  if ((!base || !head) && (github.context.eventName === 'pull_request' || github.context.eventName === 'pull_request_target')) {
    base ||= payload.pull_request?.base.sha
    head ||= payload.pull_request?.head.sha
  }
  if ((!base || !head) && github.context.eventName === 'merge_group') {
    base ||= payload.merge_group?.base_sha
    head ||= payload.merge_group?.head_sha
  }
  if (!base || !head) throw new Error('Both base-ref and head-ref are required outside pull_request, pull_request_target, or merge_group events')
  return {base, head}
}
