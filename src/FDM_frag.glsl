#version 300 es
precision mediump float;

uniform sampler2D UV;
uniform sampler2D F;
uniform float N;
uniform float c;
uniform float h;
uniform float dt;

in vec2 texCoord;
out vec4 fragColor;

void main() {

#define u(x, y, z)                                                             \
  texture(UV, vec2(mod(x, N) / N, (mod(z, N) * N + mod(y, N)) / (N * N))).x
#define v(x, y, z)                                                             \
  texture(UV, vec2(mod(x, N) / N, (mod(z, N) * N + mod(y, N)) / (N * N))).y
#define f(x, y, z)                                                             \
  texture(F, vec2(mod(x, N) / N, (mod(z, N) * N + mod(y, N)) / (N * N))).x

  float x = gl_FragCoord.x;
  float y = mod(gl_FragCoord.y, N);
  float z = floor(gl_FragCoord.y / N);

  float dudx = (u(x + 1.0, y, z) - u(x - 1.0, y, z)) / (2.0 * h);
  float dudy = (u(x, y + 1.0, z) - u(x, y - 1.0, z)) / (2.0 * h);
  float dudz = (u(x, y, z + 1.0) - u(x, y, z - 1.0)) / (2.0 * h);
  float d2udx2 =
      (u(x - 1.0, y, z) - 2.0 * u(x, y, z) + u(x + 1.0, y, z)) / (h * h);
  float d2udy2 =
      (u(x, y - 1.0, z) - 2.0 * u(x, y, z) + u(x, y + 1.0, z)) / (h * h);
  float d2udz2 =
      (u(x, y, z - 1.0) - 2.0 * u(x, y, z) + u(x, y, z + 1.0)) / (h * h);

  float dudt = v(x, y, z);
  float dvdt = c * (d2udx2 + d2udy2 + d2udz2) + f(x, y, z); // wave equation

  fragColor.x = u(x, y, z) + dt * dudt;
  fragColor.y = v(x, y, z) + dt * dvdt;
}