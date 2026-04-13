#!/bin/bash
# Oracle Status Line — adapted from claude-code-statusline
# Shows: directory • git branch • oracle agents • uptime • memory usage
# Usage: source this in .bashrc or run directly

oracle_statusline() {
  local dir model agents uptime_str mem

  # Current directory (shortened)
  dir="${PWD/#$HOME/~}"

  # Git branch
  local branch=""
  if git rev-parse --is-inside-work-tree &>/dev/null; then
    branch=" $(git branch --show-current 2>/dev/null || echo "detached")"
  fi

  # Oracle agent count
  agents="0"
  if [ -d "$HOME/.oracle/agents" ]; then
    agents=$(ls -1 "$HOME/.oracle/agents" 2>/dev/null | wc -l | tr -d ' ')
  fi

  # System uptime (short)
  if command -v uptime &>/dev/null; then
    uptime_str=$(uptime -p 2>/dev/null | sed 's/up //' | sed 's/hours/h/' | sed 's/minutes/m/' | sed 's/,.*//')
  else
    uptime_str=""
  fi

  # Memory usage
  if command -v free &>/dev/null; then
    mem=$(free -h | awk '/^Mem:/ {print $3 "/" $2}')
  elif command -v vm_stat &>/dev/null; then
    mem="mac"
  else
    mem=""
  fi

  # Build status line
  local line="🧠 ${dir}"
  [ -n "$branch" ] && line="${line} • 📦${branch}"
  [ "$agents" != "0" ] && line="${line} • 🤖${agents}"
  [ -n "$uptime_str" ] && line="${line} • ⏱${uptime_str}"
  [ -n "$mem" ] && line="${line} • 💾${mem}"

  echo "$line"
}

# If sourced, register as PROMPT_COMMAND
if [[ "${BASH_SOURCE[0]}" != "${0}" ]]; then
  export -f oracle_statusline
  # Add to PS1
  export PS1='\[\e[1;36m\]$(oracle_statusline)\[\e[0m\]\n\[\e[1;32m\]\u@\h\[\e[0m\]:\[\e[1;34m\]\w\[\e[0m\]\$ '
else
  # Run directly
  oracle_statusline
fi
