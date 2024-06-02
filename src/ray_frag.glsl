#version 300 es
precision mediump sampler3D;
precision mediump float;

#define FLT_MAX 3.402823466e+38
#define M_PI 3.1415926535897932384626433832795

uniform vec2 viewport;
uniform vec3 eye;
uniform vec3 forward;
uniform vec3 up;
uniform vec3 right;

uniform sampler3D volume;

out vec4 fragColor;

void main() {
  float f = 0.1f;
  float scale = max(viewport.x, viewport.y);
  float x = (gl_FragCoord.x - viewport.x / 2.0f) / scale * f;
  float y = -(gl_FragCoord.y - viewport.y / 2.0f) / scale * f;

  vec3 C = vec3(0.0f);
  float A = 0.0f;

  vec3 p = eye;
  vec3 d = x * right + y * up + f * forward;
  float w = 5.f;
  for(int i = 0; i < 1000; ++i) {
    p += d;
    if(abs(p.x) < w && abs(p.y) < w && abs(p.z) < w) {
      vec3 c = texture(volume, vec3(p.x / (2.0f * w) + 0.5f, p.y / (2.0f * w) + 0.5f, p.z / (2.0f * w) + 0.5f)).rgb;
      float a = 0.01f;
      C += (1.0f - A) * a * c;
      A += (1.0f - A) * a;
    }
  }
  fragColor = vec4(C, 1.0f);
}
