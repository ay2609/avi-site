"use client";

import { useEffect, useRef } from "react";

import { prefersReducedMotion } from "@/lib/stage/motion";
import { themeFader } from "@/lib/theme/light";

/**
 * Isovalues — a port of FabriceNeyret2's "isovalues 3" (shadertoy.com/view/
 * ldfczS, 2017; Shadertoy's licence, CC BY-NC-SA 3.0, applies to the shader).
 * The isolines of a smooth pseudo-Perlin noise (two value noises averaged)
 * are drawn as hairlines, and every frame lays them over the last one shifted
 * a pixel and faded a little, so each line drags a soft trail: that feedback
 * is what extrudes the contours into smooth terraces.
 *
 * Changes from the original: the shift and fade are scaled to the noise's
 * cell size and to the frame time (the original assumes 60 Hz and a ~470 px
 * canvas), the fade goes to the page's ground rather than black, and
 * `palette` "ink" draws the lines in the page's one tone (a little brighter
 * or dimmer by their level) instead of the original's spectrum. Light and
 * dark follow the theme.
 */
export type IsoPalette = "spectrum" | "ink";

const QUAD = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

/** One step of the feedback: the last frame, shifted and faded, under this frame's isolines. */
const STEP = `#version 300 es
precision highp float;
uniform sampler2D uPrev;
uniform vec2 uRes;
uniform float uTime;
uniform float uCellPx;  // the noise's cell, in buffer pixels
uniform vec2 uShift;    // how far the last frame moves this frame, px
uniform float uKeep;    // how much of the last frame survives this frame
uniform vec3 uGround;
uniform vec3 uText;
uniform int uPalette;   // 0 spectrum, 1 ink
out vec4 outColor;

float hash3(vec3 p) { return fract(sin(1e3 * dot(p, vec3(1.0, 57.0, -13.7))) * 4375.5453); }

float noise3(vec3 x) {
  vec3 p = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(p), hash3(p + vec3(1, 0, 0)), f.x),
                 mix(hash3(p + vec3(0, 1, 0)), hash3(p + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash3(p + vec3(0, 0, 1)), hash3(p + vec3(1, 0, 1)), f.x),
                 mix(hash3(p + vec3(0, 1, 1)), hash3(p + vec3(1, 1, 1)), f.x), f.y), f.z);
}

// Two value noises averaged: pseudo-Perlin, smoother than either.
float noise(vec3 x) { return (noise3(x) + noise3(x + 11.5)) / 2.0; }

void main() {
  vec2 U = gl_FragCoord.xy;
  float n = noise(vec3(U / uCellPx, 0.1 * uTime));
  float v = sin(6.28 * 10.0 * n);
  v = smoothstep(1.0, 0.0, 0.5 * abs(v) / fwidth(v));

  vec3 last = texture(uPrev, (U + uShift) / uRes).rgb;
  vec3 trail = uGround + (last - uGround) * uKeep;
  vec3 line = uPalette == 0
    ? 0.5 + 0.5 * sin(12.0 * n + vec3(0.0, 2.1, -2.1))
    : mix(uGround, uText, 0.3 + 0.5 * (0.5 + 0.5 * sin(12.0 * n)));
  outColor = vec4(mix(trail, line, v), 1.0);
}`;

