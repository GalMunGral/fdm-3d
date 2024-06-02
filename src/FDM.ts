import * as THREE from "three";
import * as d3 from "d3";
import { createProgramFromScripts, rand } from "./utils";

const canvas = new OffscreenCanvas(1, 1);
const gl = canvas.getContext("webgl2")!;
const program = await createProgramFromScripts(
  gl,
  "./FDM_vert.glsl",
  "./FDM_frag.glsl"
);

gl.getExtension("EXT_color_buffer_float");

const vertices = [-1, 1, 1, 1, -1, -1, 1, -1];
var buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
var positionLoc = gl.getAttribLocation(program, "ndcCoord");
gl.enableVertexAttribArray(positionLoc);
gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

const indexBuffer = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
const indices = [2, 1, 0, 1, 2, 3];
gl.bufferData(
  gl.ELEMENT_ARRAY_BUFFER,
  new Uint16Array(indices),
  gl.STATIC_DRAW
);

export function createImage(
  gl: WebGL2RenderingContext,
  N: int,
  init: Float32Array
): WebGLTexture {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RG32F,
    N,
    N * N,
    0,
    gl.RG,
    gl.FLOAT,
    init,
    0
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

export async function FDM(N: int, h: float, dt: float) {
  canvas.width = N;
  canvas.height = N * N;
  gl.viewport(0, 0, N, N * N);
  gl.useProgram(program);

  const AMPLITUDE = 5000;
  const RADIUS = 0.8;

  // initial values
  const center = new THREE.Vector3(0.5, 0.5, 0.5);
  const gaussians: Array<[float, float, float, float]> = [];

  const M = 30;
  for (let i = 0; i < M; ++i) {
    let point = new THREE.Vector3(Math.random(), Math.random(), Math.random());
    while (point.distanceTo(center) > RADIUS) {
      point = new THREE.Vector3(Math.random(), Math.random(), Math.random());
    }
    point.multiplyScalar(N);
    gaussians.push([
      Math.round(point.x),
      Math.round(point.y),
      Math.round(point.z),
      AMPLITUDE * rand(0, 2),
    ]);
  }

  const FREQ = 5;

  const fs = Array(N * N * N)
    .fill(0)
    .map((_, idx) => {
      const i = Math.floor(idx / (N * N));
      const j = Math.floor(idx / N) % N;
      const k = idx % N;
      let u = 0;
      for (const [ci, cj, ck, ampl] of gaussians) {
        u += i == ci && j == cj && k == ck ? ampl : 0;
      }
      const f = Math.random() * FREQ;
      return (t: float) => u * Math.exp(-1 * t) * Math.sin(f * t);
    });

  const F = (t: float) => fs.map((f) => f(t));

  const fTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, fTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  let texture0 = createImage(gl, N, new Float32Array(N * N * N * 2).fill(0));
  let texture1 = createImage(gl, N, new Float32Array(N * N * N * 2).fill(0));

  gl.uniform1i(gl.getUniformLocation(program, "UV"), 0);
  gl.uniform1i(gl.getUniformLocation(program, "F"), 1);
  gl.uniform1f(gl.getUniformLocation(program, "N"), N);
  gl.uniform1f(gl.getUniformLocation(program, "h"), h);
  gl.uniform1f(gl.getUniformLocation(program, "dt"), dt);

  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

  let t = 0;
  function step(n: int) {
    while (n--) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, fTexture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.R32F,
        N,
        N * N,
        0,
        gl.RED,
        gl.FLOAT,
        new Float32Array(F(t)),
        0
      );

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture0);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture1,
        0
      );

      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

      [texture0, texture1] = [texture1, texture0];
      t += dt;
    }
  }

  step(1);

  const index = (i: int, j: int, k: int) => (i * N + j) * N + k;

  const UV = new Float32Array(N * N * N * 2).fill(0);

  function toTexture(): THREE.Data3DTexture {
    gl.readPixels(0, 0, N, N * N, gl.RG, gl.FLOAT, UV, 0);

    let min = Infinity;
    let max = -Infinity;
    // for (let i = 0; i < N; ++i) {
    //   for (let j = 0; j < N; ++j) {
    //     for (let k = 0; k < N; ++k) {
    //       min = Math.min(min, UV[index(i, j, k) * 2]);
    //       max = Math.max(max, UV[index(i, j, k) * 2]);
    //     }
    //   }
    // }

    min = -0.5;
    max = 2;

    const data = new Uint8Array(N * N * N * 4);

    for (let i = 0; i < N; ++i) {
      for (let j = 0; j < N; ++j) {
        for (let k = 0; k < N; ++k) {
          const t = (UV[index(i, j, k) * 2] - min) / (max - min);
          const color = d3.rgb(d3.interpolateMagma(t));
          const base = index(i, j, k) * 4;
          data[base] = color.r;
          data[base + 1] = color.g;
          data[base + 2] = color.b;
        }
      }
    }

    const texture = new THREE.Data3DTexture(data, N, N, N);
    texture.format = THREE.RGBAFormat;
    texture.type = THREE.UnsignedByteType;
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    texture.wrapR = texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  function toRealTexture() {
    gl.readPixels(0, 0, N, N * N, gl.RG, gl.FLOAT, UV, 0);

    let min = Infinity;
    let max = -Infinity;
    // for (let i = 0; i < N; ++i) {
    //   for (let j = 0; j < N; ++j) {
    //     for (let k = 0; k < N; ++k) {
    //       min = Math.min(min, UV[index(i, j, k) * 2]);
    //       max = Math.max(max, UV[index(i, j, k) * 2]);
    //     }
    //   }
    // }

    min = -0.5;
    max = 2;

    const data = new Uint8Array(N * N * N * 4);

    for (let i = 0; i < N; ++i) {
      for (let j = 0; j < N; ++j) {
        for (let k = 0; k < N; ++k) {
          const t = (UV[index(i, j, k) * 2] - min) / (max - min);
          const color = d3.rgb(d3.interpolateMagma(t));
          const base = index(i, j, k) * 4;
          data[base] = color.r;
          data[base + 1] = color.g;
          data[base + 2] = color.b;
        }
      }
    }
    return { N, data };
  }

  return {
    step,
    toTexture,
    toRealTexture,
  };
}
