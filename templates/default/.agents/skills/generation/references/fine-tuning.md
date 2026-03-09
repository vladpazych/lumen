# Fine-tuning

Adapting base models for specific styles, subjects, or domains.

## LoRA (Low-Rank Adaptation)

The dominant fine-tuning method for image generation. Instead of updating all model weights, LoRA inserts small low-rank matrices (adapters) into attention layers. Only these adapters are trained — the base model stays frozen.

### How it works

A weight matrix W (e.g., 4096x4096) would have ~16M parameters to update in full fine-tuning. LoRA decomposes the update into two small matrices: A (4096 x rank) and B (rank x 4096). With rank=16, that's 131K parameters instead of 16M.

At inference: W_effective = W_original + A \* B. The adapter merges with the base model linearly.

### Training parameters

- **Rank**: dimensionality of the low-rank matrices. Higher rank = more expressive, more VRAM, easier to overfit. Typical: 4-64. Rank 16-32 covers most use cases.
- **Alpha**: scaling factor applied to the LoRA output. Usually set equal to rank. alpha/rank determines the effective learning rate contribution.
- **Training images**: 10-50 for style LoRAs, 20-80 for subject/character LoRAs. Quality matters more than quantity — curate tightly.
- **Training steps**: 1000-5000 for most LoRAs. Overfitting shows as loss of prompt responsiveness (model only outputs the trained concept).
- **Learning rate**: 1e-4 to 1e-5 typical. Lower for larger ranks, higher for smaller ranks.

### LoRA composition

Multiple LoRAs can be applied simultaneously with independent weights. A style LoRA at 0.7 strength + a subject LoRA at 0.9 strength. Interference between LoRAs is possible when they modify the same attention layers — reduce individual weights to manage conflicts.

### Limitations

LoRA captures the difference between base model behavior and target behavior. If the base model has no concept of the target (e.g., a completely novel art style), more training data and higher rank are needed. LoRA cannot fundamentally change the model's architecture or resolution.

## Full fine-tuning

Updates all model weights. Requires significantly more compute, data, and care to avoid catastrophic forgetting (model loses general capabilities while learning the new domain).

Use when: building a specialized model for a narrow domain (medical imaging, satellite photos, specific product category). Not practical for individual concepts or styles.

## Textual inversion

Learns a new token embedding that represents a concept, without changing model weights at all. Only the embedding vector is trained.

Much smaller than LoRA (a single vector vs thousands of parameters). Less expressive — can capture a concept's "essence" but can't modify the model's rendering capabilities. Useful for simple concepts that the model already knows how to render but lacks a name for.

## DreamBooth

Fine-tunes the model to associate a specific rare token (e.g., "sks") with a subject. Combines a subject-specific loss with a prior-preservation loss that prevents the model from forgetting general concepts.

Originally required full fine-tuning. Now commonly combined with LoRA (DreamBooth-LoRA) for efficiency.

## Training data quality

Quality of training data has more impact than quantity. Key factors:

- **Consistency**: if training a style, all images should share that style. Mixed styles produce a muddled LoRA.
- **Captioning**: accurate captions that describe each image. The model learns the association between caption tokens and visual features. Bad captions = bad associations.
- **Variety within consistency**: same style but different subjects, compositions, lighting. Prevents the LoRA from memorizing specific images.
- **Resolution**: match the base model's native resolution. Upscaled low-res images train the model on upscaling artifacts.
- **Regularization images**: images of the general class (e.g., "person" when training a specific person) prevent the model from associating the class concept solely with the training subject.
