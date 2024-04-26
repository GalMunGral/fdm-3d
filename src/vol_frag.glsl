
uniform sampler3D volume;

in vec3 vPos;
out vec4 fragColor;

void main() {
  vec3 color = texture(volume, vPos + vec3(.5, .5, .5)).rgb;
  fragColor = max(max(abs(vPos.x), abs(vPos.y)), abs(vPos.z)) < 0.5 &&
                      length(color) > 0.0
                  ? vec4(color, 0.005)
                  : vec4(0.0, 0.0, 0.0, 0.0);
}