---
name: lumen-file
description: "Create or edit .lumen files. TRIGGER: user asks to create a .lumen file, edit generation params, add a pipeline config, modify prompt/seed/aspect ratio in a .lumen. NOT: extension code, pipeline server code, schema definitions."
---

# .lumen file format

JSON array of config objects. Each config targets one pipeline on one service.

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
| `service`  | string | yes      | Server URL (`http://...`) or virtual provider (`provider://fal`).                                                         |
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

## Known services and pipelines

### `provider://fal`

| Pipeline          | Description                                 | Key params                                                                                       |
| :---------------- | :------------------------------------------ | :----------------------------------------------------------------------------------------------- |
| `nano-banana`     | Gemini 2.5 Flash                            | prompt, aspect_ratio, num_images, seed, output_format, resolution, enable_web_search             |
| `nano-banana-2`   | Gemini 3.1 Flash (supports reference image) | prompt, image_urls, aspect_ratio, num_images, seed, output_format, resolution, enable_web_search |
| `nano-banana-pro` | Gemini 3 Pro                                | prompt, aspect_ratio, num_images, seed, output_format, resolution, enable_web_search             |

### HTTP servers (including custom Modal pipelines)

HTTP servers expose schemas via a REST contract. Discover available pipelines and their params before writing the `.lumen` file.

#### Finding the server URL

1. Check existing configs in the `.lumen` file — the `service` field is the URL.
2. Check `.vscode/settings.json` for `lumen.servers` — each entry has `url` and `name`.

#### Discovery steps

1. List pipelines: `GET <serverUrl>/pipelines` -> `[{ "id": "echo", "name": "Echo", ... }]`
2. Get full schema: `GET <serverUrl>/pipelines/<id>` -> `PipelineConfig` with `params[]` array
3. Read each param's `type`, `name`, `required`, `default`, `options` (for select), `min`/`max` (for number/integer)
4. Use the param `name` fields as keys in your `.lumen` `params` object

#### Example: discovering a server's schema

```sh
# List available pipelines
curl http://localhost:8000/pipelines
# [{"id":"echo","name":"Echo","category":"image"}]

# Get full schema for "echo"
curl http://localhost:8000/pipelines/echo
# {"id":"echo","name":"Echo","category":"image",
#  "params":[{"type":"prompt","name":"prompt","label":"Prompt","required":true,"group":"basic"}],
#  "output":{"type":"image","format":"png"}}
```

Then write:

```json
[
  {
    "id": "echo",
    "service": "http://localhost:8000",
    "pipeline": "echo",
    "params": {
      "prompt": "a cat"
    }
  }
]
```

When the server is unavailable or params are unknown, set `params` to `{}` — the editor will populate from the server's schema once connected.

## Examples

Single config, minimal:

```json
[
  {
    "id": "nano-banana",
    "service": "provider://fal",
    "pipeline": "nano-banana",
    "params": {
      "prompt": "a cat in a spacesuit"
    }
  }
]
```

Multiple configs:

```json
[
  {
    "id": "nano-banana-pro",
    "name": "Portrait shot",
    "service": "provider://fal",
    "pipeline": "nano-banana-pro",
    "params": {
      "prompt": "professional headshot, studio lighting",
      "aspect_ratio": "3:4",
      "resolution": "2K",
      "seed": 98765
    }
  },
  {
    "id": "nano-banana-2",
    "name": "Landscape variation",
    "service": "provider://fal",
    "pipeline": "nano-banana",
    "params": {
      "prompt": "mountain lake at golden hour",
      "aspect_ratio": "16:9",
      "num_images": 2
    }
  }
]
```

## Anti-patterns

- Reusing an `id` from another config (causes state collision in the editor)
- Putting absolute paths in image/video params (breaks portability)
- Adding unknown fields to the config object (silently ignored, confuses readers)
- Wrapping in `{}` instead of `[]` (old format, auto-migrated but deprecated)
