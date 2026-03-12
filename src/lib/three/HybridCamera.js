import * as THREE from "three";

const _perspectiveProjection = new THREE.Matrix4();
const _orthographicProjection = new THREE.Matrix4();

export class HybridCamera extends THREE.Camera {
  constructor({
    fov = 50,
    aspect = 1,
    near = 0.1,
    far = 2000,
    zoom = 1,
    focusDistance = 10,
    projectionBlend = 0,
  } = {}) {
    super();

    this.type = "HybridCamera";

    // OrbitControls branches on these flags for pan/dolly behavior. This camera is
    // still a custom THREE.Camera; the flag keeps controls functional without
    // swapping to a PerspectiveCamera implementation.
    this.isPerspectiveCamera = true;
    this.isOrthographicCamera = false;

    this.fov = fov;
    this.aspect = aspect;
    this.near = near;
    this.far = far;
    this.zoom = zoom;
    this.focusDistance = focusDistance;
    this.projectionBlend = projectionBlend;

    // Keep orthographic-equivalent extents available for debugging and helpers.
    this.left = -1;
    this.right = 1;
    this.top = 1;
    this.bottom = -1;

    this.updateProjectionMatrix();
  }

  get referenceDistance() {
    return this.focusDistance;
  }

  set referenceDistance(value) {
    this.focusDistance = value;
  }

  copy(source, recursive) {
    super.copy(source, recursive);

    this.fov = source.fov;
    this.aspect = source.aspect;
    this.near = source.near;
    this.far = source.far;
    this.zoom = source.zoom;
    this.focusDistance = source.focusDistance;
    this.projectionBlend = source.projectionBlend;
    this.left = source.left;
    this.right = source.right;
    this.top = source.top;
    this.bottom = source.bottom;

    return this;
  }

  setSize(width, height) {
    this.aspect = height > 0 ? width / height : 1;
    this.updateProjectionMatrix();
    return this;
  }

  setProjectionBlend(value) {
    this.projectionBlend = value;
    this.updateProjectionMatrix();
    return this;
  }

  setFocusDistance(value) {
    this.focusDistance = Math.max(value, this.near + 1e-4);
    this.updateProjectionMatrix();
    return this;
  }

  updateProjectionMatrix() {
    const blend = this.projectionBlend;
    const near = Math.max(this.near, 1e-4);
    const far = Math.max(this.far, near + 1e-4);
    const aspect = this.aspect > 0 ? this.aspect : 1;
    const zoom = Math.max(this.zoom, 1e-4);
    const focusDistance = Math.max(this.focusDistance, near + 1e-4);
    const fovRadians = THREE.MathUtils.degToRad(
      THREE.MathUtils.clamp(this.fov, 1e-3, 179.999)
    );

    const perspectiveHalfHeight = Math.tan(fovRadians * 0.5) * near / zoom;
    const perspectiveHalfWidth = perspectiveHalfHeight * aspect;

    // Match the orthographic box to the perspective framing at the chosen focus
    // plane. Geometry on that plane keeps the same on-screen footprint at both
    // endpoints, which makes the morph visually coherent.
    const orthographicHalfHeight = Math.tan(fovRadians * 0.5) * focusDistance / zoom;
    const orthographicHalfWidth = orthographicHalfHeight * aspect;

    this.left = -orthographicHalfWidth;
    this.right = orthographicHalfWidth;
    this.top = orthographicHalfHeight;
    this.bottom = -orthographicHalfHeight;

    _perspectiveProjection.makePerspective(
      -perspectiveHalfWidth,
      perspectiveHalfWidth,
      perspectiveHalfHeight,
      -perspectiveHalfHeight,
      near,
      far,
      this.coordinateSystem,
      this.reversedDepth
    );

    _orthographicProjection.makeOrthographic(
      this.left,
      this.right,
      this.top,
      this.bottom,
      near,
      far,
      this.coordinateSystem,
      this.reversedDepth
    );

    // Perspective and orthographic cameras are both projective transforms in
    // homogeneous coordinates. Interpolating the matrices directly gives a
    // continuous projection family with exact endpoints:
    // blend = 0 -> exact perspective
    // blend = 1 -> exact orthographic
    const perspectiveElements = _perspectiveProjection.elements;
    const orthographicElements = _orthographicProjection.elements;
    const projectionElements = this.projectionMatrix.elements;

    for (let i = 0; i < 16; i += 1) {
      projectionElements[i] = THREE.MathUtils.lerp(
        perspectiveElements[i],
        orthographicElements[i],
        blend
      );
    }

    this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
  }
}

export default HybridCamera;
