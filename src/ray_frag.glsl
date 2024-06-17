#version 300 es
precision mediump sampler3D;
precision mediump float;

#define FLT_MAX 3.402823466e+38
#define M_PI 3.1415926535897932384626433832795

uniform vec2 viewport;
uniform mat3 R_inv;
uniform vec3 eye;
uniform vec3 forward;
uniform vec3 up;
uniform vec3 right;
uniform float focus;
uniform float fov;

uniform sampler3D volume;

out vec4 fragColor;


void main() {
  float scale = (2.0 * focus * tan(fov / 2.0)) /  max(viewport.x, viewport.y);
  float x = (gl_FragCoord.x - viewport.x / 2.0) * scale;
  float y = (gl_FragCoord.y - viewport.y / 2.0) * scale;

  vec3 C = vec3(0.0);
  float A = 0.0;

  vec3 p = R_inv * eye;
  vec3 d = R_inv * (x * right + y * up + focus * forward);
  float w = 5.0;
  for(int i = 0; i < 1000; ++i) {
    p += d;
    if(abs(p.x) < w && abs(p.y) < w && abs(p.z) < w) {
      vec3 c = texture(volume, vec3(p.x / (2.0 * w) + 0.5, p.y / (2.0 * w) + 0.5, p.z / (2.0 * w) + 0.5)).rgb;
      float a = 0.01;
      C += (1.0 - A) * a * c;
      A += (1.0 - A) * a;
    }
  }
  fragColor = vec4(C, 1.0);
}
