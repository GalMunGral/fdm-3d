import { correctCameraUp, makeGrid } from "./utils";
import { FDM } from "./FDM";
import * as THREE from "three";

const N = 30;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const light = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(light);

const directionalLight1 = new THREE.DirectionalLight(0xffffff);
scene.add(directionalLight1);

const directionalLight2 = new THREE.DirectionalLight(0xffff00);
directionalLight2.position.set(1, 0, 1);
scene.add(directionalLight2);

// const axesHelper = new THREE.AxesHelper(5);
// scene.add(axesHelper);

function rand(start: number, end: number) {
  return start + (end - start) * Math.random();
}

const AMPLITUDE = 5000;
const RADIUS = 0.8;

function makeFunction(M: number): Grid<(t: Float) => Float> {
  const center = new THREE.Vector3(0.5, 0.5, 0.5);
  const gaussians: Array<[Float, Float, Float, Float, Float]> = [];

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
      AMPLITUDE * rand(0.1, 1),
      rand(1, 2),
    ]);
  }
  return makeGrid(N, N, N, (i, j, k) => {
    let u = 0;
    for (const [ci, cj, ck, ampl, m] of gaussians) {
      u += i == ci && j == cj && k == ck ? ampl : 0;
    }
    const f = Math.random() * 50;
    return (t: Float) => u * Math.exp(-1 * t) * Math.sin(f * t);
  });
}

const f = makeFunction(20);

const dudt: UserFn = (i, j, k, t, { v }) => v(i, j, k);
const dvdt: UserFn = (i, j, k, t, { d2udx2, d2udy2, d2udz2 }) => {
  return (
    5000 * (d2udx2(i, j, k) + d2udy2(i, j, k) + d2udz2(i, j, k)) + f[i][j][k](t)
  );
};

// camera

let pointerDown = false;
let prevX = -1;
let prevY = -1;
window.addEventListener("pointerdown", (e) => {
  pointerDown = true;
  prevX = e.clientX;
  prevY = e.clientY;
});
window.addEventListener("pointerup", () => (pointerDown = false));
window.addEventListener("pointermove", (e) => {
  if (pointerDown) {
    function toDir(x: number, y: number) {
      const rect = renderer.domElement.getBoundingClientRect();
      const z = camera.position
        .clone()
        .normalize()
        .multiplyScalar(0.25)
        .project(camera).z;

      return new THREE.Vector3(
        ((x - rect.left) / rect.width) * 2 - 1,
        ((rect.bottom - y) / rect.height) * 2 - 1,
        z
      )
        .unproject(camera)
        .normalize();
    }

    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(
      toDir(e.clientX, e.clientY),
      toDir(prevX, prevY)
    );

    camera.position.applyQuaternion(quaternion);
    correctCameraUp(camera);
    camera.lookAt(new THREE.Vector3());

    prevX = e.clientX;
    prevY = e.clientY;
  }
});

let rafHandle = -1;
let mesh: THREE.Mesh | null = null;

(function restart() {
  cancelAnimationFrame(rafHandle);

  camera.position.set(2, 2, 2);
  camera.lookAt(new THREE.Vector3());
  camera.up.set(0, 0, 1);

  const Sol = FDM(
    makeGrid(N, N, N, () => 0),
    makeGrid(N, N, N, () => 0),
    dudt,
    dvdt,
    1,
    0.0001
  );

  let prev = -1;
  let totalSteps = 0;

  rafHandle = requestAnimationFrame(function render(t) {
    if (prev < 0) prev = t;

    const steps = Math.min(10, Math.round((t - prev) / 10));
    Sol.step(steps);
    totalSteps += steps;
    prev = t;

    if (!pointerDown) {
      camera.position.applyAxisAngle(camera.up, 0.005 * steps);
      camera.lookAt(new THREE.Vector3());
    }

    prev = t;

    scene.remove(mesh);
    mesh = makeSlices(Sol.toTexture());
    scene.add(mesh);
    renderer.render(scene, camera);

    rafHandle = requestAnimationFrame(render);
  });

  setTimeout(restart, 30000);
})();

function makeSlices(texture: THREE.Data3DTexture) {
  const W = 10;
  const L = 200;
  const vertices: number[] = [];
  const indices: number[] = [];

  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    camera.position.clone().normalize()
  );

  for (let i = 0; i < L; ++i) {
    const z = -1 + (2 / L) * i;
    vertices.push(
      ...[
        [-W, W, z],
        [W, W, z],
        [W, -W, z],
        [-W, -W, z],
      ]
        .map(([x, y, z]) =>
          new THREE.Vector3(x, y, z).applyQuaternion(quaternion)
        )
        .flatMap((p) => [p.x, p.y, p.z])
    );
    indices.push(...[3, 1, 0, 1, 3, 2].map((j) => 4 * i + j));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(vertices), 3)
  );

  geometry.computeVertexNormals();

  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    uniforms: {
      volume: { value: texture },
    },
    vertexShader: `
      out vec3 vPos;

      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler3D volume;

			in vec3 vPos;
      out vec4 fragColor;

			void main() {
        vec3 color = texture(volume, vPos + vec3(.5, .5, .5)).rgb;
        fragColor = max(max(abs(vPos.x), abs(vPos.y)), abs(vPos.z)) < 0.5 && length(color) > 0.0
          ? vec4(color, 0.01)
          : vec4(0.0, 0.0, 0.0, 0.0);
			}
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);

  return mesh;
}
