"""Hand-authored dance choreography for the Unitree G1 (29-DOF) rig.

Produces a looping, beat-synced joint trajectory in the `g1_29dof` layout that
the Simulation page's G1 model plays back (dashboard/src/sim/models.tsx):

  joint_state[N, 29]  joint angles (rad), order = G1_JOINTS
  root[N, 4]          pelvis offset (x, dy, z) in m and yaw in rad

Axis convention (shared with the rig; forward = +z, left = +x, up = +y):
  *_pitch / knee / elbow -> rotation about x, positive swings the limb backward
                            (so knee/elbow flexion is +knee / -elbow)
  *_roll                 -> rotation about z, positive moves the limb toward +x
  *_yaw, wrist_roll      -> rotation about the limb's long axis (y)
  wrist_yaw              -> rotation about z

Feet are kept flat (ankle compensates hip+knee) and the pelvis height follows
the supporting leg, so the stance foot stays on the floor while knees bend.
No external motion data is used.
"""
import numpy as np

FPS = 30
BPM = 120
BEATS = 34                      # 17 s, loops seamlessly back to beat 0

G1_JOINTS = [
    "l_hip_pitch", "l_hip_roll", "l_hip_yaw", "l_knee", "l_ankle_pitch", "l_ankle_roll",
    "r_hip_pitch", "r_hip_roll", "r_hip_yaw", "r_knee", "r_ankle_pitch", "r_ankle_roll",
    "waist_yaw", "waist_roll", "waist_pitch",
    "l_shoulder_pitch", "l_shoulder_roll", "l_shoulder_yaw", "l_elbow",
    "l_wrist_roll", "l_wrist_pitch", "l_wrist_yaw",
    "r_shoulder_pitch", "r_shoulder_roll", "r_shoulder_yaw", "r_elbow",
    "r_wrist_roll", "r_wrist_pitch", "r_wrist_yaw",
]
IDX = {n: i for i, n in enumerate(G1_JOINTS)}

# rig leg geometry (models.tsx G1Leg): hip pivot 0.07 below pelvis origin,
# thigh 0.40, shank to ankle 0.39, ankle to sole 0.055
HIP_DROP, THIGH, SHANK, SOLE = 0.07, 0.40, 0.39, 0.055
STAND = HIP_DROP + THIGH + SHANK + SOLE


