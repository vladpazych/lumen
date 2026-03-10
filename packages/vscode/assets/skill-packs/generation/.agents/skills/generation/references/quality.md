# Quality

Diagnosing problems and optimizing output quality.

## Common artifacts and fixes

### Oversaturation / burnt colors

**Cause**: guidance scale too high. CFG amplifies the difference between conditioned and unconditioned predictions — past a threshold, color channels clip.

**Fix**: reduce guidance_scale. Typical sweet spot: 7-8 for most models. Flow-matching models (Flux) may not use CFG at all.

### Blurry or soft output

**Causes**:

- Too few steps for the sampler (increase steps or switch to a faster-converging sampler like UniPC)
- VAE compression losing detail (model limitation, not user-fixable per generation)
- Generating below native resolution
- Denoising strength too low in img2img (not enough room for the model to add detail)

### Anatomical errors (extra fingers, limbs, distorted faces)

**Cause**: the model's training data distribution. Human anatomy is high-dimensional and the model's latent space doesn't perfectly capture all constraints.

**Mitigations**:

- Negative prompt: "extra fingers, extra limbs, distorted, deformed"
- Inpaint the affected region with a focused prompt
- Use a model specifically fine-tuned for better anatomy
- ControlNet with OpenPose for correct body structure

### Tiling / repetitive patterns

**Cause**: generating above native resolution. The model's receptive field covers a smaller proportion of the image, causing it to repeat patterns to fill the space.

**Fix**: generate at native resolution, upscale afterward.

### Text rendering failures

**Cause**: most diffusion models generate text as a visual pattern, not as characters. They haven't learned reliable letter formation.

**Mitigations**:

- T5-based models (Flux, SD3) are significantly better at text than CLIP-only models
- Keep text short (1-3 words)
- Larger text in the image is easier than small text
- Inpaint text regions after initial generation

### Temporal flickering (video)

**Cause**: insufficient temporal attention or too-high denoising in vid2vid.

**Mitigations**:

- Lower denoising strength in vid2vid workflows
- Use models with 3D full attention rather than factored temporal attention
- Apply temporal smoothing in post-processing

### Color shift / inconsistency across frames (video)

**Cause**: each frame being denoised somewhat independently despite temporal attention.

**Mitigations**:

- Lower guidance scale for more stable color palette
- Use image-to-video with a carefully crafted reference frame
- Post-process with color grading that enforces consistency

## Optimization strategies

### Resolution workflow

1. Generate at native resolution (1024x1024 for SDXL/Flux)
2. Select the best seed/composition
3. Upscale with a dedicated model (Real-ESRGAN for clean upscaling, diffusion-based for detail enhancement)
4. Optionally inpaint specific regions at the upscaled resolution

Generating directly at 2048x2048 wastes compute and often degrades quality compared to this workflow.

### Iterative refinement

1. Low steps (8-15) with multiple seeds to explore compositions
2. Pick the best seed, increase steps to 25-30 for full quality
3. img2img with low denoising (0.2-0.4) to refine specific aspects
4. Inpaint problem areas

### Sampler selection guide

| Goal                       | Sampler          | Steps |
| :------------------------- | :--------------- | :---- |
| Fast preview               | Euler            | 8-12  |
| Balanced quality/speed     | DPM++ 2M Karras  | 20-25 |
| Maximum quality            | DPM++ SDE Karras | 25-30 |
| Few-step generation        | UniPC or LCM     | 4-8   |
| Creative variation         | Euler Ancestral  | 20-30 |
| Deterministic reproduction | DDIM             | 20-30 |

### Prompt optimization

Prompt changes have more impact on output quality than parameter tuning. Order of impact:

1. **Prompt content** (what to generate) — highest impact
2. **Model selection** (which model) — defines the quality ceiling
3. **Guidance scale** — controls prompt adherence vs quality
4. **Seed** — determines composition
5. **Steps** — diminishing returns past convergence
6. **Sampler** — subtle differences once steps are sufficient

### When results are consistently poor

Before tuning parameters, check:

- Is the prompt well-matched to the model's training domain?
- Is the resolution close to the model's native resolution?
- Is a LoRA interfering (reduce weight or remove)?
- Is the model appropriate for the content type (photorealism vs illustration)?
