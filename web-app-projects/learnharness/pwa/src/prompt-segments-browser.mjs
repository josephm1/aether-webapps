import source from 'aether:prompt-assets';
import {promptOverrides} from './runtime-state.mjs';
export function effectivePromptSegments(agent,switches={}){return (source[agent]||[]).map(s=>({...s,overrideText:promptOverrides[s.path]??null,enabled:switches[s.path]===true&&typeof promptOverrides[s.path]==='string'}));}
