# Appendix B: Mailbox JSON Schema

> The exact shape of the mailbox format used in Part II, with every field, every type, and every gotcha recorded in a single place. Read this appendix before you write a tool that produces inbox messages.

---

## B.1 Where Inboxes Live

Every agent in the live system owns a JSON file at:

```
~/.claude/teams/<team-name>/inboxes/<agent-name>.json
```

If the agent belongs to the default "singleton" team (a solo agent with no peers), the path collapses to:

```
~/.claude/inbox/<agent-name>.json
```

Both paths obey the same schema. The schema is small enough to read end-to-end; the complexity is in the gotchas.

---

## B.2 Top-Level Shape

```json
{
  "schema_version": 2,
  "agent": "oracle",
  "team": "book-expansion",
  "messages": [ /* array of message objects */ ],
  "standing_orders": [ /* array of standing-order objects */ ],
  "last_read_at": "2026-04-13T14:10:00Z",
  "last_write_at": "2026-04-13T14:12:33Z"
}
```

| Field             | Type     | Required | Notes                                                                 |
|-------------------|----------|----------|-----------------------------------------------------------------------|
| `schema_version`  | integer  | yes      | Current version is `2`. Version `1` is still accepted for legacy reads. |
| `agent`           | string   | yes      | Canonical agent name. Must match filename stem.                        |
| `team`            | string   | no       | Omitted for singleton inboxes. Must match parent directory if set.     |
| `messages`        | array    | yes      | Newest-first. Bounded by size and count (see B.4).                     |
| `standing_orders` | array    | yes      | May be empty. Read on every wake.                                      |
| `last_read_at`    | ISO-8601 | no       | Updated by the reader when it consumes messages.                       |
| `last_write_at`   | ISO-8601 | no       | Updated by the writer on every successful append.                      |

**Gotcha:** `agent` duplicates information in the filename. This is deliberate; a file moved or copied without care would otherwise deliver to the wrong agent. Readers MUST verify `agent` matches the filename; mismatches are treated as a corruption event and the reader refuses to proceed without operator intervention.

---

## B.3 Message Object

```json
{
  "id": "msg_01HZ9Q5XK6WN2M7RXY3ZFAH3VP",
  "from": "team-lead",
  "kind": "note",
  "summary": "kick-off for chapter 7",
  "body": "Start with the tmux fundamentals. Target 3000 words.",
  "created_at": "2026-04-13T14:12:33Z",
  "read_at": null,
  "acked_at": null,
  "references": ["msg_01HZ9Q5B..."]
}
```

| Field          | Type              | Required | Notes |
|----------------|-------------------|----------|-------|
| `id`           | string (ULID)     | yes      | Monotonic, sortable, globally unique across the fleet. |
| `from`         | string            | yes      | Sender identity. May be `agent`, `node:agent`, or `human`. |
| `kind`         | enum (see B.3.1) | yes      | Controls reader behaviour. |
| `summary`      | string            | yes      | ≤ 120 chars. Shown in one-line listings. |
| `body`         | string            | yes      | Full message. Markdown-friendly. |
| `created_at`   | ISO-8601          | yes      | Writer's clock. |
| `read_at`      | ISO-8601 or null  | yes      | Null until the reader processes it. |
| `acked_at`     | ISO-8601 or null  | no       | Set when the reader has acted on the message, not merely read it. |
| `references`   | array of string   | no       | IDs of related messages — e.g., the request this is a response to. |

### B.3.1 Allowed `kind` Values

- `note` — informational, no action required.
- `task` — action required; the reader should update their task list.
- `request` — sender expects a reply. Readers MUST respond (or explicitly decline) before marking `acked_at`.
- `reply` — response to a `request`. MUST reference the original request in `references`.
- `broadcast` — fan-out. No reply expected; the reader is free to ignore.
- `shutdown` — a protocol message; see the live system's TeamCreate docs for semantics.

New kinds MUST be added with a schema version bump. Readers seeing an unknown kind MUST log and skip, not crash.

---

## B.4 Size and Count Bounds

- `messages` is bounded to **500 entries** or **1 MiB serialized**, whichever is first. Writers MUST trim from the tail (oldest-first) when either bound is exceeded.
- A single message body is soft-capped at **32 KiB**. Larger payloads belong in a file the message references.
- `summary` is hard-capped at **120 characters**.

**Gotcha:** The 1 MiB bound is not "the file must be ≤ 1 MiB"; it is "the `messages` array serializes to ≤ 1 MiB". Measuring the whole file is simpler and almost always good enough; measuring the array specifically matters only when standing orders are unusually large.

---

## B.5 Standing-Order Object

```json
{
  "id": "so_01HZA...",
  "subject": "Always sign commits as <agent-name>",
  "body": "Use Co-Authored-By: <agent-name> <noreply@...>. Never 'Claude' generically.",
  "created_at": "2026-04-10T08:00:00Z",
  "expires_at": null,
  "source": "human"
}
```

