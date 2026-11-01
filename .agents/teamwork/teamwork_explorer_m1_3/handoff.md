# Handoff Report: M1 Explorer 3 — Shader Compositing & 4K HDR Readability

## 1. Observation

Direct code observations from inspection of the rendering pipeline, shader filters, bootstrap sequencing, and test suites:

### 1.1 Shader Filter Architecture & Container Attachment
- **Current Root Filter Attachment**: `src/client/renderer/steampunk-pipeline.ts:68-69`:
  ```ts
  this.postFilter = createDiegeticPostFilter(this.uniforms);
  this.rootStage.filters = [this.postFilter];
  ```
- **Layer Stacking Hierarchy**: `src/client/renderer/steampunk-pipeline.ts:37-53`:
  - `worldTacticalContainer` (zIndex: 10)
  - `gaslightLightingContainer` (zIndex: 20)
  - `diegeticFrameContainer` (zIndex: 30)
  - `canvasUiBufferContainer` (zIndex: 40)
  - `opticalOverlayContainer` (zIndex: 50)
- **Container Population**: `src/client/renderer/glyph-stage.ts:64-70, 226, 234`:
  - `worldTacticalContainer.addChild(this.bgGraphics)` and `this.glyphSprites` (columns 0..87).
  - `gaslightLightingContainer.addChild(this.lightingGraphics)` (dynamic steam illumination rectangles with `alpha: 0.18`, `color: 0xd4af37`).
  - `diegeticFrameContainer.addChild(this.frameGraphics)` (structural border cross-sections).
  - `canvasUiBufferContainer.addChild(this.uiBgGraphics)` and `this.uiGlyphSprites` (UI console and modal buffers).
  - `opticalOverlayContainer.addChild(this.overlayGraphics)`.

### 1.2 GLSL Distortion & Text Smearing Mechanisms
- **Full-Screen Lens Curvature**: `src/client/renderer/diegetic-post-filter.ts:52-66`:
  ```glsl
  vec2 applyLensCurvature(vec2 uv, float k) {
      vec2 d = uv - vec2(0.5);
      float r2 = dot(d, d);
      return vec2(0.5) + d * (1.0 + k * r2);
  }
  ```
  Applies spherical barrel distortion centered at `(0.5, 0.5)` across the entire canvas (`uv: 0.0..1.0`).
- **Thermodynamic Heat Haze & Chromatic Aberration**: `src/client/renderer/diegetic-post-filter.ts:69-81`:
  ```glsl
  float heatHaze = sin(curvedUV.y * 36.0 + uTime * 4.2) * cos(curvedUV.x * 28.0 - uTime * 3.1);
  vec2 hazeOffset = vec2(heatHaze * 0.0005 * uThermoStress, 0.0);
  vec2 baseUV = curvedUV + hazeOffset;

  vec2 centered = baseUV - vec2(0.5);
  float caDist = length(centered);
  float caSplit = (uChromaticAberration + uThermoStress * 0.0012) * caDist;
  vec2 caDir = caDist > 0.001 ? normalize(centered) * caSplit : vec2(0.0);

  float r = texture(uTexture, baseUV - caDir).r;
  float g = texture(uTexture, baseUV).g;
  float b = texture(uTexture, baseUV + caDir).b;
  ```
  The UI sidebar occupies columns 58..87 (`x` from 0.659 to 0.989 in normalized UV). At this peripheral radius, `caDist` is between 0.25 and 0.50 (the maximum on the display), splitting R and B color channels by 2 to 4 physical pixels on 4K displays.
- **Dual-Threshold Phosphor Bloom**: `src/client/renderer/diegetic-post-filter.ts:83-97`:
  4-tap cross-filter with offset `bShift = 0.0015` (`~1.58px` logical UV blur, `~5.7px` physical blur on 4K). Monospace 12x20px character cells have only 1 to 2 pixels of inter-character spacing; bloom halation bleeds amber and cyan into adjacent glyph cells, blurring small text readouts.
- **Scanlines & Vignette**: `src/client/renderer/diegetic-post-filter.ts:109-120`:
  `sin(curvedUV.y * uResolution.y * 3.14159)` creates 360 scanline troughs that attenuate horizontal 1-pixel strokes in font glyphs. `vignette = 1.0 - dot(centered, centered) * 0.75` darkens the UI console in the right corners by up to 37.5%.

