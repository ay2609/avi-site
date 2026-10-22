"use client";

import { useEffect, useRef } from "react";

import { prefersReducedMotion } from "@/lib/stage/motion";
import { themeFader } from "@/lib/theme/light";

/**
 * Isovalues: the level sets of a slowly drifting noise, drawn as stacked
 * terraces — each band lit at its top edge and shadowed where the band above
 * steps over it, so the field reads as extruded. After FabriceNeyret2's
 * "isovalues 3" (shadertoy.com/view/ldfczS, 2017), which extrudes the
 * isolines of plain wavelength-1 ("bozo") noise by feedback; this is an
 * independent single-pass version — the extrusion is a drop shadow found by
 * looking one step towards the light — so it needs no ping-pong buffers.
 *
 * `palette`: "spectrum" walks the hue band by band (the original's look);
 * "ink" keeps to the site's one tone, ink or paper, and follows the theme.
 */
export type IsoPalette = "spectrum" | "ink";

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uScale;   // noise cells across the short side
uniform float uLight;   // 0 ink → 1 paper (ink palette only)
uniform int uPalette;   // 0 spectrum, 1 ink
out vec4 outColor;

// A lattice hash with no period or symmetry to show across a wide band.
float hash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

// Value noise of wavelength 1, smoothly interpolated, the third axis is time.
float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
                 mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
                 mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

const float LEVELS = 22.0;

float field(vec2 p) { return noise(vec3(p, uTime * 0.11)); }

vec3 hue(float h) {
  return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y * uScale + vec2(uTime * 0.03, 0.0);
  float v = field(p) * LEVELS;
  float band = floor(v);
  float f = fract(v);

  // A terrace: bright at its upper isoline, falling off down the slope.
  float lit = 0.12 + 0.88 * pow(f, 1.25);
  // The step above casts onto this band: look a little towards the light.
  vec2 toLight = vec2(-0.55, 0.83) * 0.03;
  float above = floor(field(p + toLight) * LEVELS);
  float shadow = above > band ? 0.35 : 1.0;
  // A hairline along each isoline, antialiased in screen space.
  float w = fwidth(v);
  float edge = 1.0 - smoothstep(0.0, 1.5 * w, min(f, 1.0 - f));

  vec3 col;
  if (uPalette == 0) {
    vec3 c = hue(band * 0.071 + uTime * 0.02);
    col = c * lit * shadow;
    col = mix(col, c * 1.15, edge * 0.5);
  } else {
    // One tone: terraces between the ground and a faint lift towards the text colour.
    vec3 ink = vec3(0.039, 0.039, 0.043), bone = vec3(0.902, 0.894, 0.875);
    vec3 paper = vec3(0.945, 0.937, 0.918), pressInk = vec3(0.090, 0.090, 0.102);
    vec3 ground = mix(ink, paper, uLight), text = mix(bone, pressInk, uLight);
    float t = 0.03 + 0.2 * lit * shadow;
    col = mix(ground, text, t);
    col = mix(col, text, edge * 0.35);
  }
  outColor = vec4(col, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

export default function IsoField({
  palette = "spectrum",
  scale = 3,
  maxDpr = 1.5,
  className = "",
}: {
  palette?: IsoPalette;
  /** Noise cells across the field's short side: fewer is bigger, calmer terraces. */
  scale?: number;
  /** Pixel ratio ceiling: a large field at full ratio costs more than it shows. */
  maxDpr?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas?.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!canvas || !gl) return;

    const prog = gl.createProgram();
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!prog || !vs || !fs) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const u = {
      res: gl.getUniformLocation(prog, "uRes"),
      time: gl.getUniformLocation(prog, "uTime"),
      scale: gl.getUniformLocation(prog, "uScale"),
      light: gl.getUniformLocation(prog, "uLight"),
      palette: gl.getUniformLocation(prog, "uPalette"),
    };
    gl.uniform1f(u.scale, scale);
    gl.uniform1i(u.palette, palette === "spectrum" ? 0 : 1);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(u.res, w, h);
    };

    const fader = themeFader();
    const still = prefersReducedMotion();
    const start = performance.now();
    let last = start;
    let raf = 0;
    let visible = true;

    const draw = (now: number) => {
      const { t } = fader.step((now - last) / 1000);
      last = now;
      gl.uniform1f(u.light, t);
      gl.uniform1f(u.time, still ? 7 : (now - start) / 1000 + 7);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (visible) draw(now);
    };

    const ro = new ResizeObserver(() => {
      resize();
      if (still) draw(performance.now());
    });
    ro.observe(canvas);
    // Off screen, it stops drawing.
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    io.observe(canvas);

    resize();
    if (still) {
      draw(performance.now());
      // The theme still fades it, even standing still.
      const id = window.setInterval(() => draw(performance.now()), 100);
      return () => {
        window.clearInterval(id);
        ro.disconnect();
        io.disconnect();
      };
    }
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
    };
  }, [palette, scale, maxDpr]);

  return <canvas ref={ref} aria-hidden className={`block h-full w-full ${className}`} />;
}
