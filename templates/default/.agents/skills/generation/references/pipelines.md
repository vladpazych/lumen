# Pipelines

Pipeline types for image and video generation, when to use each, and how they chain.

## Image pipelines

### txt2img

The base pipeline. Pure noise → image, conditioned on text.

Inputs: prompt, (negative_prompt), seed, steps, guidance_scale, resolution/aspect_ratio.
Output: image.

Use when: generating from scratch with no visual reference.

### img2img

Existing image → noisy latent → re-diffused image, conditioned on text.

The input image is VAE-encoded, noise is added proportional to denoising_strength, and the model denoises from that intermediate state. Lower strength preserves more of the original.

Inputs: image, prompt, denoising_strength, seed, steps, guidance_scale.
Output: image.

Use when: style transfer, iterating on a composition, refining a previous generation, adapting a sketch or photo.

### Inpainting

Selective regeneration within a masked region. Unmasked areas are preserved, masked area is re-diffused.

The mask defines where noise is injected. The model generates content for the masked region that blends with the surrounding context. Dedicated inpainting models are fine-tuned for this — generic models can inpaint but produce worse edge blending.

Inputs: image, mask, prompt, denoising_strength, seed, steps, guidance_scale.
Output: image.

Use when: fixing specific regions (hands, faces), removing objects, adding elements to existing images.

### Outpainting

Extends the canvas beyond the original image boundaries. Conceptually: inpainting where the mask is the new canvas area.

Use when: expanding composition, changing aspect ratio of existing images.

### ControlNet

Adds structural conditioning from an extracted signal (edges, depth, pose, normals, segmentation). The ControlNet module is a trained copy of the encoder half of the diffusion model, injecting its output into the main model via zero-convolution layers.

Types of control signals:

| Control type | Signal source         | What it controls                      |
| :----------- | :-------------------- | :------------------------------------ |
| Canny        | Edge detection        | Precise outlines and boundaries       |
| Depth        | Depth estimation      | Spatial layout, foreground/background |
| OpenPose     | Pose estimation       | Human body position and gesture       |
| Normal map   | Surface normals       | 3D surface orientation                |
| Segmentation | Semantic segmentation | Region-level composition              |
| Line art     | Simplified drawing    | Artistic outlines                     |
| Scribble     | Freehand sketch       | Rough composition guidance            |

conditioning_scale controls influence strength. 0.0 = ignored, 1.0 = strict adherence, >1.0 = exaggerated.

ControlNets are model-specific. An SDXL ControlNet doesn't work with Flux. Each base model needs its own trained ControlNets.

### IP-Adapter

Image Prompt Adapter. Conditions generation on a reference image's style or content, not its structure. Uses a separate image encoder (CLIP ViT) to extract features, injected via decoupled cross-attention — separate attention layers for text and image conditioning.

- **Style transfer**: reference image influences colors, textures, artistic style
- **Content transfer**: reference image influences subject identity and appearance
- **Face ID**: specialized variant that preserves facial identity

Combinable with ControlNet: IP-Adapter handles style/content, ControlNet handles structure. This separation gives independent control over what things look like vs where things are.

ip_adapter_scale controls influence. 0.0 = ignored, 1.0 = strong influence. Typical range: 0.4-0.8.

### Upscaling

Increases resolution of an existing image. Two approaches:

**Model-based upscaling**: specialized super-resolution models (ESRGAN, Real-ESRGAN, SwinIR). Fast, consistent, but limited creative enhancement.

**Diffusion-based upscaling**: img2img at higher resolution with low denoising strength, optionally with tiled processing to manage VRAM. Adds detail that wasn't in the original. Tiled upscaling splits the image into overlapping tiles, upscales each, and blends — enables arbitrary resolution scaling.

Use model-based for clean upscaling. Use diffusion-based when the image needs detail enhancement, not just interpolation.

## Video pipelines

### txt2vid (text-to-video)

Pure noise → video, conditioned on text. The 3D latent (spatial + temporal) is denoised simultaneously.

Inputs: prompt, seed, steps, guidance_scale, resolution, num_frames/duration, fps.
Output: video.

Challenges: temporal coherence (objects should move consistently), motion quality (movement should look natural), and duration limits (most models cap at 5-10 seconds per generation).

### img2vid (image-to-video)

Reference image → video. The first frame (or a keyframe) is conditioned on the input image, and the model generates temporally consistent subsequent frames.

Inputs: image, prompt, seed, steps, num_frames/duration, motion_strength.
Output: video.

Stronger motion_strength: more movement, higher risk of diverging from the reference.
Lower motion_strength: subtle animation, closer to the reference throughout.

Use when: animating a static image, creating video from a carefully crafted image generation.

### vid2vid (video-to-video)

Existing video → re-styled video. Each frame is processed through img2img-like denoising, but with temporal attention maintaining cross-frame consistency.

Inputs: video, prompt, denoising_strength, seed, steps.
Output: video.

The challenge: maintaining temporal coherence across frames while applying style changes. Too-high denoising strength causes flickering. Frame-by-frame img2img without temporal attention produces incoherent video.

### Frame interpolation

Generates intermediate frames between keyframes. Not a diffusion pipeline in the traditional sense — often uses specialized motion estimation models (RIFE, FILM).

Use when: increasing framerate, creating slow-motion effects, smoothing transitions between generated keyframes.

### Camera and motion control

Emerging capability (2025+). Specialized conditioning modules that accept:

- **Camera trajectories**: 6-DoF camera poses (position + rotation) control virtual camera movement
- **Motion trajectories**: point trajectories specify where objects should move
- **Motion strength/direction**: high-level controls for general movement intensity

Methods range from training-free plug-and-play modules (Time-to-Move) to dedicated ControlNet-like adapters (Motion Prompting, Wan-Move).

## Generation strategies

### Multi-pass workflows

Complex outputs often require chaining pipelines:

1. **txt2img → img2img**: generate base composition, then refine with adjusted prompt and low denoising
2. **txt2img → inpaint**: generate scene, then fix specific regions (faces, hands, text)
3. **txt2img → upscale**: generate at native resolution, then upscale for final output
4. **txt2img → img2vid**: generate a hero frame, then animate it
5. **ControlNet + IP-Adapter → txt2img**: structure from one source, style from another

### Batch exploration

Generate multiple outputs with different seeds at low step count to explore compositions, then re-generate the best seed at full quality. Faster than generating one perfect image at a time.

## Architectural approaches to video

### Full-sequence diffusion

The entire video (all frames) is denoised simultaneously. Model sees all frames at once via 3D attention. Best temporal coherence, highest compute cost. Duration limited by memory.

Models: HunyuanVideo, CogVideoX, most current video models.

### Autoregressive generation

Frames (or frame chunks) generated sequentially, each conditioned on previous frames. Enables streaming inference and arbitrary-length video. Lower memory ceiling, but errors can compound over long sequences.

Emerging approach (2025+): spatiotemporal cube prediction units instead of individual frames reduce error accumulation.

### Hybrid approaches

Generate keyframes via full-sequence diffusion, then interpolate between them. Balances quality and duration. Some models internally combine autoregressive chunk generation with full-attention within each chunk.
