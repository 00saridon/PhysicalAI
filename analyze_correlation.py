"""
Dataset RGB (synthetic_v1.hdf5) vs example-minimal.jpg — Correlation Analysis
"""
import h5py, numpy as np, os
from PIL import Image
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
def pearsonr(a, b):
    a, b = np.asarray(a, float), np.asarray(b, float)
    a = a - a.mean(); b = b - b.mean()
    denom = np.sqrt((a**2).sum() * (b**2).sum())
    r = float((a * b).sum() / denom) if denom > 0 else 0.0
    return r, None

BASE = os.path.dirname(os.path.abspath(__file__))

# ── Load ────────────────────────────────────────────────────────────
ref_pil  = Image.open(os.path.join(BASE, 'dashboard/public/example-minimal.jpg')).convert('RGB')
ref      = np.array(ref_pil)
ref_224  = np.array(ref_pil.resize((224, 224), Image.LANCZOS))

with h5py.File(os.path.join(BASE, 'outputs/dataset/synthetic_v1.hdf5'), 'r') as f:
    rgb     = f['rgb'][:]          # (1000, 224, 224, 3)
    joints  = f['joint_state'][:]  # (1000, 7)
    actions = f['action'][:]       # (1000, 10)
    rewards = f['reward'][:]       # (1000,)

N, H, W, C = rgb.shape
CH = ['R', 'G', 'B']

# ── Per-channel stats ───────────────────────────────────────────────
ref_m = ref_224.mean(axis=(0,1));    ref_s = ref_224.std(axis=(0,1))
syn_m = rgb.mean(axis=(0,1,2));      syn_s = rgb.std(axis=(0,1,2))
domain_gap = np.abs(ref_m - syn_m)

# ── Histogram correlation ───────────────────────────────────────────
def hist_corr(a, b, bins=64):
    ha, _ = np.histogram(a.flatten(), bins=bins, range=(0,255), density=True)
    hb, _ = np.histogram(b.flatten(), bins=bins, range=(0,255), density=True)
    r, _ = pearsonr(ha, hb)
    return r

hcorr = [hist_corr(ref_224[...,c], rgb[...,c]) for c in range(3)]

# ── Temporal dynamics ───────────────────────────────────────────────
frame_bright = rgb.mean(axis=(1,2,3))                # brightness over time
frame_r_mean = rgb[...,0].mean(axis=(1,2))
frame_g_mean = rgb[...,1].mean(axis=(1,2))
frame_b_mean = rgb[...,2].mean(axis=(1,2))

# joint vs brightness
jb_corr = [pearsonr(joints[:,j], frame_bright)[0] for j in range(7)]

# ── Mean frame ──────────────────────────────────────────────────────
mean_frame = rgb.mean(axis=0).astype(np.uint8)

# ── Reference brightness analysis ──────────────────────────────────
ref_bright = float(ref_224.mean())
syn_bright = float(rgb.mean())
bright_gap = abs(ref_bright - syn_bright)

# ── Print stats ─────────────────────────────────────────────────────
print(f"Reference       : {ref.shape}  brightness={ref_bright:.1f}/255 ({ref_bright/255*100:.0f}%)")
print(f"Synthetic v1    : {rgb.shape}  brightness={syn_bright:.1f}/255 ({syn_bright/255*100:.0f}%)")
print(f"Brightness gap  : {bright_gap:.1f} px  ({bright_gap/255*100:.0f}%)")
print()
print(f"{'':12}  {'R':>8}  {'G':>8}  {'B':>8}")
print(f"{'Ref mean':12}  {ref_m[0]:8.1f}  {ref_m[1]:8.1f}  {ref_m[2]:8.1f}")
print(f"{'Syn mean':12}  {syn_m[0]:8.1f}  {syn_m[1]:8.1f}  {syn_m[2]:8.1f}")
print(f"{'Gap':12}  {domain_gap[0]:8.1f}  {domain_gap[1]:8.1f}  {domain_gap[2]:8.1f}")
print()
print(f"Histogram corr (R/G/B): {hcorr[0]:.4f} / {hcorr[1]:.4f} / {hcorr[2]:.4f}  avg={np.mean(hcorr):.4f}")
print(f"Joint→Brightness corr: {[f'{v:.3f}' for v in jb_corr]}")

