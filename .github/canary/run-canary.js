#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!token) {
  throw new Error("GH_TOKEN or GITHUB_TOKEN is required");
}

const configPath = process.env.CANARY_CONFIG || ".github/canary/targets.json";
const rerun = (process.env.CANARY_RERUN || "true") === "true";
const timeoutMinutes = Number(process.env.CANARY_TIMEOUT_MINUTES || "45");
const pollSeconds = Number(process.env.CANARY_POLL_SECONDS || "20");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "bomly-guard-canary",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, options = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  if (res.status === 204) return null;
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = body?.message || text || res.statusText;
    throw new Error(`${options.method || "GET"} ${path} failed: ${res.status} ${message}`);
  }
  return body;
}

function ownerRepo(repo) {
  const [owner, name] = repo.split("/");
  if (!owner || !name) throw new Error(`Invalid repo ${repo}`);
  return { owner, name };
}

async function listAll(path) {
  const results = [];
  let page = 1;
  for (;;) {
    const joiner = path.includes("?") ? "&" : "?";
    const body = await request(`${path}${joiner}per_page=100&page=${page}`);
    const items = Array.isArray(body) ? body : body.items || body.workflow_runs || body.check_runs || body.jobs || [];
    results.push(...items);
    if (items.length < 100) return results;
    page += 1;
  }
}

async function getPull(repo, pr) {
  return request(`/repos/${repo}/pulls/${pr}`);
}

async function getChangedFiles(repo, pr) {
  return new Set((await listAll(`/repos/${repo}/pulls/${pr}/files`)).map((file) => file.filename));
}

async function latestWorkflowRun(repo, workflow, pull) {
  const runs = await listAll(
    `/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/runs?branch=${encodeURIComponent(
      pull.head.ref,
    )}&event=pull_request`,
  );
  return runs
    .filter((run) => run.head_sha === pull.head.sha || run.pull_requests?.some((item) => item.number === pull.number))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
}

async function rerunAndWait(repo, run) {
  if (rerun) {
    await request(`/repos/${repo}/actions/runs/${run.id}/rerun`, { method: "POST" });
  }

  const deadline = Date.now() + timeoutMinutes * 60 * 1000;
  let current = run;
  while (Date.now() < deadline) {
    current = await request(`/repos/${repo}/actions/runs/${run.id}`);
    if (current.status === "completed") return current;
    await sleep(pollSeconds * 1000);
  }
  throw new Error(`Timed out waiting for ${repo} run ${run.id}`);
}

async function getCheckRuns(repo, sha) {
  const body = await request(`/repos/${repo}/commits/${sha}/check-runs`);
  return body.check_runs || [];
}

async function getComments(repo, pr) {
  return listAll(`/repos/${repo}/issues/${pr}/comments`);
}

async function getCodeScanningAlerts(repo, pr) {
  try {
    return await listAll(`/repos/${repo}/code-scanning/alerts?state=open&pr=${pr}&tool_name=bomly`);
  } catch (error) {
    return { error: error.message, alerts: [] };
  }
}

function commentHasCategories(comment, categories) {
  return categories.every((category) => new RegExp(`\\|\\s*(introduced|persisted|resolved)\\s*\\|\\s*${category}\\s*\\|`, "i").test(comment));
}

async function evaluateTarget(target) {
  const pull = await getPull(target.repo, target.pr);
  const changedFiles = await getChangedFiles(target.repo, target.pr);
  const run = await latestWorkflowRun(target.repo, target.workflow || "bomly-guard.yml", pull);
  if (!run) throw new Error(`No pull_request workflow run found for ${target.repo}#${target.pr}`);

  const completedRun = await rerunAndWait(target.repo, run);
  const checkRuns = await getCheckRuns(target.repo, pull.head.sha);
  const guardCheck = checkRuns.find((check) => check.name === "guard");
  const bomlyCheck = checkRuns.find((check) => check.name === "bomly");
  const comments = await getComments(target.repo, target.pr);
  const bomlyComment = comments.find((comment) => comment.body.includes("<!-- bomly-guard-comment -->"));
  const codeScanningResult = await getCodeScanningAlerts(target.repo, target.pr);
  const codeScanningAlerts = Array.isArray(codeScanningResult) ? codeScanningResult : codeScanningResult.alerts;
  const codeScanningError = Array.isArray(codeScanningResult) ? "" : codeScanningResult.error;
  const changedLineAlerts = codeScanningAlerts.filter((alert) => {
    const path = alert.most_recent_instance?.location?.path;
    return path && changedFiles.has(path);
  });

  const failures = [];
  if (target.expectedConclusion && completedRun.conclusion !== target.expectedConclusion) {
    failures.push(`expected workflow conclusion ${target.expectedConclusion}, got ${completedRun.conclusion}`);
  }
  if (target.requireComment && !bomlyComment) {
    failures.push("missing Bomly PR comment");
  }
  if (bomlyComment && target.expectedFindingCategories?.length && !commentHasCategories(bomlyComment.body, target.expectedFindingCategories)) {
    failures.push(`Bomly PR comment missing expected categories: ${target.expectedFindingCategories.join(", ")}`);
  }
  if (target.requireSarif && !bomlyCheck) {
    failures.push("missing bomly code-scanning check");
  }
  if (target.requireSarif && codeScanningError) {
    failures.push(`code scanning query failed: ${codeScanningError}`);
  }
  if (target.requireSarif && codeScanningAlerts.length === 0) {
    failures.push("missing bomly code-scanning alerts");
  }
  if (target.requireChangedLineAlert && changedLineAlerts.length === 0) {
    failures.push("missing bomly code-scanning alert on changed dependency files");
  }

  return {
    target,
    prUrl: pull.html_url,
    runUrl: completedRun.html_url,
    conclusion: completedRun.conclusion,
    guardCheck: guardCheck?.conclusion || "missing",
    bomlyCheck: bomlyCheck?.conclusion || "missing",
    comment: bomlyComment ? "present" : "missing",
    alerts: codeScanningAlerts.length,
    changedLineAlerts: changedLineAlerts.length,
    failures,
  };
}

function markdown(results) {
  const lines = [
    "# Bomly Guard Canary",
    "",
    "| Target | PR | Run | Conclusion | Comment | SARIF check | Changed-line alerts | Result |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const result of results) {
    const status = result.failures.length ? `FAIL: ${result.failures.join("; ")}` : "ok";
    lines.push(
      `| ${result.target.name} | [PR](${result.prUrl}) | [run](${result.runUrl}) | ${result.conclusion} | ${result.comment} | ${result.bomlyCheck} | ${result.changedLineAlerts}/${result.alerts} | ${status} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

(async () => {
  const results = [];
  for (const target of config.targets || []) {
    try {
      results.push(await evaluateTarget(target));
    } catch (error) {
      results.push({
        target,
        prUrl: `https://github.com/${target.repo}/pull/${target.pr}`,
        runUrl: "",
        conclusion: "error",
        guardCheck: "error",
        bomlyCheck: "error",
        comment: "unknown",
        alerts: 0,
        changedLineAlerts: 0,
        failures: [error.message],
      });
    }
  }

  fs.writeFileSync("canary-results.json", JSON.stringify(results, null, 2));
  const summary = markdown(results);
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  }

  const failed = results.filter((result) => result.failures.length > 0);
  if (failed.length) {
    process.exitCode = 1;
  }
})();