| Field         | Type              | Required | Notes |
|---------------|-------------------|----------|-------|
| `id`          | string (ULID)     | yes      | Same format as message IDs. |
| `subject`     | string            | yes      | ≤ 120 chars. |
| `body`        | string            | yes      | Full text of the standing order. |
| `created_at`  | ISO-8601          | yes      | When the order entered the inbox. |
| `expires_at`  | ISO-8601 or null  | yes      | Null means "until revoked". |
| `source`      | enum              | yes      | `human`, `team-lead`, `self`, or `upstream`. |

**Gotcha:** Standing orders are not messages. They do not expire when read; they expire when revoked or when `expires_at` passes. A reader that treats standing orders as messages will fail to re-read them on subsequent wakes, and the orders will effectively evaporate.

---

## B.6 Write Semantics

Writers follow this protocol:

1. **Read** the current file. If absent, treat as an empty inbox.
2. **Merge**: append new messages to the front; trim if over bounds.
3. **Update** `last_write_at`.
4. **Write atomically**: write to `<file>.tmp`, then `rename()` to `<file>`.
5. On error at any step, bail out without modifying the destination file.

The atomic rename is load-bearing. A partial write is worse than no write; a half-written inbox can corrupt every subsequent read. Any writer that cannot guarantee atomic rename (over SMB shares, for example) must not be used.

**Gotcha:** Two writers racing is possible in theory but rare in practice, because inbox writers are almost always the local `maw-js` daemon. In the rare case of a collision, the rename discipline means the last writer wins — which is acceptable for note/task/broadcast messages but problematic for request/reply pairs. If you expect contention, wrap the write in an advisory lock (`flock`). The live system does not, and has not needed to in six months of operation.

---

## B.7 Read Semantics

Readers follow this protocol:

1. **Read** the file. If absent, return empty inbox.
2. **Validate** `schema_version`. Accept 1 or 2; reject others with a loud error.
3. **Filter** to unread messages (where `read_at` is null).
4. **Process** in `id` order (which is also chronological).
5. **Mark** each processed message with `read_at` set to `now`; optionally set `acked_at` after the reader has fulfilled any action.
6. **Write** the updated file via the same atomic-rename discipline.

Readers MUST NOT mutate message contents. Only `read_at` and `acked_at` fields are writable by readers; any other modification is a bug.

---

## B.8 Versioning and Migration

Breaking changes to the schema bump `schema_version`. The library's policy:

- **Readers** accept the current version and the previous version, and transparently upgrade version-1 records to version-2 in memory. They MAY write back in version 2 on their next write; they SHOULD NOT rewrite files solely to migrate.
- **Writers** always emit the current version.
- **Validators** reject unknown versions outright and leave the file alone.

This is the narrowest migration policy that works across a fleet where peers may update at different times. Wider policies (accept N previous versions, forward-compat fields) sounded attractive until we tried them and discovered that the combinatorics of version drift across a distributed fleet are worse than the combinatorics of a sharp migration window.

**Gotcha:** Never edit an inbox file by hand across a version boundary. If you do, set `schema_version` appropriately; readers will reject the file on first read, which is easier to debug than a silently-mismatched record.

---

## B.9 Field Evolution

Fields may be added to the schema *within* a version under two rules:

- Additions MUST be optional.
- Additions MUST have a sensible default when absent.

The `acked_at` field was added this way in schema version 2 — older messages that lacked it simply defaulted to null, and the new ack-tracking behaviour degraded gracefully for legacy records. Readers should NOT enumerate unknown fields; they should pass them through untouched on rewrite. Writers that do not understand a field must not delete it.

---

## B.10 Canonical Example

A realistic inbox in its final form:

```json
{
  "schema_version": 2,
  "agent": "book-p4",
  "team": "book-expansion",
  "messages": [
    {
      "id": "msg_01HZ9Q5XK6WN2M7RXY3ZFAH3VP",
      "from": "team-lead",
      "kind": "task",
      "summary": "write chapters 10-12 of the-agent-bus",
      "body": "Write Part IV + appendices. 2800-3200 words per chapter. See standing orders for voice guide.",
      "created_at": "2026-04-13T14:12:33Z",
      "read_at": "2026-04-13T14:13:02Z",
      "acked_at": null,
      "references": []
    },
    {
      "id": "msg_01HZ9Q5B2F7C9HXX0PE4N6Y1RR",
      "from": "team-lead",
      "kind": "note",
      "summary": "voice guide reminder",
      "body": "Lean into war stories. Don't sanitize the architecture.",
      "created_at": "2026-04-13T14:10:00Z",
      "read_at": "2026-04-13T14:11:55Z",
      "acked_at": "2026-04-13T14:11:55Z",
      "references": []
    }
  ],
  "standing_orders": [
    {
      "id": "so_01HZA7XW...",
      "subject": "Headers byte-stable",
      "body": "Never reflow existing headers; byte-stable markdown lets reviewers diff clean.",
      "created_at": "2026-04-10T08:00:00Z",
      "expires_at": null,
      "source": "human"
    }
  ],
  "last_read_at": "2026-04-13T14:13:02Z",
  "last_write_at": "2026-04-13T14:13:02Z"
}
```

Everything in Part II maps to this shape. Whatever tool you write to produce or consume inboxes, produce exactly this shape, consume exactly this shape, and the rest of the bus will accept your tool as a first-class citizen.
