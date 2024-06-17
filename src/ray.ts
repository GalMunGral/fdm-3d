import * as THREE from "three";
import * as d3 from "d3";

import { FDM } from "./FDM";
import { rand } from "./utils";
import { RayCasting } from "./RayCasting";

(async function main() {
  const canvas = document.querySelector("canvas")!;
  const renderer = new RayCasting(canvas);

  const transfer = (t: float) => d3.rgb(d3.interpolateInferno(t));

  const N = 25;
  const h = 1;
  const dt = 0.01;

  const c = 5;

  const M = 10;
  const amplitude = 100;
  const radius = 0.5;

  const min = 0;
  const max = 50;

  const data = new Uint8Array(N * N * N * 4);
  const sol = new FDM(N, h, dt, c);

  await sol.initialized;

  let rafHandle = -1;
  (function reset() {
    cancelAnimationFrame(rafHandle);

    sol.reset(initialValues(N, M, radius, amplitude));

    let prev = -1;
    rafHandle = requestAnimationFrame(function frame(t: DOMHighResTimeStamp) {
      if (prev < 0) prev = t;
      const dt = t - prev;

      const steps = Math.min(10, Math.round(dt / 10));
      sol.step(steps);
      sol.visualize(data, transfer, min, max);

      renderer.render(data, N, dt);
      renderer.rotateAboutZ(0.0005 * dt);

      prev = t;
      rafHandle = requestAnimationFrame(frame);
    });
    setTimeout(reset, 5 * 1000);
  })();
})();

function initialValues(
  N: int,
  M: int,
  radius: float,
  amplitude: float
): Array<float> {
  const center = new THREE.Vector3(0.5, 0.5, 0.5);
  const gaussians: Array<[float, float, float, float]> = [];

  for (let i = 0; i < M; ++i) {
    let point = new THREE.Vector3(Math.random(), Math.random(), Math.random());
    while (point.distanceTo(center) > radius) {
      point = new THREE.Vector3(Math.random(), Math.random(), Math.random());
    }
    point.multiplyScalar(N);
    gaussians.push([
      Math.round(point.x),
      Math.round(point.y),
      Math.round(point.z),
      amplitude * rand(0, 2),
    ]);
  }

  return Array(N * N * N)
    .fill(0)
    .map((_, idx) => {
      const i = Math.floor(idx / (N * N));
      const j = Math.floor(idx / N) % N;
      const k = idx % N;
      let u = 0;
      for (const [ci, cj, ck, ampl] of gaussians) {
        const rsqrd = (i - ci) ** 2 + (j - cj) ** 2 + (k - ck) ** 2;
        u += ampl * Math.exp(-0.1 * rsqrd);
      }
      return u;
    });
}