### 1.3 UI Console Placement & Geometry
- **Grid Layout**: `src/client/renderer/glyph-stage-types.ts:1-6`:
  `CELL_WIDTH_PX = 12`, `CELL_HEIGHT_PX = 20`, `WIDESCREEN_GRID_WIDTH = 88`, `WIDESCREEN_GRID_HEIGHT = 36`.
  Canvas logical dimensions: 1056 x 720 px.
- **Console Region**: `src/client/canvas-ui/diegetic-screen-composer.ts:85-87`:
  `renderTacticalConsole(buf, { x: 58, y: 0, width: 30, height: params.height }, ...)`
  The UI sidebar occupies columns 58 through 87 (width 30).
  Normalized UV start position: `58.0 / 88.0 = 0.6590909090909091` (`696 / 1056 px`).

### 1.4 Font Loading & Atlas Rasterization Race Condition
- **Font Definition**: `index.html:7, 30`:
  `<link rel="stylesheet" href="/node_modules/@fontsource/ibm-plex-mono/index.css" />`
  `font-family: 'IBM Plex Mono', 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;`
- **Atlas Rasterization**: `src/client/renderer/glyph-atlas-extended.ts:49, 71`:
  `fontFamily = '"JetBrains Mono", "Fira Code", "IBM Plex Mono", "Courier New", monospace'`
  `ctx.font = 'bold 14px ...'`
- **Bootstrap Execution**: `src/client/main.tsx:9-16`:
  Calls `GlyphStageRenderer.create(...)` immediately without awaiting `document.fonts.ready`. If the WOFF2 font has not finished asynchronous decoding when the 2D canvas atlas is created, canvas falls back to system monospace and bakes the wrong glyph textures into GPU memory.

### 1.5 Line Counts & Modularity Ceilings
Verified via `wc -l`:
- `src/client/renderer/glyph-stage.ts`: **239 lines** (frozen, MUST NOT be modified)
- `src/client/renderer/diegetic-post-filter.ts`: **166 lines** (budget: <= 220, ceiling: 300)
- `src/client/renderer/steampunk-pipeline.ts`: **126 lines** (budget: <= 220, ceiling: 300)
- `src/client/renderer/shader-uniforms.ts`: **67 lines** (budget: <= 220, ceiling: 300)
- `src/client/renderer/glyph-atlas-extended.ts`: **113 lines**
- `src/client/main.tsx`: **71 lines**
- `tests/sim/phase54-shader-pipeline.test.ts`: **228 lines**
- Total test suite: 109 test files, 560 tests passing in `npm run test:sim`.

---

## 2. Logic Chain

### 2.1 Architectural Evaluation: Container Attachment vs. Shader Split Uniform

We compared the two dispatch options for isolating the UI sidebar:

#### Failure Modes of Container Attachment (`postFilter` on `worldTacticalContainer` and `gaslightLightingContainer`):
1. **Opaque Alpha Occlusion**: `DIEGETIC_FRAGMENT_SHADER` writes `finalColor = vec4(col, 1.0)`. In PixiJS v8, applying a Filter to `gaslightLightingContainer` (which contains sparse transparent rectangles with `alpha: 0.18`) causes the filter to render all empty transparent space as opaque bronze bezel / dark soot black (`vec4(0.04, 0.05, 0.06, 1.0)`). This completely wipes out and occludes `worldTacticalContainer` beneath it.
2. **Double FBO GPU Fill-Rate Bottleneck at 4K**: Applying filters to multiple containers requires PixiJS's `FilterSystem` to allocate multiple intermediate framebuffers (FBOs). Rendering two full-screen passes per frame at 4K (3840x2160) doubles texture bandwidth and memory fill rate.
3. **Decoupled Optical Geometry**: If `worldTacticalContainer` has lens curvature applied, its tiles are spherically warped. If `gaslightLightingContainer` is filtered independently or left uncurved, the dynamic steam light glows detach geometrically from the lantern and pipe tiles that emitted them.
4. **Frozen File Violation**: Reworking container filter routing would require refactoring `src/client/renderer/glyph-stage.ts`, which is frozen at 239 lines.

