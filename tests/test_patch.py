import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from prepare_dagor import patch

class PatchTests(unittest.TestCase):
    def test_expected_hooks_are_idempotent(self):
        example = ('#include "test_main.h"\n'
          'void f(){\n    webui::update();\n'
          '    setDirToSun();\n    curCamera->setView();\n'
          '    d3d::set_render_target();\n\n    de3_imgui_render();\n}\n'
          '  void renderGui()\n  {\n    stuff();\n  }\n')
        changed = patch(example)
        self.assertEqual(changed, patch(changed))
        self.assertIn('aero::update_native', changed)
        self.assertIn('aero::render_scene', changed)
        self.assertIn('aero::local_sky_time', changed)

    def test_rejects_unknown_upstream_code(self):
        with self.assertRaises(RuntimeError):
            patch('#include "test_main.h"\n')

if __name__ == '__main__':
    unittest.main()
