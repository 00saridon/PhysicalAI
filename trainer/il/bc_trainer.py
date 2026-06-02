import os
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from trainer.il.policy import MLPPolicy
from trainer.il.dataloader import DemoDataset
from pipeline_metrics import emit_metric


class BCTrainer:
    """Behavior Cloning trainer: supervised regression on (obs, action) pairs."""

    def __init__(self, cfg: dict):
        self.cfg = cfg
        os.makedirs(cfg["checkpoint_dir"], exist_ok=True)
        dataset = DemoDataset(cfg["demo_dir"])
        self.loader = DataLoader(dataset, batch_size=cfg["batch_size"], shuffle=True)
        obs_dim = dataset[0][0].shape[0]
        action_dim = dataset[0][1].shape[0]
        self.policy = MLPPolicy(obs_dim=obs_dim, action_dim=action_dim,
                                hidden_dim=cfg["hidden_dim"])
        self.opt = torch.optim.Adam(self.policy.parameters(), lr=cfg["lr"])
        self.loss_fn = nn.MSELoss()
        self._best_loss = float("inf")

    def train(self):
        for epoch in range(self.cfg["epochs"]):
            epoch_loss = self._run_epoch()
            print(f"[IL] Epoch {epoch + 1} loss={epoch_loss:.6f}", flush=True)
            emit_metric(stage="il", step=epoch + 1, loss=round(epoch_loss, 6))
            if epoch_loss < self._best_loss:
                self._best_loss = epoch_loss
                self._save("best.pt")
            if (epoch + 1) % self.cfg["save_every"] == 0:
                self._save(f"epoch_{epoch+1:04d}.pt")

    def _run_epoch(self) -> float:
        total = 0.0
        for obs, action in self.loader:
            self.opt.zero_grad()
            pred = self.policy(obs)
            loss = self.loss_fn(pred, action)
            loss.backward()
            self.opt.step()
            total += loss.item()
        return total / len(self.loader)

    def _save(self, name: str):
        torch.save(self.policy.state_dict(),
                   os.path.join(self.cfg["checkpoint_dir"], name))
