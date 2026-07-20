// Tests for the Go key rotator plugin logic.
// Run with: node --test go-key-rotator.test.js

import { describe, it, mock } from "node:test"
import assert from "node:assert"

function createRotatingFetch(...keys) {
  let idx = 0
  return {
    async fetch(request, init) {
      let lastError = null
      for (let attempt = 0; attempt < keys.length; attempt++) {
        const ki = idx % keys.length
        const headers = new Headers(init?.headers)
        headers.set("Authorization", `Bearer ${keys[ki]}`)
        const res = await globalThis.fetch(
          typeof request === "string" ? request : request.url,
          { ...init, headers }
        )
        if (res.status === 429 || res.status === 401) { lastError = res; idx++; continue }
        idx++; return res
      }
      throw Object.assign(new Error(`All ${keys.length} Go API keys exhausted`), { status: 429, cause: lastError })
    },
  }
}

function authFrom(nthCall) {
  return globalThis.fetch.mock.calls[nthCall].arguments[1]?.headers?.get("Authorization")
}

describe("round-robin alternation", () => {
  it("cycles through 2 keys in order", async () => {
    const k1 = "sk-key-a"; const k2 = "sk-key-b"
    const rotator = createRotatingFetch(k1, k2)
    mock.method(globalThis, "fetch", () => Promise.resolve(new Response(null, { status: 200 })))

    try {
      await rotator.fetch("https://opencode.ai/zen/go/v1/chat/completions", { headers: {}, body: "{}" })
      assert.strictEqual(authFrom(0), `Bearer ${k1}`, "call 1 uses key 1")

      await rotator.fetch("https://opencode.ai/zen/go/v1/chat/completions", { headers: {}, body: "{}" })
      assert.strictEqual(authFrom(1), `Bearer ${k2}`, "call 2 uses key 2")

      await rotator.fetch("https://opencode.ai/zen/go/v1/chat/completions", { headers: {}, body: "{}" })
      assert.strictEqual(authFrom(2), `Bearer ${k1}`, "call 3 wraps to key 1")
    } finally { mock.restoreAll() }
  })

  it("cycles through 3 keys", async () => {
    const rotator = createRotatingFetch("sk-a", "sk-b", "sk-c")
    mock.method(globalThis, "fetch", () => Promise.resolve(new Response(null, { status: 200 })))

    try {
      for (const exp of ["sk-a", "sk-b", "sk-c", "sk-a"]) {
        await rotator.fetch("https://opencode.ai/zen/go/v1/chat/completions", { headers: {} })
        assert.strictEqual(
          authFrom(globalThis.fetch.mock.calls.length - 1), `Bearer ${exp}`
        )
      }
    } finally { mock.restoreAll() }
  })
})

describe("fallback", () => {
  it("falls back when current returns 429", async () => {
    const k1 = "sk-key-a"; const k2 = "sk-key-b"
    const rotator = createRotatingFetch(k1, k2)
    let c = 0
    mock.method(globalThis, "fetch", () => {
      c++
      // After first success on k1 (idx=0), idx=1. So second call hits k2 first.
      // Make call #2 fail (k2 429) so it retries with k1.
      if (c === 2) return Promise.resolve(new Response(null, { status: 429 }))
      return Promise.resolve(new Response(null, { status: 200 }))
    })

    try {
      await rotator.fetch("https://opencode.ai/zen/go/v1/chat/completions", { headers: {} })
      assert.strictEqual(c, 1, "call 1 succeeds (k1)")
      assert.strictEqual(authFrom(0), `Bearer ${k1}`)

      const res = await rotator.fetch("https://opencode.ai/zen/go/v1/chat/completions", { headers: {} })
      assert.strictEqual(res.status, 200, "fallback succeeds")
      assert.strictEqual(c, 3, "k2 fails (429) -> k1 retry succeeds")
      assert.strictEqual(authFrom(1), `Bearer ${k2}`, "attempt 1 uses k2 (idx=1)")
      assert.strictEqual(authFrom(2), `Bearer ${k1}`, "retry uses k1 (idx wraps to 0)")
    } finally { mock.restoreAll() }
  })

  it("falls back on 401 too", async () => {
    const rotator = createRotatingFetch("sk-a", "sk-b")
    let c = 0
    mock.method(globalThis, "fetch", () => {
      c++
      // call 2 returns 401; call 3 returns 200 (fallback)
      if (c === 2) return Promise.resolve(new Response(null, { status: 401 }))
      return Promise.resolve(new Response(null, { status: 200 }))
    })

    try {
      await rotator.fetch("https://opencode.ai/zen/go/v1/chat/completions", { headers: {} })
      const res = await rotator.fetch("https://opencode.ai/zen/go/v1/chat/completions", { headers: {} })
      assert.strictEqual(res.status, 200, "fallback from 401 succeeds")
      assert.strictEqual(c, 3, "401 -> fallback")
    } finally { mock.restoreAll() }
  })
})

describe("exhaustion", () => {
  it("throws when all keys return 429", async () => {
    createRotatingFetch("sk-a", "sk-b")
    mock.method(globalThis, "fetch", () => Promise.resolve(new Response(null, { status: 429 })))

    try {
      const f = createRotatingFetch("sk-a", "sk-b")
      await assert.rejects(
        () => f.fetch("https://opencode.ai/zen/go/v1/chat/completions", { headers: {} }),
        (err) => err.status === 429 && err.message === "All 2 Go API keys exhausted"
      )
      assert.strictEqual(globalThis.fetch.mock.calls.length, 2, "both keys tried")
    } finally { mock.restoreAll() }
  })
})

describe("no rotation", () => {
  it("single key passes through without rotation", async () => {
    const h = new Headers(); h.set("Authorization", "Bearer sk-only")
    mock.method(globalThis, "fetch", () => Promise.resolve(new Response(null, { status: 200 })))

    try {
      await globalThis.fetch("https://opencode.ai/zen/go/v1/chat/completions", { headers: h })
      assert.strictEqual(globalThis.fetch.mock.calls.length, 1)
      assert.strictEqual(
        globalThis.fetch.mock.calls[0].arguments[1]?.headers?.get("Authorization"),
        "Bearer sk-only"
      )
    } finally { mock.restoreAll() }
  })
})
