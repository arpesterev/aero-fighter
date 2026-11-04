#include "../native/include/aero_scene.h"
#include <cassert>
#include <iostream>
int main(){
  aero::Scene s;
  for(int i=0;i<1000;i++)s.update(.05f);
  assert(s.mode==aero::Mode::Quiet && s.tracers.empty());
  assert(s.apply({1,aero::Mode::Contact,3}));
  for(int i=0;i<2000;i++)s.update(.05f);
  assert(s.mode==aero::Mode::Contact && s.contacts.size()==3 && s.tracers.empty());
  assert(s.apply({2,aero::Mode::Heavy,4}));
  size_t total=0;
  for(int i=0;i<10000;i++){s.update(.05f);total+=s.tracers.size();assert(s.tracers.size()<761);assert(s.sparks.size()<101);}
  assert(total>5000 && s.mode==aero::Mode::Heavy && s.contacts.size()==4);
  assert(!s.apply({1,aero::Mode::Quiet,1}));
  assert(s.mode==aero::Mode::Heavy);
  assert(s.apply({3,aero::Mode::Quiet,1}));
  for(int i=0;i<500;i++)s.update(.05f);
  assert(s.mode==aero::Mode::Quiet && s.contacts.empty() && s.tracers.empty());
  assert(!s.apply({2,aero::Mode::Heavy,2}));
  std::cout<<"native scene tests passed\n";
}
