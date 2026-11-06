import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { externalCliEnv } from "../../core/auth-env.ts";

export interface RpcMessage { id?: number | string; method?: string; params?: Record<string, unknown>; result?: unknown; error?: { message: string } }
export type SpawnCodex = () => ChildProcessWithoutNullStreams;
const children = new Set<ChildProcessWithoutNullStreams>();
function terminateChild(child: ChildProcessWithoutNullStreams, signal: NodeJS.Signals = "SIGTERM"): void {
	// The npm Codex command is a wrapper around a native child. Own the whole group.
	if (process.platform !== "win32" && child.pid) {
		try { process.kill(-child.pid, signal); return; } catch { /* injected test child or already exited */ }
	}
	child.kill(signal);
}
const terminateChildren = () => { for (const child of children) terminateChild(child); };
process.once("exit", terminateChildren);
process.once("SIGTERM", () => { terminateChildren(); process.exit(0); });
process.once("SIGINT", () => { terminateChildren(); process.exit(0); });

export function spawnCodex(): ChildProcessWithoutNullStreams {
	return spawn(/* turbopackIgnore: true */ process.env.LH_CODEX_BINARY || "codex", ["app-server", "--listen", "stdio://",
		"-c", "features.shell_tool=false", "-c", "features.multi_agent=false", "-c", "features.sleep_tool=false", "-c", 'web_search="disabled"'],
	{ detached: process.platform !== "win32", stdio: ["pipe", "pipe", "pipe"], env: externalCliEnv() });
}

/** Local stdio only. Authentication and refresh remain owned by Codex. */
export class CodexRpc {
	private next = 1;
	private pending = new Map<number | string, { resolve(value: unknown): void; reject(error: Error): void }>();
	private stopped = false;
	readonly child: ChildProcessWithoutNullStreams;
	onMessage: (message: RpcMessage) => void = () => {};
	onFailure: (error: Error) => void = () => {};
	constructor(start: SpawnCodex = spawnCodex) {
		this.child = start(); children.add(this.child);
		const lines = createInterface({ input: this.child.stdout });
		lines.on("line", (line) => {
			if (line.length > 8 * 1024 * 1024) { this.fail(new Error("Codex response exceeded 8 MiB")); return; }
			let message: RpcMessage;
			try { message = JSON.parse(line) as RpcMessage; } catch { this.fail(new Error("Invalid Codex protocol message")); return; }
			const waiter = message.method ? undefined : this.pending.get(message.id!);
			if (waiter) {
				this.pending.delete(message.id!);
				if (message.error) waiter.reject(new Error(message.error.message)); else waiter.resolve(message.result);
			} else if (!this.stopped) {
				try { this.onMessage(message); } catch (error) { this.fail(error instanceof Error ? error : new Error(String(error))); }
			}
		});
		// Do not forward child diagnostics: account/config errors can contain private paths.
		this.child.stderr.resume();
		this.child.stdin.on("error", (error) => this.fail(error));
		this.child.once("error", (error) => this.fail(error));
		this.child.once("exit", () => { children.delete(this.child); lines.close(); this.fail(new Error("Codex process exited before completing the request")); });
	}
	private fail(error: Error): void {
		if (this.stopped) return;
		this.onFailure(error); this.close();
	}
	notify(method: string, params?: unknown): void { this.send({ method, ...(params === undefined ? {} : { params }) }); }
	private send(message: unknown): void {
		if (this.stopped) throw new Error("Codex connection is closed");
		this.child.stdin.write(JSON.stringify(message) + "\n");
	}
	async request<T = unknown>(method: string, params: unknown = {}): Promise<T> {
		const id = this.next++;
		return await new Promise<T>((resolve, reject) => {
			const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Codex ${method} timed out`)); }, 30_000);
			this.pending.set(id, {
				resolve: (value) => { clearTimeout(timer); resolve(value as T); },
				reject: (error) => { clearTimeout(timer); reject(error); },
			});
			try { this.send({ id, method, params }); } catch (error) { this.pending.get(id)?.reject(error as Error); this.pending.delete(id); }
		});
	}
	async initialize(): Promise<void> {
		await this.request("initialize", { clientInfo: { name: "learnharness_local", title: "LearnHarness", version: "0.4.0" }, capabilities: { experimentalApi: true } });
		this.notify("initialized");
		const reply = await this.request<{ account: { type: string } | null }>("account/read", { refreshToken: false });
		if (reply.account?.type !== "chatgpt") throw new Error("Codex is not signed in with ChatGPT. Sign in through the regular Codex app first; no LearnHarness login is needed.");
	}
	close(): void {
		if (this.stopped) return;
		this.stopped = true;
		for (const waiter of this.pending.values()) waiter.reject(new Error("Codex connection closed"));
		this.pending.clear();
		this.child.stdin.end(); terminateChild(this.child);
		const timer = setTimeout(() => { if (this.child.exitCode === null && this.child.signalCode === null) terminateChild(this.child, "SIGKILL"); }, 1000); timer.unref();
	}
}
