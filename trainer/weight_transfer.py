"""Bridge weights between the IL `MLPPolicy` and SB3's `ActorCriticPolicy`.

The two policies share the same obs/action dims (14 -> action_dim) but store
their layers under different names, which is why a naive key-name match copies
nothing:

    IL  MLPPolicy.net :  net.0 (Linear) ReLU  net.2 (Linear) ReLU  net.4 (Linear) Tanh
    SB3 MlpPolicy     :  mlp_extractor.policy_net.{0,2,...}        +  action_net

With a matching `net_arch` (hidden widths taken from the IL checkpoint) and ReLU
activation, the layer shapes line up, so the IL trunk maps onto PPO's policy
trunk: the hidden Linear layers -> `mlp_extractor.policy_net.{0,2,...}` and the
final Linear -> `action_net`. The same map, reversed, pulls a trained PPO trunk
back into an `MLPPolicy` for ONNX export.
"""
from __future__ import annotations


def _il_linear_prefixes(il_state: dict) -> list[str]:
    """IL Linear-layer prefixes in depth order, e.g. ['net.0', 'net.2', 'net.4']."""
    return sorted(
        {k.rsplit(".", 1)[0] for k in il_state
         if k.startswith("net.") and k.endswith(".weight")},
        key=lambda p: int(p.split(".")[1]),
    )


def infer_hidden_dims(il_state: dict) -> list[int]:
    """Hidden-layer widths of the IL policy (every Linear layer except the last)."""
    prefixes = _il_linear_prefixes(il_state)
    return [int(il_state[f"{p}.weight"].shape[0]) for p in prefixes[:-1]]


def il_to_sb3_key_map(il_state: dict) -> dict[str, str]:
    """Map IL Linear prefixes -> SB3 policy prefixes.

    Hidden layers map to ``mlp_extractor.policy_net.{0,2,...}`` and the final
    layer to ``action_net``.
    """
    prefixes = _il_linear_prefixes(il_state)
    if not prefixes:
        return {}
    *hidden, last = prefixes
    mapping = {p: f"mlp_extractor.policy_net.{2 * i}" for i, p in enumerate(hidden)}
    mapping[last] = "action_net"
    return mapping


def copy_weights(src_state: dict, dst_state: dict, key_map: dict[str, str]) -> int:
    """Copy weight+bias from src prefixes to dst prefixes where shapes match.

    Mutates ``dst_state`` in place and returns the number of tensors copied.
    """
    copied = 0
    for src_prefix, dst_prefix in key_map.items():
        for suffix in ("weight", "bias"):
            sk, dk = f"{src_prefix}.{suffix}", f"{dst_prefix}.{suffix}"
            if sk in src_state and dk in dst_state and src_state[sk].shape == dst_state[dk].shape:
                dst_state[dk] = src_state[sk].clone()
                copied += 1
    return copied
