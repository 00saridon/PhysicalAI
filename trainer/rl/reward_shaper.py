import numpy as np


class RewardShaper:
    """Scales and clips rewards for stable RL training."""

    def __init__(self, scale: float = 1.0, clip: tuple = (-10.0, 10.0)):
        self.scale = scale
        self.clip = clip

    def shape(self, reward: float) -> float:
        return float(np.clip(reward * self.scale, self.clip[0], self.clip[1]))