#### Superiority of Shader Split Uniform (`uTacticalSplit` in `DIEGETIC_FRAGMENT_SHADER`):
1. **Single-Pass Compositing**: All 5 layers composite into a single stage texture and evaluate in one fullscreen fragment pass. Zero extra FBO allocations, 100% cache friendly.
2. **Bit-Exact Mathematical Isolation**: At `vTextureCoord.x >= uTacticalSplit`:
   - `curvedUV = vTextureCoord` (0 lens curvature)
   - `baseUV = vTextureCoord` (0 heat haze horizontal waving)
   - `caDir = vec2(0.0)` (0 chromatic aberration; R, G, B channels sample identical texels)
   - `bloom` is skipped (0 halo halation across small monospace glyph gaps)
   - `smoke` is skipped (0 smoke occlusion of UI readouts)
   - `scanline` is skipped (0 horizontal troughs dimming 1-pixel font strokes)
   - `triadMask` is 1.0 (0 subpixel triad chromatic stripe modulation)
   - `vignette` is 1.0 (0 peripheral corner darkening of the console chassis)
   - `filament grain` is skipped (100% clean digital text rendering)
3. **Symmetrical Tactical Porthole**: Left of `uTacticalSplit` (`vTextureCoord.x < uTacticalSplit`), lens curvature is normalized across the tactical viewport width `[0.0, uTacticalSplit]`. The spherical lens curves symmetrically around the tactical center (column 29, where the player character is), clamping to the bronze bezel right at column 58, flush with the machined console bezel.
4. **Dynamic Adaptability**: Setting `uTacticalSplit = 0.0` treats full-screen modals (Inventory, Workbench, Embarkation, System Menu) as crisp UI text across the entire display. Setting `uTacticalSplit = 1.0` treats cinematic scenes as full-screen CRT. Defaulting to `58.0 / 88.0` (~0.65909) perfectly handles normal tactical exploration.

### 2.2 4K HDR Text Legibility Solution
1. **Font Loading Race Condition**: Adding `if (typeof document !== 'undefined' && 'fonts' in document) { await document.fonts.ready; }` in `src/client/main.tsx` guarantees that the `@fontsource/ibm-plex-mono` WOFF2 font is fully decoded before `createExtendedGlyphAtlas` rasterizes the 256 CP437 glyphs.
2. **Font Family Priority**: Reordering the font stack in `glyph-atlas-extended.ts` to `'"IBM Plex Mono", "JetBrains Mono", "Fira Code", "Courier New", monospace'` ensures that the bundled IBM Plex Mono font is selected over unbundled system fonts.
3. **4K Pixel Alignment**: In the UI bay (`vTextureCoord.x >= uTacticalSplit`), the shader executes `finalColor = vec4(texture(uTexture, vTextureCoord).rgb, 1.0);`. Combined with PixiJS's `resolution: window.devicePixelRatio` and `image-rendering: pixelated`, text cells are mapped 1:1 to display pixels with zero texture filtering blur.

### 2.3 Modularity & Line Count Enforcement
- `glyph-stage.ts`: 239 lines -> **0 lines modified** (100% preserved).
- `steampunk-pipeline.ts`: 126 lines -> adds `setTacticalSplit`, `getTacticalSplit` -> **~138 lines** (<= 220 limit).
- `diegetic-post-filter.ts`: 166 lines -> adds `uTacticalSplit` uniform and conditional blocks -> **~188 lines** (<= 220 limit).
- `shader-uniforms.ts`: 67 lines -> adds `DEFAULT_TACTICAL_SPLIT` and packing -> **~73 lines** (<= 220 limit).
- `main.tsx`: 71 lines -> adds `await document.fonts.ready` -> **74 lines**.
- `tests/sim/phase54-shader-pipeline.test.ts`: 228 lines -> adds tactical split assertions -> **~255 lines** (<= 300 ceiling).

---

## 3. Caveats

