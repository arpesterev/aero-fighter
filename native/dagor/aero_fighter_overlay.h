// Dagor native cinematic renderer for Aero Fighter, hosted in skiesSample.
// Uses the pinned engine's supported cached debug triangles/lines.
// Material/vfx here is procedural, not War Thunder's proprietary game assets.
#pragma once
#include "aero_scene.h"
#include <debug/dag_debug3d.h>
#include <math/dag_TMatrix.h>
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <ctime>
#include <string>

namespace aero {
inline Scene &runtime(){static Scene scene;return scene;}

inline void update_native(float dt){
  static float poll=0;
  poll+=std::max(0.f,dt);
  if(poll>=.14f){
    poll=0;
    const char* path=std::getenv("AERO_FIGHTER_STATE_FILE");
    if(!path||!*path)path="aero.state";
    FILE* f=std::fopen(path,"r");
    if(f){
      char magic[20]={},kind[32]={};
      unsigned long long seq=0;
      int targets=0;
      const int parsed=std::fscanf(f,"%19s %llu %31s %d",magic,&seq,kind,&targets);
      std::fclose(f);
      if(parsed==4&&std::string(magic)=="AERO1"&&targets>=1&&targets<=6&&
         (std::string(kind)=="clear"||std::string(kind)=="contact"||
          std::string(kind)=="engage_light"||std::string(kind)=="engage_heavy"))
        runtime().apply({static_cast<std::uint64_t>(seq),mode_from_string(kind),targets});
    }
  }
  runtime().update(dt);
}

inline float local_hour(){
  const std::time_t t=std::time(nullptr);
  std::tm tm{};
#if defined(_WIN32)
  localtime_s(&tm,&t);
#else
  localtime_r(&t,&tm);
#endif
  return tm.tm_hour+tm.tm_min/60.f+tm.tm_sec/3600.f;
}
inline float visual_daylight(){
  const float h=local_hour();
  return clamp((h-5.f)/3.f,0.f,1.f)*clamp((20.5f-h)/3.f,0.f,1.f);
}
template<typename SunPanel> inline void local_sky_time(SunPanel &sun){
  const float h=local_hour();
  const float angle=(h-6.f)*PI/12.f;
  sun.astronomical=false;
  sun.sun_zenith=90.f-73.f*std::sin(angle);
  sun.sun_azimuth=180.f+(h-12.f)*15.f;
}

namespace native_render {
inline Vec3 cross(Vec3 a,Vec3 b){
  return {a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x};
}
inline unsigned char alpha(float x){return static_cast<unsigned char>(clamp(x,0.f,255.f));}
inline E3DCOLOR shade(int r,int g,int b,int a=255){return E3DCOLOR(r,g,b,a);}

struct Painter {
  const TMatrix &camera_tm;
  Point3 world(Vec3 p) const{return camera_tm*Point3(p.x,p.y,p.z);}
  void line(Vec3 a,Vec3 b,E3DCOLOR col) const {
    draw_cached_debug_line(world(a),world(b),col);
  }
  void tri(Vec3 a,Vec3 b,Vec3 c,E3DCOLOR col) const {
    const Point3 pts[3]={world(a),world(b),world(c)};
    draw_cached_debug_trilist(pts,1,col);
  }
  void quad(Vec3 a,Vec3 b,Vec3 c,Vec3 d,E3DCOLOR col) const {
    tri(a,b,c,col);tri(a,c,d,col);
  }
  void box(Vec3 p,Vec3 e,E3DCOLOR front,E3DCOLOR top,E3DCOLOR side) const {
    const float x=p.x,y=p.y,z=p.z,w=e.x,h=e.y,d=e.z;
    quad({x-w,y-h,z+d},{x+w,y-h,z+d},{x+w,y+h,z+d},{x-w,y+h,z+d},front);
    quad({x+w,y-h,z-d},{x-w,y-h,z-d},{x-w,y+h,z-d},{x+w,y+h,z-d},side);
    quad({x-w,y+h,z-d},{x-w,y+h,z+d},{x+w,y+h,z+d},{x+w,y+h,z-d},top);
    quad({x-w,y-h,z-d},{x-w,y-h,z+d},{x-w,y+h,z+d},{x-w,y+h,z-d},side);
    quad({x+w,y-h,z+d},{x+w,y-h,z-d},{x+w,y+h,z-d},{x+w,y+h,z+d},side);
  }
  // Genuine 3D parametric cylinders rather than a two-dimensional gun sprite.
  void tube(Vec3 a,Vec3 b,float r0,float r1,int sides,E3DCOLOR body,E3DCOLOR rim) const {
    const Vec3 axis=normalized(b-a);
    Vec3 u=cross(axis,{0,1,0});
    if(length(u)<.1f)u=cross(axis,{0,0,1});
    u=normalized(u);
    const Vec3 v=normalized(cross(axis,u));
    for(int i=0;i<sides;i++){
      const float t0=(i*2*PI)/sides,t1=((i+1)*2*PI)/sides;
      const Vec3 d0=u*std::cos(t0)+v*std::sin(t0),d1=u*std::cos(t1)+v*std::sin(t1);
      const Vec3 p0=a+d0*r0,p1=a+d1*r0,q0=b+d0*r1,q1=b+d1*r1;
      quad(p0,p1,q1,q0,body);
      tri(a,p1,p0,rim);tri(b,q0,q1,rim);
    }
  }
  void glow(Vec3 pos,float r,E3DCOLOR inner,E3DCOLOR outer,int slices=8) const {
    const Vec3 right{r,0,0},up{0,r,0};
    for(int k=0;k<slices;k++){
      const float a=k*2*PI/slices,b=(k+1)*2*PI/slices;
      const Vec3 a0=pos+right*std::cos(a)+up*std::sin(a);
      const Vec3 a1=pos+right*std::cos(b)+up*std::sin(b);
      tri(pos,a0,a1,(k%2==0)?inner:outer);
    }
  }
  void circle(Vec3 p,float radius,E3DCOLOR color,int slices=20) const {
    for(int i=0;i<slices;i++){
      const float a=i*2*PI/slices,b=(i+1)*2*PI/slices;
      line(p+Vec3{radius*std::cos(a),radius*std::sin(a),0},
           p+Vec3{radius*std::cos(b),radius*std::sin(b),0},color);
    }
  }
};

inline void terrain(const Painter &p,float daylight){
  const E3DCOLOR earth=shade(int(18+38*daylight),int(25+49*daylight),int(29+41*daylight));
  const E3DCOLOR path=shade(int(26+41*daylight),int(31+44*daylight),int(37+47*daylight));
  const E3DCOLOR horizon=shade(int(10+28*daylight),int(18+44*daylight),int(25+46*daylight));
  const E3DCOLOR structure=shade(int(17+32*daylight),int(25+40*daylight),int(30+49*daylight));
  const E3DCOLOR roof=shade(int(29+41*daylight),int(36+48*daylight),int(38+51*daylight));
  p.quad({-900,-43,-870},{900,-43,-870},{900,-42,-77},{-900,-42,-77},earth);
  p.quad({-290,-42,-240},{290,-42,-240},{240,-41,-62},{-240,-41,-62},path);
  // Faint layered ridgelines, intentionally low in the frame.
  for(int layer=0;layer<3;layer++){
    const float z=-380-layer*120.f;
    for(int i=-13;i<13;i++){
      const float x=i*57.f;
      const float h=8+6*std::fabs(std::sin(i*1.79f+layer*.3f))+layer*5.f;
      p.quad({x,-43,z},{x+57,-43,z},{x+57,-43+h,z},{x,-43+h*.8f,z},horizon);
    }
  }
  // Hangars and hangar doors.
  for(int i=-5;i<=5;i++){
    const float x=i*76.f;
    const float h=5.f+std::fabs(std::sin(i*1.8f))*11.f;
    p.box({x,-40+h*.5f,-242},{19,h*.5f,12},structure,roof,structure);
    p.box({x,-40+h*.34f,-229.6f},{11,h*.28f,.24f},
          shade(8,19,22),shade(16,26,32),shade(8,19,22));
  }
  // Concrete grooves give distance scale without filling the sky.
  for(int x=-5;x<=5;x++){
    const float xx=x*35.f;
    p.line({xx,-40.6f,-62},{xx,-41.f,-230},shade(41,59,62,92));
  }
  for(int z=0;z<6;z++){
    const float zz=-65-z*29.f;
    p.line({-245,-40.65f,zz},{245,-40.65f,zz},shade(35,53,56,100));
  }
  // Observation tower rail is a subtle foreground anchor.
  for(int i=-8;i<=8;i++){
    const float x=i*24.f;
    p.tube({x,-56,-53},{x,-32,-53},.3f,.3f,5,structure,roof);
  }
  p.tube({-206,-32,-53},{206,-32,-53},.45f,.45f,7,roof,roof);
  p.tube({-206,-51,-53},{206,-51,-53},.28f,.28f,6,structure,structure);
}

inline void mount(const Painter &p,const GunSite &s,int index,float daylight){
  const Vec3 site=s.position;
  const E3DCOLOR base=shade(int(33+43*daylight),int(40+44*daylight),int(42+41*daylight));
  const E3DCOLOR top=shade(int(56+67*daylight),int(64+61*daylight),int(63+61*daylight));
  const E3DCOLOR shadow=shade(int(20+25*daylight),int(27+29*daylight),int(28+29*daylight));
  const E3DCOLOR steel=shade(int(72+43*daylight),int(81+41*daylight),int(83+37*daylight));
  // Square bunker, foundation, beveled deck and anti-air silhouette.
  p.box(site+Vec3{0,-13,0},{13,2,15},base,top,shadow);
  p.box(site+Vec3{0,-9,0},{10,3,12},shadow,base,shadow);
  p.tube(site+Vec3{0,-5,0},site+Vec3{0,-1,0},6,5.7f,12,base,top);
  p.box(site+Vec3{0,0,0},{8,3.8f,7},base,top,shadow);
  p.box(site+Vec3{0,4,1},{6,1.1f,5},shadow,steel,shadow);
  // Detailed articulated barrel assemblies. Only cosmetic elevation/recoil.
  const float recoil=s.recoil*.8f;
  const float rise=8.f+s.elevation*9.f;
  for(int barrel=-1;barrel<=1;barrel+=2){
    const float x=site.x+barrel*2.8f;
    const Vec3 root{x,site.y+3,site.z-3+recoil};
    const Vec3 muzzle{x,site.y+rise,site.z-15+recoil};
    p.tube(root,muzzle,.95f,.67f,9,steel,shadow);
    p.tube(muzzle+Vec3{0,0,.8f},muzzle+Vec3{0,0,-1.5f},.77f,.71f,9,shadow,steel);
    for(int vent=0;vent<3;vent++){
      const float zz=site.z-7-vent*2.3f;
      p.tube({x-1,site.y+5+vent,zz},{x+1,site.y+5+vent,zz},
             .18f,.18f,6,shadow,shadow);
    }
  }
  // Sighting optics and linked radar unit.
  p.box(site+Vec3{7,4,1},{2.3f,1.8f,2.2f},steel,top,shadow);
  p.box(site+Vec3{7,4,-1.3f},{1.5f,1.1f,.22f},shadow,shadow,shadow);
  p.tube(site+Vec3{-8,0,4},site+Vec3{-8,9,4},.45f,.38f,7,steel,top);
  p.box(site+Vec3{-8,9,4},{3.5f,1.3f,.55f},shadow,steel,shadow);
  // Animated inspection lamps and scattered equipment silhouettes.
  const float pulse=.5f+.5f*std::sin(s.lamp_phase+index*.1f);
  p.glow(site+Vec3{13,-6,5},1.3f,shade(153,223,161,alpha(100+90*pulse)),
         shade(92,140,103,alpha(60+45*pulse)));
  p.box(site+Vec3{-15,-12,7},{2.5f,1.1f,3.5f},shadow,base,shadow);
}

inline void ambient_lights(const Painter &p,float daylight,float seconds){
  for(int i=-8;i<=8;i++){
    const float x=i*41.f;
    const float depth=-225.f-(i%3)*28.f;
    const float blink=.6f+.4f*std::sin(seconds*.7f+i*2.3f);
    const unsigned char aa=alpha((1-daylight)*blink*60+18);
    p.glow({x,-30,depth},3.f,shade(255,196,128,aa),
           shade(255,121,51,alpha(aa*.65f)));
    p.line({x,-41,depth},{x,-33,depth},shade(90,107,104));
  }
}

inline void smoke_cloud(const Painter &p,const Smoke &s,float time){
  const float f=clamp(1.f-s.age/s.life,0.f,1.f);
  const float growth=1.f+s.age*.17f;
  const float r=s.initial_radius*growth;
  // Three offset octagonal camera-facing layers approximate a low-cost
  // translucent VOLUME. These are not physically simulated volumetric clouds.
  for(int layer=0;layer<3;layer++){
    const float scale=layer==0?1.f:layer==1?.71f:1.27f;
    const Vec3 center=s.position+Vec3{std::sin(s.rotation+layer*2.f)*r*.18f,
                                      layer*.38f*r,layer*.4f};
    const float a=s.opacity*f*(layer==2?.25f:.52f)*255.f;
    const E3DCOLOR col=shade(100+layer*11,107+layer*9,109+layer*9,alpha(a));
    const float rad=r*scale;
    for(int k=0;k<9;k++){
      const float az=s.rotation+float(k)*2*PI/9.f+time*.014f;
      const float bz=s.rotation+float(k+1)*2*PI/9.f+time*.014f;
      const float j1=.84f+.17f*std::sin(az*7.f+s.rotation);
      const float j2=.84f+.17f*std::sin(bz*7.f+s.rotation);
      p.tri(center,
            center+Vec3{std::cos(az)*rad*j1,std::sin(az)*rad*j1,0},
            center+Vec3{std::cos(bz)*rad*j2,std::sin(bz)*rad*j2,0},col);
    }
  }
}

inline void tracers(const Painter &p,const Scene &scene){
  const E3DCOLOR warm=shade(255,140,49,72);
  const E3DCOLOR outer=shade(255,175,76,95);
  const E3DCOLOR white=shade(255,241,186,245);
  for(const Tracer &tr:scene.tracers){
    const float t=clamp(tr.age/tr.life,0.f,1.f);
    const float tail=std::max(0.f,t-.10f);
    const Vec3 a=mix(tr.origin,tr.destination,tail);
    const Vec3 b=mix(tr.origin,tr.destination,t);
    const Vec3 normal=normalized(cross(b-a,Vec3{0,0,1}));
    const float fade=clamp((1.f-t)*5.f,0.f,1.f);
    const float w=tr.width*tr.luminosity*(.7f+.3f*fade);
    p.quad(a-normal*(w*3.8f),a+normal*(w*3.8f),
           b+normal*(w*2.f),b-normal*(w*2.f),warm);
    p.quad(a-normal*(w*2.f),a+normal*(w*2.f),
           b+normal*w,b-normal*w,outer);
    p.quad(a-normal*w*.34f,a+normal*w*.34f,
           b+normal*w*.15f,b-normal*w*.15f,white);
    p.line(a,b,shade(255,248,216,alpha(fade*240)));
    // Bright travelling tip keeps individual rounds visible.
    p.glow(b,w*2.2f,shade(255,249,209,alpha(fade*235)),
           shade(255,157,66,alpha(fade*100)),5);
  }
}

inline void light_effects(const Painter &p,const Scene &s){
  for(const Airburst &burst:s.bursts){
    const float t=clamp(burst.age/burst.life,0.f,1.f);
    const float light=(1-t)*(1-t);
    const float r=burst.radius*(.15f+t*1.8f);
    p.glow(burst.position,r,shade(255,213,144,alpha(light*155)),
           shade(255,98,35,alpha(light*60)),10);
    p.circle(burst.position,r*1.2f,shade(255,178,97,alpha(light*170)),14);
  }
  for(const Flash &f:s.flashes){
    const float t=clamp(f.age/f.life,0.f,1.f);
    const float a=(1-t)*(1-t)*f.luminosity;
    const float radius=f.size*(1+t*1.8f);
    p.glow(f.position,radius,shade(255,246,193,alpha(245*a)),
           shade(255,133,47,alpha(110*a)),9);
    // Approximate ground spill: the nearby base flashes orange for a fraction
    // of a second, using transient low-alpha geometry instead of live GI.
    if(f.position.y<0){
      const Vec3 ground=f.position+Vec3{0,-13,0};
      p.glow(ground,radius*1.8f,shade(255,105,39,alpha(a*40)),
             shade(255,75,32,alpha(a*20)));
    }
  }
  for(const Spark &spark:s.sparks){
    const float fade=clamp(1.f-spark.age/spark.life,0.f,1.f);
    const float sz=spark.size*(spark.hot?1.3f:2.2f)*fade;
    const E3DCOLOR col=spark.hot?shade(255,213,117,alpha(fade*240)):
                                 shade(190,200,200,alpha(fade*100));
    p.line(spark.position-spark.velocity*.025f,
           spark.position+normalized(spark.velocity)*sz,col);
    if(spark.hot)p.glow(spark.position,sz*.7f,col,
                         shade(255,110,30,alpha(fade*80)),5);
  }
}

inline void radar(const Painter &p,const Scene &s){
  const Vec3 center={176,-30,-66};
  const E3DCOLOR grid=shade(36,100,73,96),lit=shade(126,237,172,155);
  for(int i=1;i<=3;i++)p.circle(center,i*4.8f,grid,32);
  p.line(center+Vec3{-16,0,0},center+Vec3{16,0,0},grid);
  p.line(center+Vec3{0,-16,0},center+Vec3{0,16,0},grid);
  const float phase=s.elapsed*.85f;
  p.line(center,center+Vec3{15*std::cos(phase),15*std::sin(phase),0},lit);
  for(const Contact &c:s.contacts){
    const float x=clamp(c.position.x*.075f,-13.f,13.f);
    const float y=clamp((c.position.y-82.f)*.15f,-13.f,13.f);
    const Vec3 dot=center+Vec3{x,y,0};
    p.line(dot+Vec3{-1,0,0},dot+Vec3{1,0,0},shade(255,171,118,235));
    p.line(dot+Vec3{0,-1,0},dot+Vec3{0,1,0},shade(255,171,118,235));
  }
}
} // namespace native_render

inline void render_scene(const TMatrix &view_itm){
  using namespace native_render;
  const Scene &s=runtime();
  const Painter p{view_itm};
  const float day=visual_daylight();

  // Background silhouettes, actual 3D procedurally modeled gun mounts, scene
  // lighting/beacons. Use depth test, without overwriting the sky's depth.
  begin_draw_cached_debug_lines(true,false);
  set_cached_debug_lines_wtm(TMatrix::IDENT);
  terrain(p,day);
  for(int i=0;i<5;i++)mount(p,s.sites[i],i,day);
  ambient_lights(p,day,s.elapsed);
  end_draw_cached_debug_lines();

  // Smoke is a soft layered billboard impostor. Render as translucent geometry.
  begin_draw_cached_debug_lines(false,false);
  set_cached_debug_lines_wtm(TMatrix::IDENT);
  for(const Smoke &cloud:s.smoke)smoke_cloud(p,cloud,s.elapsed);

  // Distant targets, muzzle lighting, sparks and bright tracer cores.
  for(const Contact &c:s.contacts){
    const float flutter=.65f+.35f*std::sin(s.elapsed*3.7f+c.position.x);
    p.glow(c.position,1.6f,shade(255,182,138,alpha(150*flutter)),
           shade(255,125,67,alpha(75*flutter)),6);
  }
  tracers(p,s);
  light_effects(p,s);
  radar(p,s);
  end_draw_cached_debug_lines();
}
} // namespace aero
