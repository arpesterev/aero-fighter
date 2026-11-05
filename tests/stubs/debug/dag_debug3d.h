#pragma once
#include <math/dag_TMatrix.h>
#include <cstdint>
struct E3DCOLOR {
  std::uint8_t r,g,b,a;
  E3DCOLOR(int red,int green,int blue,int alpha=255):
    r(std::uint8_t(red)),g(std::uint8_t(green)),b(std::uint8_t(blue)),a(std::uint8_t(alpha)){}
};
inline void begin_draw_cached_debug_lines(bool,bool){}
inline void set_cached_debug_lines_wtm(const TMatrix &){}
inline void draw_cached_debug_line(const Point3&,const Point3&,E3DCOLOR){}
inline void draw_cached_debug_trilist(const Point3*,int,E3DCOLOR){}
inline void end_draw_cached_debug_lines(){}