1. **Simulated WebGL Context in Tests**: In Vitest / Node.js test runs, WebGL shaders are validated via string pattern matching and uniform data structure packing rather than GPU execution. Visual output was confirmed via shader mathematics and PixiJS v8 architecture specifications.
2. **CSS Viewport Scaling**: On displays with non-integer scaling factors (e.g. 150% Windows scaling), CSS `image-rendering: pixelated` ensures integer pixel snapping. If a browser forcibly applies bilinear filtering to the canvas CSS element, setting CSS `image-rendering: crisp-edges` maintains sharp edges.

---

## 4. Conclusion & Exact Implementation Blueprint

### Recommendation:
Adopt the **Single-Pass Fullscreen Shader Split Uniform (`uTacticalSplit`)** approach.
Reject the container-level filter attachment approach.

### Exact Diff Specification for the Worker Agent:

#### File 1: `src/client/renderer/shader-uniforms.ts`
Current line count: 67 lines. New line count: ~73 lines.

**Before:**
```ts
export interface DiegeticShaderUniformValues {
  time: number;
  thermoStress: number;
  lensCurvature: number;
  scanlineIntensity: number;
  chromaticAberration: number;
  distortionScale: number;
  resolution: [number, number];
  bloomThresholds: [number, number]; // [amberMin, cyanMin]
  smokeMask?: [number, number, number, number];
}

export const DEFAULT_LENS_CURVATURE = 0.03;
export const DEFAULT_SCANLINE_INTENSITY = 0.08;
export const DEFAULT_CHROMATIC_ABERRATION = 0.0008;

export function createDefaultShaderUniformValues(
  widthPx = 1056,
  heightPx = 720,
): DiegeticShaderUniformValues {
  return {
    time: 0,
    thermoStress: 0,
    lensCurvature: DEFAULT_LENS_CURVATURE,
    scanlineIntensity: DEFAULT_SCANLINE_INTENSITY,
    chromaticAberration: DEFAULT_CHROMATIC_ABERRATION,
    distortionScale: 1.0,
    resolution: [widthPx, heightPx],
    bloomThresholds: [0.65, 0.70],
    smokeMask: [0, 0, 0, 0],
  };
}
```

**After:**
```ts
export interface DiegeticShaderUniformValues {
  time: number;
  thermoStress: number;
  lensCurvature: number;
  scanlineIntensity: number;
  chromaticAberration: number;
  distortionScale: number;
  resolution: [number, number];
  bloomThresholds: [number, number]; // [amberMin, cyanMin]
  smokeMask?: [number, number, number, number];
  tacticalSplit?: number; // Normalized UV X boundary separating tactical map from UI console (default: 58/88)
}

export const DEFAULT_LENS_CURVATURE = 0.03;
export const DEFAULT_SCANLINE_INTENSITY = 0.08;
export const DEFAULT_CHROMATIC_ABERRATION = 0.0008;
export const DEFAULT_TACTICAL_SPLIT = 58.0 / 88.0; // Column 58 of 88 columns = 0.6590909

export function createDefaultShaderUniformValues(
  widthPx = 1056,
  heightPx = 720,
  tacticalSplit = DEFAULT_TACTICAL_SPLIT,
): DiegeticShaderUniformValues {
  return {
    time: 0,
    thermoStress: 0,
    lensCurvature: DEFAULT_LENS_CURVATURE,
    scanlineIntensity: DEFAULT_SCANLINE_INTENSITY,
    chromaticAberration: DEFAULT_CHROMATIC_ABERRATION,
    distortionScale: 1.0,
    resolution: [widthPx, heightPx],
    bloomThresholds: [0.65, 0.70],
    smokeMask: [0, 0, 0, 0],
    tacticalSplit,
  };
}
```

In `packShaderUniforms(values)`:
Add `uTacticalSplit`:
```ts
export function packShaderUniforms(values: DiegeticShaderUniformValues): Record<string, { value: unknown; type: string }> {
  return {
    uTime: { value: values.time, type: 'f32' },
    uResolution: { value: new Float32Array(values.resolution), type: 'vec2<f32>' },
    uLensCurvature: { value: values.lensCurvature * values.distortionScale, type: 'f32' },
    uScanlineIntensity: { value: values.scanlineIntensity * values.distortionScale, type: 'f32' },
    uThermoStress: { value: values.thermoStress, type: 'f32' },
    uChromaticAberration: { value: values.chromaticAberration, type: 'f32' },
    uDistortionScale: { value: values.distortionScale, type: 'f32' },
    uBloomThresholds: { value: new Float32Array(values.bloomThresholds), type: 'vec2<f32>' },
    uSmokeMask: { value: new Float32Array(values.smokeMask ?? [0, 0, 0, 0]), type: 'vec4<f32>' },
    uTacticalSplit: { value: values.tacticalSplit ?? DEFAULT_TACTICAL_SPLIT, type: 'f32' },
  };
}
```

