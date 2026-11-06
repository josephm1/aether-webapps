import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import assert from "node:assert/strict";
import { test } from "node:test";
import { DictationBar, type Dictation } from "../components/dictation.tsx";
Object.assign(globalThis, { React });
test("recording, startup and finishing stay distinguishable without animation", () => {
 for (const [phase, label] of [["connecting", "Starting microphone…"], ["recording", "Listening"], ["stopping", "Finishing…"]] as const) {
  const dictation: Dictation = {phase,error:null,levelRef:{current:0},active:true,toggle(){},stop(){},cancel(){},clearError(){},async finish(){}};
  const html=renderToStaticMarkup(<DictationBar dictation={dictation}/>);
  assert.ok(html.includes(label)); assert.match(html,/role="status"/);assert.match(html,/aria-live="polite"/);
  assert.match(html,/aria-label="Stop dictation"/);
  if(phase==="stopping")assert.match(html,/disabled=""/);
 }
});
