---
name: lumen-file
description: "Create or edit .lumen files. TRIGGER: user asks to create a .lumen file, edit generation params, add a pipeline config, modify prompt/seed/aspect ratio in a .lumen. NOT: extension code, pipeline server code, schema definitions."
---

# .lumen file format

JSON array of config objects. In the default Lumen flow, each config targets one pipeline on the workspace's single managed server.

## Schema

```json
[
  {
    "id": "txt2img",
    "name": "Display Name",
    "service": "http://localhost:8000",
    "pipeline": "txt2img",
    "params": {
      "prompt": "a cat sitting on a windowsill",
      "seed": 42,
      "aspect_ratio": "16:9"
    }
  }
]
```

### Fields

| Field      | Type   | Required | Description                                                                                                               |
| :--------- | :----- | :------- | :------------------------------------------------------------------------------------------------------------------------ |
| `id`       | string | yes      | Kebab-case slug, unique within the file. Derive from pipeline id (e.g., `nano-banana`). Append `-2`, `-3` for duplicates. |
| `name`     | string | no       | Display name. Auto-generated from pipeline name if omitted.                                                               |
| `service`  | string | yes      | Live server URL (`https://...modal.run` in the default Modal flow).                                                        |
| `pipeline` | string | yes      | Pipeline ID on that service (e.g., `txt2img`, `nano-banana`).                                                             |
| `params`   | object | yes      | Key-value pairs matching the pipeline's `ParamDefinition[]` schema.                                                       |

### Param value types

Match param values to their schema type:

| Schema type  | JSON value                | Example                     |
| :----------- | :------------------------ | :-------------------------- |
| `prompt`     | string                    | `"a sunset over mountains"` |
| `text`       | string                    | `"watercolor style"`        |
| `number`     | number (float)            | `0.75`                      |
| `integer`    | number (int)              | `4`                         |
| `boolean`    | boolean                   | `true`                      |
| `select`     | string (from options)     | `"16:9"`                    |
| `seed`       | number or omit            | `42`                        |
| `dimensions` | `{ "w": 1024, "h": 768 }` |                             |
| `image`      | string (relative path)    | `"./ref.png"`               |
| `video`      | string (relative path)    | `"./input.mp4"`             |

## Rules

1. `id` is a kebab-case slug derived from the pipeline id. Must be unique within the file. For duplicates, append `-2`, `-3`, etc.
2. Array order = display order in the editor.
3. Multiple configs for the same service + pipeline pair are allowed (different param sets).
4. Image/video paths are relative to the `.lumen` file location.
5. Omit `seed` or set to `0`/`null` for random. A non-zero seed locks reproducibility.
6. Empty file starts as `[]`.
7. Trailing newline after the closing bracket.
8. 2-space indentation.

## Managed server flow

The VS Code extension manages one server per workspace. It starts `modal serve`, generates the auth key, and discovers the live server URL automatically.

#### Finding the server URL

1. Check existing configs in the `.lumen` file — the `service` field is the live URL.
2. Check the workspace setting `lumen.server` — it points to the server source directory, not the live URL.
3. Start the dev server from the editor. The extension detects the live `https://...modal.run` URL and uses it for new configs.

#### Discovery steps

1. List pipelines: `GET <serverUrl>/pipelines` -> `[{ "id": "echo", "name": "Echo", ... }]`
2. Get full schema: `GET <serverUrl>/pipelines/<id>` -> `PipelineConfig` with `params[]` array
3. Read each param's `type`, `name`, `required`, `default`, `options` (for select), `min`/`max` (for number/integer)
4. Use the param `name` fields as keys in your `.lumen` `params` object

All requests require the Bearer token from `server/.authkey`:

```sh
AUTH="$(tr -d '\n' < server/.authkey)"
curl -H "Authorization: Bearer $AUTH" "$SERVER_URL/pipelines"
```

#### Example: discovering a server's schema

```sh
# List available pipelines
curl -H "Authorization: Bearer $AUTH" "$SERVER_URL/pipelines"
# [{"id":"echo","name":"Echo","category":"image"}]

# Get full schema for "echo"
curl -H "Authorization: Bearer $AUTH" "$SERVER_URL/pipelines/echo"
# {"id":"echo","name":"Echo","category":"image",
#  "params":[{"type":"prompt","name":"prompt","label":"Prompt","required":true,"group":"basic"}],
#  "output":{"type":"image","format":"png"}}
```

Then write:

```json
[
  {
    "id": "echo",
    "service": "https://workspace-name.modal.run",
    "pipeline": "echo",
    "params": {
      "prompt": "a cat"
    }
  }
]
```

When the server is unavailable or params are unknown, start the server from the editor first. The current product does not support offline schema editing.

## Examples

Single config, minimal:

```json
[
  {
    "id": "echo",
    "service": "https://workspace-name.modal.run",
    "pipeline": "echo",
    "params": {
      "prompt": "a cat in a spacesuit"
    }
  }
]
```

Multiple configs on the same server:

```json
[
  {
    "id": "echo",
    "name": "Portrait shot",
    "service": "https://workspace-name.modal.run",
    "pipeline": "echo",
    "params": {
      "prompt": "professional headshot, studio lighting",
      "seed": 98765
    }
  },
  {
    "id": "echo-2",
    "name": "Landscape variation",
    "service": "https://workspace-name.modal.run",
    "pipeline": "echo",
    "params": {
      "prompt": "mountain lake at golden hour"
    }
  }
]
```

## Anti-patterns

- Reusing an `id` from another config (causes state collision in the editor)
- Putting absolute paths in image/video params (breaks portability)
- Adding unknown fields to the config object (silently ignored, confuses readers)
- Wrapping in `{}` instead of `[]` (old format, auto-migrated but deprecated)
