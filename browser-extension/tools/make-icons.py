#!/usr/bin/env python3
"""
生成扩展图标（纯 Python，不依赖 Pillow / GD）

思路：在 4 倍尺寸上做「点是否在图形内」的二值判断，再按 4×4 取平均降采样，
      得到带抗锯齿的 PNG。图形用 SDF（有向距离场）描述：
        · 圆角方块 = 骰子本体
        · 五个小圆  = 骰子点数（5 点面）

用法：python3 tools/make-icons.py
输出：icons/icon16.png  icon32.png  icon48.png  icon128.png
"""
import math
import os
import struct
import zlib

# ---- 配色（与扩展 UI 的蓝一致）----
BG = (52, 152, 219)      # #3498db
PIP = (255, 255, 255)

SS = 4                   # 超采样倍数
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")

# 骰子 5 点面的点位（0~1 归一化坐标）与点数半径
PIPS = [(0.29, 0.29), (0.71, 0.29), (0.50, 0.50), (0.29, 0.71), (0.71, 0.71)]
PIP_R = 0.088


def rounded_rect_sdf(px, py, cx, cy, hw, hh, r):
    """圆角矩形有向距离：<0 在内部"""
    dx = abs(px - cx) - (hw - r)
    dy = abs(py - cy) - (hh - r)
    ax, ay = max(dx, 0.0), max(dy, 0.0)
    return math.hypot(ax, ay) + min(max(dx, dy), 0.0) - r


def render(size):
    """渲染一张 size×size 的 RGBA 像素缓冲（已抗锯齿）"""
    n = size * SS
    # 先把超采样图渲染成布尔覆盖，再降采样
    cover_bg = [[0.0] * size for _ in range(size)]
    cover_pip = [[0.0] * size for _ in range(size)]

    margin = n * 0.045          # 四周留一点点边距
    hw = hh = (n / 2.0) - margin
    radius = n * 0.20           # 圆角
    cx = cy = n / 2.0

    pip_pts = [(px * n, py * n, PIP_R * n) for px, py in PIPS]

    for oy in range(size):
        for ox in range(size):
            bg_hits = 0
            pip_hits = 0
            for sy in range(SS):
                for sx in range(SS):
                    px = ox * SS + sx + 0.5
                    py = oy * SS + sy + 0.5
                    inside = rounded_rect_sdf(px, py, cx, cy, hw, hh, radius) <= 0
                    if inside:
                        bg_hits += 1
                        for qx, qy, qr in pip_pts:
                            if math.hypot(px - qx, py - qy) <= qr:
                                pip_hits += 1
                                break
            total = SS * SS
            cover_bg[oy][ox] = bg_hits / total
            cover_pip[oy][ox] = pip_hits / total

    # 合成 RGBA
    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            a = cover_bg[y][x]
            if a <= 0.0:
                row += bytes((0, 0, 0, 0))
                continue
            p = cover_pip[y][x] / a if a > 0 else 0.0    # 在骰子内部，点数占的比例
            r = BG[0] + (PIP[0] - BG[0]) * p
            g = BG[1] + (PIP[1] - BG[1]) * p
            b = BG[2] + (PIP[2] - BG[2]) * p
            row += bytes((int(round(r)), int(round(g)), int(round(b)), int(round(a * 255))))
        rows.append(bytes(row))
    return rows


def write_png(path, size, rows):
    """写 8 位 RGBA 的 PNG（无 alpha 调色，真彩色+alpha）"""
    raw = bytearray()
    for r in rows:
        raw.append(0)          # filter type 0 (None)
        raw += r

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)   # 8bit, RGBA
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", ihdr)
           + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
           + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)
    return len(png)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for size in (16, 32, 48, 128):
        rows = render(size)
        out = os.path.join(OUT_DIR, "icon%d.png" % size)
        n = write_png(out, size, rows)
        print("  ✔ %-16s %3d×%-3d  %5d 字节" % (os.path.basename(out), size, size, n))


if __name__ == "__main__":
    main()
