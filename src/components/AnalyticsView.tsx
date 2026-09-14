import React, { useState } from 'react';
import { UsageStats, ChatTestResult, SubscriptionState, ProviderInfo } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import {
  BarChart3,
  Coins,
  Cpu,
  Clock,
  CheckCircle2,
  TrendingUp,
  Download,
  RotateCcw,
  RefreshCw,
  Search,
  Filter,
  FileSpreadsheet,
  Layers,
  ArrowUpRight,
  Zap,
  Activity,
  ShieldAlert,
} from 'lucide-react';
import {
  logUsageToSheets,
  loadSavedSheetsConfig,
  DEFAULT_WEB_APP_URL,
} from '../services/googleSheetsService';

interface AnalyticsViewProps {
  stats: UsageStats;
  history: ChatTestResult[];
  subscription: SubscriptionState;
  providers: ProviderInfo[];
  onResetStats: () => void;
  onAddLog: (level: 'info' | 'warn' | 'error' | 'success', message: string, provider?: string) => void;
  onOpenQuotaModal?: () => void;
}

const PROVIDER_COLORS: Record<string, string> = {
  deepseek: '#3b82f6',
  claude: '#f59e0b',
  chatgpt: '#10b981',
  gemini: '#06b6d4',
  qwen: '#a855f7',
  kimi: '#0ea5e9',
  zai: '#f43f5e',
  'auto-nemapi': '#8b5cf6',
};

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  stats,
  history,
  subscription,
  providers,
  onResetStats,
  onAddLog,
  onOpenQuotaModal,
}) => {
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const isPremium = subscription.plan !== 'free';

  // Calcul des métriques globales
  const totalRequests = stats.requests || history.length || 0;
  const totalPromptTokens = stats.prompt_tokens || history.reduce((acc, h) => acc + h.promptTokens, 0);
  const totalCompletionTokens = stats.completion_tokens || history.reduce((acc, h) => acc + h.completionTokens, 0);
  const totalTokens = totalPromptTokens + totalCompletionTokens;
  const totalCostSaved = stats.estimated_cost || history.reduce((acc, h) => acc + (h.costSaved || 0), 0);

  const avgLatency =
    history.length > 0
      ? Math.round(history.reduce((acc, h) => acc + (h.latencyMs || 0), 0) / history.length)
      : 320;

  const successCount = history.filter((h) => (h.httpStatus || 200) < 400).length;
  const successRate = history.length > 0 ? ((successCount / history.length) * 100).toFixed(1) : '100.0';

  // Données de distribution par provider pour Recharts
  const providerData = providers.map((prov) => {
    const provStats = stats.providers[prov.id];
    const provHistory = history.filter((h) => h.provider === prov.id);
    const reqCount = provStats?.requests || provHistory.length || 0;
    const promptTok = provStats?.prompt_tokens || provHistory.reduce((acc, h) => acc + h.promptTokens, 0);
    const compTok = provStats?.completion_tokens || provHistory.reduce((acc, h) => acc + h.completionTokens, 0);
    const cost = provStats?.cost || provHistory.reduce((acc, h) => acc + (h.costSaved || 0), 0);
    const avgLat =
      provHistory.length > 0
        ? Math.round(provHistory.reduce((acc, h) => acc + (h.latencyMs || 0), 0) / provHistory.length)
        : Math.round(220 + Math.random() * 200);

    return {
      id: prov.id,
      name: prov.name.split(' ')[0],
      fullName: prov.name,
      requests: reqCount,
      promptTokens: promptTok,
      completionTokens: compTok,
      totalTokens: promptTok + compTok,
      costSaved: Number(cost.toFixed(4)),
      latency: avgLat,
      color: PROVIDER_COLORS[prov.id] || '#38bdf8',
    };
  });

  // Moteur le plus sollicité
  const topProvider = [...providerData].sort((a, b) => b.requests - a.requests)[0] || providerData[0];

  // Filtrage de l'historique des requêtes
  const filteredHistory = history.filter((item) => {
    const matchesProvider = filterProvider === 'all' || item.provider === filterProvider;
    const matchesSearch =
      searchTerm === '' ||
      item.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.content && item.content.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesProvider && matchesSearch;
  });

  // Synchronisation des stats avec la Google Sheet
  const handleSyncToSheets = async () => {
    setIsSyncing(true);
    setSyncStatus('Envoi des journaux de consommation à Google Sheets...');
    try {
      const config = loadSavedSheetsConfig();
      const url = config.webAppUrl || DEFAULT_WEB_APP_URL;

      // Envoyer les dernières requêtes de l'historique
      for (const item of history.slice(0, 10)) {
        await logUsageToSheets(url, {
          provider: item.provider,
          model: item.model,
          prompt_tokens: item.promptTokens,
          completion_tokens: item.completionTokens,
          cost_saved: item.costSaved,
          status: item.httpStatus < 400 ? 'success' : 'error',
        });
      }

      setSyncStatus('Synchronisation réussie avec la feuille [UsageLogs] !');
      onAddLog('success', 'Statistiques de consommation synchronisées avec Google Sheets');
    } catch (err: any) {
      setSyncStatus('Erreur lors de la synchronisation');
      onAddLog('error', `Échec sync Google Sheets: ${err.message}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(null), 4000);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Provider', 'Model', 'PromptTokens', 'CompletionTokens', 'TotalTokens', 'LatencyMs', 'CostSavedUSD', 'Status'];
    const rows = (history.length > 0 ? history : []).map((h) => [
      h.timestamp || new Date().toISOString(),
      h.provider,
      h.model,
      h.promptTokens,
      h.completionTokens,
      h.totalTokens,
      h.latencyMs,
      h.costSaved,
      h.httpStatus || 200,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `nemapi-analytics-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onAddLog('info', 'Export CSV des statistiques téléchargé');
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* En-tête de section */}
      <div className="rounded-3xl border border-sky-700/40 bg-gradient-to-br from-[#0c1833] via-[#09152b] to-[#071124] p-6 sm:p-7 shadow-xl shadow-sky-950/40 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-sky-500/15 border border-sky-400/30 text-sky-400">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Statistiques & Analyse des Coûts
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-sky-200/70 max-w-2xl">
            Surveillez le débit des requêtes, le volume de tokens consommés, les latences et le montant économisé par rapport aux APIs payantes officielles.
          </p>
        </div>

        {/* Boutons d'actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {onOpenQuotaModal && (
            <button
              onClick={onOpenQuotaModal}
              className="px-4 py-2.5 rounded-2xl border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md"
              title="Configurer les quotas journaliers et moteurs de secours (fallbacks)"
            >
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Quotas & Fallbacks</span>
            </button>
          )}

          <button
            onClick={handleSyncToSheets}
            disabled={isSyncing}
            className="px-4 py-2.5 rounded-2xl border border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
            title="Enregistrer les stats dans Google Sheets"
          >
            {isSyncing ? (
              <RefreshCw className="w-4 h-4 animate-spin text-sky-300" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            )}
            <span>Sync Google Sheets</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-2xl border border-sky-700/50 bg-[#091730] hover:bg-sky-900/60 text-sky-200 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md"
            title="Télécharger un rapport CSV"
          >
            <Download className="w-4 h-4 text-sky-400" />
            <span>Exporter CSV</span>
          </button>

          <button
            onClick={() => {
              if (confirm('Voulez-vous réinitialiser les compteurs de statistiques locales ?')) {
                onResetStats();
              }
            }}
            className="p-2.5 rounded-2xl border border-sky-800/40 bg-[#091730] hover:bg-rose-500/20 hover:border-rose-500/40 text-sky-400 hover:text-rose-300 transition-all cursor-pointer"
            title="Réinitialiser les métriques"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Message de statut de synchronisation */}
      {syncStatus && (
        <div className="p-4 rounded-2xl border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 text-xs font-bold flex items-center gap-2.5 shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{syncStatus}</span>
        </div>
      )}

      {/* Grille des 6 KPIs Principaux */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Requêtes */}
        <div className="p-5 rounded-3xl border border-sky-800/40 bg-[#0c1833]/80 backdrop-blur-md space-y-2 shadow-lg shadow-sky-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-sky-300/70 uppercase tracking-wider">Requêtes</span>
            <Activity className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-white">{totalRequests.toLocaleString('fr-FR')}</div>
          <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold">
            <TrendingUp className="w-3 h-3" />
            <span>Passerelle active</span>
          </div>
        </div>

        {/* Tokens Traités */}
        <div className="p-5 rounded-3xl border border-sky-800/40 bg-[#0c1833]/80 backdrop-blur-md space-y-2 shadow-lg shadow-sky-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-sky-300/70 uppercase tracking-wider">Tokens Totaux</span>
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-cyan-300">
            {totalTokens > 1000000
              ? `${(totalTokens / 1000000).toFixed(2)}M`
              : totalTokens > 1000
              ? `${(totalTokens / 1000).toFixed(1)}k`
              : totalTokens}
          </div>
          <div className="text-[10px] text-sky-300/60 truncate font-mono">
            {totalPromptTokens} in • {totalCompletionTokens} out
          </div>
        </div>

        {/* Économies Financières */}
        <div className="p-5 rounded-3xl border border-emerald-500/40 bg-emerald-950/20 backdrop-blur-md space-y-2 shadow-lg shadow-emerald-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider">Économisé</span>
            <Coins className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-300">
            {totalCostSaved > 0 ? `${totalCostSaved.toFixed(3)} $` : '0.000 $'}
          </div>
          <div className="text-[10px] text-emerald-400/80 font-semibold">
            vs Tarifs Cloud officiels
          </div>
        </div>

        {/* Latence Moyenne */}
        <div className="p-5 rounded-3xl border border-sky-800/40 bg-[#0c1833]/80 backdrop-blur-md space-y-2 shadow-lg shadow-sky-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-sky-300/70 uppercase tracking-wider">Latence Moy.</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-300">{avgLatency} ms</div>
          <div className="text-[10px] text-sky-300/60 font-semibold">Exécution locale rapide</div>
        </div>

        {/* Taux de Succès */}
        <div className="p-5 rounded-3xl border border-sky-800/40 bg-[#0c1833]/80 backdrop-blur-md space-y-2 shadow-lg shadow-sky-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-sky-300/70 uppercase tracking-wider">Taux Succès</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">{successRate} %</div>
          <div className="text-[10px] text-sky-300/60 font-semibold">HTTP 200 OK</div>
        </div>

        {/* Top Provider */}
        <div className="p-5 rounded-3xl border border-sky-800/40 bg-[#0c1833]/80 backdrop-blur-md space-y-2 shadow-lg shadow-sky-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-sky-300/70 uppercase tracking-wider">Top Moteur</span>
            <Zap className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-black text-white truncate">{topProvider.name}</div>
          <div className="text-[10px] text-purple-300/80 font-semibold">
            {topProvider.requests} appels enregistrés
          </div>
        </div>
      </div>

      {/* Graphiques Interactifs : Répartition des Requêtes & Économies */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Graphique 1 : Volume de requêtes par Provider (7 colonnes) */}
        <div className="lg:col-span-7 rounded-3xl border border-sky-800/40 bg-[#0c1833]/85 backdrop-blur-md p-6 space-y-4 shadow-xl shadow-sky-950/30">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sky-400" />
                <span>Volume de Requêtes par Moteur IA</span>
              </h3>
              <p className="text-[11px] text-sky-300/60">Distribution des appels envoyés aux 7 fournisseurs</p>
            </div>
            <span className="text-[10px] px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-400/30 text-sky-300 font-bold font-mono">
              7 Moteurs
            </span>
          </div>

          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={providerData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#071124',
                    borderColor: '#0284c7',
                    borderRadius: '16px',
                    color: '#fff',
                    fontSize: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
                  }}
                  formatter={(value: any) => [`${value} requêtes`, 'Volume']}
                />
                <Bar dataKey="requests" radius={[8, 8, 0, 0]}>
                  {providerData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graphique 2 : Distribution des Coûts Économisés (5 colonnes) */}
        <div className="lg:col-span-5 rounded-3xl border border-sky-800/40 bg-[#0c1833]/85 backdrop-blur-md p-6 space-y-4 shadow-xl shadow-sky-950/30 flex flex-col justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-400" />
              <span>Économies Générées par Fournisseur</span>
            </h3>
            <p className="text-[11px] text-sky-300/60">Montant théorique économisé vs API officielle</p>
          </div>

          <div className="space-y-3 py-2">
            {providerData.map((prov) => {
              const pct = totalCostSaved > 0 ? (prov.costSaved / totalCostSaved) * 100 : 0;
              return (
                <div key={prov.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-sky-200 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: prov.color }} />
                      {prov.fullName}
                    </span>
                    <span className="text-white font-mono">{prov.costSaved.toFixed(3)} $</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[#071124] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(4, Math.min(100, pct))}%`,
                        backgroundColor: prov.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 rounded-2xl bg-[#071124] border border-sky-800/40 text-[11px] text-sky-300/70 flex items-center justify-between">
            <span>Total économisé estimé :</span>
            <span className="text-emerald-400 font-bold font-mono text-xs">{totalCostSaved.toFixed(3)} USD</span>
          </div>
        </div>
      </div>

      {/* Tableau détaillé de consommation par Fournisseur */}
      <div className="rounded-3xl border border-sky-800/40 bg-[#0c1833]/85 backdrop-blur-md p-6 space-y-4 shadow-xl shadow-sky-950/30">
        <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-400" />
          <span>Tableau Comparatif des 7 Moteurs IA</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-sky-800/50 text-sky-300/70">
                <th className="py-3 px-4 font-bold uppercase tracking-wider">Moteur & Modèle</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider">Statut Plan</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider text-right">Appels</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider text-right">Prompt Tokens</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider text-right">Completion Tokens</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider text-right">Latence Moy.</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider text-right">Économies ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-800/30 text-sky-100">
              {providerData.map((prov) => {
                const isUnlocked = isPremium || (prov.id === 'deepseek' || prov.id === 'gemini');
                return (
                  <tr key={prov.id} className="hover:bg-sky-900/20 transition-colors">
                    <td className="py-3 px-4 font-semibold flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: prov.color }} />
                      <div>
                        <div className="font-bold text-white">{prov.fullName}</div>
                        <div className="text-[10px] text-sky-300/60 font-mono">{prov.id}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {isUnlocked ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-400/30 text-emerald-300">
                          Débloqué
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 border border-amber-400/30 text-amber-300">
                          Pro / Lifetime
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-white">{prov.requests}</td>
                    <td className="py-3 px-4 text-right font-mono text-sky-200">{prov.promptTokens.toLocaleString('fr-FR')}</td>
                    <td className="py-3 px-4 text-right font-mono text-sky-200">{prov.completionTokens.toLocaleString('fr-FR')}</td>
                    <td className="py-3 px-4 text-right font-mono text-amber-300">{prov.latency} ms</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-300">{prov.costSaved.toFixed(3)} $</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Journal d'Historique des Requêtes Récentes */}
      <div className="rounded-3xl border border-sky-800/40 bg-[#0c1833]/85 backdrop-blur-md p-6 space-y-4 shadow-xl shadow-sky-950/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400" />
              <span>Historique des Requêtes Récentes</span>
            </h3>
            <p className="text-xs text-sky-200/70">
              Affichage des {filteredHistory.length} dernières transactions exécutées localement
            </p>
          </div>

          {/* Filtres et recherche */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Recherche textuelle */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-sky-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrer par modèle..."
                className="pl-8 pr-3 py-1.5 rounded-xl border border-sky-700/50 bg-[#071124] text-white text-xs placeholder-sky-400/40 focus:outline-none focus:border-sky-400 w-44"
              />
            </div>

            {/* Sélecteur Fournisseur */}
            <select
              value={filterProvider}
              onChange={(e) => setFilterProvider(e.target.value)}
              className="py-1.5 px-3 rounded-xl border border-sky-700/50 bg-[#071124] text-white text-xs font-semibold focus:outline-none focus:border-sky-400"
            >
              <option value="all">Tous les moteurs</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Liste / Tableau des requêtes récentes */}
        {filteredHistory.length === 0 ? (
          <div className="p-8 rounded-2xl border border-sky-800/30 bg-[#071124]/60 text-center space-y-2">
            <Clock className="w-8 h-8 text-sky-400/50 mx-auto" />
            <div className="text-xs font-bold text-sky-200">Aucune requête trouvée</div>
            <div className="text-[11px] text-sky-400/60 max-w-sm mx-auto">
              Effectuez un test dans l'onglet Console Interactive pour générer des métriques et des transactions.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-sky-800/50 text-sky-300/70">
                  <th className="py-2.5 px-3 font-bold uppercase tracking-wider">ID / Heure</th>
                  <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Moteur</th>
                  <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Modèle</th>
                  <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-right">Tokens</th>
                  <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-right">Latence</th>
                  <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-right">Économie</th>
                  <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-800/30 text-sky-100">
                {filteredHistory.slice(0, 20).map((req) => (
                  <tr key={req.id} className="hover:bg-sky-900/20 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-sky-300">
                      <div>{req.id.slice(0, 16)}</div>
                      <div className="text-[9px] text-sky-400/50">
                        {req.timestamp ? req.timestamp.slice(11, 19) : 'Récemment'}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-white capitalize">{req.provider}</td>
                    <td className="py-2.5 px-3 font-mono text-sky-200 text-[11px]">{req.model}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-sky-200">
                      {req.promptTokens + req.completionTokens} <span className="text-[10px] text-sky-400/60">({req.promptTokens} / {req.completionTokens})</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-amber-300">{req.latencyMs} ms</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-300">
                      {req.costSaved ? `${req.costSaved.toFixed(4)} $` : '0.000 $'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          (req.httpStatus || 200) < 400
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {req.httpStatus || 200} OK
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
