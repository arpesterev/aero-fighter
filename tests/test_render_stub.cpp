// Compile native overlay with signatures from Dagor's documented debug3d API.
// This catches errors in our renderer even when macOS Metal SDK is unavailable.
#include "../native/dagor/aero_fighter_overlay.h"
#include <cassert>
#include <iostream>
int main(){
  TMatrix m;
  aero::Scene &s=aero::runtime();
  s.apply({1,aero::Mode::Heavy,4});
  for(int i=0;i<250;i++)s.update(.05f);
  aero::render_scene(m);
  assert(s.smoke.size()>0);
  assert(s.tracers.size()>0);
  s.apply({2,aero::Mode::Quiet,1});
  aero::render_scene(m);
  std::cout<<"Dagor adapter stub compilation/execution passed\n";
}
