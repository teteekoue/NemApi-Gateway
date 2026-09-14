import React, { useState } from 'react';
import { LogEntry } from '../types';
import {
  Terminal,
  Trash2,
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Layers,
} from 'lucide-react';

interface LiveLogsProps {
  logs: LogEntry[];
  onClearLogs: () => void;
}

export const LiveLogs: React.FC<LiveLogsProps> = ({ logs, onClearLogs }) => {
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredLogs = logs.filter((l) => {
    if (filterLevel !== 'all' && l.level !== filterLevel) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        l.message.toLowerCase().includes(q) ||
        (l.provider && l.provider.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* En-tête de section moderne */}
      <div className="rounded-3xl border border-sky-700/40 bg-gradient-to-br from-[#0c1833] to-[#071124] p-6 sm:p-7 shadow-xl shadow-sky-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <Terminal className="w-6 h-6 text-sky-400" />
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Journal des Activités & Télémétrie
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-sky-200/70">
            Historique en temps réel des transactions transitant par la passerelle locale 127.0.0.1:8090.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="clear-logs-btn"
            onClick={onClearLogs}
            className="px-4 py-2.5 rounded-2xl border border-sky-700/60 bg-[#09152b] hover:bg-sky-900/60 text-sky-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-md hover:-translate-y-0.5"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Effacer les journaux</span>
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-sky-700/40 bg-[#0c1833]/85 backdrop-blur-md overflow-hidden flex flex-col h-[580px] shadow-xl shadow-sky-950/30">
        {/* Barre de contrôle des filtres */}
        <div className="p-4 border-b border-sky-800/40 bg-[#071124] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {[
              { id: 'all', label: 'Tous' },
              { id: 'info', label: 'Infos' },
              { id: 'success', label: 'Succès' },
              { id: 'warn', label: 'Avertissements' },
              { id: 'error', label: 'Erreurs' },
            ].map((lvl) => (
              <button
                key={lvl.id}
                onClick={() => setFilterLevel(lvl.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterLevel === lvl.id
                    ? 'bg-sky-400 text-slate-950 shadow-md'
                    : 'bg-[#09152b] text-sky-300 hover:text-white border border-sky-800/50'
                }`}
              >
                {lvl.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-sky-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrer un message..."
              className="w-full rounded-xl border border-sky-800/60 bg-[#060e1d] pl-9 pr-3.5 py-1.5 text-xs text-white placeholder:text-sky-400/30 focus:outline-none focus:border-sky-400 transition-colors"
            />
          </div>
        </div>

        {/* Liste des entrées de journal */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 font-mono text-xs select-text">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-20 text-sky-300/50 flex flex-col items-center gap-2">
              <Layers className="w-8 h-8 text-sky-500/30" />
              <span>Aucun enregistrement correspondant aux critères sélectionnés.</span>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isError = log.level === 'error';
              const isWarn = log.level === 'warn';
              const isSuccess = log.level === 'success';

              return (
                <div
                  key={log.id}
                  className={`p-3 rounded-2xl border flex items-start gap-3 transition-colors ${
                    isError
                      ? 'bg-rose-950/25 border-rose-500/30 text-rose-200'
                      : isWarn
                      ? 'bg-amber-950/25 border-amber-500/30 text-amber-200'
                      : isSuccess
                      ? 'bg-emerald-950/25 border-emerald-500/30 text-emerald-200'
                      : 'bg-[#071124] border-sky-800/40 text-sky-200'
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    {isError && <AlertCircle className="w-4 h-4 text-rose-400" />}
                    {isWarn && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                    {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    {!isError && !isWarn && !isSuccess && <Info className="w-4 h-4 text-sky-400" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sky-400/70 text-[10px] font-bold">{log.timestamp}</span>
                      {log.provider && (
                        <span className="px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-500/30 text-[10px] text-sky-300 font-bold uppercase">
                          {log.provider}
                        </span>
                      )}
                    </div>
                    <div className="break-words leading-relaxed text-xs">{log.message}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pied de log */}
        <div className="p-3.5 border-t border-sky-800/40 bg-[#071124] text-[11px] text-sky-400/70 flex items-center justify-between">
          <span>{filteredLogs.length} ligne(s) affichée(s)</span>
          <span className="flex items-center gap-2 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Flux en direct
          </span>
        </div>
      </div>
    </div>
  );
};
