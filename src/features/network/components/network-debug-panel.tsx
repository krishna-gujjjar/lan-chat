import { Copy, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { invokeOrThrow } from "@/shared/lib/tauri/invoke";
import type { NetworkDiagnosticReport } from "@/shared/types/diagnostics";

export function NetworkDebugPanel({ onClose }: { readonly onClose: () => void }) {
  const [report, setReport] = useState<NetworkDiagnosticReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setReport(await invokeOrThrow("run_network_diagnostics")); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void run(); }, [run]);
  const copy = useCallback(() => {
    if (report) void navigator.clipboard.writeText(JSON.stringify(report, null, 2));
  }, [report]);

  return (
    <div className="debug-backdrop" role="dialog" aria-modal="true" aria-label="Network diagnostics">
      <section className="debug-panel">
        <header className="flex items-center justify-between border-b border-retro-border p-4">
          <div><h2 className="font-pixel text-[0.7rem] text-retro-green">NETWORK DEBUGGER</h2><p className="mt-1 text-xs text-retro-text-dim">Independent TCP reachability test</p></div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
        </header>
        <div className="space-y-4 overflow-y-auto p-4">
          <div className="flex gap-2"><button className="retro-button retro-button-primary" onClick={() => void run()} disabled={loading}><RefreshCw className={loading ? "mr-2 h-3 w-3 animate-spin" : "mr-2 h-3 w-3"} />RUN TEST</button><button className="retro-button" onClick={copy} disabled={!report}><Copy className="mr-2 h-3 w-3" />COPY REPORT</button></div>
          {error && <p className="border border-retro-red bg-retro-red/10 p-3 text-retro-red">{error}</p>}
          {report && <Report report={report} />}
        </div>
      </section>
    </div>
  );
}

function Report({ report }: { readonly report: NetworkDiagnosticReport }) {
  return <>
    <div className="debug-grid"><Cell label="DEVICE IDENTITY" value={`${report.localUser ?? "NOT INITIALIZED"} · ${report.localUserId?.slice(0, 8) ?? "NO ID"}`} /><Cell label="CURRENT IP" value={report.localAddress ?? "UNKNOWN"} /><Cell label="TCP LISTENER" value={report.localTcpPort?.toString() ?? "NOT RUNNING"} /><Cell label="UDP DISCOVERY" value={report.discoveryPort.toString()} /></div>
    <div><h3 className="section-label mb-2">KNOWN PEERS // {report.peers.length}</h3>{report.peers.length === 0 ? <p className="debug-empty">No discovery records. Check UDP 42421, subnet, firewall and AP isolation.</p> : <div className="space-y-2">{report.peers.map((peer) => <article className="debug-peer" key={`${peer.address}:${peer.port}`}><div className="flex items-center justify-between"><strong className="text-retro-text">{peer.username}</strong><span className={peer.reachable ? "text-retro-green" : "text-retro-red"}>{peer.reachable ? `REACHABLE ${peer.latencyMs ?? 0}ms` : "UNREACHABLE"}</span></div><code>ID {peer.userId}<br />CURRENT ENDPOINT {peer.address}:{peer.port}</code><p>Last seen: {peer.lastSeenAt ?? "never"}</p>{peer.error && <p className="text-retro-red">{peer.error}</p>}</article>)}</div>}</div>
  </>;
}
function Cell({ label, value }: { readonly label: string; readonly value: string }) { return <div className="debug-cell"><span>{label}</span><strong>{value}</strong></div>; }
