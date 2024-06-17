import * as THREE from "three";

export function rand(min: float, max: float) {
  return min + (max - min) * Math.random();
}

export const makeGrid = (m: int, n: int, fn: (i: int, j: int) => float) =>
  Array<float>(m * n)
    .fill(0)
    .map((_, k) => fn(k / n, k % n));

export function zeros(m: int, n: int): Array<float> {
  return makeGrid(m, n, () => 0);
}

export function random(m: int, n: int): Array<float> {
  return makeGrid(m, n, () => Math.random());
}

export function sinusoid1D(m: int, n: int, kx: float, ky: float): Array<float> {
  return makeGrid(m, n, (i, j) => Math.sin(kx * j + ky * i));
}

export function sinusoid2D(m: int, n: int, k: float): Array<float> {
  return makeGrid(m, n, (i, j) =>
    Math.sin(k * Math.sqrt((j - n / 2) ** 2 + (i - m / 2) ** 2))
  );
}

export function clamp(v: float, min: float, max: float): float {
  return Math.max(min, Math.min(max, v));
}

export function correctCameraUp(camera: THREE.Camera) {
  const forward = camera.position.clone().normalize().multiplyScalar(-1);
  const right = forward.clone().cross(camera.up);
  camera.up = right.cross(forward);
}

function compileShader(
  gl: WebGL2RenderingContext,
  shaderSource: string,
  shaderType: GLenum
) {
  const shader = gl.createShader(shaderType)!;
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!success) {
    throw "could not compile shader:" + gl.getShaderInfoLog(shader);
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
) {
  const program = gl.createProgram()!;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  const success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!success) {
    throw "program failed to link:" + gl.getProgramInfoLog(program);
  }

  return program;
}

async function createShaderFromScript(
  gl: WebGL2RenderingContext,
  url: string,
  opt_shaderType: GLenum
) {
  var shaderSource = await (await fetch(url)).text();
  return compileShader(gl, shaderSource, opt_shaderType);
}

export async function createProgramFromScripts(
  gl: WebGL2RenderingContext,
  vertexShaderUrl: string,
  fragmentShaderUrl: string
) {
  var vertexShader = await createShaderFromScript(
    gl,
    vertexShaderUrl,
    gl.VERTEX_SHADER
  );
  var fragmentShader = await createShaderFromScript(
    gl,
    fragmentShaderUrl,
    gl.FRAGMENT_SHADER
  );
  return createProgram(gl, vertexShader, fragmentShader);
}
