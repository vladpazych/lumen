import { defineConfig } from "@vladpazych/dexter/cli"

import { release } from "@repo/meta-commands"

export default defineConfig({
  description: "lumen repo tooling",
  commands: {
    release,
  },
})
