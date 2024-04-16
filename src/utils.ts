import * as THREE from "three";

export function makeGrid<T>(
  l: Int,
  m: Int,
  n: Int,
  fn: (i: Int, j: Int, k: Int) => T
): Grid<T> {
  return Array(l)
    .fill(0)
    .map((_, i) =>
      Array(m)
        .fill(0)
        .map((_, j) =>
          Array(n)
            .fill(0)
            .map((_, k) => fn(i, j, k))
        )
    );
}

export function clamp(v: Float, min: Float, max: Float): Float {
  return Math.max(min, Math.min(max, v));
}

export function correctCameraUp(camera: THREE.Camera) {
  const forward = camera.position.clone().normalize().multiplyScalar(-1);
  const right = forward.clone().cross(camera.up);
  camera.up = right.cross(forward);
}
