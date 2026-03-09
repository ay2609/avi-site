varying vec2 vUv;

uniform sampler2D uLandTexture;
uniform sampler2D uHeightTexture;
uniform float opacity;
uniform float uTime;

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
    mix(mix(v000, v100, f.x), mix(v010, v110, f.x), f.y),
    mix(mix(v001, v101, f.x), mix(v011, v111, f.x), f.y),
    f.z
  );
}

float noiseVal(vec3 x) {
  return 0.5 * (noise3(x) + noise3(x + 11.5));
}

float getLandMask(vec2 uv) {
  // The existing map is white ocean / black land.
  return clamp(1.0 - texture2D(uLandTexture, uv).r, 0.0, 1.0);
}

float getHeightField(vec2 uv) {
  vec2 stepUv = vec2(0.0012, 0.0012);

  float c = texture2D(uHeightTexture, uv).r;
  float n = texture2D(uHeightTexture, uv + vec2(0.0, stepUv.y)).r;
  float s = texture2D(uHeightTexture, uv - vec2(0.0, stepUv.y)).r;
  float e = texture2D(uHeightTexture, uv + vec2(stepUv.x, 0.0)).r;
  float w = texture2D(uHeightTexture, uv - vec2(stepUv.x, 0.0)).r;

  return c * 0.48 + (n + s + e + w) * 0.13;
}

float getContourMask(float fieldValue, float intervalCount) {
  float contourPos = fieldValue * intervalCount;
  float f = fract(contourPos);
  float distToLine = min(f, 1.0 - f);
  float aa = fwidth(contourPos) * 1.0 + 0.0005;
  return 1.0 - smoothstep(0.0, aa, distToLine);
}

void main() {
  float landMask = getLandMask(vUv);
  float heightField = getHeightField(vUv);

  // Reintroduce a smooth, repeating animated transition on top of the real heightmap.
  vec2 U = vUv * 9.0;
  float flow = noiseVal(vec3(U, uTime * 0.06));
  float detail = noiseVal(vec3(U * 2.2 + 17.0, uTime * 0.09));
  float scalarField = heightField * 2.0 + flow * 0.22 + detail * 0.08;

  float contour = getContourMask(scalarField, 25.0);

  float slope = length(vec2(dFdx(heightField), dFdy(heightField)));
  float slopeBoost = smoothstep(0.0008, 0.008, slope);

  float lineMask = contour * (0.65 + 0.35 * slopeBoost);
  lineMask *= smoothstep(0.02, 0.2, landMask);

  vec3 oceanColor = vec3(0.015, 0.02, 0.03);
  vec3 landColor = vec3(0.07, 0.08, 0.08);

  // Grayscale oscillation similar to the old shader's repeating transition.
  float wave = 0.5 + 0.5 * sin(12.0 * scalarField + uTime * 0.9);
  vec3 contourColor = vec3(wave);

  vec3 landWithContours = mix(landColor, contourColor, lineMask);
  vec3 finalRgb = mix(oceanColor, landWithContours, landMask);

  gl_FragColor = vec4(finalRgb, opacity);
}
