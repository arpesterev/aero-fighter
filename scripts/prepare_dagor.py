#!/usr/bin/env python3
"""Idempotently integrate Aero Fighter into pinned Dagor skiesSample.

Works on engine/dagor checkout. Refuses unfamiliar upstream layouts rather
than silently generating broken code. The submodule becomes dirty by design.
"""
from pathlib import Path
import argparse
import shutil

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'engine' / 'dagor' / 'samples' / 'skiesSample' / 'prog'

def replace_one(source, old, new):
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'expected one insertion site, got {count}: {old[:110]!r}')
    return source.replace(old, new, 1)

def patch(text):
    if '#include "aero_fighter_overlay.h"' in text:
        for marker in ('aero::update_native(', 'aero::render_scene(', 'aero::local_sky_time('):
            if marker not in text:
                raise RuntimeError(f'partial Dagor patch detected: missing {marker}')
        return text
    text = replace_one(text, '#include "test_main.h"\n',
        '#include "test_main.h"\n#include "aero_fighter_overlay.h"\n')
    text = replace_one(text, '    webui::update();\n',
        '    webui::update();\n    aero::update_native(::dagor_game_act_time);\n')
    text = replace_one(text, '    setDirToSun();\n    curCamera->setView();\n',
        '    aero::local_sky_time(sun_panel);\n    setDirToSun();\n    curCamera->setView();\n')
    text = replace_one(text, '    d3d::set_render_target();\n\n    de3_imgui_render();\n',
        '    d3d::set_render_target();\n    curCamera->setView();\n'
        '    TMatrix aero_camera_tm;\n    curCamera->getInvViewMatrix(aero_camera_tm);\n'
        '    aero::render_scene(aero_camera_tm);\n'
        '    // Native cinematic view: hide upstream debug sliders.\n')
    text = replace_one(text, '  void renderGui()\n  {\n',
        '  void renderGui()\n  {\n    return; // Aero Fighter: dedicated observation screen.\n')
    return text

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true',
                    help='test insertion points against upstream source')
    args = ap.parse_args()
    source = TARGET / 'test_app.cpp'
    if not source.is_file():
        raise SystemExit('Missing Dagor skiesSample. Run: git submodule update --init --recursive')
    original = source.read_text(encoding='utf8')
    changed = patch(original)
    if args.check:
        print('All Dagor injection points verified')
        return
    if changed != original:
        backup = TARGET / 'test_app.aero-original.cpp.txt'
        if not backup.exists():
            backup.write_text(original, encoding='utf8')
        source.write_text(changed, encoding='utf8')
    shutil.copy2(ROOT / 'native' / 'dagor' / 'aero_fighter_overlay.h',
                 TARGET / 'aero_fighter_overlay.h')
    shutil.copy2(ROOT / 'native' / 'include' / 'aero_scene.h',
                 TARGET / 'aero_scene.h')
    print('Dagor skiesSample integrated. Source is modified inside the submodule.')

if __name__ == '__main__':
    main()
