import * as THREE from "three";
import { makeGrid } from "./utils";
import * as d3 from "d3";

export function FDM(
  U: Grid,
  V: Grid,
  dudt: UserFn,
  dvdt: UserFn,
  h: Float,
  dt: Float
) {
  const l = U.length;
  const m = U[0].length;
  const n = U[0][0].length;
  let t = 0;

  const u: Fn = (i, j, k) => U[(i + l) % l][(j + m) % m][(k + n) % n];
  const v: Fn = (i, j, k) => V[(i + l) % l][(j + m) % m][(k + n) % n];

  const dudx: Fn = (i, j, k) => (u(i, j, k + 1) - u(i, j, k - 1)) / (2 * h);
  const dudy: Fn = (i, j, k) => (u(i, j + 1, k) - u(i, j - 1, k)) / (2 * h);
  const dudz: Fn = (i, j, k) => (u(i + 1, j, k) - u(i - 1, j, k)) / (2 * h);

  const d2udx2: Fn = (i, j, k) =>
    (u(i, j, k - 1) - 2 * u(i, j, k) + u(i, j, k + 1)) / h ** 2;
  const d2udy2: Fn = (i, j, k) =>
    (u(i, j - 1, k) - 2 * u(i, j, k) + u(i, j + 1, k)) / h ** 2;
  const d2udz2: Fn = (i, j, k) =>
    (u(i - 1, j, k) - 2 * u(i, j, k) + u(i + 1, j, k)) / h ** 2;

  function step(iters: Int): void {
    while (iters--) {
      t += dt;
      const _U = makeGrid(l, m, n, () => 0);
      const _V = makeGrid(l, m, n, () => 0);
      for (let i = 0; i < l; ++i) {
        for (let j = 0; j < m; ++j) {
          for (let k = 0; k < n; ++k) {
            const du =
              dudt(i, j, k, t, {
                u,
                v,
                dudx,
                dudy,
                dudz,
                d2udx2,
                d2udy2,
                d2udz2,
              }) * dt;
            const dv =
              dvdt(i, j, k, t, {
                u,
                v,
                dudx,
                dudy,
                dudz,
                d2udx2,
                d2udy2,
                d2udz2,
              }) * dt;

            if (isNaN(du) || isNaN(dv)) throw new Error("NaN");

            _U[i][j][k] = U[i][j][k] + du;
            _V[i][j][k] = V[i][j][k] + dv;
          }
        }
      }
      U = _U;
      V = _V;
    }
  }

  const index = (i: Int, j: Int, k: Int) => (i * m + j) * n + k;

  function toTexture(): THREE.Data3DTexture {
    // let min = Infinity;
    // let max = -Infinity;
    // for (let i = 0; i < l; ++i) {
    //   for (let j = 0; j < m; ++j) {
    //     for (let k = 0; k < n; ++k) {
    //       min = Math.min(min, u(i, j, k));
    //       max = Math.max(max, u(i, j, k));
    //     }
    //   }
    // }

    let min = 0;
    let max = 0.5;

    const data = new Uint8Array(l * m * n * 4);

    for (let i = 0; i < l; ++i) {
      for (let j = 0; j < m; ++j) {
        for (let k = 0; k < n; ++k) {
          const t = (u(i, j, k) - min) / (max - min);
          const color = d3.rgb(d3.interpolateInferno(t));
          const base = ((i * m + j) * n + k) * 4;
          data[base] = color.r;
          data[base + 1] = color.g;
          data[base + 2] = color.b;
        }
      }
    }

    const texture = new THREE.Data3DTexture(data, n, m, l);
    texture.format = THREE.RGBAFormat;
    texture.type = THREE.UnsignedByteType;
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    texture.wrapR = texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  function toMesh(i: Int): THREE.Mesh {
    const vertices: number[] = [];
    for (let j = 0; j < m; ++j) {
      for (let k = 0; k < n; ++k) {
        vertices.push(k / (n - 1), j / (m - 1), u(i, j, k) / 2);
      }
    }

    const indices: number[] = [];
    for (let j = 1; j < m; ++j) {
      for (let k = 1; k < n; ++k) {
        indices.push(
          index(i, j - 1, k - 1),
          index(i, j, k),
          index(i, j, k - 1)
        );
        indices.push(
          index(i, j, k),
          index(i, j - 1, k - 1),
          index(i, j - 1, k)
        );
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(vertices), 3)
    );
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      roughness: 0,
    });
    const mesh = new THREE.Mesh(geometry, material);

    return mesh;
  }

  return {
    step,
    toMesh,
    toTexture,
  };
}