def _smooth(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


def _window(b, start, end, fade=1.0):
    """Section weight; fades are centred on the boundaries so neighbouring
    sections cross-fade (both 0.5 exactly at the boundary)."""
    return _smooth((b - start) / fade + 0.5) * _smooth((end - b) / fade + 0.5)


def _pose():
    return {n: 0.0 for n in G1_JOINTS}


def _bounce(p, b, depth=1.0):
    """Knee bounce on every beat (deepest mid-beat), hips counter-flex."""
    d = depth * (0.5 - 0.5 * np.cos(2 * np.pi * b))
    for s in "lr":
        p[f"{s}_knee"] += 0.15 + 0.35 * d
        p[f"{s}_hip_pitch"] -= 0.45 * (0.15 + 0.35 * d)


def _groove(b):
    p = _pose()
    _bounce(p, b)
    sw = np.sin(np.pi * b)
    p["waist_yaw"] = 0.3 * sw
    p["waist_roll"] = 0.08 * sw
    p["l_shoulder_pitch"] = -0.4 + 0.5 * sw
    p["r_shoulder_pitch"] = -0.4 - 0.5 * sw
    p["l_shoulder_roll"], p["r_shoulder_roll"] = 0.2, -0.2
    p["l_elbow"] = p["r_elbow"] = -1.2
    return p


def _wave(b):
    """Arms out to the sides, an elbow/wrist wave travelling left -> right."""
    p = _pose()
    _bounce(p, b, 0.6)
    p["l_shoulder_roll"], p["r_shoulder_roll"] = 1.35, -1.35
    p["l_shoulder_yaw"], p["r_shoulder_yaw"] = 1.57, -1.57   # turn elbow hinge vertical
    ph = np.pi * b
    p["l_elbow"] = -0.5 - 0.5 * np.sin(ph)
    p["l_wrist_pitch"] = 0.6 * np.sin(ph - 0.8)
    p["r_elbow"] = -0.5 - 0.5 * np.sin(ph - 1.6)
    p["r_wrist_pitch"] = 0.6 * np.sin(ph - 2.4)
    p["waist_roll"] = 0.15 * np.sin(np.pi * b / 2)
    return p


def _step_kick(b):
    """Side weight shift, knee lift on the unweighted leg, cross punch."""
    p = _pose()
    _bounce(p, b, 0.4)
    lean = np.sin(np.pi * b / 2)                 # +1 at beat 1 (weight right)
    p["l_hip_roll"] = p["r_hip_roll"] = 0.12 * lean
    beat = int(np.floor(b)) % 4
    e = np.sin(np.pi * (b - np.floor(b)))        # 0 -> 1 -> 0 within the beat
    lift, punch = ("l", "r") if beat == 1 else ("r", "l") if beat == 3 else (None, None)
    for s in "lr":
        p[f"{s}_shoulder_pitch"] = -0.3
        p[f"{s}_elbow"] = -1.6
    p["l_shoulder_roll"], p["r_shoulder_roll"] = 0.15, -0.15
    if lift:
        p[f"{lift}_hip_pitch"] -= 1.1 * e
        p[f"{lift}_knee"] += 1.6 * e
        p[f"{punch}_shoulder_pitch"] = -0.3 - 1.2 * e
        p[f"{punch}_elbow"] = -1.6 + 1.4 * e
        p["waist_yaw"] = (0.35 if punch == "l" else -0.35) * e
    return p


def _spin(b):
    p = _pose()
    _bounce(p, b, 0.5)
    rise = _smooth((b - 28) / 2)                 # arms open up after the turn
    for s, sign in (("l", 1), ("r", -1)):
        p[f"{s}_shoulder_pitch"] = -0.6 - 1.2 * rise
        p[f"{s}_shoulder_roll"] = sign * (0.3 + 0.4 * rise)
        p[f"{s}_elbow"] = -1.4 * (1 - rise)
    return p


def _final(b):
    p = _pose()
    for s, sign in (("l", 1), ("r", -1)):
        p[f"{s}_knee"] = 0.25
        p[f"{s}_hip_pitch"] = -0.1
        p[f"{s}_shoulder_pitch"] = -2.7
        p[f"{s}_shoulder_roll"] = sign * 0.5
        p[f"{s}_wrist_pitch"] = -0.3
    return p


SECTIONS = [  # (pose fn, start beat, end beat, cross-fade beats)
    (_groove, -2, 8, 1.0), (_wave, 8, 16, 1.0), (_step_kick, 16, 24, 1.0),
    (_spin, 24, 30, 1.0), (_final, 30, 33, 2.0), (_groove, 33, 36, 2.0),
]


def _leg_drop(p, s):
    """Vertical distance from pelvis origin to the sole, foot kept flat."""
    h, k, r = p[f"{s}_hip_pitch"], p[f"{s}_knee"], p[f"{s}_hip_roll"]
    return HIP_DROP + np.cos(r) * (THIGH * np.cos(h) + SHANK * np.cos(h + k)) + SOLE


def generate():
    """Return (joint_state[N,29], root[N,4]) for one full loop."""
    n = int(round(BEATS * 60 / BPM * FPS))
    joints = np.zeros((n, len(G1_JOINTS)), np.float32)
    root = np.zeros((n, 4), np.float32)
    for i in range(n):
        b = i / FPS * BPM / 60
        acc, wsum = _pose(), 0.0
        for fn, start, end, fade in SECTIONS:
            w = float(_window(b, start, end, fade))
            if w <= 0:
                continue
            q = fn(b)
            for k in acc:
                acc[k] += w * q[k]
            wsum += w
        p = {k: v / wsum for k, v in acc.items()}
        for s in "lr":   # flat feet: ankle cancels hip pitch + knee, and hip roll
            p[f"{s}_ankle_pitch"] = -(p[f"{s}_hip_pitch"] + p[f"{s}_knee"])
            p[f"{s}_ankle_roll"] = -p[f"{s}_hip_roll"]
        joints[i] = [p[n_] for n_ in G1_JOINTS]
        drop = max(_leg_drop(p, "l"), _leg_drop(p, "r"))   # stance leg carries the body
        roll = p["l_hip_roll"]
        x = -drop * np.sin(roll)                            # keep the planted foot in place
        yaw = 2 * np.pi * _smooth((b - 24) / 4)             # one full turn on beats 24-28
        root[i] = [x, drop - STAND, 0.0, yaw]
    return joints, root
