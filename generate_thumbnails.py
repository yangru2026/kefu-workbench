#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量生成花色图片缩略图
- 源目录: images/patterns/
- 目标目录: images/patterns/thumb/
- 缩略图尺寸: 宽度 480px（卡片实际显示 260px，2x 适配高 DPI 屏），保持比例
- 格式: WebP（质量 80），体积比原图小 70-85%
"""
import os
import sys
from pathlib import Path
from PIL import Image

SRC_DIR = Path(__file__).parent / 'images' / 'patterns'
DST_DIR = SRC_DIR / 'thumb'
THUMB_WIDTH = 480
QUALITY = 80

def human_size(n):
    if n < 1024:
        return f"{n}B"
    if n < 1024 * 1024:
        return f"{n/1024:.0f}KB"
    return f"{n/1024/1024:.1f}MB"

def main():
    if not SRC_DIR.exists():
        print(f"[错误] 源目录不存在: {SRC_DIR}")
        sys.exit(1)
    DST_DIR.mkdir(parents=True, exist_ok=True)

    exts = {'.jpg', '.jpeg', '.png', '.webp'}
    files = sorted([f for f in SRC_DIR.iterdir() if f.is_file() and f.suffix.lower() in exts])
    print(f"找到 {len(files)} 张原图")
    print(f"源目录: {SRC_DIR}")
    print(f"目标目录: {DST_DIR}")
    print(f"缩略图宽度: {THUMB_WIDTH}px, 质量: {QUALITY}, 格式: WebP\n")

    total_src = 0
    total_dst = 0
    success = 0
    fail = 0

    for i, src in enumerate(files, 1):
        dst = DST_DIR / (src.stem + '.webp')
        try:
            with Image.open(src) as img:
                # 转换模式（PNG/WebP 可能有 alpha，JPG 转 RGB）
                if img.mode in ('RGBA', 'LA', 'P'):
                    bg = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    bg.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                    img = bg
                elif img.mode != 'RGB':
                    img = img.convert('RGB')

                w, h = img.size
                if w <= THUMB_WIDTH:
                    # 原图比目标还小，直接保存（避免放大模糊）
                    ratio = 1
                else:
                    ratio = THUMB_WIDTH / w
                new_w = int(w * ratio)
                new_h = int(h * ratio)
                img = img.resize((new_w, new_h), Image.LANCZOS)
                img.save(dst, 'WEBP', quality=QUALITY, method=4)

            src_size = src.stat().st_size
            dst_size = dst.stat().st_size
            total_src += src_size
            total_dst += dst_size
            success += 1
            saved = max(0, src_size - dst_size)
            ratio_str = f"-{saved*100//src_size}%" if src_size > 0 else ""
            print(f"  [{i:3d}/{len(files)}] {src.name:50s} {human_size(src_size):>8s} -> {human_size(dst_size):>8s}  {ratio_str}")
        except Exception as e:
            fail += 1
            print(f"  [{i:3d}/{len(files)}] [失败] {src.name}: {e}")

    print(f"\n{'='*70}")
    print(f"完成: 成功 {success} / 失败 {fail}")
    print(f"原图总大小: {human_size(total_src)}")
    print(f"缩略图总大小: {human_size(total_dst)}")
    if total_src > 0:
        print(f"压缩比: {total_dst*100//total_src}% (节省 {human_size(total_src - total_dst)})")
    print(f"平均单张: {human_size(total_dst // max(success, 1))}")
    print(f"{'='*70}")

if __name__ == '__main__':
    main()
