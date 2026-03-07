varying vec3 vPosition;
varying vec2 vUv;

uniform sampler2D uTexture;
uniform float opacity;
uniform float uTime;

// ------------------------------------
// 3D value noise
// ------------------------------------
float noise3(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);

  // smooth interpolation
  f = f * f * (3.0 - 2.0 * f);

  float hash000 = fract(sin(1000.0 * dot(p + vec3(0.0, 0.0, 0.0), vec3(1.0, 57.0, -13.7))) * 4375.5453);
  float hash100 = fract(sin(1000.0 * dot(p + vec3(1.0, 0.0, 0.0), vec3(1.0, 57.0, -13.7))) * 4375.5453);
  float hash010 = fract(sin(1000.0 * dot(p + vec3(0.0, 1.0, 0.0), vec3(1.0, 57.0, -13.7))) * 4375.5453);
  float hash110 = fract(sin(1000.0 * dot(p + vec3(1.0, 1.0, 0.0), vec3(1.0, 57.0, -13.7))) * 4375.5453);

  float hash001 = fract(sin(1000.0 * dot(p + vec3(0.0, 0.0, 1.0), vec3(1.0, 57.0, -13.7))) * 4375.5453);
  float hash101 = fract(sin(1000.0 * dot(p + vec3(1.0, 0.0, 1.0), vec3(1.0, 57.0, -13.7))) * 4375.5453);
  float hash011 = fract(sin(1000.0 * dot(p + vec3(0.0, 1.0, 1.0), vec3(1.0, 57.0, -13.7))) * 4375.5453);
  float hash111 = fract(sin(1000.0 * dot(p + vec3(1.0, 1.0, 1.0), vec3(1.0, 57.0, -13.7))) * 4375.5453);

  return mix(
    mix(
      mix(hash000, hash100, f.x),
      mix(hash010, hash110, f.x),
      f.y
    ),
    mix(
      mix(hash001, hash101, f.x),
      mix(hash011, hash111, f.x),
      f.y
    ),
    f.z
  );
}

float noiseVal(vec3 x) {
  return (noise3(x) + noise3(x + 11.5)) * 0.5;
}

void main() {
  // Black/white globe mask texture
  vec4 texColor = texture2D(uTexture, vUv);

  // Assume land = white, water = black
  float landMask = -1.0*(texColor.r - 1.0);

  // UV-based coordinates so pattern follows the map texture
  vec2 U = vUv * 16.0;

  // animated scalar field
  float n = noiseVal(vec3(U, 0.1 * uTime));

  // contour rings
  float v = sin(6.28318 * 20.0 * n);

  // anti-aliased contour thickness
  v = smoothstep(1.0, 0.0, 0.5 * abs(v) / fwidth(v));

  // smooth palette across rings
  vec3 topoColor = 0.5 + 0.5 * sin(12.0 * n + vec3(0.0, 2.1, -2.1));

  // only show topo effect on land
  vec3 water = texColor.rgb;
  vec3 finalRgb = (topoColor * v * landMask) + water;

  gl_FragColor = vec4(finalRgb, opacity);
}