/** Optional Mobile Codex host capability; regular browsers retain their existing provider. */
export type NativeDictationEvent = {
 type: "state" | "result";
 phase?: string;
 level?: number;
 text?: string;
 error?: string;
 cancelled?: boolean;
};
export type NativeDictationSession = { stop(): void; cancel(): void };
export type NativeDictation = {
 start(options: { language: string }, listener: (event: NativeDictationEvent) => void): NativeDictationSession;
};

declare global {
 interface Window { mobileCodex?: { dictation: NativeDictation }; }
}
export function inMobileCodex(): boolean {
 return typeof window !== "undefined" && (Boolean(window.mobileCodex?.dictation)
  || (typeof navigator !== "undefined" && navigator.userAgent.includes("MobileCodexWebApp/1")));
}
export function mobileDictation(): Promise<NativeDictation> {
 if (window.mobileCodex?.dictation) return Promise.resolve(window.mobileCodex.dictation);
 return new Promise((resolve, reject) => {
  const ready = () => {
   const capability = window.mobileCodex?.dictation;
   if (!capability) return;
   clearTimeout(timer); window.removeEventListener("mobilecodex:ready", ready); resolve(capability);
  };
  const timer = setTimeout(() => {
   window.removeEventListener("mobilecodex:ready", ready);
   reject(new Error("Mobile Codex dictation is unavailable. Reopen this app to reconnect."));
  }, 5000);
  window.addEventListener("mobilecodex:ready", ready);
  ready();
 });
}