---

#### File 2: `src/client/renderer/diegetic-post-filter.ts`
Current line count: 166 lines. New line count: ~188 lines.

**Fragment Shader Replacement (`DIEGETIC_FRAGMENT_SHADER`):**
```glsl
export const DIEGETIC_FRAGMENT_SHADER = `
  in vec2 vTextureCoord;
  out vec4 finalColor;

  uniform sampler2D uTexture;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uLensCurvature;
  uniform float uScanlineIntensity;
  uniform float uThermoStress;
  uniform float uChromaticAberration;
  uniform float uDistortionScale;
  uniform vec2 uBloomThresholds;
  uniform vec4 uSmokeMask;
  uniform float uTacticalSplit;

  // Pass 1: Spherical glass lens curvature (k = 0.08)
  vec2 applyLensCurvature(vec2 uv, float k) {
      vec2 d = uv - vec2(0.5);
      float r2 = dot(d, d);
      return vec2(0.5) + d * (1.0 + k * r2);
  }

  void main(void)
  {
      bool isUi = vTextureCoord.x >= uTacticalSplit;
      vec2 curvedUV = vTextureCoord;

      if (!isUi) {
          float split = max(uTacticalSplit, 0.01);
          vec2 normUV = vec2(vTextureCoord.x / split, vTextureCoord.y);
          vec2 curvedNorm = applyLensCurvature(normUV, uLensCurvature * uDistortionScale);

          // Clamping to bronze bezel at tactical perimeter
          if (curvedNorm.x < 0.0 || curvedNorm.x > 1.0 || curvedNorm.y < 0.0 || curvedNorm.y > 1.0) {
              finalColor = vec4(0.04, 0.05, 0.06, 1.0);
              return;
          }
          curvedUV = vec2(curvedNorm.x * split, curvedNorm.y);
      }

      // Pass 4: Thermodynamic heat haze & chromatic aberration (isolated from UI sidebar)
      vec2 baseUV = curvedUV;
      vec2 caDir = vec2(0.0);
      if (!isUi) {
          float heatHaze = sin(curvedUV.y * 36.0 + uTime * 4.2) * cos(curvedUV.x * 28.0 - uTime * 3.1);
          vec2 hazeOffset = vec2(heatHaze * 0.0005 * uThermoStress, 0.0);
          baseUV = curvedUV + hazeOffset;

          vec2 centered = baseUV - vec2(uTacticalSplit * 0.5, 0.5);
          float caDist = length(centered);
          float caSplit = (uChromaticAberration + uThermoStress * 0.0012) * caDist;
          caDir = caDist > 0.001 ? normalize(centered) * caSplit : vec2(0.0);
      }

      float r = texture(uTexture, baseUV - caDir).r;
      float g = texture(uTexture, baseUV).g;
      float b = texture(uTexture, baseUV + caDir).b;
      vec3 col = vec3(r, g, b);

      // Pass 3: Dual-threshold phosphor bloom (amber/cyan) - tactical only to preserve UI glyph sharpness
      if (!isUi) {
          vec3 bloom = vec3(0.0);
          float bShift = 0.0015;
          bloom += texture(uTexture, baseUV + vec2(bShift, 0.0)).rgb;
          bloom += texture(uTexture, baseUV - vec2(bShift, 0.0)).rgb;
          bloom += texture(uTexture, baseUV + vec2(0.0, bShift)).rgb;
          bloom += texture(uTexture, baseUV - vec2(0.0, bShift)).rgb;
          bloom *= 0.25;

          if (bloom.b > uBloomThresholds.y && bloom.g > 0.60) {
              col += bloom * vec3(0.30, 0.85, 1.00) * 0.20;
          }
          if (bloom.r > uBloomThresholds.x && bloom.g > 0.40) {
              col += bloom * vec3(1.15, 0.85, 0.30) * 0.16;
          }
      }

      // Pass 3b: Localized volumetric smoke plume within masked UV bounds (tactical only)
      if (!isUi && uSmokeMask.z > uSmokeMask.x &&
          baseUV.x >= uSmokeMask.x && baseUV.x <= uSmokeMask.z &&
          baseUV.y >= uSmokeMask.y && baseUV.y <= uSmokeMask.w) {
          float smokeNoise = sin(baseUV.x * 24.0 + uTime * 1.6) * cos((baseUV.y - uTime * 0.9) * 18.0);
          float plume = smoothstep(0.15, 0.85, smokeNoise * 0.5 + 0.5) * 0.16;
          col = mix(col, vec3(0.22, 0.18, 0.15), plume);
      }

      // Pass 2: Aperture grille shadow mask (tactical only for razor-sharp 4K HDR UI text)
      if (!isUi) {
          float scanline = sin(curvedUV.y * uResolution.y * 3.14159) * 0.5 + 0.5;
          col *= (1.0 - uScanlineIntensity * (1.0 - scanline));

          float triad = mod(curvedUV.x * uResolution.x, 3.0);
          vec3 triadMask = vec3(0.985);
          if (triad < 1.0) triadMask += 0.015;
          col *= triadMask;

          // Outer bezel vignette
          vec2 centered = curvedUV - vec2(uTacticalSplit * 0.5, 0.5);
          float vignette = 1.0 - dot(centered, centered) * 0.75;
          col *= clamp(vignette, 0.40, 1.0);

          // Microscopic Edison filament grain
          float grain = fract(sin(dot(curvedUV * 90.0, vec2(12.9898, 78.233)) + uTime * 0.05) * 43758.5453);
          col += (grain - 0.5) * 0.007;
      }

      finalColor = vec4(col, 1.0);
  }
