import { correctCameraUp, makeGrid } from "./utils";
import { FDM } from "./FDM";
import * as THREE from "three";

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

const vertexShaderSource = await (await fetch("./vol_vert.glsl")).text();
const fragmentShaderSource = await (await fetch("./vol_frag.glsl")).text();

(async function restart() {
  cancelAnimationFrame(rafHandle);

  camera.position.set(1.5, 1.5, 1.5);
  camera.lookAt(new THREE.Vector3());
  camera.up.set(0, 0, 1);

  const Sol = await FDM(40, 1, 0.001);

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

  setTimeout(restart, 20000);
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
    vertexShader: vertexShaderSource,
    fragmentShader: fragmentShaderSource,
  });

  const mesh = new THREE.Mesh(geometry, material);

  return mesh;
}
