/** Build-time capability notice: no polling, history serialization or model requests. */
export function AetherStatus() {
 if (process.env.NEXT_PUBLIC_LH_AETHER !== "1") return null;
 return <aside role="note" className="aether-capability-notice">Aether adaptation: local source, saved records and document import are available. In-app AI generation and new graph connections are blocked: Script API v2 has no authenticated inference adapter. Your Aether model/effort and credentials are unchanged. <a href="/__aether_host__/manage">Files &amp; source paths</a></aside>;
}
