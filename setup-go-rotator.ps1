# Setup script for GoKeyRotator plugin.
# Run this on any machine where you want to enable multi-key round-robin for opencode-go.
#
# Usage:
#   powershell -File setup-go-rotator.ps1
#
# Or non-interactively with the key already set:
#   $env:OPENCODE_GO_KEY_2 = "sk-your-second-key"
#   powershell -File setup-go-rotator.ps1

$pluginDir = "$env:USERPROFILE\.config\opencode\plugins"
$pluginFile = "$pluginDir\go-key-rotator.ts"

Write-Host "=== Go Key Rotator Plugin Setup ===" -ForegroundColor Cyan

# 1. Create plugins directory if needed
if (-not (Test-Path -LiteralPath $pluginDir)) {
  New-Item -ItemType Directory -Force -Path $pluginDir | Out-Null
  Write-Host "[OK] Created plugins directory" -ForegroundColor Green
}

# 2. Create the plugin file
@'
import type { Plugin } from "@opencode-ai/plugin"

let keyIndex = 0
let keys: string[] = []

export const GoKeyRotatorPlugin: Plugin = async () => {
  return {
    auth: {
      provider: "opencode-go",

      loader: async (getAuth) => {
        const auth = await getAuth()
        if (auth?.type !== "api") return {}

        keys = [auth.key]
        if (auth.metadata?.backup_key) {
          keys.push(auth.metadata.backup_key)
        }
        if (process.env.OPENCODE_GO_KEY_2) {
          if (!keys.includes(process.env.OPENCODE_GO_KEY_2)) {
            keys.push(process.env.OPENCODE_GO_KEY_2)
          }
        }
        if (process.env.OPENCODE_GO_KEY_3) {
          if (!keys.includes(process.env.OPENCODE_GO_KEY_3)) {
            keys.push(process.env.OPENCODE_GO_KEY_3)
          }
        }

        if (keys.length < 2) return {}

        return {
          apiKey: "",
          async fetch(request, init) {
            let lastError: Response | null = null

            for (let attempt = 0; attempt < keys.length; attempt++) {
              const ki = keyIndex % keys.length
              const headers = new Headers(init?.headers)
              headers.set("Authorization", `Bearer ${keys[ki]}`)

              const res = await globalThis.fetch(
                typeof request === "string" ? request : request.url,
                { ...init, headers }
              )

              if (res.status === 429 || res.status === 401) {
                lastError = res
                keyIndex++
                continue
              }

              keyIndex++
              return res
            }

            throw Object.assign(
              new Error(`All ${keys.length} Go API keys exhausted`),
              { status: 429, cause: lastError }
            )
          },
        }
      },

      methods: [
        {
          type: "api",
          label: "OpenCode Go API Key",
          authorize: async (inputs) => ({
            type: "success" as const,
            key: inputs?.key ?? "",
          }),
        },
      ],
    },
  }
}
'@ | Set-Content -Path $pluginFile -Encoding UTF8

Write-Host "[OK] Plugin written to $pluginFile" -ForegroundColor Green

# 3. Prompt for second key if not already set
if (-not $env:OPENCODE_GO_KEY_2) {
  $key2 = Read-Host -Prompt "Enter your 2nd OpenCode Go API key (or press Enter to skip)"
  if ($key2) {
    [Environment]::SetEnvironmentVariable("OPENCODE_GO_KEY_2", $key2, "User")
    $env:OPENCODE_GO_KEY_2 = $key2
    Write-Host "[OK] OPENCODE_GO_KEY_2 set as a user-level environment variable" -ForegroundColor Green
    Write-Host "    You may need to restart your terminal for it to take effect." -ForegroundColor Yellow
  } else {
    Write-Host "[WARN] No second key provided. Set OPENCODE_GO_KEY_2 later to enable rotation." -ForegroundColor Yellow
  }
} else {
  Write-Host "[OK] OPENCODE_GO_KEY_2 already set" -ForegroundColor Green
}

# 4. Verify
if (Test-Path -LiteralPath $pluginFile) {
  Write-Host ""
  Write-Host "=== Setup Complete ===" -ForegroundColor Cyan
  Write-Host "Plugin installed. Restart opencode to activate."
  Write-Host ""
  Write-Host "To add a 3rd key later: set OPENCODE_GO_KEY_3 as an env var"
  Write-Host ""
  Write-Host "To test the plugin, run opencode and check for errors at startup."
  Write-Host "Run tests:  node --test $pluginDir\go-key-rotator.test.mjs"
}
