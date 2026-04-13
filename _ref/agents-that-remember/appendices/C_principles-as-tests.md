# Appendix C — Principles as Tests

> Turning the four principles into CI checks and pre-commit hooks.

Principles that live only in documentation decay. Principles that live in CI stay. This appendix shows how to take each of the four principles from Part IV and turn it into something a machine can enforce. Not exhaustively — these are illustrative. Adapt to your stack.

## Principle 1: Nothing Is Deleted

### Pre-commit hook — forbid `rm` in vault-touching scripts

Any shell script inside the vault (or any script that touches vault paths) must not call `rm` unless wrapped by an archival helper. The hook rejects the commit otherwise.

```bash
#!/usr/bin/env bash
# .githooks/pre-commit-no-rm
# Fails if a staged file introduces an `rm` in a vault-touching script.

set -euo pipefail

staged_scripts=$(git diff --cached --name-only --diff-filter=ACM \
  | grep -E '\.(sh|bash|zsh|py|js|ts)$' || true)

for f in $staged_scripts; do
  # Only scripts that touch ψ/ are policed.
  if ! grep -q 'ψ/' "$f"; then continue; fi

  # Allow archive_then_remove and similar wrappers.
  if grep -E '^[^#]*\brm\b' "$f" | grep -vE 'archive_then_remove|# allow-rm' >/dev/null; then
    echo "FAIL: $f contains unwrapped 'rm' against vault paths."
    echo "Use archive_then_remove, or add '# allow-rm' with justification."
    exit 1
  fi
done
```

The escape hatch is intentional: `# allow-rm` next to a line lets you override, but leaves a grep-able comment explaining why. Silent deletions can't sneak in; justified deletions can, with a trace.

### CI check — retrospective directory is append-only

No commit is allowed to delete or modify an existing retrospective file, only add new ones.

```bash
#!/usr/bin/env bash
# ci/check-retro-append-only.sh

# For every file under retrospectives/ that changed in this PR, fail if the
# change is anything other than an addition of a new file.

base="origin/main"
changed=$(git diff --name-only "$base"...HEAD -- 'ψ/agents/*/retrospectives/')

for f in $changed; do
  status=$(git log --follow --name-status "$base"...HEAD -- "$f" \
    | awk '/^[AMD]/{print $1; exit}')
  if [[ "$status" != "A" ]]; then
    echo "FAIL: retrospective $f was $status (not a clean add)."
    exit 1
  fi
done
```

Extend the same pattern to `handoffs/`, `findings.md` (append-only inside the file — check with a diff-rule that rejects deletion lines but allows addition lines), and anything else you declare append-only.

### Weekly audit — unaccounted-for deletions

A scheduled job scans the vault for files that exist in the Git history but not on disk, with no matching archival record. Each such file is reported for review. This is defense-in-depth — if your hooks fail or someone bypasses them, the audit catches it.

## Principle 2: Patterns Over Intentions

This one is subtler. You can't CI-check "did the engineer trust the pattern or the summary?" You can CI-check its infrastructure: the patterns must exist to be trusted.

### CI check — every agent has a tool-call log

Each agent's session directory must contain a tool-call log file. If a session ended without producing one, the agent is violating the observation contract.

```bash
#!/usr/bin/env bash
# ci/check-session-logs.sh

for session_dir in ψ/agents/*/sessions/*/; do
  if [[ ! -f "$session_dir/tool-calls.jsonl" ]]; then
    echo "FAIL: session $session_dir has no tool-calls.jsonl — pattern is missing."
    exit 1
  fi
done
```

The test doesn't judge the content. It just guarantees the pattern *exists*. If it exists, humans and future agents can read it. If it doesn't, all you have is the summary — and summaries are intentions.

### Pre-commit hook — claims in retrospectives must link to evidence

A retrospective that says "shipped PR #N" must include a link. A retrospective that mentions a commit must reference the hash in a form that can be verified.

```bash
#!/usr/bin/env bash
# .githooks/pre-commit-retro-evidence

retro_files=$(git diff --cached --name-only --diff-filter=A \
  | grep -E 'retrospectives/.*\.md$' || true)

for f in $retro_files; do
  # If the retro mentions a PR number, it should link to the PR.
  if grep -E '#[0-9]+' "$f" >/dev/null && ! grep -E '\[#[0-9]+\]' "$f" >/dev/null; then
    echo "WARN: $f mentions a PR number without a link."
    # Warning, not failure — too strict for a hook, but worth flagging.
  fi
done
```

You can tune this stricter or looser. The spirit: when a retrospective makes a claim, the reader should be one click away from the evidence.

## Principle 3: External Brain Beats Internal

### CI check — every agent has identity + standing-orders

