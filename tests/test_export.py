import torch
import numpy as np
import os
from trainer.il.policy import MLPPolicy
from export.policy_exporter import PolicyExporter


def test_onnx_export_and_inference(tmp_path):
    """Test that ONNX export creates a valid model file."""
    policy = MLPPolicy(obs_dim=14, action_dim=10, hidden_dim=64)
    path = str(tmp_path / "policy.onnx")
    exporter = PolicyExporter(policy, obs_dim=14)
    exporter.to_onnx(path)
    assert os.path.exists(path)

    import onnxruntime as ort
    sess = ort.InferenceSession(path)
    obs = np.zeros((1, 14), dtype=np.float32)
    out = sess.run(None, {"obs": obs})[0]
    assert out.shape == (1, 10)


def test_onnx_output_matches_pytorch(tmp_path):
    """Test that ONNX outputs match PyTorch outputs."""
    policy = MLPPolicy(obs_dim=14, action_dim=10, hidden_dim=64)
    path = str(tmp_path / "policy.onnx")
    exporter = PolicyExporter(policy, obs_dim=14)
    exporter.to_onnx(path)

    obs_np = np.random.randn(1, 14).astype(np.float32)
    with torch.no_grad():
        pt_out = policy(torch.from_numpy(obs_np)).numpy()

    import onnxruntime as ort
    sess = ort.InferenceSession(path)
    ort_out = sess.run(None, {"obs": obs_np})[0]

    np.testing.assert_allclose(pt_out, ort_out, atol=1e-5)
