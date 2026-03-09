# Architecture

How modern generative models turn text into pixels.

## The diffusion process

Forward process adds Gaussian noise to data over T timesteps until it becomes pure noise. Reverse process learns to denoise step-by-step, recovering data from noise. The model predicts the noise (or velocity, or score) at each step, and a sampler removes it.

Training objective: given a noisy image x_t at timestep t, predict the noise epsilon that was added. The loss is simply MSE between predicted and actual noise.

## Latent diffusion

Pixel-space diffusion is computationally prohibitive at high resolution. Latent diffusion compresses images through a VAE encoder into a lower-dimensional latent space, runs diffusion there, then decodes back to pixels.

### VAE compression ratios

| Model family | Spatial factor          | Channels | Compression | Detail impact                                   |
| :----------- | :---------------------- | :------- | :---------- | :---------------------------------------------- |
| SD 1.5       | 8x                      | 4        | 48x         | Loses fine detail                               |
| SDXL         | 8x                      | 4        | 48x         | Same compression, larger native res compensates |
| Flux / SD3   | 8x                      | 16       | 12x         | Preserves significantly more detail             |
| Video models | 8x spatial, 4x temporal | 16       | ~185x total | Temporal compression adds efficiency            |

Detail loss happens at the VAE stage, not the diffusion stage. A 48x VAE discards fine texture before diffusion even begins. Flux's 16-channel VAE preserves ~4x more information than SDXL's 4-channel VAE.

### Video VAE (3D Causal VAE)

Video models use CausalConv3D to compress both spatial and temporal dimensions. "Causal" means each frame can only attend to previous frames during encoding — preserving temporal ordering.

Typical compression: 8x spatial, 4x temporal, 16 channels. A 720x1280x129-frame video compresses ~185x in total elements.

## Backbone architectures

### UNet (legacy)

Encoder-decoder with skip connections. Downsamples through conv blocks, processes at low resolution with self-attention, upsamples back. Skip connections preserve spatial detail across scales.

Limitation: attention is quadratic in sequence length, so UNet only applies it at low resolutions. Global coherence suffers at high resolution.

### DiT (Diffusion Transformer)

Replaces UNet entirely with a transformer operating on patches of the latent. Latent is split into non-overlapping patches, linearly embedded into tokens, processed through transformer blocks with self-attention.

Advantages over UNet:

- Attention at every layer, not just bottleneck — better global coherence
- Scales predictably with depth and width (transformer scaling laws apply)
- No architectural asymmetry between encoder/decoder

### MM-DiT (Multimodal DiT)

Used by SD3 and Flux. Two separate weight sets for text and image modalities. During attention, text and image token sequences are concatenated — bidirectional attention lets each modality see the other.

SD3: pure MM-DiT (symmetric dual-stream blocks).
Flux: hybrid — 19 dual-stream MM-DiT blocks followed by 38 single-stream blocks. Single-stream processes concatenated text+image with unified weights, reducing per-block parameters from 340M to 141M.

### Video transformer variants

| Approach           | Models                             | Mechanism                               | Tradeoff                                |
| :----------------- | :--------------------------------- | :-------------------------------------- | :-------------------------------------- |
| 3D full attention  | HunyuanVideo, CogVideoX, LTX-Video | Joint spatial-temporal attention        | Best coherence, highest compute         |
| Factored attention | Open-Sora                          | Separate spatial and temporal attention | Scalable, slightly weaker temporal      |
| MoE routing        | Wan 2.2                            | Mixture-of-Experts across timesteps     | Specialized experts per denoising phase |

## Text conditioning

### Text encoders

| Encoder            | Type                             | Token limit      | Strength                                             | Used by                           |
| :----------------- | :------------------------------- | :--------------- | :--------------------------------------------------- | :-------------------------------- |
| CLIP ViT-L         | Contrastive (image-text aligned) | 77 (~50 words)   | Visual concepts, style keywords                      | SD 1.5, SDXL, Flux (secondary)    |
| CLIP ViT-bigG      | Contrastive                      | 77               | Stronger visual alignment                            | SDXL                              |
| T5-XXL             | Encoder-only language model      | 512 (~375 words) | Natural language understanding, complex descriptions | SD3, Flux (primary), video models |
| LLM (decoder-only) | Generative language model        | 2048+            | Rich semantics, reasoning                            | HunyuanVideo, some experimental   |

