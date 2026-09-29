/**
 * The fractals walkthrough, chapter by chapter: what the stage says and which
 * of Avi's code sits beside each picture. The pictures themselves are set up in
 * engine.ts from the same ids; the maths is in systems.ts.
 *
 * Code excerpts are his, verbatim, from the files named — only long lines are
 * broken inside brackets, where Python allows it.
 */
import type { FractalParams } from "./renderer";

export interface Excerpt {
  file: string;
  year: string;
  code: string;
}

export interface Preset {
  id: string;
  label: string;
  /** One line under the figures, when this preset has something to own up to. */
  note?: string;
  excerpt: Excerpt;
  params: FractalParams;
}

export interface Chapter {
  id: "fractals" | "iterate" | "resolve" | "julia" | "fraotic" | "lissajous";
  headline: string;
  /** Beside "Chapter NN / NN". */
  kicker?: string;
  caption: string;
  /** Fixed readouts; chapters with live ones get them from the engine. */
  figures: [string, string][];
  excerpt?: Excerpt;
  presets?: Preset[];
}

const MANDELBROT_LOOP: Excerpt = {
  file: "manim/Vlog_2/iterative_mandelbrot.py",
  year: "2023",
  code: `for m in range(1, iters + 1):
    z_n = (z_n ** 2) + c

    mask = abs(z_n) > threshold

    image_map[mask] = m
    z_n[mask] = 0
    c[mask] = 0`,
};

