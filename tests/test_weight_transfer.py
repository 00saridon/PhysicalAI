import torch
import torch.nn as nn
import gymnasium as gym
from stable_baselines3 import PPO

from trainer.il.policy import MLPPolicy
from trainer.weight_transfer import (
    infer_hidden_dims,
    il_to_sb3_key_map,
    copy_weights,
)


def test_infer_hidden_dims_and_key_map():
    il = MLPPolicy(obs_dim=14, action_dim=10, hidden_dim=256)
    state = il.state_dict()
    assert infer_hidden_dims(state) == [256, 256]
    assert il_to_sb3_key_map(state) == {
        "net.0": "mlp_extractor.policy_net.0",
        "net.2": "mlp_extractor.policy_net.2",
        "net.4": "action_net",
    }


def test_il_to_sb3_transfer_roundtrip():
    env = gym.make("Pendulum-v1")  # Box obs(3) / Box action(1)
    obs_dim = env.observation_space.shape[0]
    action_dim = env.action_space.shape[0]

    il = MLPPolicy(obs_dim=obs_dim, action_dim=action_dim, hidden_dim=32)
    il_state = il.state_dict()

    hidden = infer_hidden_dims(il_state)
    model = PPO(
        "MlpPolicy", env, n_steps=64, batch_size=32,
        policy_kwargs=dict(net_arch=dict(pi=hidden, vf=hidden), activation_fn=nn.ReLU),
        verbose=0,
    )

    # IL -> SB3: 3 layers x (weight + bias) = 6 tensors
    sb3_state = model.policy.state_dict()
    n = copy_weights(il_state, sb3_state, il_to_sb3_key_map(il_state))
    assert n == 6
    assert torch.equal(sb3_state["mlp_extractor.policy_net.0.weight"], il_state["net.0.weight"])
    assert torch.equal(sb3_state["action_net.weight"], il_state["net.4.weight"])
    model.policy.load_state_dict(sb3_state, strict=False)

    # SB3 -> MLP (export direction): reverse map must round-trip the values back
    out = MLPPolicy(obs_dim=obs_dim, action_dim=action_dim, hidden_dim=hidden[0])
    out_state = out.state_dict()
    rev = {v: k for k, v in il_to_sb3_key_map(out_state).items()}
    m = copy_weights(model.policy.state_dict(), out_state, rev)
    assert m == 6
    assert torch.equal(out_state["net.0.weight"], il_state["net.0.weight"])
    assert torch.equal(out_state["net.4.weight"], il_state["net.4.weight"])
