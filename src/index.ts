import { correctCameraUp, makeGrid } from "./utils";
import { FDM } from "./FDM";
import * as THREE from "three";

const N = 40;

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

const CAMERA_DIST = 1;
camera.translateY(-CAMERA_DIST);
camera.lookAt(new THREE.Vector3());
camera.up.set(0, 0, 1);

// const axesHelper = new THREE.AxesHelper(5);
// scene.add(axesHelper);

const AMPLITUDE = 0.5;

function rand(start: number, end: number) {
  return start + (end - start) * Math.random();
}

function initialValue(M: number): Fn {
  const gaussians: Array<[Float, Float, Float, Float, Float]> = [];
  for (let i = 0; i < M; ++i) {
    const margin = 0.3;
    gaussians.push([
      rand(margin, 1 - margin) * N,
      rand(margin, 1 - margin) * N,
      rand(margin, 1 - margin) * N,
      (AMPLITUDE / Math.sqrt(M)) * rand(0.1, 1),
      rand(0.05, 0.5),
    ]);
  }
  return (i, j, k) => {
    let u = 0;
    for (const [ci, cj, ck, ampl, m] of gaussians) {
      u +=
        ampl * Math.exp(-m * ((i - ci) ** 2 + (j - cj) ** 2 + (k - ck) ** 2));
    }
    return u;
  };
}

const dudt: UserFn = (i, j, k, { v }) => v(i, j, k);
const dvdt: UserFn = (i, j, k, { d2udx2, d2udy2, d2udz2 }) =>
  50 * (d2udx2(i, j, k) + d2udy2(i, j, k) + d2udz2(i, j, k));

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
        .multiplyScalar(1 / 2)
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

const helpText = document.querySelector("#help");
const audio = document.querySelector("audio");

window.onkeydown = restart;
audio.onended = restart;

function restart() {
  document.body.requestFullscreen();
  cancelAnimationFrame(rafHandle);

  audio.currentTime = 0;
  audio.play();
  helpText.remove();

  const Sol = FDM(
    makeGrid(N, N, N, initialValue(100)),
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
      camera.position.applyAxisAngle(camera.up, 0.01 * steps);
      camera.lookAt(new THREE.Vector3());
    }

    prev = t;

    scene.remove(mesh);
    mesh = makeSlices(Sol.toTexture());
    scene.add(mesh);
    renderer.render(scene, camera);

    rafHandle = requestAnimationFrame(render);
  });
}

function makeSlices(texture: THREE.Data3DTexture) {
  const W = 2;
  const L = 100;
  const vertices: number[] = [];
  const indices: number[] = [];

  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    camera.position.clone().normalize()
  );

  for (let i = 0; i < L; ++i) {
    const z = -0.5 + (1 / L) * i;
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
        if (length(vPos) < 0.5) {
          fragColor = vec4(
            texture(volume, vPos + vec3(.5, .5, .5)).rgb,
            0.01
          );
        }
			}
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);

  return mesh;
}
