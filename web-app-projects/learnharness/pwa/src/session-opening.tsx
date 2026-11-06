import React from 'react';
import {readOpeningPromptEntry} from '../../components/opening-prompt';
import {ThinkingControl} from './ai-selection';
export function SessionOpening(){const id=decodeURIComponent(location.pathname.split('/')[2]||''),prompt=readOpeningPromptEntry(id)?.text;return <main className="lh-session-opening" aria-busy="true">{prompt&&<div data-testid="user-message">{prompt}</div>}<p role="status">Opening your conversation…</p><div className="lh-opening-composer lh-session-composer-surface"><div className="lh-opening-input">Your conversation will continue here.</div><div className="lh-session-tools"><span/><ThinkingControl/></div></div></main>;}
