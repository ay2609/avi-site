varying vec3 vPosition;
varying vec2 vUv;

uniform sampler2D uTexture;
uniform float opacity;
uniform float uTime;
uniform vec2 uResolution;

// ------------------------------------
// 3D value noise
// ------------------------------------
float hash31(vec3 p) {
  return fract(sin(1000.0 * dot(p, vec3(1.0, 57.0, -13.7))) * 4375.5453);
}

float noise3(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);

  f = f * f * (3.0 - 2.0 * f);

  float v000 = hash31(p + vec3(0.0, 0.0, 0.0));
  float v100 = hash31(p + vec3(1.0, 0.0, 0.0));
  float v010 = hash31(p + vec3(0.0, 1.0, 0.0));
  float v110 = hash31(p + vec3(1.0, 1.0, 0.0));
  float v001 = hash31(p + vec3(0.0, 0.0, 1.0));
  float v101 = hash31(p + vec3(1.0, 0.0, 1.0));
  float v011 = hash31(p + vec3(0.0, 1.0, 1.0));
  float v111 = hash31(p + vec3(1.0, 1.0, 1.0));

  return mix(
    mix(
      mix(v000, v100, f.x),
      mix(v010, v110, f.x),
      f.y
    ),
    mix(
      mix(v001, v101, f.x),
      mix(v011, v111, f.x),
      f.y
    ),
    f.z
  );
}

float noiseVal(vec3 x) {
  return 0.5 * (noise3(x) + noise3(x + 11.5));
}

// ------------------------------------
// soft land field from the texture
// ------------------------------------
float getLandField(vec2 uv) {
  vec2 texel = 1.0 / uResolution;

  float c  = texture2D(uTexture, uv).r;
  float n  = texture2D(uTexture, uv + vec2(0.0,  texel.y)).r;
  float s  = texture2D(uTexture, uv - vec2(0.0,  texel.y)).r;
  float e  = texture2D(uTexture, uv + vec2(texel.x, 0.0)).r;
  float w  = texture2D(uTexture, uv - vec2(texel.x, 0.0)).r;
  float ne = texture2D(uTexture, uv + vec2(texel.x,  texel.y)).r;
  float nw = texture2D(uTexture, uv + vec2(-texel.x, texel.y)).r;
  float se = texture2D(uTexture, uv + vec2(texel.x, -texel.y)).r;
  float sw = texture2D(uTexture, uv + vec2(-texel.x, -texel.y)).r;

  // simple local blur
  float blurred =
      c * 0.30 +
      (n + s + e + w) * 0.12 +
      (ne + nw + se + sw) * 0.055;

  return blurred;
}

void main() {
  float landMask = -1. * (texture2D(uTexture, vUv).r - 1.) ;


  // soft map-based scalar field
  float landField = getLandField(vUv);

  // procedural distortion that stays attached to UV/map space
  vec2 U = vUv * 10.0;
  float flow = noiseVal(vec3(U, 0.08 * uTime));
  float detail = noiseVal(vec3(U * 2.0 + 20.0, 0.12 * uTime));

  // combined scalar field:
  // landField makes contours follow continents
  // noise adds organic motion/detail
  float n = landField * 1.8 + flow * 0.45 + detail * 0.18;

  // contour rings
  float v = sin(6.28318 * 10.0 * n);

  // anti-aliased contour line mask
  v = smoothstep(1.0, 0.0, 0.5 * abs(v) / fwidth(v));

  // smooth palette
  vec3 topoColor = 0.5 + 0.5 * sin(12.0 * n + vec3(0.0, 2.1, -2.1));

  // optional land fill so continents aren't only thin lines
  vec3 filledColor = topoColor * (0.18 + 0.82 * v);

  // apply only on land
  vec3 finalRgb = filledColor * landMask;

  gl_FragColor = vec4(finalRgb, opacity);
}