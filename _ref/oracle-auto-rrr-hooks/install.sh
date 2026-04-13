#!/bin/bash
# ============================================================
# Oracle Auto /rrr + /forward Hooks — Installer
# ============================================================
#
# สคริปต์นี้:
# 1. สร้าง ~/.claude/hooks/ directory
# 2. คัดลอก hook scripts ไปไว้ที่ ~/.claude/hooks/
# 3. ตั้ง execute permission
# 4. อัพเดท ~/.claude/settings.json (merge hooks เข้าไป)
#
# ปลอดภัย: ไม่ลบ settings เดิม, merge เฉพาะ hooks ใหม่
# ============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Oracle Auto /rrr + /forward Hooks — Installer${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# --- ตรวจ Dependencies ---
echo -e "${YELLOW}[1/5]${NC} Checking dependencies..."

if ! command -v jq &> /dev/null; then
  echo -e "${RED}  ✗ jq not found${NC}"
  echo "    Install: sudo apt install jq (Linux) / brew install jq (macOS)"
  echo ""
  echo "  jq is required for statusline.sh"
  echo "  force-rrr-at-80.sh uses python3 as fallback"
  echo ""
  read -p "  Continue without jq? [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
  fi
else
  echo -e "  ${GREEN}✓ jq${NC}"
fi

if ! command -v python3 &> /dev/null; then
  echo -e "${RED}  ✗ python3 not found${NC}"
  echo "    Install: sudo apt install python3 (Linux)"
  echo "    python3 is required for force-rrr-at-80.sh"
  exit 1
else
  echo -e "  ${GREEN}✓ python3${NC}"
fi

# --- Script directory (ที่ clone repo ไว้) ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOKS_SRC="$SCRIPT_DIR/hooks"

if [ ! -d "$HOOKS_SRC" ]; then
  echo -e "${RED}Error: hooks/ directory not found in $SCRIPT_DIR${NC}"
  exit 1
fi

# --- สร้าง hooks directory ---
echo -e "${YELLOW}[2/5]${NC} Creating ~/.claude/hooks/..."

HOOKS_DEST="$HOME/.claude/hooks"
mkdir -p "$HOOKS_DEST"
echo -e "  ${GREEN}✓ $HOOKS_DEST${NC}"

# --- คัดลอก hooks ---
echo -e "${YELLOW}[3/5]${NC} Copying hook scripts..."

for script in "$HOOKS_SRC"/*.sh; do
  name=$(basename "$script")
  dest="$HOOKS_DEST/$name"

  if [ -f "$dest" ]; then
    echo -e "  ${YELLOW}⚠ $name already exists — backup to ${name}.bak${NC}"
    cp "$dest" "${dest}.bak"
  fi

  cp "$script" "$dest"
  chmod +x "$dest"
  echo -e "  ${GREEN}✓ $name${NC}"
done

# --- อัพเดท settings.json ---
echo -e "${YELLOW}[4/5]${NC} Updating ~/.claude/settings.json..."

SETTINGS="$HOME/.claude/settings.json"

if [ ! -f "$SETTINGS" ]; then
  # ไม่มี settings.json เลย → สร้างใหม่จาก example
  cp "$SCRIPT_DIR/examples/settings.json" "$SETTINGS"
  echo -e "  ${GREEN}✓ Created new settings.json${NC}"
else
  # มีอยู่แล้ว → merge hooks เข้าไป
  echo -e "  ${YELLOW}⚠ settings.json exists — merging hooks...${NC}"

  # Backup
  cp "$SETTINGS" "${SETTINGS}.bak"
  echo -e "  ${GREEN}✓ Backup saved to settings.json.bak${NC}"

  # ใช้ python3 merge เพราะ jq อาจไม่มี
  python3 << 'PYEOF'
import json
import os

settings_path = os.path.expanduser("~/.claude/settings.json")
hooks_dir = os.path.expanduser("~/.claude/hooks")

with open(settings_path) as f:
    settings = json.load(f)

# Ensure hooks key exists
if "hooks" not in settings:
    settings["hooks"] = {}

# --- StatusLine ---
if "statusLine" not in settings:
    settings["statusLine"] = {
        "type": "command",
        "command": f"{hooks_dir}/statusline.sh"
    }
    print("  ✓ Added statusLine")
else:
    print("  ⚠ statusLine already exists — skipped")

# --- PostToolUse: force-rrr-at-80 ---
post_hooks = settings["hooks"].get("PostToolUse", [])
rrr_hook_exists = any(
    "force-rrr" in str(h)
    for entry in post_hooks
    for h in entry.get("hooks", [])
)

if not rrr_hook_exists:
    post_hooks.append({
        "matcher": ".*",
        "hooks": [{
            "type": "command",
            "command": f"{hooks_dir}/force-rrr-at-80.sh"
        }]
    })
    settings["hooks"]["PostToolUse"] = post_hooks
    print("  ✓ Added PostToolUse: force-rrr-at-80")
else:
    print("  ⚠ force-rrr hook already exists — skipped")

# --- Stop: auto-forward ---
stop_hooks = settings["hooks"].get("Stop", [])
forward_hook_exists = any(
    "auto-forward" in str(h)
    for entry in stop_hooks
    for h in entry.get("hooks", [])
)

if not forward_hook_exists:
    stop_hooks.append({
        "matcher": "",
        "hooks": [{
            "type": "command",
            "command": f"{hooks_dir}/auto-forward-on-stop.sh"
        }]
    })
    settings["hooks"]["Stop"] = stop_hooks
    print("  ✓ Added Stop: auto-forward-on-stop")
else:
    print("  ⚠ auto-forward hook already exists — skipped")

with open(settings_path, "w") as f:
    json.dump(settings, f, indent=2)
    f.write("\n")

PYEOF

fi

# --- ทดสอบ ---
echo -e "${YELLOW}[5/5]${NC} Testing hooks..."

# Test statusline
echo '{"context_window":{"used_percentage":42,"current_usage":{"input_tokens":50000},"context_window_size":200000},"model":{"display_name":"Test"},"cost":{"total_duration_ms":60000}}' | bash "$HOOKS_DEST/statusline.sh" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo -e "  ${GREEN}✓ statusline.sh works${NC}"
else
  echo -e "  ${RED}✗ statusline.sh failed${NC}"
fi

# Test force-rrr (low %, should not warn)
echo '{"context_window":{"used_percentage":42}}' > "${TMPDIR:-/tmp}/statusline-raw.json"
bash "$HOOKS_DEST/force-rrr-at-80.sh" 2>/dev/null
if [ $? -eq 0 ]; then
  echo -e "  ${GREEN}✓ force-rrr-at-80.sh works${NC}"
else
  echo -e "  ${RED}✗ force-rrr-at-80.sh failed${NC}"
fi

# Test stop hook
echo '{}' | bash "$HOOKS_DEST/auto-forward-on-stop.sh" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo -e "  ${GREEN}✓ auto-forward-on-stop.sh works${NC}"
else
  echo -e "  ${RED}✗ auto-forward-on-stop.sh failed${NC}"
fi

# --- Done ---
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✅ Installation complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Hooks installed to: $HOOKS_DEST/"
echo "  Settings updated:   $SETTINGS"
echo ""
echo "  What happens now:"
echo "  • StatusLine shows context % in real-time"
echo "  • At 70%: warning to run /rrr + /forward"
echo "  • At 80%: emergency stop — auto-compact is coming!"
echo "  • On session end: reminder to /forward"
echo ""
echo "  Open Claude Code to see it in action!"
echo ""
