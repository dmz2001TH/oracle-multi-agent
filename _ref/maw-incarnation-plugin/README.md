# maw-incarnation-plugin

> Template plugin for [maw-js](https://github.com/Soul-Brews-Studio/maw-js). Clone this to create your own.

## Quick Start

```bash
# 1. Clone
gh repo create my-org/my-cool-plugin --template Soul-Brews-Studio/maw-incarnation-plugin --clone

# 2. Edit
#    - plugin.json → change name, description, command
#    - index.ts    → write your handler

# 3. Test
bun test

# 4. Install
maw plugin install .
# or
maw plugin install https://github.com/my-org/my-cool-plugin

# 5. Use
maw my-plugin hello
maw my-plugin -v
maw my-plugin -h
curl http://localhost:3456/api/my-plugin
maw hey plugin:my-plugin "hello"
```

## Files

```
├── plugin.json        ← manifest (name, surfaces, weight)
├── index.ts           ← handler (one function, all surfaces)
├── my-plugin.test.ts  ← tests (covers cli + api + peer)
└── README.md          ← you're here
```

## The Handler

One function handles CLI, API, and peer:

```ts
export default async function handler(ctx: InvokeContext): Promise<InvokeResult> {
  if (ctx.source === "cli")  { /* terminal args */ }
  if (ctx.source === "api")  { /* HTTP body/query */ }
  if (ctx.source === "peer") { /* maw hey plugin:name */ }
  return { ok: true, output: "..." };
}
```

## plugin.json

```json
{
  "name": "my-plugin",          ← unique name
  "version": "0.1.0",           ← semver
  "weight": 50,                 ← execution order (0=first, 99=last)
  "entry": "./index.ts",        ← handler file
  "sdk": "^1.0.0",              ← SDK version
  "cli": { "command": "my-plugin" },
  "api": { "path": "/api/my-plugin", "methods": ["GET", "POST"] },
  "hooks": {},                   ← event hooks (gate/filter/on/late)
  "transport": { "peer": true }  ← federation routing
}
```

## Weight Guide

```
 0-9   core     (wake, sleep — can't function without)
10-19  infra    (fleet, federation, pulse)
20-29  tools    (ping, health, costs)
50-59  features (bud, oracle, artifacts)
90-99  custom   (dashboard, morning routines)
```

## Built-in Flags (free — every plugin gets these)

```bash
maw my-plugin -v       # version + metadata
maw my-plugin -h       # help + flags + surfaces
maw my-plugin --help   # same
```

## License

MIT
