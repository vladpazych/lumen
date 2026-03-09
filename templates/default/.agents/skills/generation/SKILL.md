---
name: generation
description: "Image and video generation expertise. TRIGGER: writing prompts, choosing parameters, designing pipelines, debugging generation quality, discussing diffusion/flow-matching models, comparing models or architectures, explaining how generation works. NOT: editing .lumen files (use lumen-file skill), writing pipeline server code, VS Code extension code."
user-invocable: false
---

# Image & video generation

Modern generative models convert text (and other conditioning signals) into images or video through iterative denoising in a learned latent space. All current state-of-the-art models share this core loop, regardless of provider or architecture.

## Mental model

```
text ──→ text encoder ──→ embeddings ──┐
                                       ├──→ denoising network ──→ latent ──→ VAE decoder ──→ pixels
seed ──→ initial noise ────────────────┘
              ↑                              (repeat for N steps)
           scheduler
```

Generation is not retrieval. The model doesn't search a database. It starts from random noise shaped by the seed and iteratively removes noise, guided by text embeddings at each step. The output is a novel synthesis that reflects patterns learned during training.

## Core concepts

**Latent space**: images are compressed by a VAE (typically 8x spatial, 4-16 channels) before diffusion. All denoising happens in this compact space. Detail preservation depends on VAE compression ratio — Flux's 16-channel VAE preserves ~4x more information than SDXL's 4-channel VAE.

**Text conditioning**: text encoders (CLIP, T5, or both) convert prompts into embedding sequences. Cross-attention injects these at every denoising layer. CLIP responds to visual keywords. T5 responds to natural language. Dual-encoder models use both.

**Guidance (CFG)**: each step runs the model twice — conditioned and unconditioned. The difference is amplified by guidance_scale. Higher = stronger prompt adherence, but past ~10-12 causes artifacts. Flow-matching models (Flux, SD3) handle guidance differently or bake it in during distillation.

**Samplers**: numerical ODE/SDE solvers that trace the path from noise to data. Deterministic samplers (Euler, DPM++ 2M, DDIM) converge — more steps refine. Stochastic samplers (Euler a, DPM++ SDE) add variation — more steps change rather than refine.

**Seed**: initializes the noise tensor. Same seed + same everything = same output (on same hardware). Seeds encode spatial structure, not semantic content.

## Parameter impact hierarchy

Ordered by impact on output quality:

1. **Prompt** — what to generate. Largest influence.
2. **Model** — defines the quality ceiling and aesthetic domain.
3. **Guidance scale** — prompt adherence vs quality. Sweet spot: 7-8 for most models.
4. **Resolution** — generate at native resolution. Non-native degrades quality.
5. **Seed** — determines composition and layout.
6. **Steps** — 20-30 for standard samplers. Diminishing returns past convergence.
7. **Sampler** — subtle differences once steps are sufficient.

## Pipeline types

| Pipeline   | Input → Output                 | Key parameter      | When to use                              |
| :--------- | :----------------------------- | :----------------- | :--------------------------------------- |
| txt2img    | text → image                   | prompt, seed       | Generating from scratch                  |
| img2img    | image + text → image           | denoising_strength | Style transfer, refinement               |
| Inpainting | image + mask + text → image    | denoising_strength | Fixing regions, removing/adding objects  |
| ControlNet | control signal + text → image  | conditioning_scale | Structural guidance (edges, depth, pose) |
| IP-Adapter | reference image + text → image | ip_adapter_scale   | Style/content transfer from reference    |
| Upscaling  | image → high-res image         | —                  | Resolution increase after generation     |
| txt2vid    | text → video                   | num_frames, motion | Video from scratch                       |
| img2vid    | image + text → video           | motion_strength    | Animating a static image                 |

## Architecture evolution

UNet → DiT → MM-DiT → Video transformers.

Key transition: replacing convolutional UNet with transformer backbone (DiT). Transformers apply attention at every layer (not just bottleneck), scale predictably with size, and enable MM-DiT's bidirectional text-image attention.

Video models extend this with 3D attention (spatial + temporal jointly) or factored attention (spatial and temporal separately). Temporal compression via causal 3D VAE adds 4x compression in the time dimension.

## Video generation

Video diffusion denoises a 3D latent (space + time) simultaneously. Key differences from image generation:

- **Temporal coherence** is the core challenge — objects must move consistently across frames
- **Compute scales with duration** — each additional second adds frames to the attention sequence
- **Motion control** is emerging — camera trajectories, point trajectories, motion strength
- **Two paradigms**: full-sequence (all frames at once, best coherence, memory-limited) vs autoregressive (sequential chunks, arbitrary length, error accumulates)

## Deep references

- [references/architecture.md](./references/architecture.md) — diffusion process, latent space, VAE, DiT, MM-DiT, text encoders, CFG, samplers, flow matching, acceleration
- [references/parameters.md](./references/parameters.md) — what each parameter controls, optimal ranges, encoder-aware prompting, video-specific params
- [references/pipelines.md](./references/pipelines.md) — txt2img, img2img, inpainting, ControlNet, IP-Adapter, upscaling, video pipelines, multi-pass workflows
- [references/fine-tuning.md](./references/fine-tuning.md) — LoRA, DreamBooth, textual inversion, training data quality
- [references/quality.md](./references/quality.md) — artifact diagnosis, optimization strategies, sampler selection, iterative refinement
