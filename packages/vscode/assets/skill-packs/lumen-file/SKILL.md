---
name: lumen-file
description: "Create or edit .lumen runner config files in assets/. Use when adding configs, changing prompts or params, or wiring a config to a discovered pipeline."
---

# .lumen Files

A `.lumen` file is a JSON array of runner configs. In the default Lumen workspace flow, each config targets one pipeline on the workspace's single managed server.

## Rules

- Keep the file as a JSON array.
- Use 2-space indentation and a trailing newline.
- Each config needs `id`, `service`, `pipeline`, and `params`.
- Keep `id` unique within the file. Use kebab-case and append `-2`, `-3`, and so on for duplicates.
- Keep image and video paths relative to the `.lumen` file location.

## Example

```json
[
  {
    "id": "echo",
    "name": "First run",
    "service": "https://workspace-name.modal.run",
    "pipeline": "echo",
    "params": {
      "prompt": "a cat in a spacesuit"
    }
  }
]
```
