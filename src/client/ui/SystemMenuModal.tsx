import { useState } from 'preact/hooks';
import { deserializeWorld, serializeWorld, WorldState } from '../../sim/core/world.js';
import { SystemSettingsControls } from './SystemSettingsControls.js';

export interface SystemMenuModalProps {
  readonly state: Readonly<WorldState>;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onNewSeed: (seed: number) => void;
  readonly onLoadWorld: (savedWorld: WorldState) => void;
  readonly onOpenCharacterCreator?: (() => void) | undefined;
  readonly crtScanlinesEnabled?: boolean | undefined;
  readonly onToggleCrtScanlines?: (() => void) | undefined;
  readonly useDiegeticCanvasUi?: boolean | undefined;
  readonly onToggleUiMode?: (() => void) | undefined;
}

const LOCAL_STORAGE_KEY = 'aether_soot_save';

export function SystemMenuModal({
  state,
  isOpen,
  onClose,
  onNewSeed,
  onLoadWorld,
  onOpenCharacterCreator,
  crtScanlinesEnabled = true,
  onToggleCrtScanlines,
  useDiegeticCanvasUi = true,
  onToggleUiMode,
}: SystemMenuModalProps) {
  if (!isOpen) return null;

  const [seedInput, setSeedInput] = useState<string>(String(state.seed));
  const [statusMsg, setStatusMsg] = useState<string>('');

  const handleSaveLocalStorage = () => {
    try {
      const json = serializeWorld(state as WorldState);
      localStorage.setItem(LOCAL_STORAGE_KEY, json);
      setStatusMsg(`Saved world state (Turn ${state.turnCount}) to LocalStorage.`);
    } catch (err: unknown) {
      setStatusMsg(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleLoadLocalStorage = () => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) {
        setStatusMsg('No save file found in LocalStorage slot.');
        return;
      }
      const loaded = deserializeWorld(raw);
      onLoadWorld(loaded);
      setStatusMsg(`Loaded save from LocalStorage (Turn ${loaded.turnCount}).`);
      onClose();
    } catch (err: unknown) {
      setStatusMsg(`Load failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleExportJson = () => {
    try {
      const json = serializeWorld(state as WorldState);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aether_soot_t${state.turnCount}_s${state.seed}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMsg('Exported JSON save file.');
    } catch (err: unknown) {
      setStatusMsg(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleImportJson = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const loaded = deserializeWorld(text);
        onLoadWorld(loaded);
        setStatusMsg(`Imported world (Turn ${loaded.turnCount}, Seed ${loaded.seed}).`);
        onClose();
      } catch (err: unknown) {
        setStatusMsg(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(7, 9, 10, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        class="panel-box"
        style={{
          width: '420px',
          maxWidth: '90vw',
          border: '2px solid var(--brass-gold)',
          background: '#0d1316',
          boxShadow: '0 0 30px rgba(212, 175, 55, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div class="panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>CHRONOS &amp; ENGINE ARCHIVE [Esc]</span>
          <button type="button" onClick={onClose} style={{ padding: '2px 6px' }}>
            [X]
          </button>
        </div>

        {statusMsg && (
          <div class="log-entry brass-text" style={{ margin: '6px 0', padding: '4px' }}>
            {statusMsg}
          </div>
        )}

        {onOpenCharacterCreator && (
          <div style={{ margin: '8px 0' }}>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCharacterCreator();
              }}
              style={{
                width: '100%',
                padding: '8px',
                background: 'rgba(212, 175, 55, 0.15)',
                border: '1px solid var(--brass-gold)',
                color: 'var(--brass-gold)',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              [+] [N] Create New Character / Scenario
            </button>
          </div>
        )}

        <SystemSettingsControls
          crtScanlinesEnabled={crtScanlinesEnabled}
          onToggleCrtScanlines={onToggleCrtScanlines}
          useDiegeticCanvasUi={useDiegeticCanvasUi}
          onToggleUiMode={onToggleUiMode}
        />

        <div class="panel-header" style={{ marginTop: '8px' }}>DISTRICT SEED GENERATION</div>
        <div style={{ display: 'flex', gap: '6px', margin: '6px 0' }}>
          <input
            type="number"
            value={seedInput}
            onInput={(e) => setSeedInput((e.target as HTMLInputElement).value)}
            style={{
              background: '#17202a',
              color: 'var(--brass-gold)',
              border: '1px solid #2e4053',
              padding: '4px 8px',
              fontFamily: 'inherit',
              flex: 1,
            }}
          />
          <button
            type="button"
            onClick={() => {
              const val = parseInt(seedInput, 10);
              if (!Number.isNaN(val)) {
                onNewSeed(val);
                onClose();
              }
            }}
          >
            Generate
          </button>
          <button
            type="button"
            onClick={() => {
              const rolled = Math.floor(Math.random() * 0x7fffffff);
              setSeedInput(String(rolled));
              onNewSeed(rolled);
              onClose();
            }}
          >
            Roll
          </button>
        </div>

        <div class="panel-header" style={{ marginTop: '12px' }}>SAVE / LOAD WORLD STATE</div>
        <div class="button-grid" style={{ marginTop: '6px' }}>
          <button type="button" onClick={handleSaveLocalStorage}>[S] Save to LocalStorage Slot</button>
          <button type="button" onClick={handleLoadLocalStorage}>[L] Restore from LocalStorage Slot</button>
          <button type="button" onClick={handleExportJson}>[E] Export Save JSON File</button>
          <label style={{ display: 'block', cursor: 'pointer' }}>
            <span style={{ display: 'block', background: '#17202a', color: 'var(--brass-gold)', border: '1px solid var(--brass-gold)', padding: '6px 8px', fontSize: '11px' }}>
              [I] Import Save JSON File
            </span>
            <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportJson} />
          </label>
        </div>

        <div style={{ marginTop: '14px', textAlign: 'center' }}>
          <button type="button" onClick={onClose} style={{ width: '100%', textAlign: 'center' }}>
            Resume Boiler &amp; Simulation
          </button>
        </div>
      </div>
    </div>
  );
}
