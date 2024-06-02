import * as THREE from "three";

import { FDM } from "./FDM";

function compileShader(
  gl: WebGL2RenderingContext,
  shaderSource: string,
  shaderType: GLenum
) {
  var shader = gl.createShader(shaderType)!;
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
  var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
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
  var program = gl.createProgram()!;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  var success = gl.getProgramParameter(program, gl.LINK_STATUS);
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

async function createProgramFromScripts(gl: WebGL2RenderingContext) {
  var vertexShader = await createShaderFromScript(
    gl,
    "./ray_vert.glsl",
    gl.VERTEX_SHADER
  );
  var fragmentShader = await createShaderFromScript(
    gl,
    "./ray_frag.glsl",
    gl.FRAGMENT_SHADER
  );
  return createProgram(gl, vertexShader, fragmentShader);
}

async function main() {
  const canvas = document.querySelector("canvas")!;
  const r = 1;
  canvas.width = window.innerWidth / r;
  canvas.height = window.innerHeight / r;
  canvas.style.height = window.innerHeight + "px";
  const gl = canvas.getContext("webgl2", { antialias: true })!;
  const program = await createProgramFromScripts(gl);

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

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.useProgram(program);

  const fTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_3D, fTexture);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const loc = (name: string) => gl.getUniformLocation(program, name);

  let eye = new THREE.Vector3(20, 20, 20);
  let forward = new THREE.Vector3();
  let up = new THREE.Vector3(0, 0, 1);
  let right = new THREE.Vector3();

  let pointerDown = false;
  let prevX = -1;
  let prevY = -1;
  window.addEventListener("pointerdown", (e) => {
    pointerDown = true;
    prevX = e.clientX;
    prevY = e.clientY;
  });
  window.addEventListener("pointerup", () => (pointerDown = false));

  const scale = Math.max(canvas.width, canvas.height);

  window.addEventListener("pointermove", (e) => {
    if (pointerDown) {
      const quaternion = new THREE.Quaternion();
      const dist = eye.length();
      const toDir = (x: number, y: number) => {
        x = (((x - canvas.width / 2) / scale) * dist) / 0.7;
        y = (((y - canvas.height / 2) / scale) * dist) / 0.7;
        return eye
          .clone()
          .add(right.clone().multiplyScalar(x))
          .add(up.clone().multiplyScalar(y));
      };
      quaternion.setFromUnitVectors(
        toDir(e.clientX, e.clientY),
        toDir(prevX, prevY)
      );

      eye.applyQuaternion(quaternion);
      adjustCameraFrame();
      prevX = e.clientX;
      prevY = e.clientY;
    }
  });

  function adjustCameraFrame() {
    forward = eye.clone().multiplyScalar(-1).normalize();
    right = forward.clone().cross(up).normalize();
    up = right.clone().cross(forward).normalize();
  }

  const Sol = await FDM(40, 1, 0.001);
  let prev = -1;
  let totalSteps = 0;

  function render(t: DOMHighResTimeStamp) {
    if (prev < 0) prev = t;

    const steps = Math.min(10, Math.round((t - prev) / 10));
    Sol.step(steps);

    const { N, data } = Sol.toRealTexture();

    gl.texImage3D(
      gl.TEXTURE_3D,
      0,
      gl.RGBA,
      N,
      N,
      N,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data
    );

    totalSteps += steps;
    prev = t;

    if (!pointerDown) {
      eye.applyAxisAngle(up, 0.005 * steps);
      adjustCameraFrame();
    }

    gl.uniform2fv(
      loc(`viewport`),
      new Float32Array([canvas.width, canvas.height])
    );
    gl.uniform3fv(loc(`eye`), new Float32Array(eye));
    gl.uniform3fv(loc(`forward`), new Float32Array(forward));
    gl.uniform3fv(loc(`up`), new Float32Array(up));
    gl.uniform3fv(loc(`right`), new Float32Array(right));
    gl.uniform1i(loc(`volume`), 0);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    requestAnimationFrame(render);
  }

  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  requestAnimationFrame(render);
}

main();
