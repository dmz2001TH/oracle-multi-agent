# maw-core-plugins

> Essential plugins that ship with [maw-js](https://github.com/Soul-Brews-Studio/maw-js). These can't be removed — maw-js needs them to function.

## Packages

```
packages/
├── 00-wake/     ← spawn/attach oracle sessions
├── 00-sleep/    ← sleep an oracle
├── 00-stop/     ← stop all fleet sessions
└── 00-done/     ← finish a worktree
```

Weight 00 = always loads first. These are the agent lifecycle primitives.

## vs maw-plugins

| Repo | Purpose | Install |
|------|---------|---------|
| **maw-core-plugins** | Ships with maw-js, always present | Automatic |
| [maw-plugins](https://github.com/Soul-Brews-Studio/maw-plugins) | Optional, pick what you need | `maw plugin install <name>` |

## License

MIT
