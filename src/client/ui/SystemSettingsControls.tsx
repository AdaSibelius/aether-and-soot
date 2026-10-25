import { getPerformanceGovernor, ShaderQualityTier } from '../renderer/performance-governor.js';

export interface SystemSettingsControlsProps {
  readonly crtScanlinesEnabled?: boolean | undefined;
  readonly onToggleCrtScanlines?: (() => void) | undefined;
  readonly onSettingsChanged?: (() => void) | undefined;
  readonly useDiegeticCanvasUi?: boolean | undefined;
  readonly onToggleUiMode?: (() => void) | undefined;
}

export function SystemSettingsControls({
  crtScanlinesEnabled = true,
  onToggleCrtScanlines,
  onSettingsChanged,
  useDiegeticCanvasUi = true,
  onToggleUiMode,
}: SystemSettingsControlsProps) {
  const governor = getPerformanceGovernor();
  const currentTier = governor.getQualityTier();
  const reducedMotion = governor.isReducedMotion();
  const disableDistortion = governor.isLensDistortionDisabled();
  const fps = governor.getFps();

  const handleTierChange = (tier: ShaderQualityTier) => {
    governor.setQualityTier(tier);
    onSettingsChanged?.();
  };

  const handleToggleReducedMotion = () => {
    governor.setReducedMotion(!reducedMotion);
    onSettingsChanged?.();
  };

  const handleToggleDistortion = () => {
    governor.setLensDistortionDisabled(!disableDistortion);
    onSettingsChanged?.();
  };

  return (
    <div style={{ margin: '8px 0', borderTop: '1px solid #2e4053', paddingTop: '8px' }}>
      <div class="panel-header" style={{ marginBottom: '6px', fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
        <span>OPTICAL &amp; ACCESSIBILITY GOVERNOR</span>
        <span style={{ color: fps >= 55 ? 'var(--ok-green)' : '#e6a145' }}>{fps} FPS</span>
      </div>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
        {(['HIGH_OPTICAL', 'BALANCED', 'CRISP_TERMINAL'] as const).map((tier) => (
          <button
            key={tier}
            type="button"
            onClick={() => handleTierChange(tier)}
            style={{
              flex: 1,
              padding: '4px 2px',
              fontSize: '10px',
              color: currentTier === tier ? 'var(--brass-gold)' : '#7f8c8d',
              border: currentTier === tier ? '1px solid var(--brass-gold)' : '1px solid #2e4053',
              background: currentTier === tier ? 'rgba(212, 175, 55, 0.15)' : '#17202a',
            }}
          >
            {tier === 'HIGH_OPTICAL' ? 'High' : tier === 'BALANCED' ? 'Balanced' : 'Crisp'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
        <button
          type="button"
          onClick={handleToggleReducedMotion}
          style={{
            flex: 1,
            padding: '4px',
            fontSize: '10px',
            color: reducedMotion ? 'var(--ok-green)' : '#7f8c8d',
            border: '1px solid #2e4053',
          }}
        >
          Reduced Motion: {reducedMotion ? '[ON]' : '[OFF]'}
        </button>

        <button
          type="button"
          onClick={handleToggleDistortion}
          style={{
            flex: 1,
            padding: '4px',
            fontSize: '10px',
            color: disableDistortion ? '#7f8c8d' : 'var(--ok-green)',
            border: '1px solid #2e4053',
          }}
        >
          Lens Optics: {disableDistortion ? '[FLAT]' : '[CURVED]'}
        </button>
      </div>

      {onToggleUiMode && (
        <button
          type="button"
          onClick={onToggleUiMode}
          style={{
            width: '100%',
            padding: '4px 6px',
            marginBottom: '6px',
            fontSize: '10px',
            color: useDiegeticCanvasUi ? 'var(--brass-gold)' : 'var(--ok-green)',
            border: '1px solid #2e4053',
            background: useDiegeticCanvasUi ? 'rgba(212, 175, 55, 0.15)' : '#17202a',
          }}
        >
          Interface Mode: {useDiegeticCanvasUi ? '[DIEGETIC CANVAS UI]' : '[CLASSIC DOM WINDOWS]'}
        </button>
      )}

      {onToggleCrtScanlines && (
        <button
          type="button"
          onClick={onToggleCrtScanlines}
          style={{
            width: '100%',
            padding: '4px 6px',
            fontSize: '10px',
            color: crtScanlinesEnabled ? 'var(--ok-green)' : '#7f8c8d',
            border: '1px solid #2e4053',
          }}
        >
          CRT Scanlines: {crtScanlinesEnabled ? '[ACTIVE -45% Alpha]' : '[DISABLED]'}
        </button>
      )}
    </div>
  );
}
