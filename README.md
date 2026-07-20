# opencode-go-key-rotator

A plugin for [OpenCode](https://opencode.ai) that round-robins between multiple OpenCode Go API keys.

When one key hits a rate-limit (429) or is unauthorized (401), it automatically falls back to the next key.

## How it works

- Keys from `auth.json` + `OPENCODE_GO_KEY_2` + `OPENCODE_GO_KEY_3` env vars are collected at startup
- Every API call rotates to the next key in round-robin order
- On 429/401 it skips to the next key automatically
- If all keys are exhausted, it throws `All N Go API keys exhausted`
- With a single key, rotation is disabled (passes through normally)

## Installation

**Step 1 — Place the plugin:**

```powershell
# Create plugins dir if needed
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.config\opencode\plugins" | Out-Null

# Copy the plugin
Copy-Item go-key-rotator.ts "$env:USERPROFILE\.config\opencode\plugins\go-key-rotator.ts"
```

**Step 2 — Set your extra keys as environment variables:**

```powershell
[Environment]::SetEnvironmentVariable("OPENCODE_GO_KEY_2", "sk-your-second-key", "User")
[Environment]::SetEnvironmentVariable("OPENCODE_GO_KEY_3", "sk-your-third-key", "User")
```

Then restart OpenCode.

## Quick start (with setup script)

```powershell
.\setup-go-rotator.ps1
```

## Running tests

```bash
node --test go-key-rotator.test.js
```

## Requirements

- OpenCode v1.12+
- `@opencode-ai/plugin` v1.17+ (shipped with OpenCode)

## License

MIT