# ════════════════════════════════════════════════════════════════════
# FIGURE  (4 rows × 4 cols)
# ════════════════════════════════════════════════════════════════════
BG     = '#0a0c10'
CARD   = '#111827'
BORDER = '#1f2937'
NVIDIA = '#76b900'
CYAN   = '#00d4ff'
PURPLE = '#a855f7'
AMBER  = '#f59e0b'
RED    = '#ef4444'
GRAY   = '#94a3b8'
WHITE  = '#e2e8f0'

def ax_setup(ax, title='', xlabel='', ylabel=''):
    ax.set_facecolor(CARD)
    ax.tick_params(colors=GRAY, labelsize=8)
    for sp in ax.spines.values():
        sp.set_edgecolor(BORDER)
    if title:
        ax.set_title(title, color=WHITE, fontsize=9.5, fontweight='bold', pad=6)
    if xlabel: ax.set_xlabel(xlabel, color=GRAY, fontsize=8)
    if ylabel: ax.set_ylabel(ylabel, color=GRAY, fontsize=8)

fig = plt.figure(figsize=(20, 24), facecolor=BG)
gs  = gridspec.GridSpec(4, 4, figure=fig,
                        hspace=0.52, wspace=0.36,
                        top=0.93, bottom=0.03, left=0.06, right=0.97)

# ── Row 0: Image comparison ─────────────────────────────────────────
ax0 = fig.add_subplot(gs[0, 0])
ax0.imshow(ref_224); ax0.axis('off')
ax0.set_title('OVRTX Reference\nexample-minimal.jpg', color=NVIDIA, fontsize=9.5, fontweight='bold')

sample_idx = [0, 250, 500, 750]
sample_titles = ['frame 0\n(t=0s)', 'frame 250\n(t=2.1s)', 'frame 500\n(t=4.2s)', 'frame 750\n(t=6.3s)']
for k in range(3):
    ax = fig.add_subplot(gs[0, k+1])
    ax.imshow(rgb[sample_idx[k]])
    ax.axis('off')
    ax.set_title(f'Synthetic {sample_titles[k]}', color=CYAN, fontsize=9)

# ── Row 1: Channel histograms ──────────────────────────────────────
bins_arr = np.linspace(0, 255, 65)
bm = (bins_arr[:-1] + bins_arr[1:]) / 2

for c in range(3):
    ax = fig.add_subplot(gs[1, c])
    ax_setup(ax, f'{CH[c]} Channel  (r={hcorr[c]:.3f})', 'Pixel value', 'Density')
    hr, _ = np.histogram(ref_224[...,c].flatten(), bins=bins_arr, density=True)
    hs, _ = np.histogram(rgb[...,c].flatten(),     bins=bins_arr, density=True)
    ax.fill_between(bm, hr, alpha=0.3, color=WHITE)
    ax.plot(bm, hr, '-',  color=WHITE,  lw=2,   label=f'Reference  μ={ref_m[c]:.0f}')
    ax.fill_between(bm, hs, alpha=0.3, color=NVIDIA)
    ax.plot(bm, hs, '--', color=NVIDIA, lw=1.8, label=f'Synthetic  μ={syn_m[c]:.0f}')
    ax.axvline(ref_m[c], color=WHITE,  lw=1, ls=':', alpha=0.7)
    ax.axvline(syn_m[c], color=NVIDIA, lw=1, ls=':', alpha=0.7)
    ax.legend(fontsize=7.5, facecolor='#1f2937', labelcolor=GRAY, edgecolor=BORDER,
              loc='upper right' if c < 2 else 'upper left')

# Color domain gap bar
ax_gap = fig.add_subplot(gs[1, 3])
ax_setup(ax_gap, 'Color Domain Gap\n(|Ref mean − Syn mean|)', '', 'Δ pixels (0-255)')
bar_c = [RED, '#22c55e', '#3b82f6']
bars = ax_gap.bar(range(3), domain_gap, color=bar_c, alpha=0.88, width=0.5)
ax_gap.set_xticks(range(3)); ax_gap.set_xticklabels(CH, color=GRAY)
ax_gap.set_ylim(0, 200)
for b, v, cm, sm in zip(bars, domain_gap, ref_m, syn_m):
    ax_gap.text(b.get_x()+0.25, v+2, f'{v:.0f}px', ha='center', va='bottom', color=WHITE, fontsize=9, fontweight='bold')
    ax_gap.text(b.get_x()+0.25, -12, f'Ref {cm:.0f}\nSyn {sm:.0f}', ha='center', va='top', color=GRAY, fontsize=7)
