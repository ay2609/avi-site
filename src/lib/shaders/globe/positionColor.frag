varying vec2 vUv;

uniform sampler2D uLandTexture;
uniform sampler2D uHeightTexture;
uniform float opacity;
uniform float uTime;
uniform float uIntervalCount;
uniform float uPhaseSpeed;
uniform float uLineWidth;
uniform float uLineBias;
uniform float uGridLonCount;
uniform float uGridLatCount;
uniform float uGridWidth;
uniform float uGridBias;
uniform float uGridStrength;
uniform float uAltitudeCutoffBottomPct;
uniform float uAltitudeCutoffTopPct;
uniform float uOceanIsoStrength;
uniform float uLandIsoStrength;
uniform vec3 uTopoLineColor;

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

float getPeriodicLineMask(float coord, float lineCount, float widthMul, float widthBias) {
  float lineCoord = coord * lineCount;
  float f = fract(lineCoord);
  float distToLine = min(f, 1.0 - f);
  float aa = fwidth(lineCoord) * widthMul + widthBias;
  return 1.0 - smoothstep(0.0, aa, distToLine);
}

void main() {
  float landMask = getLandMask(vUv);
  float heightField = getHeightField(vUv);

  // Slight animated perturbation so lines feel organic without losing elevation structure.
  vec2 U = vUv * 9.0;
  float flow = noiseVal(vec3(U, uTime * 0.06));
  float detail = noiseVal(vec3(U * 2.2 + 17.0, uTime * 0.09));
  float noiseOffset = (flow - 0.5) * 0.03 + (detail - 0.5) * 0.012;

  // Periodic contour set with moving phase.
  // Conceptually: every 50m contour is visible, and phase offsets over time.
  float phase = uTime * uPhaseSpeed;
  float contourCoord = (heightField + noiseOffset) * uIntervalCount + phase;
  float f = fract(contourCoord);
  float distToContour = min(f, 1.0 - f);
  float aa = fwidth(contourCoord) * uLineWidth + uLineBias;
  float contour = 1.0 - smoothstep(0.0, aa, distToContour);

  float landVisibility = smoothstep(0.02, 0.2, landMask);
  float areaVisibility = mix(uOceanIsoStrength, uLandIsoStrength, landVisibility);

  float minAltitude = clamp(uAltitudeCutoffBottomPct, 0.0, 0.99);
  float maxAltitude = clamp(1.0 - uAltitudeCutoffTopPct, minAltitude + 0.001, 1.0);
  float altitudeFeather = 0.004;
  float bottomMask = smoothstep(minAltitude, minAltitude + altitudeFeather, heightField);
  float topMask = 1.0 - smoothstep(maxAltitude - altitudeFeather, maxAltitude, heightField);
  float altitudeMask = bottomMask * topMask;

  float lineMask = contour * areaVisibility * altitudeMask;

  vec3 oceanColor = vec3(0.015, 0.02, 0.03);
  vec3 landColor = vec3(0.07, 0.08, 0.08);
  vec3 contourColor = uTopoLineColor;

  vec3 baseColor = mix(oceanColor, landColor, landMask);
  vec3 finalRgb = mix(baseColor, contourColor, lineMask);

  // Subtle wireframe-style latitude/longitude overlay.
  float lonGrid = getPeriodicLineMask(vUv.x, uGridLonCount, uGridWidth, uGridBias);
  float latGrid = getPeriodicLineMask(vUv.y, uGridLatCount, uGridWidth, uGridBias);
  float poleFade = smoothstep(0.01, 0.08, vUv.y) * (1.0 - smoothstep(0.92, 0.99, vUv.y));
  float gridMask = max(lonGrid, latGrid) * poleFade;
  vec3 gridColor = vec3(0.78);
  finalRgb = mix(finalRgb, gridColor, gridMask * uGridStrength);

  gl_FragColor = vec4(finalRgb, opacity);
}
