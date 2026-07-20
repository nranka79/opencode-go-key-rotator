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
