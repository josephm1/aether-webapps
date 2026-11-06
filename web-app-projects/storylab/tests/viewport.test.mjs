import test from 'node:test';
import assert from 'node:assert/strict';
import {installViewport} from '../pwa/dist/viewport.mjs';
test('dialog height uses real pixels and follows keyboard/attachment resizing',()=>{
 let height;const events={};const visualEvents={};const window={innerHeight:900,visualViewport:{height:0,addEventListener:(name,fn)=>visualEvents[name]=fn},addEventListener:(name,fn)=>events[name]=fn};const document={documentElement:{clientHeight:0,style:{setProperty:(name,value)=>{assert.equal(name,'--app-height');height=value;}}}};
 installViewport(window,document);assert.equal(height,'900px');window.visualViewport.height=450;visualEvents.resize();assert.equal(height,'450px');window.visualViewport.height=0;window.innerHeight=0;events.resize();assert.equal(height,'640px');
});