CLIP: trained jointly with an image encoder via contrastive learning. Embedding space aligns visual and textual concepts. Best with comma-separated keywords and visual descriptors.

T5: trained purely on text. Processes natural language with NLP-level understanding. Best with flowing descriptive sentences.

Dual-encoder models (Flux, SD3) use both CLIP and T5. Each encoder has different strengths — CLIP for visual grounding, T5 for semantic understanding. Using the same prompt for both can degrade quality by 50-75%.

### Cross-attention

Text encoder outputs a sequence of token embeddings. At each transformer block, image tokens attend to text tokens via cross-attention: image tokens are queries, text tokens are keys/values. This injects text semantics into the spatial generation process at every layer.

### Classifier-Free Guidance (CFG)

At each denoising step, the model runs twice: once conditioned on the text prompt, once unconditionally (empty prompt). The final prediction amplifies the difference:

```
output = unconditional + guidance_scale * (conditional - unconditional)
```

- guidance_scale = 1.0: no guidance, model follows its own prior
- guidance_scale = 7-8: typical sweet spot for most models
- guidance_scale > 15: oversaturated, high-contrast artifacts

Negative prompts replace the unconditional prediction with a conditioned-on-negative prediction. The model steers toward the positive prompt and away from the negative prompt. This is not "filtering out" concepts — it is a directional push in noise space.

Flow-matching models (Flux) use guidance differently or not at all. Flux dev uses a guidance distillation approach that bakes guidance into the model, eliminating the need for separate CFG at inference.

## Samplers and scheduling

### What samplers do

The reverse diffusion process is an ODE (or SDE). Samplers are numerical methods for solving it — they determine how to step from noise to data.

| Sampler         | Type | Steps for quality | Characteristics                                   |
| :-------------- | :--- | :---------------- | :------------------------------------------------ |
| Euler           | ODE  | 20-30             | Simplest, fast, linear noise removal              |
| Euler Ancestral | SDE  | 20-30             | Adds stochasticity, more creative variation       |
| DPM++ 2M        | ODE  | 20-30             | Good balance of speed and quality                 |
| DPM++ SDE       | SDE  | 20-30             | Higher quality, stochastic                        |
| DDIM            | ODE  | 20-50             | Deterministic, invertible, good for interpolation |
| UniPC           | ODE  | 5-10              | Fast convergence, predictor-corrector method      |

ODE samplers: deterministic (same seed = same result). SDE samplers: stochastic (adds noise at each step, more variation even with same seed).

Ancestral samplers (marked with "a") never converge — increasing steps changes the output rather than refining it.

### Noise schedules

Control how noise levels change across timesteps.

- **Linear**: noise increases linearly. Gets too noisy too fast for high-resolution images.
- **Cosine**: slower noise increase. Most popular default.
- **Karras**: progressively smaller steps near the end. Finer detail rendering in final steps.

Karras insight: the schedule itself doesn't add expressivity. Simplify by setting sigma(t) = t and working directly with sigma values.

### Flow matching

Rectified flow replaces the diffusion SDE with an ODE that maps noise to data along straight-line trajectories. Straighter paths = fewer steps needed for accurate sampling.

Traditional diffusion: curved trajectories in noise space, requiring many steps to trace accurately.
Rectified flow: learns near-straight paths, enabling 4-8 step generation with minimal quality loss.

Used by SD3 and Flux. Enables fast inference without separate distillation.

## Acceleration techniques

### Consistency models

Train a model to map any point on the ODE trajectory directly to the final output. Enables 1-4 step generation. Two approaches:

- Consistency Distillation: distill from a pretrained diffusion model
- Consistency Training: learn from scratch

Latent Consistency Models (LCM) apply this to latent diffusion. A 2-4 step LCM can be trained in ~32 A100 GPU hours.

### Step distillation

Train a student model to match the output of a teacher model running many steps, but in fewer steps. Progressive distillation halves the step count iteratively.

### Guidance distillation

Bake the effect of CFG into the model weights during distillation, so inference needs only one forward pass instead of two. Flux dev uses this approach.
