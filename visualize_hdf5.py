"""synthetic_v1.hdf5 시각화 — HTML 리포트 생성"""
import sys
sys.stdout.reconfigure(encoding="utf-8")

import h5py
import numpy as np
import base64
import io
from pathlib import Path
from PIL import Image

PATH = Path(r"C:\Users\ASUS\OneDrive\Desktop\PhysicalAI\outputs\dataset\synthetic_v1.hdf5")
OUT  = Path(r"C:\Users\ASUS\OneDrive\Desktop\PhysicalAI\hdf5_preview.html")

with h5py.File(PATH, "r") as f:
    rgb        = f["rgb"]        # (10000, 224, 224, 3)
    reward     = f["reward"][:]  # (10000,)
    action     = f["action"][:]  # (10000, 10)
    joint_state= f["joint_state"][:]  # (10000, 7)

N = len(reward)
print(f"총 프레임: {N:,}")
print(f"Reward  — min:{reward.min():.4f}  max:{reward.max():.4f}  mean:{reward.mean():.4f}")
print(f"Action  — shape:{action.shape}")
print(f"Joint   — shape:{joint_state.shape}")

# ── 샘플 프레임 24장 (균등 추출) ──────────────────────────────
SAMPLES = 24
idxs = np.linspace(0, N - 1, SAMPLES, dtype=int)

def frame_to_b64(arr):
    img = Image.fromarray(arr.astype(np.uint8))
    img = img.resize((160, 160))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80)
    return base64.b64encode(buf.getvalue()).decode()

with h5py.File(PATH, "r") as f:
    frames_b64 = [frame_to_b64(f["rgb"][i]) for i in idxs]

print("프레임 추출 완료")

# ── SVG 차트 (reward, action, joint) ─────────────────────────
def svg_line(values, color, label, width=700, height=120):
    v = np.array(values, dtype=float)
    # downsample to 500 pts
    if len(v) > 500:
        v = v[np.linspace(0, len(v)-1, 500, dtype=int)]
    mn, mx = v.min(), v.max()
    rng = mx - mn if mx != mn else 1.0
    pts = []
    for i, val in enumerate(v):
        x = i / (len(v) - 1) * (width - 40) + 20
        y = height - 20 - ((val - mn) / rng) * (height - 40)
        pts.append(f"{x:.1f},{y:.1f}")
    path = "M " + " L ".join(pts)
    return f"""
<svg width="{width}" height="{height}" style="display:block;overflow:visible">
  <text x="10" y="12" font-size="11" fill="#64748b" font-family="monospace">{label}</text>
  <text x="{width-10}" y="12" font-size="10" fill="{color}" text-anchor="end" font-family="monospace">
    min:{mn:.3f}  max:{mx:.3f}  mean:{v.mean():.3f}
  </text>
  <rect x="20" y="18" width="{width-40}" height="{height-38}" fill="#0d1117" rx="4"/>
  <path d="{path}" fill="none" stroke="{color}" stroke-width="1.5" opacity="0.9"/>
</svg>"""

reward_svg = svg_line(reward, "#76b900", "Reward")
action_svgs = "".join(
    svg_line(action[:, i], f"hsl({i*36},70%,60%)", f"Action[{i}]", height=80)
    for i in range(action.shape[1])
)
joint_svgs = "".join(
    svg_line(joint_state[:, i], f"hsl({i*51+180},70%,60%)", f"Joint[{i}]", height=80)
    for i in range(joint_state.shape[1])
)

# ── HTML 생성 ─────────────────────────────────────────────────
frame_html = "\n".join(
    f'<div style="text-align:center">'
    f'<img src="data:image/jpeg;base64,{b64}" style="width:160px;height:160px;border-radius:6px;border:1px solid #1e2330"/>'
    f'<p style="font-size:10px;color:#64748b;margin:2px 0">frame {idx:,}</p>'
    f'</div>'
    for b64, idx in zip(frames_b64, idxs)
)

html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>synthetic_v1.hdf5 — PhysicalAI</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ background: #0a0c10; color: #cbd5e1; font-family: -apple-system, sans-serif; padding: 32px; }}
  h1 {{ font-size: 1.4rem; font-weight: 900; color: #76b900; margin-bottom: 4px; }}
  h2 {{ font-size: .85rem; font-weight: 700; color: #94a3b8; text-transform: uppercase;
        letter-spacing: .1em; margin: 28px 0 12px; border-bottom: 1px solid #1e2330; padding-bottom: 6px; }}
  .meta {{ display: flex; gap: 20px; flex-wrap: wrap; margin: 12px 0 24px; }}
  .chip {{ background: #111318; border: 1px solid #1e2330; border-radius: 8px;
           padding: 8px 16px; font-size: .75rem; }}
  .chip span {{ color: #76b900; font-weight: 700; font-size: 1.1rem; display: block; }}
  .frames {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(164px, 1fr)); gap: 10px; }}
  .chart-box {{ background: #111318; border: 1px solid #1e2330; border-radius: 10px; padding: 14px; margin-bottom: 10px; }}
</style>
</head>
<body>
<h1>synthetic_v1.hdf5</h1>
<p style="font-size:.8rem;color:#475569">PhysicalAI · OVRTX Synthetic Dataset · outputs/dataset/</p>

<div class="meta">
  <div class="chip"><span>{N:,}</span>총 프레임</div>
  <div class="chip"><span>224×224</span>RGB 해상도</div>
  <div class="chip"><span>{action.shape[1]}</span>Action Dim</div>
  <div class="chip"><span>{joint_state.shape[1]}</span>Joint DOF</div>
  <div class="chip"><span>{reward.mean():.4f}</span>평균 리워드</div>
  <div class="chip"><span>{PATH.stat().st_size / 1e9:.2f} GB</span>파일 크기</div>
</div>

<h2>RGB 프레임 샘플 ({SAMPLES}장 균등 추출)</h2>
<div class="frames">{frame_html}</div>

<h2>Reward 곡선</h2>
<div class="chart-box">{reward_svg}</div>

<h2>Action 궤적 (10 DOF)</h2>
<div class="chart-box">{action_svgs}</div>

<h2>Joint State 궤적 (7 DOF)</h2>
<div class="chart-box">{joint_svgs}</div>

</body></html>"""

OUT.write_text(html, encoding="utf-8")
print(f"저장 완료: {OUT}")

import webbrowser
webbrowser.open(OUT.as_uri())
