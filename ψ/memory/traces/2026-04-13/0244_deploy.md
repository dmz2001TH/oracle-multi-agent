# Trace: deploy
Date: 2026-04-13T18:44:44.199Z
Mode: deep
Results: 23

## Memory Results

## Deep Results
- [code/grep] ./AGENT-PROMPT.md:92:- docs/DEPLOY.md — VPS deploy guide (systemd, Docker, Nginx)
- [code/grep] ./HANDOFF.md:72:| 26 | **VPS deploy guide** | ✅ docs/DEPLOY.md (systemd, Docker, Docker Compose, Nginx) |
- [code/grep] ./src/hooks.ts:96:    if (topic.includes("deploy") || topic.includes("release")) tags.push("release");
- [code/grep] ./src/agents/manager.js:68:- Manage deployment pipelines
- [code/grep] ./src/agents/definitions/devops.md:3:description: Manage deployments, CI/CD, infrastructure, and monitoring
- [code/grep] ./src/agents/definitions/devops.md:10:Manage infrastructure, deployments, and CI/CD pipelines.
- [code/grep] ./src/agents/definitions/devops.md:13:- Setting up deployment pipelines
- [code/grep] ./src/agents/definitions/devops.md:23:4. Verify deployment success
- [code/grep] ./src/dashboard/src/lib/peerProxyClient.ts:52: *   together when Q#5 (deploy ownership) is answered.
- [code/grep] ./src/dashboard/src/lib/api.ts:20: *                                         where mkcert isn't deployed)
- [code/grep] ./src/dashboard/src/lib/peerExecClient.ts:63: * - Awaits server half in maw-js + Nat's confirmation on deploy ownership.
- [code/grep] ./src/dashboard/src/hooks/useFederationList.ts:47:      // Federation API not available yet (#10 not deployed)
- [code/grep] ./src/commands/index.ts:245:      "/rrr good: deploy สำเร็จ | improve: test ยังไม่ครบ | action: เขียน unit test เพิ่ม",
- [code/grep] ./src/commands/index.ts:449:        "/trace deploy --deep",
- [code/grep] ./src/workflows/index.ts:236:    name: "deploy-pipeline",
- [code/grep] ./src/workflows/index.ts:237:    description: "Build → test → deploy → verify",
- [code/grep] ./src/workflows/index.ts:242:      { id: "deploy", name: "Deploy", role: "devops", task: "Deploy to production", dependsOn: ["test"] },
- [code/grep] ./src/workflows/index.ts:243:      { id: "verify", name: "Verify", role: "qa-tester", task: "Verify deployment health", dependsOn: ["deploy"] },
- [code/grep] ./ψ/memory/traces/2026-04-13/0237_deploy.md:1:# Trace: deploy
- [code/grep] ./ψ/memory/traces/2026-04-13/0237_deploy.md:9:- [code/grep] ./HANDOFF.md:72:| 26 | **VPS deploy guide** | ✅ docs/DEPLOY.md (systemd, Docker, Docker Co
- [git/log] d473f51 v3.0: Oracle ecosystem upgrade — ψ/ structure, slash commands, team orchestrator
- [git/diff] - PM2 ecosystem config for VPS deployment
- [git/diff] +// PM2 ecosystem config for VPS deployment