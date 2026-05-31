import os
import torch
import torch.nn as nn


class PolicyExporter:
    """Exports a PyTorch policy to ONNX or TorchScript."""

    def __init__(self, policy: nn.Module, obs_dim: int):
        self.policy = policy.eval()
        self.obs_dim = obs_dim

    def to_onnx(self, path: str):
        """Export policy to ONNX format."""
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        dummy = torch.zeros(1, self.obs_dim)
        # Use explicit dynamo=False to keep the stable legacy exporter path,
        # which avoids the new dynamo backend's UTF-8 logging issues on Windows.
        torch.onnx.export(
            self.policy,
            (dummy,),
            path,
            input_names=["obs"],
            output_names=["action"],
            dynamic_axes={"obs": {0: "batch"}, "action": {0: "batch"}},
            opset_version=18,
            dynamo=False,
        )

    def to_torchscript(self, path: str):
        """Export policy to TorchScript format."""
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        scripted = torch.jit.script(self.policy)
        scripted.save(path)