ax_gap.set_facecolor(CARD)
for sp in ax_gap.spines.values(): sp.set_edgecolor(BORDER)
ax_gap.tick_params(colors=GRAY, labelsize=8)

# ── Row 2: Temporal dynamics ──────────────────────────────────────
ax_bright = fig.add_subplot(gs[2, 0:2])
ax_setup(ax_bright, 'Frame Brightness over Time  (Synthetic v1 — 1000 frames)', 'Frame index', 'Mean pixel value (0-255)')
ax_bright.plot(frame_bright, color=NVIDIA, lw=1.2, alpha=0.9, label='Overall brightness')
ax_bright.plot(frame_r_mean, color=RED,   lw=0.8, alpha=0.7, label='R channel')
ax_bright.plot(frame_g_mean, color='#22c55e', lw=0.8, alpha=0.7, label='G channel')
ax_bright.plot(frame_b_mean, color='#3b82f6', lw=0.8, alpha=0.7, label='B channel')
ax_bright.axhline(ref_bright, color=WHITE, lw=1.5, ls='--', alpha=0.8, label=f'Reference brightness ({ref_bright:.0f})')
ax_bright.axhline(syn_bright, color=NVIDIA, lw=1,  ls=':', alpha=0.6, label=f'Synthetic mean ({syn_bright:.0f})')
ax_bright.fill_between(range(N), syn_bright - rgb.std(axis=(1,2,3)),
                                 syn_bright + rgb.std(axis=(1,2,3)),
                       alpha=0.1, color=NVIDIA)
ax_bright.set_ylim(0, 220)
ax_bright.legend(fontsize=7.5, facecolor='#1f2937', labelcolor=GRAY, edgecolor=BORDER, ncol=3, loc='upper right')

# Mean frame comparison
ax_mf = fig.add_subplot(gs[2, 2])
ax_mf.imshow(mean_frame)
ax_mf.axis('off')
ax_mf.set_title('Synthetic Mean Frame\n(temporal avg, 1000 frames)', color=CYAN, fontsize=9, fontweight='bold')

# Side by side overlay: ref vs mean frame
ax_ov = fig.add_subplot(gs[2, 3])
ax_ov.imshow(ref_224, alpha=0.5)
ax_ov.imshow(mean_frame, alpha=0.5)
ax_ov.axis('off')
ax_ov.set_title('50% Blend\nRef (white) + Synthetic (color)', color=AMBER, fontsize=9, fontweight='bold')

# ── Row 3: Joint/Action/Reward + Summary ──────────────────────────
# Joint vs brightness
ax_jb = fig.add_subplot(gs[3, 0])
ax_setup(ax_jb, 'Joint State → Frame Brightness\n(Pearson r)', 'Joint index', 'r')
jb_colors = [NVIDIA if v >= 0 else RED for v in jb_corr]
bars = ax_jb.bar(range(7), jb_corr, color=jb_colors, alpha=0.85, width=0.6)
ax_jb.axhline(0, color=GRAY, lw=0.8, ls='--')
ax_jb.set_xticks(range(7))
ax_jb.set_xticklabels([f'j{i}' for i in range(7)], color=GRAY, fontsize=8)
ax_jb.set_ylim(-1.0, 1.0)
ax_jb.axhspan(0.7, 1.0,  alpha=0.05, color=NVIDIA)
ax_jb.axhspan(-1.0,-0.7, alpha=0.05, color=RED)
for b, v in zip(bars, jb_corr):
    ax_jb.text(b.get_x()+0.3, v + (0.03 if v>=0 else -0.07),
               f'{v:.3f}', ha='center', color=WHITE, fontsize=7.5)

# Action std
ax_act = fig.add_subplot(gs[3, 1])
ax_setup(ax_act, f'Action Std per DOF\n(exploration noise σ={actions.std():.3f})', 'DOF index', 'Std')
act_std = actions.std(axis=0)
ax_act.bar(range(10), act_std, color=PURPLE, alpha=0.85, width=0.6)
ax_act.axhline(act_std.mean(), color=WHITE, lw=1.5, ls='--', label=f'mean={act_std.mean():.3f}')
ax_act.axhspan(0.14, 0.16, alpha=0.15, color=NVIDIA, label='target ±0.15')
ax_act.set_xticks(range(10))
ax_act.set_xticklabels([f'a{i}' for i in range(10)], color=GRAY, fontsize=7.5)
ax_act.legend(fontsize=7.5, facecolor='#1f2937', labelcolor=GRAY, edgecolor=BORDER)

