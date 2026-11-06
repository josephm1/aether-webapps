/** Explicit, bounded live smoke; uses only the local Codex ChatGPT connection. */
import { Type } from "typebox";
import { CodexRpc } from "../src/agent/codex-cli/rpc.ts";
import assert from "node:assert/strict";
import { normalizeContext } from "@earendil-works/pi-ai/utils/transcript";
import { codexModels } from "../src/agent/codex-cli/provider.ts";
import { streamCodex } from "../src/agent/codex-cli/stream.ts";

if (!process.env.LH_CODEX_MODELS) {
    const rpc = new CodexRpc();
    try {
        await rpc.initialize();
        const catalog = await rpc.request<{data: {id: string; displayName: string; supportedReasoningEfforts: {reasoningEffort: string}[]; hidden: boolean; isDefault: boolean}[]}>("model/list", {});
        process.env.LH_CODEX_BRIDGE = "1";
        process.env.LH_CODEX_MODELS = JSON.stringify(catalog.data.filter(m => !m.hidden).sort((a,b) => Number(b.isDefault)-Number(a.isDefault)).map(m => ({id:m.id,name:m.displayName,reasoning:m.supportedReasoningEfforts})));
    } finally {rpc.close();}
}
const model = codexModels()[0];
assert(model, "Codex model catalog is required");
const context = normalizeContext({ systemPrompt: "You are checking a learning app connection. Follow the user's short instruction exactly.", messages: [{ role: "user", content: "Reply with exactly READY.", timestamp: Date.now() }] });
const response = streamCodex(model, context, { reasoning: "low", signal: AbortSignal.timeout(60_000) });
const result = await response.result();
assert.equal(result.stopReason, "stop", result.errorMessage);
assert.match(result.content.filter(b => b.type === "text").map(b => b.text).join(""), /READY/);
console.log("Live Codex text smoke passed: existing ChatGPT account, completed response.");

const toolContext = normalizeContext({
    systemPrompt: "You are testing the quiz bridge. Call record_choice exactly once with choice dinner. After the tool result arrives, reply with exactly READY7. Do not call other tools.",
    messages: [{role:"user",content:"Record my dinner choice using the tool.",timestamp:Date.now()}],
    tools: [{name:"record_choice",description:"Record the learner choice",parameters:Type.Object({choice:Type.Union([Type.Literal("lunch"),Type.Literal("dinner")])})}],
});
const toolReply = await streamCodex(model, toolContext, {reasoning:"low",signal:AbortSignal.timeout(60_000)}).result();
assert.equal(toolReply.stopReason,"toolUse",toolReply.errorMessage);
const call=toolReply.content.find(b=>b.type==="toolCall");assert(call && call.type==="toolCall");assert.equal(call.arguments.choice,"dinner");
const continued=normalizeContext({messages:[...toolContext.messages,toolReply,{role:"toolResult",toolCallId:call.id,toolName:call.name,content:[{type:"text",text:'{"recorded":true,"confirmation":"READY7"}'}],isError:false,timestamp:Date.now()}]});
const final=await streamCodex(model,continued,{reasoning:"low",signal:AbortSignal.timeout(60_000)}).result();
assert.equal(final.stopReason,"stop",final.errorMessage);assert.match(final.content.filter(b=>b.type==="text").map(b=>b.text).join(""),/READY7/);
console.log("Live Codex tool/answer/history smoke passed.");
