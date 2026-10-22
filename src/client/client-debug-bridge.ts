import { GameCommand } from '../schemas/commands.schema.js';
import { WorldState } from '../sim/core/world.js';
import { VisualGridFrame } from './projection/frame-adapter.js';
import { SoundscapeManager } from './audio/soundscape-manager.js';
import {  } from './client-interactions.js';

export interface DebugSimBridge {
  getState: () => Readonly<WorldState>;
  getVisualFrame: () => VisualGridFrame;
  dispatch: (cmd: GameCommand) => void;
  serialize: () => string;
  soundscape?: SoundscapeManager;
}
