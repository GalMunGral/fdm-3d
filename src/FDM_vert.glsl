#version 300 es

in vec2 ndcCoord;
in vec2 vTexCoord;
out vec2 texCoord;

void main() {
  gl_Position = vec4(ndcCoord, 0.0, 1.0);
  texCoord = vTexCoord;
}
