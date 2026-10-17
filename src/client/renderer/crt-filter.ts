import { Filter, GlProgram } from 'pixi.js';

const CRT_VERTEX_SHADER = `
  in vec2 aPosition;
  out vec2 vTextureCoord;

  uniform vec4 uInputSize;
  uniform vec4 uOutputFrame;
  uniform vec4 uOutputTexture;

  vec4 filterVertexPosition( void )
  {
      vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
      position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
      position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
      return vec4(position, 0.0, 1.0);
  }

  vec2 filterTextureCoord( void )
  {
      return aPosition * (uOutputFrame.zw * uInputSize.zw);
  }

  void main(void)
  {
      gl_Position = filterVertexPosition();
      vTextureCoord = filterTextureCoord();
  }
`;

const CRT_FRAGMENT_SHADER = `
  in vec2 vTextureCoord;
  out vec4 finalColor;

  uniform sampler2D uTexture;
  uniform float uTime;

  void main(void)
  {
      vec2 uv = vTextureCoord;

      // Subtle chromatic aberration (amber/cyan Victorian CRT fringe)
      float shift = 0.0009;
      float r = texture(uTexture, vec2(uv.x + shift, uv.y)).r;
      float g = texture(uTexture, uv).g;
      float b = texture(uTexture, vec2(uv.x - shift, uv.y)).b;
      vec3 col = vec3(r, g, b);

      // Horizontal CRT scanlines
      float scanline = sin(uv.y * 540.0 + uTime * 2.0) * 0.06;
      col -= scanline;

      // Warm brass phosphor tint & vignette
      vec2 centered = uv - vec2(0.5);
      float vignette = 1.0 - dot(centered, centered) * 0.55;
      col *= clamp(vignette, 0.4, 1.0);

      finalColor = vec4(col, 1.0);
  }
`;

export function createCrtPostFilter(): Filter {
  const glProgram = GlProgram.from({
    vertex: CRT_VERTEX_SHADER,
    fragment: CRT_FRAGMENT_SHADER,
  });

  return new Filter({
    glProgram,
    resources: {
      crtUniforms: {
        uTime: { value: 0, type: 'f32' },
      },
    },
  });
}