const SHOW = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes;
out vec4 outColor;
void main() { outColor = texture(uTex, gl_FragCoord.xy / uRes); }`;

/** The original at its 60 Hz: a pixel of shift and exp(-33/470) of fade a frame, at 470/8 px a cell. */
const REF_CELL = 470 / 8;
const REF_FADE = 33 / 470;

const INK = [0.039, 0.039, 0.043];
const BONE = [0.902, 0.894, 0.875];
const PAPER = [0.945, 0.937, 0.918];
const PRESS = [0.09, 0.09, 0.102];

function program(gl: WebGL2RenderingContext, frag: string): WebGLProgram | null {
  const make = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram();
  if (!p) return null;
  gl.attachShader(p, make(gl.VERTEX_SHADER, QUAD));
  gl.attachShader(p, make(gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(p);
  return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
}

export default function IsoField({
  palette = "spectrum",
  scale = 3,
  maxDpr = 1.5,
  className = "",
}: {
  palette?: IsoPalette;
  /** Noise cells across the field's short side: fewer is bigger, calmer contours. */
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
    // Half-float buffers keep the long fade smooth; 8-bit ones stall on its last steps.
    const float = !!gl.getExtension("EXT_color_buffer_float");

    const step = program(gl, STEP);
    const show = program(gl, SHOW);
    if (!step || !show) return;

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    for (const p of [step, show]) {
      const a = gl.getAttribLocation(p, "aPos");
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    }
    const U = (p: WebGLProgram, n: string) => gl.getUniformLocation(p, n);
    const s = {
      prev: U(step, "uPrev"), res: U(step, "uRes"), time: U(step, "uTime"), cell: U(step, "uCellPx"),
      shift: U(step, "uShift"), keep: U(step, "uKeep"), ground: U(step, "uGround"), text: U(step, "uText"),
      palette: U(step, "uPalette"),
    };
    const v = { tex: U(show, "uTex"), res: U(show, "uRes") };

    // Two buffers, flip-flopped: each step reads one and writes the other.
    let w = 0;
    let h = 0;
    let bufs: { tex: WebGLTexture; fbo: WebGLFramebuffer }[] = [];
    let cur = 0;

    const fader = themeFader();
    let light = fader.step(0).t;
    const colors = () => {
      const mix = (a: number[], b: number[]) => a.map((x, i) => x + (b[i] - x) * light) as [number, number, number];
      return { ground: mix(INK, PAPER), text: mix(BONE, PRESS) };
    };

    const makeBuffers = () => {
      for (const b of bufs) {
        gl.deleteTexture(b.tex);
        gl.deleteFramebuffer(b.fbo);
      }
      const { ground } = colors();
      bufs = [0, 1].map(() => {
        const tex = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        if (float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
        else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const fbo = gl.createFramebuffer()!;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        gl.clearColor(ground[0], ground[1], ground[2], 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        return { tex, fbo };
      });
      cur = 0;
    };

    const resize = (): boolean => {
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      const nw = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const nh = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (nw === w && nh === h) return false;
      w = canvas.width = nw;
      h = canvas.height = nh;
      makeBuffers();
      return true;
    };

    /** One feedback step of `dt` seconds at time `t`, then (unless warming up) the result to the screen. */
    const frame = (t: number, dt: number, present = true) => {
      const cellPx = Math.min(w, h) / scale;
      const k = cellPx / REF_CELL; // the original's motion, in this field's cells
      const f = dt * 60; // frames of the original's 60 Hz
      const { ground, text } = colors();
      const from = bufs[cur];
      const to = bufs[1 - cur];
      gl.bindFramebuffer(gl.FRAMEBUFFER, to.fbo);
      gl.viewport(0, 0, w, h);
      gl.useProgram(step);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, from.tex);
      gl.uniform1i(s.prev, 0);
      gl.uniform2f(s.res, w, h);
      gl.uniform1f(s.time, t);
      gl.uniform1f(s.cell, cellPx);
      gl.uniform2f(s.shift, k * f, k * f * Math.sin(t));
      gl.uniform1f(s.keep, Math.exp(-REF_FADE * f));
      gl.uniform3f(s.ground, ground[0], ground[1], ground[2]);
      gl.uniform3f(s.text, text[0], text[1], text[2]);
      gl.uniform1i(s.palette, palette === "spectrum" ? 0 : 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      cur = 1 - cur;
      if (!present) return;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.useProgram(show);
      gl.bindTexture(gl.TEXTURE_2D, to.tex);
      gl.uniform1i(v.tex, 0);
      gl.uniform2f(v.res, w, h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    /** Run the feedback up from blank to a full set of trails, ending at `t`. */
    const warm = (t: number) => {
      const N = 150;
      for (let i = N; i > 0; i--) frame(t - i / 60, 1 / 60, false);
      frame(t, 1 / 60);
    };

    const still = prefersReducedMotion();
    const T0 = 7; // where a still field stops, and a moving one starts from
    const start = performance.now();
    let last = start;
    let raf = 0;
    let visible = true;

    resize();
    warm(T0);

    const ro = new ResizeObserver(() => {
      if (resize()) warm(still ? T0 : T0 + (performance.now() - start) / 1000);
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    io.observe(canvas);

    let stillTimer = 0;
    if (still) {
      // Standing still, it only redraws when the theme fades.
      stillTimer = window.setInterval(() => {
        const now = performance.now();
        const { t, moved } = fader.step((now - last) / 1000);
        last = now;
        if (!moved) return;
        light = t;
        makeBuffers();
        warm(T0);
      }, 50);
    } else {
      const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        light = fader.step(dt).t;
        if (!visible) return;
        // A slow frame runs as several 60 Hz steps, so the trails stay continuous.
        const n = Math.min(4, Math.max(1, Math.round(dt * 60)));
        const t = T0 + (now - start) / 1000;
        for (let i = n - 1; i >= 0; i--) frame(t - (i * dt) / n, dt / n, i === 0);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(stillTimer);
      ro.disconnect();
      io.disconnect();
      for (const b of bufs) {
        gl.deleteTexture(b.tex);
        gl.deleteFramebuffer(b.fbo);
      }
      gl.deleteProgram(step);
      gl.deleteProgram(show);
      gl.deleteBuffer(quad);
    };
  }, [palette, scale, maxDpr]);

  return <canvas ref={ref} aria-hidden className={`block h-full w-full ${className}`} />;
}
