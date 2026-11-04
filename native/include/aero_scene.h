// Aero Fighter: fictional cinematic sky visualization (not a weapons simulator).
// Standard C++17, independent of Dagor, so animation logic can be tested headlessly.
#pragma once
#include <array>
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <string>
#include <vector>

namespace aero {
struct Vec3 {
  float x=0,y=0,z=0;
  Vec3 operator+(Vec3 a) const { return {x+a.x,y+a.y,z+a.z}; }
  Vec3 operator-(Vec3 a) const { return {x-a.x,y-a.y,z-a.z}; }
  Vec3 operator*(float s) const { return {x*s,y*s,z*s}; }
};
inline Vec3 mix(Vec3 a,Vec3 b,float t) {return a*(1-t)+b*t;}
inline float clamp(float x,float a,float b) {return std::max(a,std::min(b,x));}
enum class Mode { Quiet, Contact, Light, Heavy };
inline Mode mode_from_string(const std::string& s) {
  if(s=="contact"||s=="alert") return Mode::Contact;
  if(s=="engage_light"||s=="incoming") return Mode::Light;
  if(s=="engage_heavy"||s=="engage") return Mode::Heavy;
  return Mode::Quiet;
}
struct Signal {std::uint64_t sequence=0; Mode mode=Mode::Quiet; int targets=3;};
struct Contact {Vec3 position; Vec3 velocity; float age=0;};
struct Tracer {Vec3 origin;Vec3 destination; float age=0;float life=.75f;int site=0;};
struct Spark {Vec3 position;float age=0;float life=1;};

class Scene {
  std::uint32_t rng_=0x19760111u;
  std::array<float,5> shot_timer_{};
  float contact_timer_=0;
  float flare_timer_=0;
  float contact_clock_=0;
  std::uint64_t sequence_=0;
  float rand01() {rng_^=rng_<<13;rng_^=rng_>>17;rng_^=rng_<<5;return (rng_&0x00ffffffu)/16777216.f;}
  float between(float lo,float hi){return lo+(hi-lo)*rand01();}
  Vec3 site(int i) const {return {float((i-2)*50),-30,float(-92-(i%2)*17)};}
  void make_contacts(int count) {
    contacts.clear();
    for(int i=0;i<count;i++){
      const float lane=(i-(count-1)*.5f);
      contacts.push_back({{lane*35+between(-12,12),between(47,94),-290-between(0,100)},
                          {between(-1.2f,1.2f),between(-.35f,.2f),between(.4f,1.2f)},0});
    }
  }
  void fire(int index) {
    if(contacts.empty())return;
    const int targetIndex=int(rand01()*contacts.size())%int(contacts.size());
    const Vec3 aim=contacts[targetIndex].position;
    const Vec3 jitter={between(-11,11),between(-8,8),between(-6,6)};
    if(tracers.size()<760)tracers.push_back({site(index),aim+jitter,0,between(.66f,1.07f),index});
    if(rand01()<.12f && sparks.size()<100)sparks.push_back({site(index),0,.13f});
  }
public:
  Mode mode=Mode::Quiet;
  float elapsed=0;
  std::vector<Contact> contacts;
  std::vector<Tracer> tracers;
  std::vector<Spark> sparks;
  bool apply(const Signal& signal) {
    if(signal.sequence==0 || signal.sequence<=sequence_ || signal.targets<1 || signal.targets>6)return false;
    sequence_=signal.sequence;
    mode=signal.mode;
    elapsed=0;contact_clock_=0;contact_timer_=0;flare_timer_=0;
    shot_timer_.fill(0);
    tracers.clear();sparks.clear();contacts.clear();
    if(mode!=Mode::Quiet)make_contacts(signal.targets);
    return true;
  }
  std::uint64_t sequence() const{return sequence_;}
  void update(float dt) {
    if(!(dt>0))return;
    dt=std::min(dt,.1f);
    elapsed+=dt;
    for(auto& t:tracers)t.age+=dt;
    tracers.erase(std::remove_if(tracers.begin(),tracers.end(),[](const Tracer& t){return t.age>=t.life;}),tracers.end());
    for(auto& s:sparks)s.age+=dt;
    sparks.erase(std::remove_if(sparks.begin(),sparks.end(),[](const Spark& s){return s.age>=s.life;}),sparks.end());
    if(mode==Mode::Quiet)return;
    contact_clock_+=dt;
    for(auto& target:contacts){
      target.age+=dt;
      target.position=target.position+target.velocity*dt;
      target.position.y+=.035f*std::sin(target.age*.3f);
    }
    if(contact_clock_>=27){contact_clock_=0;make_contacts(int(contacts.size()));}
    if(mode==Mode::Contact)return;
    const int active=(mode==Mode::Heavy)?5:2;
    for(int i=0;i<active;i++){
      shot_timer_[i]-=dt;
      const float cycle=std::fmod(elapsed+i*.64f,3.1f);
      if(cycle>1.65f)continue; // bursts separated by visible gaps
      if(shot_timer_[i]<=0){
        shot_timer_[i]=between(.065f,.13f);
        fire(i);
      }
    }
    flare_timer_-=dt;
    if(flare_timer_<0){
      flare_timer_=between(mode==Mode::Heavy?1.2f:2.8f,mode==Mode::Heavy?3.8f:6.0f);
      if(!contacts.empty() && sparks.size()<100){
        auto target=contacts[int(rand01()*contacts.size())%contacts.size()].position;
        target.x+=between(-9,9);target.y+=between(-7,7);
        sparks.push_back({target,0,between(.35f,.9f)});
      }
    }
  }
};
} // namespace aero
