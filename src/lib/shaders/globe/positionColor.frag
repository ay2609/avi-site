varying vec3 vPosition;
varying vec2 vUv;

uniform sampler2D uTexture;
uniform float opacity;
uniform float uTime;

void main() {
  vec3 normalizedPos = (vPosition / 2.0 + 1.0) * 0.5;
  vec4 texColor = texture2D(uTexture, vUv);

  // Animated RGB gradient based on position + time
  vec3 animatedGradient = 0.5 + 0.5 * sin(
    vec3(
      normalizedPos.x * 6.28318 + uTime,
      normalizedPos.y * 6.28318 + uTime * 1.2,
      normalizedPos.z * 6.28318 + uTime * 0.8
    )
  );

  // Keep black map areas black, color only land
  vec3 finalRgb = texColor.rgb * animatedGradient;

  gl_FragColor = vec4(finalRgb, opacity);
}