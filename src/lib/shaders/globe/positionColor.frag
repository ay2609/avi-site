varying vec3 vPosition;
varying vec2 vUv;

uniform sampler2D uTexture;
uniform float opacity;

void main() {
  // Sphere radius is 2, so position is in [-2, 2]. Normalize to [0, 1] for RGB.
  vec3 normalizedPos = (vPosition / 2.0 + 1.0) * 0.5;
  // gl_FragColor = vec4(normalizedPos, opacity);
  vec4 texColor = texture2D(uTexture, vUv);

  vec4 finalColor = vec4((-1. * (texColor.rgb - 1.0)) * normalizedPos, opacity);


  gl_FragColor = finalColor;
}
