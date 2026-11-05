#include "../native/include/aero_scene.h"
#include <cassert>
#include <cmath>
#include <iostream>

static void tick(aero::Scene& s,int frames,float dt=.05f){
  for(int n=0;n<frames;n++){
    s.update(dt);
    assert(s.tracers.size()<=aero::Scene::MaxTracers);
    assert(s.sparks.size()<=aero::Scene::MaxSparks);
    assert(s.smoke.size()<=aero::Scene::MaxSmoke);
    assert(s.flashes.size()<=aero::Scene::MaxFlashes);
    assert(s.bursts.size()<=aero::Scene::MaxBursts);
  }
}
int main(){
  using namespace aero;
  Scene s;
  tick(s,200);
  assert(s.mode==Mode::Quiet);
  assert(s.contacts.empty() && s.tracers.empty() && s.smoke.empty());

  assert(s.apply({1,Mode::Contact,3}));
  tick(s,2200); // Contact-only can remain for minutes without self-clear.
  assert(s.mode==Mode::Contact && s.contacts.size()==3);
  assert(s.tracers.empty() && s.flashes.empty());

  assert(s.apply({2,Mode::Heavy,4}));
  std::size_t totalTracers=0,totalSmoke=0,totalBursts=0,totalFlashes=0;
  for(int i=0;i<18000;i++){
    tick(s,1);
    totalTracers+=s.tracers.size();
    totalSmoke+=s.smoke.size();
    totalBursts+=s.bursts.size();
    totalFlashes+=s.flashes.size();
    assert(s.mode==Mode::Heavy);
  }
  assert(totalTracers>8000); // The simulated fire continues for 15 minutes.
  assert(totalSmoke>1000 && totalBursts>100 && totalFlashes>1000);
  assert(s.contacts.size()==4 && s.active_sites()==5);

  assert(!s.apply({1,Mode::Quiet,1})); // stale clear must not stop the scene
  assert(s.mode==Mode::Heavy);
  assert(!s.apply({3,Mode::Heavy,9})); // malformed count rejected
  assert(s.mode==Mode::Heavy);

  assert(s.apply({3,Mode::Light,2}));
  assert(s.active_sites()==2 && s.contacts.size()==2);
  std::size_t lightTraces=0;
  for(int i=0;i<1000;i++){tick(s,1);lightTraces+=s.tracers.size();}
  assert(s.mode==Mode::Light && lightTraces>30);

  assert(s.apply({4,Mode::Quiet,1})); // only external clear ends combat
  assert(s.mode==Mode::Quiet && s.active_sites()==0 && s.contacts.empty());
  assert(s.tracers.empty() && s.flashes.empty());
  tick(s,350);
  assert(s.smoke.empty() && s.sparks.empty() && s.bursts.empty());
  assert(!s.apply({3,Mode::Heavy,5}));
  assert(s.mode==Mode::Quiet);

  s.update(0);s.update(-4.f);s.update(std::nanf(""));
  assert(std::isfinite(s.elapsed));
  std::cout<<"scene / persistent clear / VFX memory cap tests passed\n";
}
