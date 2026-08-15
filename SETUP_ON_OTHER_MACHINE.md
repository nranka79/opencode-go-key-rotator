Paste this into the agent on your other machine:

---

Install the Go key rotator plugin from GitHub and set up round-robin rotation.

Steps:
1. Download the plugin file from https://raw.githubusercontent.com/nranka79/opencode-go-key-rotator/master/go-key-rotator.ts to `~/.config/opencode/plugins/go-key-rotator.ts` (create the plugins directory if it doesn't exist).
2. Run the tests: `node --test ~/.config/opencode/plugins/go-key-rotator.test.js` — first download https://raw.githubusercontent.com/nranka79/opencode-go-key-rotator/master/go-key-rotator.test.js to `~/.config/opencode/plugins/go-key-rotator.test.js`.
3. Ask me for my second OpenCode Go API key.
4. Set it as a user-level environment variable `OPENCODE_GO_KEY_2`.
5. Tell me to restart opencode.
