import { clamp, createProgramFromScripts } from "./utils";

export class FDM {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private UV: Float32Array;
  private texture0: WebGLTexture | null = null;
  private texture1: WebGLTexture | null = null;
  private fTexture: WebGLTexture | null = null;
  private t = 0;

  public initialized: Promise<void>;

  constructor(
    private N: int,
    private h: float,
    private dt: float,
    private c: float
  ) {
    this.initialized = (async () => {
      this.UV = new Float32Array(N * N * N * 2).fill(0);

      const canvas = new OffscreenCanvas(1, 1);
      canvas.width = N;
      canvas.height = N * N;

      const gl = (this.gl = canvas.getContext("webgl2")!);
      const program = (this.program = await createProgramFromScripts(
        gl,
        "./FDM_vert.glsl",
        "./FDM_frag.glsl"
      ));

      gl.getExtension("EXT_color_buffer_float");

      const vertices = [-1, 1, 1, 1, -1, -1, 1, -1];
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(vertices),
        gl.STATIC_DRAW
      );

      const positionLoc = gl.getAttribLocation(program, "ndcCoord");
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

      function createGrid(init: Array<float>): WebGLTexture | null {
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
          new Float32Array(init),
          0
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return texture;
      }

      this.texture0 = createGrid(Array(N * N * N * 2).fill(0));
      this.texture1 = createGrid(Array(N * N * N * 2).fill(0));

      this.fTexture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.fTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        this.texture1,
        0
      );
    })();
  }

  private swapBuffers() {
    [this.texture0, this.texture1] = [this.texture1, this.texture0];
  }

  public reset(initial: Array<float>) {
    const { gl, texture0, N } = this;
    if (!gl) return;

    gl.bindTexture(gl.TEXTURE_2D, this.texture0);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG32F,
      N,
      N * N,
      0,
      gl.RG,
      gl.FLOAT,
      new Float32Array(initial.flatMap((v) => [v, 0])),
      0
    );
  }

  public step(n: int) {
    const { gl, program, N, h, dt, c } = this;
    if (!program) return;

    gl.viewport(0, 0, N, N * N);
    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, "UV"), 0);
    gl.uniform1i(gl.getUniformLocation(program, "F"), 1);
    gl.uniform1f(gl.getUniformLocation(program, "N"), N);
    gl.uniform1f(gl.getUniformLocation(program, "h"), h);
    gl.uniform1f(gl.getUniformLocation(program, "dt"), dt);
    gl.uniform1f(gl.getUniformLocation(program, "c"), c);

    while (n--) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture0);

      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        this.texture1,
        0
      );

      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

      this.swapBuffers();
      this.t += dt;
    }

    gl.readPixels(0, 0, N, N * N, gl.RG, gl.FLOAT, this.UV, 0);
  }

  public visualize(
    result: Uint8Array,
    transfer: (t: float) => { r: int; g: int; b: int },
    min: number,
    max: number
  ): void {
    const { gl, N } = this;
    if (!gl) return;

    const index = (i: int, j: int, k: int) => (i * N + j) * N + k;

    for (let i = 0; i < N; ++i) {
      for (let j = 0; j < N; ++j) {
        for (let k = 0; k < N; ++k) {
          const t = clamp(
            (this.UV[index(i, j, k) * 2] - min) / (max - min),
            0,
            1
          );
          const color = transfer(t);
          const base = index(i, j, k) * 4;
          result[base] = color.r;
          result[base + 1] = color.g;
          result[base + 2] = color.b;
          result[base + 3] = (0.5 + 0.5 * t) * 0.05 * 255;
        }
      }
    }

    // const texture = new THREE.Data3DTexture(data, N, N, N);
    // texture.format = THREE.RGBAFormat;
    // texture.type = THREE.UnsignedByteType;
    // texture.minFilter = texture.magFilter = THREE.LinearFilter;
    // texture.needsUpdate = true;
    // texture.wrapR = texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  }
}
