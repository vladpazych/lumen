# Parameters

What each generation parameter controls and how to use it effectively.

## Prompt

The text description that conditions generation. Processed by one or more text encoders into token embeddings.

### How text becomes conditioning

1. Text is tokenized into subword tokens
2. Tokens pass through the text encoder(s), producing a sequence of embeddings
3. Embeddings are injected into the diffusion model via cross-attention at every layer
4. The model generates content that aligns with the embedding space, not the literal words

### Encoder-aware prompting

CLIP-based models (SD 1.5, SDXL): respond to comma-separated descriptors, style keywords, visual concepts. Order matters — earlier tokens get more attention weight. 77-token limit (~50 words).

T5-based models (Flux, SD3): respond to natural language descriptions. Flowing sentences outperform keyword lists. 512-token limit (~375 words).

Dual-encoder models: each encoder has different strengths. CLIP anchors visual style, T5 handles semantic complexity.

### Common prompt patterns

- **Subject first**: "A cat sitting on a windowsill" not "On a windowsill, there sits a cat"
- **Style descriptors**: "oil painting", "photograph", "3D render", "watercolor" — sets the visual domain
- **Quality modifiers**: "highly detailed", "sharp focus", "professional" — push toward higher-quality training examples
- **Lighting/mood**: "golden hour", "studio lighting", "dramatic shadows" — strongly affects composition
- **Camera language**: "close-up", "wide angle", "aerial view", "85mm lens" — controls framing and perspective

### Negative prompt

Replaces the unconditional prediction in CFG with a conditioned-on-negative prediction. The model steers away from these concepts in noise space.

Effective for: removing artifacts ("blurry, distorted, watermark"), shifting away from unwanted styles ("cartoon" when seeking realism), suppressing common failure modes ("extra fingers, extra limbs").

Not effective for: precise exclusion of specific objects (text encoders struggle with negation). "No cats" often produces cats — the encoder activates the "cat" concept regardless of negation.

Flow-matching models (Flux) have limited or no negative prompt support because they don't use traditional CFG.

## Guidance scale (CFG scale)

Controls the strength of text conditioning. Technically, it scales the difference between conditional and unconditional predictions.

| Range | Effect                                                        |
| :---- | :------------------------------------------------------------ |
| 1.0   | No guidance — model follows its learned prior, ignores prompt |
| 3-5   | Soft guidance — creative, may drift from prompt               |
| 7-8   | Standard — good balance of prompt adherence and image quality |
| 10-12 | Strong — tighter prompt following, some saturation            |
| 15+   | Overshoot — oversaturated colors, high contrast, artifacts    |

Higher CFG doesn't mean "better." It amplifies the difference between conditioned and unconditioned, which past a threshold introduces artifacts. The optimal range depends on the model and sampler.

Models with guidance distillation (Flux dev) bake this in — the guidance_scale parameter may have no effect or a different interpretation.

## Steps (inference steps)

Number of denoising iterations. Each step removes a portion of noise according to the sampler and schedule.

| Steps | Effect                                        |
| :---- | :-------------------------------------------- |
| 1-4   | Only viable with distilled/consistency models |
| 8-15  | Fast generation, adequate for previews        |
| 20-30 | Standard quality range for most samplers      |
| 50+   | Diminishing returns for most samplers         |

Step count interacts with the sampler. DPM++ 2M converges around 20 steps. UniPC can produce good results in 5-10. Euler needs 20-30.

Ancestral samplers never converge — more steps changes the output rather than improving it. Non-ancestral (deterministic) samplers converge, meaning additional steps refine rather than alter.

## Seed

Integer that initializes the random number generator. Controls the initial noise tensor from which generation begins.

- Same seed + same parameters + same model = same output (on same hardware)
- Seed = 0 or -1 or null: random seed, different output each run
- Seeds encode structure: the initial noise pattern determines the rough spatial layout of the final image

Cross-hardware reproducibility is not guaranteed. Different GPU architectures may produce slightly different random sequences even with the same seed. For exact reproducibility, fix the hardware and software versions.

### Seed as a creative tool

Adjacent seeds (42 vs 43) produce completely different compositions — seeds don't interpolate linearly. To explore variations of a liked composition, fix the seed and vary other parameters (prompt, CFG, steps).

## Resolution and aspect ratio

### Native resolution

Models are trained at specific resolutions. Generating at non-native resolutions degrades quality.

| Model  | Native resolution | Common aspect ratios          |
| :----- | :---------------- | :---------------------------- |
| SD 1.5 | 512x512           | 512x768, 768x512              |
| SDXL   | 1024x1024         | 1024x1024, 896x1152, 1216x832 |
| Flux   | 1024x1024         | Flexible with bucketing       |

### Aspect ratio bucketing

Training data is grouped into resolution buckets that share an aspect ratio. The model learns to generate at these bucketed resolutions. Generating at a resolution between buckets forces interpolation, reducing quality.

Requesting non-standard resolutions: the pipeline snaps to the nearest bucket. Keep total pixel count close to the native resolution squared (e.g., ~1M pixels for SDXL).

### Resolution vs quality

Higher resolution ≠ better quality. Generating above native resolution causes:

- Repeated patterns and tiling artifacts
- Loss of global coherence (model "sees" a smaller portion of the image at each attention layer)
- Increased compute with diminishing returns

For high-resolution output: generate at native resolution, then upscale with a dedicated upscaler.

## Denoising strength

Controls how much of the input image is preserved in img2img and inpainting workflows. Range: 0.0 to 1.0.

| Strength | Noise added | Effect                                                |
| :------- | :---------- | :---------------------------------------------------- |
| 0.0      | None        | Output = input (no change)                            |
| 0.1-0.3  | Low         | Subtle style/color shifts, composition unchanged      |
| 0.4-0.6  | Medium      | Noticeable changes, general structure preserved       |
| 0.7-0.8  | High        | Significant reinterpretation, loose structure         |
| 1.0      | Full        | Input fully replaced by noise — equivalent to txt2img |

The input image is encoded through the VAE, noise is added proportional to denoising strength, and the model denoises from that partially-noised state. Lower strength = more of the original survives.

For inpainting: 0.5 is a good starting point. Lower for subtle touch-ups, higher for replacing content entirely.

## Model-specific parameters

Some parameters exist only in specific pipeline types or model families:

- **num_images**: batch count — generate multiple outputs from different seeds in one call
- **output_format**: png, jpeg, webp — determines encoding of the returned image
- **scheduler**: override the default sampler/scheduler
- **lora_weights**: path or ID of a LoRA adapter to apply
- **controlnet_conditioning_scale**: strength of ControlNet influence (0.0-2.0, typically 0.5-1.0)
- **ip_adapter_scale**: strength of IP-Adapter image conditioning (0.0-1.0)

## Video-specific parameters

- **num_frames / duration**: length of output video
- **fps**: frames per second for output
- **motion_strength**: controls amount of motion (model-dependent)
- **camera_control**: pan, tilt, zoom, orbit parameters
- **reference_image**: starting frame for image-to-video
