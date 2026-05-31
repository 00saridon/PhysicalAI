import torch
import torch.nn as nn


class MLPPolicy(nn.Module):
    """Simple MLP policy: obs → action (continuous)."""

    def __init__(self, obs_dim: int, action_dim: int, hidden_dim: int = 256):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(obs_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, action_dim),
            nn.Tanh(),
        )

    def forward(self, obs: torch.Tensor) -> torch.Tensor:
        return self.net(obs)

    def predict(self, obs_vec):
        """SB3-compatible predict interface. Accepts 1D (single obs) or 2D (batch)."""
        import numpy as np
        obs_arr = np.asarray(obs_vec, dtype=np.float32)
        single = obs_arr.ndim == 1
        with torch.no_grad():
            t = torch.from_numpy(obs_arr if not single else obs_arr[np.newaxis])
            out = self(t)
            return (out.squeeze(0) if single else out).numpy(), None
