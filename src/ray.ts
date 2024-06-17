import * as THREE from "three";
import * as d3 from "d3";

import { FDM } from "./FDM";
import { rand } from "./utils";
import { RayCasting } from "./RayCasting";

let rafHandle = -1;
(function reset() {
  cancelAnimationFrame(rafHandle);
  const canvas = document.querySelector("canvas")!;
  const renderer = new RayCasting(canvas);

  const transfer = (t: float) => d3.rgb(d3.interpolateViridis(t));

  const N = 50;
  const h = 1;
  const dt = 0.01;

  const c = 50;

  const M = 10;
  const amplitude = 5000;
  const radius = 0.8;

  const min = -1;
  const max = 5;

  const data = new Uint8Array(N * N * N * 4);
  const source = createSourceTerm(N, M, radius, amplitude);
  const sol = new FDM(N, h, dt, c, source);

  let prev = -1;

  rafHandle = requestAnimationFrame(function frame(t: DOMHighResTimeStamp) {
    if (prev < 0) prev = t;
    const dt = t - prev;

    const steps = Math.min(10, Math.round(dt / 10));
    sol.step(1);
    sol.visualize(data, transfer, min, max);

    renderer.render(data, N, dt);
    renderer.rotateAboutZ(0.0005 * dt);

    prev = t;
    rafHandle = requestAnimationFrame(frame);
  });
  setTimeout(reset, 15 * 1000);
})();

function createSourceTerm(
  N: int,
  M: int,
  radius: float,
  amplitude: float
): (t: float) => Array<float> {
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
      return (t: float) => u * Math.exp(-0.1 * t);
    });

  return (t: float) => fs.map((f) => f(t));
}