export const CHAPTERS: Chapter[] = [
  {
    id: "fractals",
    headline: "Fractals",
    caption: "Fig. 3.0 — This is a fractal. The Mandelbrot set, as my first year of code drew it.",
    figures: [
      ["SINCE", "NOV 2022"],
      ["SCRIPTS", "100+"],
      ["FIRST RENDER", "PURE PYTHON"],
    ],
    excerpt: {
      file: "Fractals/stage_1/JuliaSet/main.py",
      year: "2022",
      code: `for x in list1:
    for y in list2:
        z = complex(x,y)
        point = z
        accuracy = 0
        while accuracy < iterations and abs(z) < 2.0:
            z = z*z + complex_number
            accuracy += 1`,
    },
  },
  {
    id: "iterate",
    headline: "Iterate",
    caption:
      "Fig. 3.1 — Every point is a c. Square it, add c, repeat: the points that never leave |z| ≤ 2 are the set.",
    figures: [],
    excerpt: MANDELBROT_LOOP,
  },
  {
    id: "resolve",
    headline: "Resolve",
    caption: "Fig. 3.2 — One setting at a time: the resolution, then the centre, then the iterations.",
    figures: [],
    excerpt: {
      file: "Fractals/stage_1/JuliaSet/Iterate.py",
      year: "2023",
      code: `x = np.round(np.linspace(-(PLANE_X), (PLANE_X), size_2,
                         dtype=complex), precision)
y = np.round(np.linspace(-(PLANE_Y)*1j, (PLANE_Y)*1j, size_1,
                         dtype=complex), precision)
inputs = x + y[:, np.newaxis]

for i in range(0, size_1, step):
    iterate(inputs[i:i+step,:], c, i, accuracy, precision, step, mapp)`,
    },
  },
  {
    id: "julia",
    headline: "Julia",
    caption: "Fig. 3.3 — Hold c still and start every z somewhere else. Drag to move c.",
    figures: [],
    presets: [
      {
        id: "first",
        label: "First",
        note: "The first one — pygame, pixel by pixel, 1920 × 1080",
        excerpt: {
          file: "Fractals/stage_1/JuliaSet/constants.py",
          year: "2022",
          code: `max_x = 1.6
max_y = 1.0
offset_x = -1.6
offset_y = -1.0

iterations = 1000
color_mode = 1
complex_number = complex(-0.8, .156)`,
        },
        params: {
          mode: "escape",
          julia: true,
          c: [-0.8, 0.156],
          center: [0, 0],
          half: 1.6,
          iters: 1000,
          max: 1000,
          gamma: 1,
          palette: "site",
          pygame: true,
        },
      },
      {
        id: "prisonah",
        label: "Prisonah",
        note: "c marked “yes #prisonah” in the notes",
        excerpt: {
          file: "Fractals/stage_1/JuliaSet/Iterate.py",
          year: "2023",
          code: `z = (z**2 + c)

mask_2 = (abs(z) > THRESHOLD)
mask_3 = (mapp[i:i+step,:] == 0)

if count < accuracy:
    mapp[i:i+step,:][mask_2 & mask_3] = count
elif count == accuracy:
    mapp[i:i+step,:][mask_3] = accuracy`,
        },
        params: {
          mode: "escape",
          julia: true,
          c: [-0.624, 0.435],
          center: [0, 0],
          half: 1.25,
          iters: 500,
          max: 500,
          gamma: 1,
          offset: -1,
          palette: "inferno",
          interior: "max",
        },
      },
      {
        id: "sunburst",
        label: "−0.4 − 0.6i",
        excerpt: {
          file: "manim/Vlog_2/iterative_julia.py",
          year: "2023",
          code: `max_iter = 2000
threshold = 2
chunking_step = int(32500 / size)

c_factor = -0.4 + -0.6j

plt.imshow((image / np.max(image)) ** (1 / 3.2),
           cmap=cmr.sunburst, interpolation='none')`,
        },
        params: {
          mode: "escape",
          julia: true,
          c: [-0.4, -0.6],
          center: [0, 0],
          half: 1.5,
          iters: 1000,
          max: 1000,
          gamma: 3.2,
          palette: "sunburst",
        },
      },
      {
        id: "thorn",
        label: "Thorn",
        note: "Xsave = X is the same array, so Y divides by the new X — the thorns are that bug",
        excerpt: {
          file: "Fractals/stage_1/JuliaSet/Final Results/Thorn.py",
          year: "2023",
          code: `def Iterate(X, Y, count=0):
    Xsave = X

    mask_1 = (abs((X + (Y * 1j))) < 1000)
    mask_2 = (mapp == 0)

    X[mask_1 & mask_2] = ((X / np.cos(Y)) + cx)[mask_1 & mask_2]
    Y[mask_1 & mask_2] = ((Y / np.sin(Xsave)) + cy)[mask_1 & mask_2]`,
        },
        params: {
          mode: "thorn",
          c: [0.662, 1.086],
          center: [0, 0],
          half: 3,
          iters: 250,
          max: 29,
          gamma: 1,
          palette: "bone",
          flipY: true,
        },
      },
    ],
  },
  {
    id: "fraotic",
    headline: "Fraotic",
    caption:
      "Fig. 3.4 — Escape time, turned on a chaotic flow: how many steps each start takes to fall into the attractor. Drag to turn the slice.",
    figures: [],
    presets: [
      {
        id: "thomas",
        label: "Thomas",
        excerpt: {
          file: "Fractals/stage_2/Fraotic Attractors/TCSA.py",
          year: "2025",
          code: `dist = np.sqrt((x - averages[0]) ** 2 + (y - averages[1]) ** 2
               + (z - averages[2]) ** 2)
mask_1 = dist < min_radius
mask_2 = dist > max_radius

mapp[mask_1 & mask] = count
alt_mapp[mask_2 & alt_mask] = count`,
        },
        params: { mode: "thomas", iters: 1000, max: 612, gamma: 3.2, palette: "gothic" },
      },
      {
        id: "lorenz",
        label: "Lorenz",
        note: "Euler, dt 0.01: the escapes come from the step size — the continuous flow keeps every point",
        excerpt: {
          file: "Fractals/stage_2/Fraotic Attractors/lorenz.py",
          year: "2025",
          code: `mapp[mask_1 & mask] = count
alt_mapp[mask_2 & alt_mask] = count

x_dot = s * (y - x)
y_dot = r * x - y - x * z
z_dot = x * y - b * z

x_dot[mask_1 | mask_2] = 0`,
        },
        params: {
          mode: "lorenz",
          iters: 500,
          max: 267,
          gamma: 2.1,
          palette: "twilight",
          escape: { palette: "gothic", gamma: 2, max: 238, alpha: 0.75 },
        },
      },
    ],
  },
  {
    id: "lissajous",
    headline: "Lissajous",
    kicker: "Bonus",
    caption: "Fig. 3.5 — A Lissajous table: each curve is its column's circle against its row's.",
    figures: [
      ["COLUMNS", "1 · 2 · 3 · 5 · 7 · 10"],
      ["ROWS", "1 · 2 · 5"],
      ["ONE TURN", "10 S"],
    ],
    excerpt: {
      file: "FractalsPython/Circles/MovingCircle6.py",
      year: "2023",
      code: `rhythm_h = [1, 2, 3, 5, 7 , 10]

rhythm_v = [1, 2, 5]

def circle(phi, x_displacement, y_displacement):
    return np.array([R * np.cos(np.deg2rad(phi)) + x_displacement,
                     R * np.sin(np.deg2rad(phi)) + y_displacement])`,
    },
  },
];

export const LAST_CHAPTER = CHAPTERS.length - 1;
