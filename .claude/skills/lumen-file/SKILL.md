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
    "id": "uuid-string",
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

| Field      | Type   | Required | Description                                                                   |
| :--------- | :----- | :------- | :---------------------------------------------------------------------------- |
| `id`       | string | yes      | Stable UUID. Generate with `crypto.randomUUID()`. Never reuse across configs. |
| `name`     | string | no       | Display name. Auto-generated from pipeline name if omitted.                   |
| `service`  | string | yes      | Server URL (`http://...`) or virtual provider (`provider://fal`).             |
| `pipeline` | string | yes      | Pipeline ID on that service (e.g., `txt2img`, `nano-banana`).                 |
| `params`   | object | yes      | Key-value pairs matching the pipeline's `ParamDefinition[]` schema.           |

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

1. Always generate a fresh UUID for `id` when adding a config. Never copy an existing id.
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

### HTTP servers

Pipeline IDs and params depend on the server. When unknown, set `params` to `{}` — the editor will populate from the server's schema.

## Examples

Single config, minimal:

```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
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
    "id": "11111111-1111-1111-1111-111111111111",
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
    "id": "22222222-2222-2222-2222-222222222222",
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
