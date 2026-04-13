export function usage() {
  console.log(`\x1b[36moracle\x1b[0m — Multi-Agent Workflow (v5.0)

\x1b[33mUsage:\x1b[0m
  oracle ls                      List sessions + windows
  oracle peek [agent]            Peek agent screen (or all)
  oracle hey <agent> <msg...>    Send message to agent (alias: tell)
  oracle hey <oracle>:<win> <m>  Target a specific tab (e.g. mawjs:mawjs-dev)
  oracle wire <agent> <msg...>   Send via federation (curl over WireGuard)
  oracle wake <oracle> [task]    Wake oracle in tmux window + claude
  oracle wake <oracle> --issue N Wake oracle with GitHub issue as prompt
  oracle wake <oracle> --pr N   Wake oracle with GitHub PR as prompt
  oracle wake <oracle> --incubate org/repo  Clone repo + worktree
  oracle wake all [--kill]       Wake fleet (01-15 + 99, skips dormant 20+)
  oracle wake all --all          Wake ALL including dormant
  oracle sleep <oracle> [window] Gracefully stop one oracle window
  oracle stop                    Stop all fleet sessions
  oracle restart                 Clean views + update + stop + wake all
  oracle about <oracle>          Oracle profile — session, worktrees, fleet
  oracle oracle ls               Fleet status (awake/sleeping/worktrees)
  oracle overview                War-room: all oracles in split panes
  oracle bud <name>              Bud new oracle from current (yeast model)
  oracle bud <name> --from <o>   Bud from specific parent oracle
  oracle bud <name> --root       Root oracle — no parent lineage
  oracle take <sess>:<win> [tgt] Move window to session
  oracle archive <oracle>        Graceful oracle death (soul-sync → disable → archive)
  oracle find <keyword>          Search ψ/memory/ across all oracles
  oracle fleet init              Scan repos, generate fleet configs
  oracle fleet ls                List fleet configs with conflict detection
  oracle fleet health            Fleet health: dormancy, zombies, islands
  oracle fleet doctor            Federation config doctor
  oracle fleet consolidate        Merge branches + push disabled oracles
  oracle done <window>           Auto-save + commit + push then clean up
  oracle reunion [window]        Sync ψ/memory/ from worktree → main
  oracle soul-sync               Sync current oracle ψ/ to configured peers
  oracle pulse add "task"        Create issue + wake oracle
  oracle view <agent> [window]   Grouped tmux session (interactive attach)
  oracle workon <repo> [task]    Open repo in new tmux window + claude
  oracle rename <tab#> <name>    Rename tab
  oracle park [window] [note]    Park tab with context snapshot
  oracle inbox                   List recent inbox items
  oracle tab                     List tabs in current session
  oracle contacts                List Oracle contacts
  oracle mega                    Show MegaAgent team hierarchy tree
  oracle federation status       Peer connectivity + agent counts
  oracle federation sync         Pull live /api/identity → auto-update
  oracle talk-to <agent> <msg>   Thread + hey (persistent + real-time)
  oracle <agent> <msg...>        Shorthand for hey
  oracle <agent>                 Shorthand for peek
  oracle assign <issue-url>      Clone repo + wake oracle with issue
  oracle costs                   Token usage + estimated cost per agent
  oracle pr [window]             Create PR from current branch
  oracle triggers                List configured workflow triggers
  oracle ping [node]             Check peer connectivity
  oracle transport status        Transport layer connectivity
  oracle avengers status         ARRA-01 rate limit monitor
  oracle workspace create <name> Create workspace on hub
  oracle workspace join <code>   Join with invite code
  oracle workspace ls            List joined workspaces
  oracle serve [port]            Start API server (default: 3456)

\x1b[33mWake modes:\x1b[0m
  oracle wake neo                Wake main repo
  oracle wake hermes bitkub      Wake existing worktree
  oracle wake neo --new free     Create worktree + wake
  oracle wake neo --issue 5      Fetch issue #5 + send as prompt
  oracle wake org/repo           Clone via ghq + wake (auto-detect name)

\x1b[33mEnv:\x1b[0m
  MAW_HOST=<host>               SSH target (default: white.local)

\x1b[33mExamples:\x1b[0m
  oracle wake neo --new bitkub   Create worktree + start claude
  oracle pulse add "Fix IME" --oracle neo --priority P1
  oracle hey neo what is your status
  oracle serve 8080`);

  // Plugin commands (beta)
  try {
    const { listCommands } = require("./command-registry");
    const cmds = listCommands();
    if (cmds.length > 0) {
      console.log(`\n\x1b[33mPlugin Commands (beta):\x1b[0m`);
      for (const c of cmds) {
        const name = Array.isArray(c.name) ? c.name[0] : c.name;
        const scope = c.scope === "user" ? "\x1b[90m(user)\x1b[0m" : "";
        console.log(`  oracle ${name.padEnd(24)} ${c.description} ${scope}`);
      }
    }
  } catch { /* registry not loaded yet */ }
}