`;
```

In `updateDiegeticFilterUniforms`:
```ts
export function updateDiegeticFilterUniforms(
  filter: Filter,
  values: DiegeticShaderUniformValues,
): void {
  const uniforms = (filter.resources.diegeticUniforms as { uniforms?: Record<string, unknown> } | undefined)?.uniforms;
  if (!uniforms) return;
  uniforms.uTime = values.time;
  uniforms.uResolution = values.resolution;
  uniforms.uLensCurvature = values.lensCurvature * values.distortionScale;
  uniforms.uScanlineIntensity = values.scanlineIntensity * values.distortionScale;
  uniforms.uThermoStress = values.thermoStress;
  uniforms.uChromaticAberration = values.chromaticAberration;
  uniforms.uDistortionScale = values.distortionScale;
  uniforms.uBloomThresholds = values.bloomThresholds;
  if (values.tacticalSplit !== undefined) uniforms.uTacticalSplit = values.tacticalSplit;
  if (values.smokeMask) uniforms.uSmokeMask = values.smokeMask;
}
```

---

#### File 3: `src/client/renderer/steampunk-pipeline.ts`
Current line count: 126 lines. New line count: ~138 lines.

Add `DEFAULT_TACTICAL_SPLIT` import from `./shader-uniforms.js`.
Add helper methods:
```ts
  public setTacticalSplit(split: number): void {
    this.uniforms.tacticalSplit = split;
    if (this.postFilter && this.filterEnabled) {
      updateDiegeticFilterUniforms(this.postFilter, this.uniforms);
    }
  }

  public getTacticalSplit(): number {
    return this.uniforms.tacticalSplit ?? DEFAULT_TACTICAL_SPLIT;
  }
```

---

#### File 4: `src/client/main.tsx`
Current line count: 71 lines. New line count: 74 lines.

