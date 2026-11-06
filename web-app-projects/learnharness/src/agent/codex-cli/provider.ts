import { createProvider, type Provider, type Model, type Api } from "@earendil-works/pi-ai";
import { streamCodex } from "./stream.ts";

export const CODEX_PROVIDER = "codex-cli";
export const codexEnabled = () => process.env.LH_CODEX_BRIDGE === "1";
export interface CodexModelInfo { id: string; name: string; input?: ("text" | "image")[]; reasoning?: { reasoningEffort: string }[] }
export function codexModels(): Model<Api>[] {
	if (!codexEnabled()) return [];
	const raw = JSON.parse(process.env.LH_CODEX_MODELS || "[]") as CodexModelInfo[];
	return raw.map((m) => ({
		id: m.id, name: `${m.name} · Codex`, provider: CODEX_PROVIDER, api: "codex-app-server", baseUrl: "",
		input: m.input ?? ["text"], reasoning: true,
		thinkingLevelMap: Object.fromEntries((m.reasoning ?? []).filter((r) => ["low", "medium", "high", "xhigh", "max"].includes(r.reasoningEffort)).map((r) => [r.reasoningEffort, r.reasoningEffort])),
		// An application input budget, not a claim about the model's full context size.
		contextWindow: 128_000, maxTokens: 32_000,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	} as Model<Api>));
}
export function createCodexProvider(): Provider {
	return createProvider({ id: CODEX_PROVIDER, name: "Codex · existing ChatGPT login", auth: { apiKey: { name: "Local Codex", resolve: async () => ({ auth: {}, source: "Codex CLI" }) } }, models: codexModels(), api: { stream: streamCodex, streamSimple: streamCodex } });
}
