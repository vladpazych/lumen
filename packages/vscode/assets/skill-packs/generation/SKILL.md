---
name: generation
description: "Generation guidance for prompts, parameter choices, and debugging output quality. Use when discussing image or video generation behavior."
user-invocable: false
---

# Generation Concepts

Use this skill when helping with prompt writing, parameter tuning, or generation quality.

## Mental Model

- Text and other inputs are turned into conditioning embeddings.
- A seed creates the starting noise pattern.
- The model iteratively denoises that latent until it becomes the final image or video.

## Practical Guidance

- Prompt quality has the largest effect on output quality.
- The model or pipeline sets the quality ceiling.
- Guidance scale, resolution, and seed are usually the next most important controls.
- Native model resolution usually beats arbitrary resolutions.
- More steps help only until the sampler has effectively converged.

## Common Pipeline Types

- `txt2img`: text to image
- `img2img`: image plus text to image
- `inpainting`: masked edit
- `txt2vid`: text to video
- `img2vid`: image to video
