export const lensFieldWgsl = /* wgsl */ `
struct Params {
  resolution: vec2f,
  center: vec2f,
  pointer: vec2f,
  time: f32,
  divergence: f32,
  violation: f32,
}

@group(0) @binding(0) var<uniform> params: Params;

const AGENT_TINT = vec3f(0.36, 0.62, 1.0);
const HUMAN_TINT = vec3f(1.0, 0.76, 0.30);
const VIOLATION_TINT = vec3f(1.0, 0.22, 0.30);
const SPACE_FLOOR = vec3f(0.012, 0.016, 0.026);

fn hash21(p: vec2f) -> f32 {
  var q = fract(p * vec2f(127.1, 311.7));
  q += vec2f(dot(q, q + vec2f(34.53)));
  return fract(q.x * q.y);
}

fn hash22(p: vec2f) -> vec2f {
  return vec2f(hash21(p), hash21(p + vec2f(19.19, 7.07)));
}

// The unlensed field: versioned state-light on an instrument lattice.
// Left of the seam the field is the agent's frozen observation; right of the
// seam live state keeps moving and warms toward the human actor color.
fn fieldColor(p: vec2f, time: f32, divergence: f32) -> vec3f {
  var color = SPACE_FLOOR + vec3f(0.0, 0.004, 0.010) * (0.5 - p.y * 0.5);

  let sideMix = smoothstep(-0.30, 0.42, p.x) * (0.30 + 0.70 * divergence);
  let flow = smoothstep(-0.08, 0.45, p.x);
  var q = p * 3.1;
  q.x -= time * 0.05 * flow;

  let lineX = smoothstep(0.024, 0.0, abs(fract(q.x + 0.5) - 0.5));
  let lineY = smoothstep(0.024, 0.0, abs(fract(q.y + 0.5) - 0.5));
  color += vec3f(0.030, 0.036, 0.052) * max(lineX, lineY);

  let cell = floor(q);
  let local = fract(q);
  var light = vec3f(0.0);
  for (var oy = -1; oy <= 1; oy++) {
    for (var ox = -1; ox <= 1; ox++) {
      let offset = vec2f(f32(ox), f32(oy));
      let seed = hash22(cell + offset);
      if (seed.x < 0.36) { continue; }
      let center = offset + vec2f(0.5) + (seed - vec2f(0.5)) * 0.72;
      let d = length(local - center);
      let radius = mix(0.020, 0.052, seed.y * seed.y);
      let core = smoothstep(radius, 0.0, d);
      let halo = smoothstep(radius * 6.0, 0.0, d) * 0.10;
      let warmth = clamp(sideMix + (seed.y - 0.5) * 0.22, 0.0, 1.0);
      let tint = mix(AGENT_TINT, HUMAN_TINT, warmth);
      let twinkle = 0.82 + 0.18 * sin(time * 0.6 + seed.x * 41.0);
      light += tint * (core * (0.55 + seed.x) + halo) * twinkle;
    }
  }
  return color + light;
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let aspect = params.resolution.x / max(params.resolution.y, 1.0);
  let p = (uv * 2.0 - 1.0) * vec2f(aspect, 1.0);

  let lensPos = params.center + params.pointer * vec2f(0.05, 0.035);
  let r = p - lensPos;
  let rl = max(length(r), 1e-4);

  let eased = params.divergence * params.divergence * (3.0 - 2.0 * params.divergence);
  let thetaE = mix(0.055, 0.34, eased);

  // Point-mass lens equation: the observed ray at radius rl originated at
  // rl * (1 - thetaE^2 / rl^2). Inside the Einstein radius the factor flips
  // sign and the field reappears inverted.
  let bend = 1.0 - (thetaE * thetaE) / (rl * rl);
  let src = lensPos + r * bend;

  var color = fieldColor(src, params.time, params.divergence);

  let magnification = exp(-pow((rl - thetaE) / (thetaE * 0.55 + 0.01), 2.0));
  color *= 1.0 + 0.6 * magnification * eased;

  let ring = exp(-pow((rl - thetaE) / (thetaE * 0.15 + 0.005), 2.0));
  let ringTint = mix(vec3f(0.80, 0.89, 1.0), VIOLATION_TINT, params.violation);
  color += ringTint * ring * (0.10 + 0.30 * eased + 0.58 * params.violation);
  color += vec3f(1.0, 0.93, 0.90) * ring * ring * 0.30 * params.violation;

  let shadow = 1.0 - smoothstep(thetaE * 0.34, thetaE * 0.52, rl);
  color = mix(color, vec3f(0.002, 0.003, 0.005), shadow);

  let vignette = smoothstep(1.55, 0.42, length(p * vec2f(0.78, 1.06)));
  color *= mix(0.42, 1.0, vignette);

  return vec4f(color, 1.0);
}
`;
