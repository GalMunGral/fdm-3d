import * as THREE from "three";

import { FDM } from "./FDM";
import { createProgramFromScripts } from "./utils";

class RayCasting {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;

  private eye = new THREE.Vector3(20, 20, 20);
  private forward = new THREE.Vector3();
  private up = new THREE.Vector3(0, 0, 1);
  private right = new THREE.Vector3();

  private pointerDown = false;
  private prevX = -1;
  private prevY = -1;

  constructor(private canvas: HTMLCanvasElement) {
    (async () => {
      const r = 1;
      canvas.width = window.innerWidth / r;
      canvas.height = window.innerHeight / r;
      canvas.style.height = window.innerHeight + "px";
      const gl = (this.gl = canvas.getContext("webgl2", { antialias: true })!);

      const program = (this.program = await createProgramFromScripts(
        gl,
        "./ray_vert.glsl",
        "./ray_frag.glsl"
      ));

      const vertices = [-1, 1, 1, 1, -1, -1, 1, -1];
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(vertices),
        gl.STATIC_DRAW
      );

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

      const fTexture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_3D, fTexture);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      window.addEventListener("pointerdown", (e) => {
        this.pointerDown = true;
        this.prevX = e.clientX;
        this.prevY = e.clientY;
      });
      window.addEventListener("pointerup", () => (this.pointerDown = false));

      const scale = Math.max(canvas.width, canvas.height);

      window.addEventListener("pointermove", (e) => {
        if (this.pointerDown) {
          const quaternion = new THREE.Quaternion();
          const dist = this.eye.length();
          const toDir = (x: number, y: number) => {
            x = (((x - canvas.width / 2) / scale) * dist) / 0.7;
            y = (((y - canvas.height / 2) / scale) * dist) / 0.7;
            return this.eye
              .clone()
              .add(this.right.clone().multiplyScalar(x))
              .add(this.up.clone().multiplyScalar(y));
          };
          quaternion.setFromUnitVectors(
            toDir(e.clientX, e.clientY),
            toDir(this.prevX, this.prevY)
          );

          this.eye.applyQuaternion(quaternion);
          this.adjustCameraFrame();
          this.prevX = e.clientX;
          this.prevY = e.clientY;
        }
      });
    })();
  }

  private adjustCameraFrame() {
    this.forward = this.eye.clone().multiplyScalar(-1).normalize();
    this.right = this.forward.clone().cross(this.up).normalize();
    this.up = this.right.clone().cross(this.forward).normalize();
  }

  rotate(angle: number) {
    if (!this.pointerDown) {
      this.eye.applyAxisAngle(this.up, -angle);
      this.adjustCameraFrame();
    }
  }

  render(N: number, data: Uint8Array) {
    const { gl, program } = this;
    if (!program) return;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.useProgram(program);

    const loc = (name: string) => gl.getUniformLocation(program, name);

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

    gl.uniform2fv(
      loc(`viewport`),
      new Float32Array([gl.canvas.width, gl.canvas.height])
    );
    gl.uniform3fv(loc(`eye`), new Float32Array(this.eye));
    gl.uniform3fv(loc(`forward`), new Float32Array(this.forward));
    gl.uniform3fv(loc(`up`), new Float32Array(this.up));
    gl.uniform3fv(loc(`right`), new Float32Array(this.right));
    gl.uniform1i(loc(`volume`), 0);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }
}

async function main() {
  const canvas = document.querySelector("canvas")!;
  const renderer = new RayCasting(canvas);

  const Sol = await FDM(40, 1, 0.001);

  let prev = -1;
  requestAnimationFrame(function frame(t: DOMHighResTimeStamp) {
    if (prev < 0) prev = t;

    const steps = Math.min(10, Math.round((t - prev) / 10));
    Sol.step(steps);
    const { N, data } = Sol.toRealTexture();
    const angle = 0.005 * steps;
    renderer.render(N, data);
    renderer.rotate(angle);

    prev = t;
    requestAnimationFrame(frame);
  });
}

main();
