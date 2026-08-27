// Deterministic tiled value-noise lattice for the accretion-disk material.

import { sampler, type Gpu } from "vgpu";

export const NOISE_VOLUME_SIZE = 64;

const FORMAT = "r8unorm";
const SEED = 13;
const fr = Math.fround;
const fract = (value: number) => fr(value - Math.floor(value));
const K0 = fr(0.1031);
const K1 = fr(0.103);
const K2 = fr(0.0973);
const K3 = fr(33.33);

function hash31(x: number, y: number, z: number): number {
  let qx = fract(fr(x * K0));
  let qy = fract(fr(y * K1));
  let qz = fract(fr(z * K2));
  const d = fr(fr(fr(qx * fr(qy + K3)) + fr(qy * fr(qz + K3))) + fr(qz * fr(qx + K3)));
  qx = fr(qx + d);
  qy = fr(qy + d);
  qz = fr(qz + d);
  return fract(fr(fr(qx + qy) * qz));
}

/** Signed lattice coordinates keep the disk's angular axes tileable. */
function latticeCoord(index: number, size: number): number {
  return index < size / 2 ? index : index - size;
}

function buildNoiseVolume(size: number, seed: number): Uint8Array {
  const data = new Uint8Array(size * size * size);
  const offset = seed * 1024;
  let cursor = 0;
  for (let z = 0; z < size; z++) {
    const pz = latticeCoord(z, size) + offset;
    for (let y = 0; y < size; y++) {
      const py = latticeCoord(y, size);
      for (let x = 0; x < size; x++) {
        data[cursor++] = Math.min(255, Math.round(hash31(latticeCoord(x, size), py, pz) * 255));
      }
    }
  }
  return data;
}

let cached: Uint8Array | undefined;

function noiseVolumeData(size: number): Uint8Array {
  cached ??= buildNoiseVolume(size, SEED);
  return cached;
}

export function createNoiseVolume(gpu: Gpu, size = NOISE_VOLUME_SIZE, label = "paradox-noise-volume") {
  const texture = gpu.device.createTexture({
    size: [size, size, size],
    dimension: "3d",
    format: FORMAT,
    usage: ["texture_binding", "copy_dst"],
    label,
  });
  try {
    gpu.gpu.queue.writeTexture(
      { texture: texture.gpu },
      noiseVolumeData(size),
      { offset: 0, bytesPerRow: size, rowsPerImage: size },
      { width: size, height: size, depthOrArrayLayers: size },
    );
    return texture;
  } catch (error) {
    try {
      texture.destroy();
    } catch {
      // Preserve the upload failure that made this texture unusable.
    }
    throw error;
  }
}

export function noiseVolumeSampler(gpu: Gpu) {
  return sampler(gpu, {
    addressModeU: "repeat",
    addressModeV: "repeat",
    addressModeW: "repeat",
    minFilter: "linear",
    magFilter: "linear",
  });
}
