"""Predefined pose definitions and OpenPose skeleton renderer.

Each pose is a set of 18 normalized COCO body keypoints. The renderer draws
colored skeleton lines and joint circles on a black background — the standard
input format for OpenPose ControlNet conditioning.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from PIL import Image

# --- COCO 18-point body model ---

KEYPOINT_NAMES = [
    "nose",             # 0
    "neck",             # 1
    "right_shoulder",   # 2
    "right_elbow",      # 3
    "right_wrist",      # 4
    "left_shoulder",    # 5
    "left_elbow",       # 6
    "left_wrist",       # 7
    "right_hip",        # 8
    "right_knee",       # 9
    "right_ankle",      # 10
    "left_hip",         # 11
    "left_knee",        # 12
    "left_ankle",       # 13
    "right_eye",        # 14
    "left_eye",         # 15
    "right_ear",        # 16
    "left_ear",         # 17
]

SKELETON = [
    (0, 1),    # nose → neck
    (1, 2),    # neck → right shoulder
    (2, 3),    # right shoulder → right elbow
    (3, 4),    # right elbow → right wrist
    (1, 5),    # neck → left shoulder
    (5, 6),    # left shoulder → left elbow
    (6, 7),    # left elbow → left wrist
    (1, 8),    # neck → right hip
    (8, 9),    # right hip → right knee
    (9, 10),   # right knee → right ankle
    (1, 11),   # neck → left hip
    (11, 12),  # left hip → left knee
    (12, 13),  # left knee → left ankle
    (0, 14),   # nose → right eye
    (14, 16),  # right eye → right ear
    (0, 15),   # nose → left eye
    (15, 17),  # left eye → left ear
]

# Standard OpenPose limb colors (one per skeleton connection)
LIMB_COLORS: list[tuple[int, int, int]] = [
    (255, 0, 0),       # nose–neck
    (255, 85, 0),      # neck–right shoulder
    (255, 170, 0),     # right shoulder–right elbow
    (255, 255, 0),     # right elbow–right wrist
    (170, 255, 0),     # neck–left shoulder
    (85, 255, 0),      # left shoulder–left elbow
    (0, 255, 0),       # left elbow–left wrist
    (0, 255, 85),      # neck–right hip
    (0, 255, 170),     # right hip–right knee
    (0, 255, 255),     # right knee–right ankle
    (0, 170, 255),     # neck–left hip
    (0, 85, 255),      # left hip–left knee
    (0, 0, 255),       # left knee–left ankle
    (85, 0, 255),      # nose–right eye
    (170, 0, 255),     # right eye–right ear
    (255, 0, 255),     # nose–left eye
    (255, 0, 170),     # left eye–left ear
]

# Joint colors match the average of connected limb colors
JOINT_COLOR = (255, 255, 255)


# --- Pose definitions ---

Point = tuple[float, float] | None  # normalized (x, y) or None if invisible


@dataclass
class PoseDefinition:
    name: str
    label: str
    keypoints: list[Point] = field(default_factory=list)  # 18 entries


POSES: dict[str, PoseDefinition] = {
    "standing_front": PoseDefinition(
        name="standing_front",
        label="Standing (Front)",
        keypoints=[
            (0.50, 0.10),   # nose
            (0.50, 0.15),   # neck
            (0.42, 0.18),   # right shoulder
            (0.38, 0.32),   # right elbow
            (0.36, 0.44),   # right wrist
            (0.58, 0.18),   # left shoulder
            (0.62, 0.32),   # left elbow
            (0.64, 0.44),   # left wrist
            (0.45, 0.48),   # right hip
            (0.44, 0.66),   # right knee
            (0.44, 0.86),   # right ankle
            (0.55, 0.48),   # left hip
            (0.56, 0.66),   # left knee
            (0.56, 0.86),   # left ankle
            (0.47, 0.08),   # right eye
            (0.53, 0.08),   # left eye
            (0.44, 0.09),   # right ear
            (0.56, 0.09),   # left ear
        ],
    ),
    "standing_confident": PoseDefinition(
        name="standing_confident",
        label="Standing (Confident)",
        keypoints=[
            (0.50, 0.10),   # nose
            (0.50, 0.15),   # neck
            (0.40, 0.18),   # right shoulder
            (0.34, 0.30),   # right elbow
            (0.38, 0.42),   # right wrist — hand on hip
            (0.60, 0.18),   # left shoulder
            (0.66, 0.30),   # left elbow
            (0.62, 0.42),   # left wrist — hand on hip
            (0.44, 0.48),   # right hip
            (0.43, 0.66),   # right knee
            (0.42, 0.86),   # right ankle
            (0.56, 0.48),   # left hip
            (0.57, 0.66),   # left knee
            (0.58, 0.86),   # left ankle
            (0.47, 0.08),   # right eye
            (0.53, 0.08),   # left eye
            (0.44, 0.09),   # right ear
            (0.56, 0.09),   # left ear
        ],
    ),
    "sitting_casual": PoseDefinition(
        name="sitting_casual",
        label="Sitting (Casual)",
        keypoints=[
            (0.50, 0.12),   # nose
            (0.50, 0.18),   # neck
            (0.40, 0.22),   # right shoulder
            (0.36, 0.36),   # right elbow
            (0.40, 0.48),   # right wrist — on knee
            (0.60, 0.22),   # left shoulder
            (0.64, 0.36),   # left elbow
            (0.60, 0.48),   # left wrist — on knee
            (0.44, 0.50),   # right hip
            (0.38, 0.62),   # right knee — extended
            (0.34, 0.78),   # right ankle
            (0.56, 0.50),   # left hip
            (0.62, 0.62),   # left knee — extended
            (0.66, 0.78),   # left ankle
            (0.47, 0.10),   # right eye
            (0.53, 0.10),   # left eye
            (0.44, 0.11),   # right ear
            (0.56, 0.11),   # left ear
        ],
    ),
    "walking": PoseDefinition(
        name="walking",
        label="Walking",
        keypoints=[
            (0.48, 0.10),   # nose
            (0.48, 0.15),   # neck
            (0.40, 0.18),   # right shoulder
            (0.34, 0.30),   # right elbow
            (0.30, 0.40),   # right wrist — swinging back
            (0.56, 0.18),   # left shoulder
            (0.62, 0.28),   # left elbow
            (0.66, 0.38),   # left wrist — swinging forward
            (0.44, 0.48),   # right hip
            (0.50, 0.64),   # right knee — forward leg
            (0.54, 0.82),   # right ankle
            (0.52, 0.48),   # left hip
            (0.42, 0.66),   # left knee — back leg
            (0.38, 0.84),   # left ankle
            (0.46, 0.08),   # right eye
            (0.50, 0.08),   # left eye
            (0.43, 0.09),   # right ear
            (0.53, 0.09),   # left ear
        ],
    ),
    "portrait_headshot": PoseDefinition(
        name="portrait_headshot",
        label="Portrait Headshot",
        keypoints=[
            (0.50, 0.30),   # nose
            (0.50, 0.42),   # neck
            (0.36, 0.52),   # right shoulder
            (0.28, 0.72),   # right elbow
            None,            # right wrist — out of frame
            (0.64, 0.52),   # left shoulder
            (0.72, 0.72),   # left elbow
            None,            # left wrist — out of frame
            None,            # right hip — out of frame
            None,            # right knee
            None,            # right ankle
            None,            # left hip
            None,            # left knee
            None,            # left ankle
            (0.46, 0.26),   # right eye
            (0.54, 0.26),   # left eye
            (0.40, 0.28),   # right ear
            (0.60, 0.28),   # left ear
        ],
    ),
    "leaning": PoseDefinition(
        name="leaning",
        label="Leaning",
        keypoints=[
            (0.45, 0.10),   # nose — tilted
            (0.46, 0.16),   # neck
            (0.38, 0.20),   # right shoulder
            (0.30, 0.32),   # right elbow
            (0.26, 0.44),   # right wrist — resting on surface
            (0.54, 0.18),   # left shoulder
            (0.60, 0.28),   # left elbow
            (0.56, 0.40),   # left wrist — on hip
            (0.42, 0.48),   # right hip
            (0.40, 0.66),   # right knee
            (0.38, 0.86),   # right ankle — weight shifted
            (0.54, 0.48),   # left hip
            (0.58, 0.64),   # left knee — crossed
            (0.62, 0.84),   # left ankle
            (0.43, 0.08),   # right eye
            (0.48, 0.08),   # left eye
            (0.40, 0.09),   # right ear
            (0.52, 0.09),   # left ear
        ],
    ),
    "crossed_arms": PoseDefinition(
        name="crossed_arms",
        label="Crossed Arms",
        keypoints=[
            (0.50, 0.10),   # nose
            (0.50, 0.15),   # neck
            (0.40, 0.18),   # right shoulder
            (0.46, 0.30),   # right elbow — folded in
            (0.58, 0.34),   # right wrist — crossed to left
            (0.60, 0.18),   # left shoulder
            (0.54, 0.30),   # left elbow — folded in
            (0.42, 0.34),   # left wrist — crossed to right
            (0.44, 0.48),   # right hip
            (0.44, 0.66),   # right knee
            (0.44, 0.86),   # right ankle
            (0.56, 0.48),   # left hip
            (0.56, 0.66),   # left knee
            (0.56, 0.86),   # left ankle
            (0.47, 0.08),   # right eye
            (0.53, 0.08),   # left eye
            (0.44, 0.09),   # right ear
            (0.56, 0.09),   # left ear
        ],
    ),
    "dynamic": PoseDefinition(
        name="dynamic",
        label="Dynamic",
        keypoints=[
            (0.52, 0.12),   # nose — slight tilt
            (0.50, 0.17),   # neck
            (0.40, 0.20),   # right shoulder
            (0.30, 0.28),   # right elbow — reaching out
            (0.22, 0.34),   # right wrist
            (0.60, 0.20),   # left shoulder
            (0.68, 0.32),   # left elbow — reaching up
            (0.72, 0.22),   # left wrist — raised
            (0.44, 0.48),   # right hip
            (0.38, 0.64),   # right knee — lunging
            (0.34, 0.82),   # right ankle
            (0.56, 0.48),   # left hip
            (0.62, 0.62),   # left knee — back
            (0.66, 0.80),   # left ankle
            (0.49, 0.10),   # right eye
            (0.55, 0.10),   # left eye
            (0.46, 0.11),   # right ear
            (0.58, 0.11),   # left ear
        ],
    ),
}


def render_pose(pose_name: str, width: int, height: int) -> Image.Image:
    """Render an OpenPose skeleton on a black background.

    Returns an RGB PIL Image of the given dimensions. Raises KeyError
    if the pose name is not in POSES.
    """
    from PIL import Image as PILImage, ImageDraw

    pose = POSES[pose_name]
    img = PILImage.new("RGB", (width, height), (0, 0, 0))
    draw = ImageDraw.Draw(img)

    line_width = max(2, width // 256)
    joint_radius = max(3, width // 170)

    # Draw limbs
    for idx, (i, j) in enumerate(SKELETON):
        kp_i = pose.keypoints[i]
        kp_j = pose.keypoints[j]
        if kp_i is None or kp_j is None:
            continue
        x1, y1 = int(kp_i[0] * width), int(kp_i[1] * height)
        x2, y2 = int(kp_j[0] * width), int(kp_j[1] * height)
        draw.line([(x1, y1), (x2, y2)], fill=LIMB_COLORS[idx], width=line_width)

    # Draw joints on top of limbs
    for kp in pose.keypoints:
        if kp is None:
            continue
        x, y = int(kp[0] * width), int(kp[1] * height)
        r = joint_radius
        draw.ellipse([(x - r, y - r), (x + r, y + r)], fill=JOINT_COLOR)

    return img
