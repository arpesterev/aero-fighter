// Aero Fighter / cinematic airspace installation. C++17, no Dagor dependency.
// This produces VISUAL events only. No weapon ballistics or operational control.
#pragma once
#include <array>
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <string>
#include <vector>

namespace aero {
constexpr float PI=3.14159265358979323846f;

struct Vec3 {
  float x=0, y=0, z=0;
  Vec3 operator+(Vec3 p) const {return {x+p.x,y+p.y,z+p.z};}
  Vec3 operator-(Vec3 p) const {return {x-p.x,y-p.y,z-p.z};}
  Vec3 operator*(float s) const {return {x*s,y*s,z*s};}
  Vec3& operator+=(Vec3 p){x+=p.x;y+=p.y;z+=p.z;return *this;}
};
inline Vec3 mix(Vec3 a,Vec3 b,float t){return a*(1-t)+b*t;}
inline float clamp(float v,float lo,float hi){return std::max(lo,std::min(hi,v));}
inline float length(Vec3 p){return std::sqrt(p.x*p.x+p.y*p.y+p.z*p.z);}
inline Vec3 normalized(Vec3 p){const float n=length(p);return n>1e-5f?p*(1.f/n):Vec3{0,1,0};}
enum class Mode {Quiet,Contact,Light,Heavy};
inline Mode mode_from_string(const std::string& s){
  if(s=="contact"||s=="alert")return Mode::Contact;
  if(s=="engage_light"||s=="incoming")return Mode::Light;
  if(s=="engage_heavy"||s=="engage")return Mode::Heavy;
  return Mode::Quiet;
}
struct Signal {std::uint64_t sequence=0;Mode mode=Mode::Quiet;int targets=3;};
struct Contact {Vec3 position,velocity;float age=0,brightness=1;};
struct Tracer {
  Vec3 origin,destination;
  float age=0,life=.75f,width=.5f,luminosity=1;
  int site=0;
};
struct Spark {
  Vec3 position,velocity;
  float age=0,life=.5f,size=1;
  bool hot=true;
};
struct Smoke {
  Vec3 position,velocity;
  float age=0,life=7,initial_radius=4,opacity=.3f,rotation=0;
};
struct Flash {
  Vec3 position;
  float age=0,life=.12f,size=3,luminosity=1;
};
struct Airburst {
  Vec3 position;
  float age=0,life=.9f,radius=8;
};
struct GunSite {
  Vec3 position;
  float yaw=0,elevation=.32f,recoil=0,heat=0;
  float lamp_phase=0;
};

class Scene {
  std::uint32_t rng_=0x51A7A13Du;
  std::array<float,5> shot_timer_{};
  float contact_clock_=0;
  float burst_timer_=0;
  std::uint64_t sequence_=0;
  int target_count_=3;

