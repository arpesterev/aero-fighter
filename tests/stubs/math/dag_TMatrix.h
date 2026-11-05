#pragma once
struct Point3 {
  float x=0,y=0,z=0;
  Point3()=default;
  Point3(float a,float b,float c):x(a),y(b),z(c){}
};
struct TMatrix {
  static const TMatrix IDENT;
  Point3 operator*(Point3 p) const{return p;}
};
inline const TMatrix TMatrix::IDENT = {};
