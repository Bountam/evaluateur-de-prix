import React, { useState } from "react";
import { Clock, ShieldCheck, HelpCircle, Search } from "lucide-react";

interface HistoriqueTabProps {
  logs: any[];
}

export default function HistoriqueTab({ logs }: HistoriqueTabProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (log.model || "").toLowerCase().includes(term) ||
      (log.action || "").toLowerCase().includes(term) ||
      (log.operator || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-4 animate-fadeIn" id="historique-tab-container">
      {/* Audit compliance badge */}
      <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 text-white flex items-start space-x-3 shadow-md" id="audit-certification-banner">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5 shadow-[0_0_8px_rgba(52,211,153,0.3)]" />
        <div>
          <h4 className="font-mono font-bold uppercase tracking-wider text-emerald-400 text-xs">Piste d'Audit Réglementaire & Traçabilité</h4>
          <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
            Pour se conformer aux normes de contrôle fiscal canadien, toutes les interventions manuelles des analystes 
            (ajustements de prix, rejets de comparables aberrants, mises à jour des configurations) sont consignées 
            de façon immuable dans ce journal d'audit centralisé.
          </p>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-lg border border-[#DCDDE1] shadow-sm overflow-hidden" id="historique-logs-panel">
        <div className="px-4 py-3 bg-[#F1F2F6] border-b border-[#DCDDE1] flex justify-between items-center gap-4 flex-wrap">
          <h3 className="text-xs font-bold text-[#2D3436] uppercase tracking-wider flex items-center space-x-2">
            <Clock className="w-4 h-4 text-brand-purple dark:text-brand-lime" />
            <span>Journal Permanent des Interventions Humaines</span>
            <span className="bg-brand-purple/10 text-brand-purple dark:bg-brand-lime/10 dark:text-brand-lime px-2 py-0.5 rounded-full text-[10px] ml-2">
              {filteredLogs.length}
            </span>
          </h3>
          
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Rechercher par modèle, action ou opérateur..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-[#DCDDE1] rounded-md focus:outline-none focus:border-brand-purple dark:focus:border-brand-lime w-72"
            />
          </div>
        </div>

        <div className="overflow-x-auto" id="historique-table-container">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b bg-brand-purple border-brand-purple dark:bg-slate-800 dark:border-slate-800 text-white text-[10px] font-bold uppercase tracking-wider italic">
                <th className="py-2.5 px-3 w-40">DATE & HEURE</th>
                <th className="py-2.5 px-3">MODÈLE CONCERNÉ</th>
                <th className="py-2.5 px-3">ACTION CONSIGNÉE</th>
                <th className="py-2.5 px-3 w-32 text-right">ANCIEN INDEX</th>
                <th className="py-2.5 px-3 w-32 text-right text-brand-purple dark:text-brand-lime">NOUVEL INDEX</th>
                <th className="py-2.5 px-3 w-28 text-right">VARIATION</th>
                <th className="py-2.5 px-3 w-48">OPÉRATEUR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F2F6]">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log, index) => {
                  const previous = log.previousPrice || 0;
                  const current = log.currentPrice || 0;
                  const diff = current - previous;
                  const pct = previous > 0 ? (diff / previous) * 100 : 0;

                  return (
                    <tr 
                      key={log.id} 
                      className={`hover:bg-[#F1F2F6]/60 transition-colors ${
                        index % 2 === 0 ? "bg-white" : "bg-[#F8F9FA]"
                      }`}
                      id={`row-log-${log.id}`}
                    >
                      {/* Date & Time */}
                      <td className="py-3 px-3 font-mono text-[#7F8C8D]">
                        {new Date(log.date).toLocaleDateString("fr-CA", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </td>

                      {/* Model Name */}
                      <td className="py-3 px-3 font-bold text-[#2D3436]">{log.model}</td>

                      {/* Action */}
                      <td className="py-3 px-3 font-semibold text-slate-700">{log.action}</td>

                      {/* Old Price */}
                      <td className="py-3 px-3 text-right font-mono text-slate-600">
                        {previous > 0 ? `${previous.toFixed(2)}$` : "N/A"}
                      </td>

                      {/* New Price */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {current.toFixed(2)}$
                      </td>

                      {/* Variation indicator */}
                      <td className="py-3 px-3 text-right font-mono">
                        {diff === 0 ? (
                          <span className="text-slate-400 font-bold">= 0.00%</span>
                        ) : diff > 0 ? (
                          <span className="text-emerald-600 font-bold">▲ +{pct.toFixed(1)}%</span>
                        ) : (
                          <span className="text-rose-600 font-bold">▼ {pct.toFixed(1)}%</span>
                        )}
                      </td>

                      {/* Operator info */}
                      <td className="py-3 px-3 text-[#7F8C8D] truncate max-w-[12rem]" title={log.operator}>
                        {log.operator}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#7F8C8D] italic">
                    Aucune entrée de journal disponible pour le moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