  float random01(){
    rng_^=rng_<<13;rng_^=rng_>>17;rng_^=rng_<<5;
    return float(rng_&0x00ffffffu)/16777216.f;
  }
  float range(float lo,float hi){return lo+(hi-lo)*random01();}
  Vec3 offset(float amplitude){return {range(-amplitude,amplitude),range(-amplitude*.4f,amplitude*.4f),range(-amplitude,amplitude)};}
  void spawn_smoke(Vec3 p,float radius,float duration,float opacity){
    if(smoke.size()>=260)return;
    smoke.push_back({p,{range(-1.4f,.2f),range(.7f,2.2f),range(-.45f,.45f)},0,
                     duration,radius,opacity,range(0,2*PI)});
  }
  void spawn_flash(Vec3 p,float size,float life,float power){
    if(flashes.size()<85)flashes.push_back({p,0,life,size,power});
  }
  void spawn_sparks(Vec3 p,int count,float size,bool hot){
    for(int i=0;i<count && sparks.size()<340;i++){
      Vec3 v={range(-1,1),range(-1,1),range(-1,1)};
      v=normalized(v)*range(2.f,hot?18.f:6.f);
      sparks.push_back({p,v,0,range(.3f,hot?.95f:1.8f),size*range(.5f,1.4f),hot});
    }
  }
  void make_contacts(int count){
    contacts.clear();target_count_=count;
    for(int i=0;i<count;i++){
      const float lane=i-(count-1)*.5f;
      contacts.push_back({{lane*43.f+range(-12,12),range(58,116),-320.f-range(0,100)},
                          {range(-.75f,.75f),range(-.15f,.17f),range(.35f,1.1f)},0,range(.55f,1)});
    }
  }
  void airburst(){
    if(contacts.empty()||bursts.size()>=28)return;
    const int index=int(random01()*contacts.size())%int(contacts.size());
    const Vec3 p=contacts[index].position+offset(7);
    bursts.push_back({p,0,range(.7f,1.25f),range(6,12)});
    spawn_flash(p,range(12,21),range(.24f,.40f),1.3f);
    spawn_sparks(p,mode==Mode::Heavy?23:12,range(1.3f,2.6f),true);
    for(int i=0;i<5;i++)spawn_smoke(p+offset(4.2f),range(3,7),range(5,10),range(.14f,.24f));
  }
  void fire(int index){
    if(contacts.empty())return;
    const Vec3 mount=sites[index].position;
    const Vec3 muzzle=mount+Vec3{1.0f,-0.0f,-9.f};
    const Contact& target=contacts[int(random01()*contacts.size())%int(contacts.size())];
    const Vec3 endpoint=target.position+offset(mode==Mode::Heavy?13.f:8.f);
    if(tracers.size()<760)tracers.push_back({muzzle,endpoint,0,range(.56f,.94f),
                                             range(.45f,.92f),range(.7f,1.5f),index});
    sites[index].recoil=1.f;
    sites[index].heat=std::min(1.f,sites[index].heat+.08f);
    if(random01()<.6f){
      spawn_flash(muzzle,range(3,7),range(.055f,.14f),range(.9f,1.6f));
      if(random01()<.35f)spawn_sparks(muzzle,3,range(.2f,.8f),true);
    }
    if(random01()<.25f)spawn_smoke(muzzle+Vec3{0,2,0},range(1.5f,3.3f),range(3,5),range(.14f,.27f));
  }

public:
  static constexpr std::size_t MaxTracers=760,MaxSparks=340,MaxSmoke=260,MaxFlashes=85,MaxBursts=28;
  Mode mode=Mode::Quiet;
  float elapsed=0;
  std::array<GunSite,5> sites{{
    {{-102.f,-24.f,-162.f},0,.42f,0,0,.2f},
    {{-58.f,-22.f,-116.f},0,.48f,0,0,1.6f},
    {{ 0.f,-20.f,-128.f},0,.40f,0,0,2.3f},
    {{ 65.f,-21.f,-133.f},0,.46f,0,0,2.9f},
    {{ 113.f,-24.f,-186.f},0,.38f,0,0,3.4f}
  }};
  std::vector<Contact> contacts;
  std::vector<Tracer> tracers;
  std::vector<Spark> sparks;
  std::vector<Smoke> smoke;
  std::vector<Flash> flashes;
  std::vector<Airburst> bursts;
  Scene(){shot_timer_={{.2f,.83f,1.11f,.53f,1.72f}};}
  std::uint64_t sequence() const{return sequence_;}
  int active_sites() const {return mode==Mode::Heavy?5:mode==Mode::Light?2:0;}

  bool apply(const Signal& event){
    if(!event.sequence||event.sequence<=sequence_||event.targets<1||event.targets>6)return false;
    sequence_=event.sequence;
    mode=event.mode;
    contact_clock_=0;burst_timer_=0;
    tracers.clear();flashes.clear();bursts.clear();sparks.clear();
    shot_timer_={{.22f,.74f,1.24f,.54f,1.66f}};
    for(auto& site:sites){site.recoil=0;site.heat=0;}
    if(mode==Mode::Quiet){contacts.clear();return true;}
    make_contacts(event.targets);
    return true;
  }

  void update(float dt){
    if(!std::isfinite(dt)||dt<=0)return;
    // Cope with system sleep/resume, browser-free display for days.
    dt=std::min(dt,.10f);
    elapsed+=dt;
    auto advance=[dt](auto& array){
      for(auto& p:array)p.age+=dt;
      array.erase(std::remove_if(array.begin(),array.end(),
                   [](const auto& p){return p.age>=p.life;}),array.end());
    };
    advance(tracers);advance(sparks);advance(smoke);advance(flashes);advance(bursts);
    for(auto& s:smoke){
      s.position+=s.velocity*dt;
      s.position.x+=std::sin(elapsed*.23f+s.rotation)*dt*.19f;
    }
    for(auto& s:sparks)s.position+=s.velocity*dt;
    for(auto& site:sites){
      site.recoil*=std::exp(-dt*16.f);
      site.heat*=std::exp(-dt*.8f);
    }
    if(mode==Mode::Quiet)return;
    contact_clock_+=dt;
    for(auto& c:contacts){c.age+=dt;c.position+=c.velocity*dt;}
    if(contact_clock_>=32.f){contact_clock_=0;make_contacts(target_count_);}
    if(mode==Mode::Contact)return;

    const int active=active_sites();
    for(int i=0;i<active;i++){
      shot_timer_[i]-=dt;
      // Different burst rhythms keep the light pattern cinematic, not a laser.
      const float phase=std::fmod(elapsed*(i%2?.86f:1.03f)+i*.77f,3.7f);
      if(phase>=(mode==Mode::Heavy?2.15f:1.36f))continue;
      if(shot_timer_[i]<=0){
        shot_timer_[i]=range(mode==Mode::Heavy?.055f:.115f,mode==Mode::Heavy?.125f:.23f);
        fire(i);
      }
    }
    burst_timer_-=dt;
    if(burst_timer_<=0){
      burst_timer_=range(mode==Mode::Heavy?1.3f:3.8f,mode==Mode::Heavy?3.7f:7.8f);
      airburst();
    }
  }
};
} // namespace aero