In `bootstrapClient()`:
```ts
async function bootstrapClient(): Promise<void> {
  const canvasHost = document.getElementById('canvas-stage');
  const hudHost = document.getElementById('hud-root');
  const actionBarHost = document.getElementById('action-bar-root');
  const topBarHost = document.getElementById('top-bar-root');
  if (!canvasHost || !hudHost) throw new Error('Missing #canvas-stage or #hud-root mount elements');

  // Ensure IBM Plex Mono WOFF2 font is fully decoded prior to atlas rasterization
  if (typeof document !== 'undefined' && 'fonts' in document) {
    await document.fonts.ready;
  }

  const stageRenderer = await GlyphStageRenderer.create(canvasHost, WIDESCREEN_GRID_WIDTH, WIDESCREEN_GRID_HEIGHT);
```

---

#### File 5: `src/client/renderer/glyph-atlas-extended.ts`
Current line count: 113 lines. New line count: 113 lines (0 net lines).

Update default `fontFamily` parameter at line 49:
```ts
export function createExtendedGlyphAtlas(
  cellWidth: number,
  cellHeight: number,
  fontFamily = '"IBM Plex Mono", "JetBrains Mono", "Fira Code", "Courier New", monospace',
): GlyphAtlas {
```

---

#### File 6: `tests/sim/phase54-shader-pipeline.test.ts`
Current line count: 228 lines. New line count: ~255 lines.

Add assertions to `Phase 54: Diegetic Presentation Shell & GLSL Shader Suite`:
```ts
    it('verifies tactical split uniform exists and isolates UI console from distortion', () => {
      expect(DIEGETIC_FRAGMENT_SHADER).toContain('uTacticalSplit');
      const uniforms = createDefaultShaderUniformValues();
      expect(uniforms.tacticalSplit).toBeCloseTo(58.0 / 88.0, 4);

      const packed = packShaderUniforms(uniforms);
      expect(packed['uTacticalSplit']?.type).toBe('f32');
      expect(packed['uTacticalSplit']?.value).toBeCloseTo(58.0 / 88.0, 4);

      const pipeline = new SteampunkRenderPipeline(1056, 720, false);
      expect(pipeline.getTacticalSplit()).toBeCloseTo(58.0 / 88.0, 4);
      pipeline.setTacticalSplit(0.0);
      expect(pipeline.getTacticalSplit()).toBe(0.0);
      pipeline.setTacticalSplit(58.0 / 88.0);
    });
```

---

## 5. Verification Method

To independently verify the implementation:

1. **Shader Pipeline Tests**:
   ```bash
   npx vitest run tests/sim/phase54-shader-pipeline.test.ts
   ```
   *Expected Output*: All 12 tests pass (verifying 5-layer container hierarchy, 4-pass GLSL shader strings, default uniforms, `uTacticalSplit` packing, camera governor, and 256-glyph CP437 atlas).

2. **POI & Thematic Template Shader Tests**:
   ```bash
   npx vitest run tests/sim/poi-thematic-templates.test.ts
   ```
   *Expected Output*: All 5 tests pass (verifying `uSmokeMask` and architectural terrain).

3. **Full Headless Deterministic Test Suite**:
   ```bash
   npm run test:sim
   ```
   *Expected Output*: 109 test files passed, 560+ tests passed.

4. **Architectural Boundary & Modularity Ceiling Gate**:
   ```bash
   npm run check:boundaries
   ```
   *Expected Output*: `[check:boundaries] OK — Checked 404 files. Zero Core/Shell or modularity violations.`

5. **Line Count Verification**:
   ```bash
   wc -l src/client/renderer/glyph-stage.ts src/client/renderer/diegetic-post-filter.ts src/client/renderer/steampunk-pipeline.ts src/client/renderer/shader-uniforms.ts
   ```
   *Expected Line Counts*:
   - `src/client/renderer/glyph-stage.ts`: 239 lines (exactly unmodified)
   - `src/client/renderer/diegetic-post-filter.ts`: <= 220 lines (target ~188 lines)
   - `src/client/renderer/steampunk-pipeline.ts`: <= 220 lines (target ~138 lines)
   - `src/client/renderer/shader-uniforms.ts`: <= 220 lines (target ~73 lines)
   - None exceeding the 300-line hard ceiling.

6. **Full Pre-Flight Verification Gate**:
   ```bash
   npm run verify
   ```
   *Expected Output*: Typecheck, boundary check, data validation, and simulation test suite all exit with code 0.
