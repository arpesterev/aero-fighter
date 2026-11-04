// Aero Fighter Dagor integration. Include inside skiesSample/prog/test_app.cpp.
// Uses Dagor's native line/triangle renderer over its atmospheric sky.
#pragma once
#include "aero_scene.h"
#include <debug/dag_debug3d.h>
#include <math/dag_TMatrix.h>
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <ctime>
#include <string>

namespace aero {
inline Scene &runtime() {static Scene s;return s;}

inline void update_native(float dt) {
  static float poll=0;
  poll+=std::max(0.0f,dt);
  if(poll>=.14f){
    poll=0;
    const char* path=std::getenv("AERO_FIGHTER_STATE_FILE");
    if(!path || !*path)path="aero.state";
    FILE* file=std::fopen(path,"r");
    if(file){
      char magic[20]={},kind[32]={};
      unsigned long long seq=0;
      int count=0;
      const int parsed=std::fscanf(file,"%19s %llu %31s %d",magic,&seq,kind,&count);
      std::fclose(file);
      if(parsed==4 && std::string(magic)=="AERO1" && count>=1 && count<=6 &&
         (std::string(kind)=="clear"||std::string(kind)=="contact"||
          std::string(kind)=="engage_light"||std::string(kind)=="engage_heavy"))
        runtime().apply({static_cast<std::uint64_t>(seq),mode_from_string(kind),count});
    }
  }
  runtime().update(dt);
}

template<typename SunPanel> inline void local_sky_time(SunPanel& sun){
  // Day/dusk/night palette synchronized to this Mac's local clock.
  // The Dagor sample supplies atmospheric scattering, clouds and stars.
  const std::time_t raw=std::time(nullptr);
  std::tm local{};
#if defined(_WIN32)
  localtime_s(&local,&raw);
#else
  localtime_r(&raw,&local);
#endif
  const float hours=local.tm_hour+(local.tm_min/60.f);
  const float angle=(hours-6.f)*3.14159265f/12.f;
  sun.astronomical=false;
  sun.sun_zenith=90.f-73.f*std::sin(angle);
  sun.sun_azimuth=180.f+(hours-12.f)*15.f;
}

inline void render_scene(const TMatrix &view_itm){
  const Scene &s=runtime();
  // All coordinates are camera-relative and transformed into world space.
  auto xyz=[&](Vec3 p){return view_itm*Point3(p.x,p.y,p.z);};
  auto ln=[&](Vec3 a,Vec3 b,E3DCOLOR color){draw_cached_debug_line(xyz(a),xyz(b),color);};
  auto tri=[&](Vec3 a,Vec3 b,Vec3 c,E3DCOLOR color){
    Point3 pts[3]={xyz(a),xyz(b),xyz(c)};
    draw_cached_debug_trilist(pts,1,color);
  };
  auto quad=[&](Vec3 a,Vec3 b,Vec3 c,Vec3 d,E3DCOLOR color){tri(a,b,c,color);tri(c,d,a,color);};
  auto cube=[&](Vec3 p,Vec3 ext,E3DCOLOR front,E3DCOLOR top){
    const float x=p.x,y=p.y,z=p.z,w=ext.x,h=ext.y,d=ext.z;
    quad({x-w,y-h,z+d},{x+w,y-h,z+d},{x+w,y+h,z+d},{x-w,y+h,z+d},front);
    quad({x-w,y+h,z-d},{x-w,y+h,z+d},{x+w,y+h,z+d},{x+w,y+h,z-d},top);
    quad({x+w,y-h,z-d},{x+w,y-h,z+d},{x+w,y+h,z+d},{x+w,y+h,z-d},front);
  };
  const E3DCOLOR base(18,30,36,255),roof(29,43,48,255);
  const E3DCOLOR distant(10,21,31,255);
  const E3DCOLOR amber(255,119,42,150),core(255,236,173,255),halo(255,143,47,80);
  begin_draw_cached_debug_lines(false,false);
  set_cached_debug_lines_wtm(TMatrix::IDENT);

  // Low silhouette: most of the picture is Dagor's actual atmospheric sky.
  quad({-800,-43,-900},{800,-43,-900},{800,-42,-95},{-800,-42,-95},distant);
  quad({-600,-41,-220},{600,-41,-220},{600,-39,-70},{-600,-39,-70},base);
  for(int i=-7;i<=7;i++){
    const float x=i*67.f;
    const float h=3.f+std::fabs(std::sin(i*1.61f))*9.f;
    cube({x,-39+h*.5f,-290}, {20.f,h*.5f,11.f},distant,roof);
  }
  // Observation tower railing in the foreground.
  for(int i=-8;i<=8;i++){
    const float x=i*22.f;
    ln({x,-57,-52},{x,-32,-52},E3DCOLOR(52,68,75,205));
  }
  ln({-200,-33,-52},{200,-33,-52},E3DCOLOR(94,117,115,255));
  ln({-200,-52,-52},{200,-52,-52},base);

  // Five stylized anti-aircraft mounts; no missile launchers.
  for(int i=0;i<5;i++){
    const float x=float((i-2)*50),z=float(-92-(i%2)*17);
    cube({x,-33,z},{8,4,11},E3DCOLOR(30,40,42,255),E3DCOLOR(64,70,70,255));
    cube({x,-27,z-1},{4,3,5},base,roof);
    ln({x,-25,z-1},{x+3,-17,z-15},E3DCOLOR(93,103,99,255));
    ln({x+2,-25,z-1},{x+5,-17,z-15},E3DCOLOR(72,77,74,255));
    const float blink=std::sin(s.elapsed*1.7f+i*1.9f);
    if(blink>.3f)ln({x-8,-36,z},{x-8,-35,z},E3DCOLOR(170,216,144,255));
  }
  // Threats: small, distant glowing contacts, not physical aircraft models.
  for(const Contact &target:s.contacts){
    const Vec3 p=target.position;
    const float glow=.7f+.3f*std::sin(s.elapsed*6.2f);
    const int b=int(120+glow*110);
    ln(p+Vec3{-1.5f,0,0},p+Vec3{1.5f,0,0},E3DCOLOR(b,103,81,255));
    ln(p+Vec3{0,-1.5f,0},p+Vec3{0,1.5f,0},E3DCOLOR(b,113,76,220));
  }
  // White-hot moving streaks with warm orange halo and slight dispersion.
  for(const Tracer &t:s.tracers){
    const float progress=clamp(t.age/t.life,0.f,1.f);
    const float tail=std::max(0.f,progress-.12f);
    const Vec3 start=mix(t.origin,t.destination,tail);
    const Vec3 end=mix(t.origin,t.destination,progress);
    const Vec3 eye={1.6f,0,0};
    ln(start+eye,end+eye,halo);
    ln(start-eye,end-eye,halo);
    ln(start,end,core);
    if(progress>.8f)ln(start,end,amber);
  }
  // Short muzzle flashes and distant airburst spark crosses.
  for(const Spark &flash:s.sparks){
    const float k=1.f-clamp(flash.age/flash.life,0.f,1.f);
    const float size=(flash.position.y>0?8.f:4.f)*k;
    const E3DCOLOR col(255,193,96,static_cast<unsigned char>(255*k));
    ln(flash.position+Vec3{-size,0,0},flash.position+Vec3{size,0,0},col);
    ln(flash.position+Vec3{0,-size,0},flash.position+Vec3{0,size,0},col);
    ln(flash.position+Vec3{0,0,-size},flash.position+Vec3{0,0,size},col);
  }
  // Perspective-attached rotating radar repeater on the observation deck.
  const Vec3 radarCenter={42.f,-29.f,-74.f};
  const E3DCOLOR radarDim(29,101,77,155),radarLit(99,230,158,235);
  for(int ring=1;ring<=3;ring++){
    const float radius=float(ring*5);
    for(int k=0;k<32;k++){
      const float a=(float(k)/32.f)*6.2831853f;
      const float b=(float(k+1)/32.f)*6.2831853f;
      ln(radarCenter+Vec3{radius*std::cos(a),radius*std::sin(a),0},
         radarCenter+Vec3{radius*std::cos(b),radius*std::sin(b),0},radarDim);
    }
  }
  ln(radarCenter+Vec3{-16,0,0},radarCenter+Vec3{16,0,0},radarDim);
  ln(radarCenter+Vec3{0,-16,0},radarCenter+Vec3{0,16,0},radarDim);
  const float scan=s.elapsed*.84f;
  ln(radarCenter,radarCenter+Vec3{15*std::cos(scan),15*std::sin(scan),0},radarLit);
  for(const Contact &t:s.contacts){
    // Diagrammatic contact mapping, deliberately NOT a real-world bearing.
    const float x=clamp(t.position.x*.075f,-13.f,13.f);
    const float y=clamp((t.position.y-74.f)*.14f,-13.f,13.f);
    ln(radarCenter+Vec3{x-.8f,y,0},radarCenter+Vec3{x+.8f,y,0},radarLit);
    ln(radarCenter+Vec3{x,y-.8f,0},radarCenter+Vec3{x,y+.8f,0},radarLit);
  }
  end_draw_cached_debug_lines();
}
} // namespace aero