Every agent directory must contain the minimum brain. If an agent is missing the basics, it has no external memory to lose.

```bash
#!/usr/bin/env bash
# ci/check-external-brain.sh

for agent_dir in ψ/agents/*/; do
  agent=$(basename "$agent_dir")
  for required in identity.md standing-orders.md mailbox/context.md; do
    if [[ ! -f "$agent_dir/$required" ]]; then
      echo "FAIL: agent $agent is missing $required"
      exit 1
    fi
  done
done
```

### Pre-commit hook — no giant prompt files

A prompt file larger than a threshold (say, 50KB) is a sign that state is being crammed into the prompt instead of loaded from disk.

```bash
#!/usr/bin/env bash
# .githooks/pre-commit-prompt-size

prompt_files=$(git diff --cached --name-only --diff-filter=ACM \
  | grep -E 'prompts?/.*\.(txt|md)$' || true)

for f in $prompt_files; do
  size=$(wc -c < "$f")
  if (( size > 50000 )); then
    echo "FAIL: $f is ${size} bytes — move stable state to the external brain."
    exit 1
  fi
done
```

Threshold is taste. The point is to make the anti-pattern (cramming) visible early, not to forbid all large prompts.

## Principle 4: Rule 6 — Never Pretend To Be Human

### Pre-commit hook — AI commits must include attribution

If a commit is made by an AI agent, it must include a `Co-Authored-By:` line with the agent's name.

```bash
#!/usr/bin/env bash
# .githooks/commit-msg-rule6

commit_msg_file="$1"

# Detect AI authorship — for example, if the committer email matches an agent pattern.
author_email=$(git config user.email)

if [[ "$author_email" =~ @oracle$ ]] || [[ "$author_email" =~ @noreply\.agent ]]; then
  if ! grep -qE '^Co-Authored-By: .+<.+@.+>$' "$commit_msg_file"; then
    echo "FAIL: AI-authored commit must include Co-Authored-By line."
    echo "Add: Co-Authored-By: <agent-name> <agent-email>"
    exit 1
  fi
fi
```

This is the technical form of Rule 6: the AI's involvement in the commit is always labeled. No silent AI commits.

### Check — bot accounts have bot-shaped identities

A periodic audit of chat/issue/PR accounts controlled by agents. Each such account should:

- Have a username that makes its bot nature clear (`oracle-bot`, `agent-foo`, not `steve_m`).
- Have a bio or profile description that identifies it as an automated agent.
- Have an avatar that is not a stock human photo.

This is harder to automate end-to-end, but even a quarterly manual review with a checklist enforces the principle. Keep the checklist in the repo so the review is reproducible.

### Pre-send hook — outbound messages that claim to be human fail

For an agent that sends outbound messages (email, chat), a send-time check inspects the message for phrasing like "as a human," "speaking as a person," or similar assertions that violate Rule 6. Such messages are blocked.

This is a last-line defense. In practice you shouldn't need it — the agent's prompts and training should keep it from ever reaching for such phrasing. But belt-and-suspenders matters for a principle this consequential.

## How To Roll These Out

Don't land all of these at once. Rolling out test enforcement is a social move as much as a technical one.

1. **Week one:** enable the checks as warnings. Nothing fails. The output is purely informational. People see which of their habits would have tripped a check.
2. **Week two:** turn on the two most important checks as blockers (the `rm` hook and the `Co-Authored-By` hook are the usual first picks).
3. **Weeks three and beyond:** add checks one at a time, with a changelog entry each time explaining what the check enforces and why. Let the team absorb each addition.
4. **Ongoing:** review the warnings that are still only warnings. Promote the ones that matter to blockers. Retire the ones that turn out to produce only noise.

You will find, once the hooks are in place, that the principles start shaping code you haven't yet written. Someone about to type `rm` pauses and uses `archive_then_remove` instead — because the hook would have stopped them. Someone about to cram 200KB into a prompt puts it in a file instead. Someone adds `Co-Authored-By` automatically, without thinking. The principles become ambient. The hooks taught the team what the book tried to teach the reader, with less friction and more durability.

## The Goal

The goal is not a CI pipeline so strict that no one can work. The goal is a CI pipeline that makes the right thing easy and the wrong thing visibly worth flagging. A hook should almost never fail in normal work. When it does, it should feel like a seatbelt catching you during a stop — not like a cage.

Principles that pass through CI become culture. Culture is what survives team turnover, framework rewrites, and the slow drift of priorities. Without enforcement, even well-loved principles fade inside a year. With enforcement, they outlast the people who wrote them.

Pick two checks from this appendix. Turn them on tomorrow. Next month, add a third. That's how the principles become the system.