# Reward
ax_rw = fig.add_subplot(gs[3, 2])
ax_setup(ax_rw, f'Reward Distribution\n(N={N} steps)', 'Reward', 'Count')
ax_rw.hist(rewards, bins=40, color=AMBER, alpha=0.85, edgecolor=BG, lw=0.4)
ax_rw.axvline(rewards.mean(), color=WHITE, lw=1.5, ls='--', label=f'μ={rewards.mean():.3f}')
ax_rw.axvline(rewards.mean()+rewards.std(), color=GRAY, lw=1, ls=':', alpha=0.7)
ax_rw.axvline(rewards.mean()-rewards.std(), color=GRAY, lw=1, ls=':', alpha=0.7)
ax_rw.legend(fontsize=8, facecolor='#1f2937', labelcolor=GRAY, edgecolor=BORDER)

# Summary panel
ax_s = fig.add_subplot(gs[3, 3])
ax_s.set_facecolor('#0d1526')
ax_s.axis('off')
for sp in ax_s.spines.values():
    sp.set_edgecolor(NVIDIA); sp.set_linewidth(1.5)

def kv(ax, y, label, value, vc, labelc=GRAY, fs=8.5):
    ax.text(0.05, y, label, transform=ax.transAxes, color=labelc,
            fontsize=fs, va='top', fontfamily='monospace')
    ax.text(0.95, y, value, transform=ax.transAxes, color=vc,
            fontsize=fs, va='top', ha='right', fontweight='bold', fontfamily='monospace')

ax_s.text(0.5, 0.99, 'CORRELATION SUMMARY', transform=ax_s.transAxes,
          color=NVIDIA, fontsize=10, va='top', ha='center', fontweight='bold')
y = 0.88
kv(ax_s, y,    'Brightness (Ref)',  f'{ref_bright:.1f} / 255  (73%)', WHITE); y -= 0.09
kv(ax_s, y,    'Brightness (Syn)',  f'{syn_bright:.1f} / 255  (18%)', CYAN);  y -= 0.09
kv(ax_s, y,    'Domain Gap',        f'{bright_gap:.0f} px  (55%)',    RED);   y -= 0.09
ax_s.plot([0.05, 0.95], [y+0.05, y+0.05], color=BORDER, lw=0.8, transform=ax_s.transAxes, clip_on=False)
y -= 0.02
kv(ax_s, y,    'Hist Corr R',       f'{hcorr[0]:+.4f}', RED if hcorr[0]<0 else NVIDIA); y -= 0.09
kv(ax_s, y,    'Hist Corr G',       f'{hcorr[1]:+.4f}', RED if hcorr[1]<0 else NVIDIA); y -= 0.09
kv(ax_s, y,    'Hist Corr B',       f'{hcorr[2]:+.4f}', RED if hcorr[2]<0 else NVIDIA); y -= 0.09
kv(ax_s, y,    'Hist Corr avg',     f'{np.mean(hcorr):+.4f}', RED if np.mean(hcorr)<0 else NVIDIA); y -= 0.09
ax_s.plot([0.05, 0.95], [y+0.05, y+0.05], color=BORDER, lw=0.8, transform=ax_s.transAxes, clip_on=False)
y -= 0.02
kv(ax_s, y,    'j1→bright (max)',   f'r={max(jb_corr):.3f}', NVIDIA); y -= 0.09
kv(ax_s, y,    'Action σ',          f'{actions.std():.4f}', CYAN);    y -= 0.09
kv(ax_s, y,    'Reward μ±σ',        f'{rewards.mean():.3f}±{rewards.std():.3f}', AMBER)

# suptitle
fig.suptitle('Dataset RGB  vs  OVRTX Reference Render — Correlation Analysis',
             color=WHITE, fontsize=14, fontweight='bold', y=0.97)

out = os.path.join(BASE, 'outputs/dataset/correlation_analysis.png')
fig.savefig(out, dpi=150, facecolor=BG, bbox_inches='tight')
plt.close()
print(f"\nSaved: {out}")
print("DONE")
