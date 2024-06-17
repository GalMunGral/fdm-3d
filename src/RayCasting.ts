import * as THREE from "three";
import { createProgramFromScripts } from "./utils";

export class RayCasting {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;

  private eye = new THREE.Vector3(20, 20, 10);
  private forward = new THREE.Vector3();
  private up = new THREE.Vector3(0, 0, 1);
  private right = new THREE.Vector3();
  private focus = 0.1;
  private fov = Math.PI / 3;

  private e1 = new THREE.Vector3(1, 0, 0);
  private e2 = new THREE.Vector3(0, 1, 0);
  private e3 = new THREE.Vector3(0, 0, 1);

  private keydown: Record<string, boolean> = {};
  private pointerDown = false;
  private prevX = -1;
  private prevY = -1;

  constructor(canvas: HTMLCanvasElement) {
    (async () => {
      this.adjustCameraFrame();

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

      window.addEventListener("keydown", (e) => {
        this.keydown[e.key] = true;
      });

      window.addEventListener("keyup", (e) => {
        this.keydown[e.key] = false;
      });

      window.addEventListener("pointerdown", (e) => {
        this.pointerDown = true;
        this.prevX = e.clientX;
        this.prevY = e.clientY;
      });

      window.addEventListener("pointerup", () => (this.pointerDown = false));

      window.addEventListener("pointermove", (e) => {
        if (this.pointerDown) {
          const q = new THREE.Quaternion()
            .setFromUnitVectors(
              this.toDir(this.prevX, this.prevY),
              this.toDir(e.clientX, e.clientY)
            )
            .normalize();

          this.e1.applyQuaternion(q);
          this.e2.applyQuaternion(q);
          this.e3.applyQuaternion(q);

          this.prevX = e.clientX;
          this.prevY = e.clientY;
        }
      });
    })();
  }

  private toDir(x: number, y: number): THREE.Vector3 {
    return this.eye
      .clone()
      .multiplyScalar(5)
      .add(this.right.clone().multiplyScalar(x - this.gl.canvas.width / 2))
      .add(this.up.clone().multiplyScalar(-(y - this.gl.canvas.height / 2)))
      .normalize();
  }

  private adjustCameraFrame() {
    this.forward = this.eye.clone().multiplyScalar(-1).normalize();
    this.right = this.forward.clone().cross(this.up).normalize();
    this.up = this.right.clone().cross(this.forward).normalize();
  }

  public rotateAboutZ(angle: float) {
    if (!this.pointerDown) {
      const z = new THREE.Vector3(0, 0, 1);
      this.e1.applyAxisAngle(z, angle);
      this.e2.applyAxisAngle(z, angle);
      this.e3.applyAxisAngle(z, angle);
    }
  }

  public render(texture3d: Uint8Array, N: int, dt: float) {
    const { gl, program } = this;
    const { width, height } = gl.canvas;

    if (!program) return;

    if (this.keydown["ArrowUp"]) {
      this.fov += dt * 0.001;
    }
    if (this.keydown["ArrowDown"]) {
      this.fov -= dt * 0.001;
    }

    gl.viewport(0, 0, width, height);
    gl.useProgram(program);

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
      texture3d
    );

    const L = (name: string) => gl.getUniformLocation(program, name);
    const RInv = new THREE.Matrix3(
      this.e1.x,
      this.e1.y,
      this.e1.z,
      this.e2.x,
      this.e2.y,
      this.e2.z,
      this.e3.x,
      this.e3.y,
      this.e3.z
    );
    const inObjectSpace = (v: THREE.Vector3): THREE.Vector3 => {
      return v.clone().applyMatrix3(RInv);
    };

    gl.uniform1i(L(`volume`), 0);
    gl.uniform2fv(L(`viewport`), new Float32Array([width, height]));
    gl.uniform1f(L(`focus`), this.focus);
    gl.uniform1f(L(`fov`), this.fov);
    gl.uniform3fv(L(`eye`), new Float32Array(inObjectSpace(this.eye)));
    gl.uniform3fv(L(`forward`), new Float32Array(inObjectSpace(this.forward)));
    gl.uniform3fv(L(`up`), new Float32Array(inObjectSpace(this.up)));
    gl.uniform3fv(L(`right`), new Float32Array(inObjectSpace(this.right)));

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }
}
