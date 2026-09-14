import React, { useState } from 'react';
import {
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  Copy,
  Check,
  Trash2,
  Plus,
  Radio,
  Lock,
  Unlock,
  AlertCircle,
} from 'lucide-react';

export interface ApiKeyItem {
  id: string;
  key: string;
  name: string;
  createdAt: string;
}

interface KeyManagerProps {
  apiKeysEnabled: boolean;
  onToggleApiKeys: (enabled: boolean) => void;
  keys: ApiKeyItem[];
  activeKey: string;
  onSelectActiveKey: (key: string) => void;
  onAddKey: (name: string) => void;
  onDeleteKey: (id: string) => void;
}

export const KeyManager: React.FC<KeyManagerProps> = ({
  apiKeysEnabled,
  onToggleApiKeys,
  keys,
  activeKey,
  onSelectActiveKey,
  onAddKey,
  onDeleteKey,
}) => {
  const [newKeyName, setNewKeyName] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newKeyName.trim() || `Clé API ${keys.length + 1}`;
    onAddKey(name);
    setNewKeyName('');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleVisibility = (id: string) => {
    setVisibleKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const maskKey = (key: string) => {
    if (key.length <= 14) return '••••••••••••';
    return `${key.slice(0, 12)}••••••••${key.slice(-4)}`;
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* En-tête de section moderne */}
      <div className="rounded-3xl border border-sky-700/40 bg-gradient-to-br from-[#0c1833] to-[#071124] p-6 sm:p-7 shadow-xl shadow-sky-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <KeyRound className="w-6 h-6 text-sky-400" />
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Gestion des Clés d'Accès API
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-sky-200/70">
            Configurez l'authentification des requêtes HTTP transitant par la passerelle locale (127.0.0.1:8090/v1).
          </p>
        </div>

        {/* Badge d'état synthétique */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-sky-700/50 bg-[#09152b]">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              apiKeysEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span className="text-xs font-bold text-sky-200">
            {apiKeysEnabled ? 'Authentification requise' : 'Mode sans clé (libre)'}
          </span>
        </div>
      </div>

      {/* Carte Commutateur Global : Mode avec clé vs Mode sans clé */}
      <div className="rounded-3xl border border-sky-700/40 bg-[#0c1833]/85 backdrop-blur-md p-6 sm:p-7 space-y-5 shadow-xl shadow-sky-950/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {apiKeysEnabled ? (
                <Lock className="w-4 h-4 text-emerald-400" />
              ) : (
                <Unlock className="w-4 h-4 text-amber-400" />
              )}
              <h3 className="text-base font-bold text-white tracking-tight">
                Contrôle de l'Authentification API
              </h3>
            </div>
            <p className="text-xs text-sky-200/70 max-w-2xl leading-relaxed">
              {apiKeysEnabled
                ? 'La protection est activée. Vos applications (Cursor, Cline, Aider, scripts) doivent obligatoirement fournir une clé dans l’en-tête Authorization: Bearer <votre_clé>.'
                : 'Mode sans clé actif. Toutes les requêtes locales sont immédiatement autorisées sans exiger d’en-tête Authorization.'}
            </p>
          </div>

          <button
            id="toggle-auth-mode-btn"
            onClick={() => onToggleApiKeys(!apiKeysEnabled)}
            className={`px-5 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shadow-lg flex items-center gap-2 hover:-translate-y-0.5 ${
              apiKeysEnabled
                ? 'bg-[#09152b] hover:bg-sky-900/60 text-sky-200 border border-sky-700/60'
                : 'bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 shadow-emerald-500/25'
            }`}
          >
            {apiKeysEnabled ? (
              <>
                <Unlock className="w-4 h-4" />
                <span>Désactiver (Passer en Mode libre)</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Activer la protection par clé</span>
              </>
            )}
          </button>
        </div>

        {/* Bannière explicative selon le mode */}
        <div
          className={`p-4 rounded-2xl border text-xs leading-relaxed ${
            apiKeysEnabled
              ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
              : 'border-amber-500/40 bg-amber-950/30 text-amber-200'
          }`}
        >
          {apiKeysEnabled ? (
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Protection Renforcée :</span> Seules les requêtes dotées d'une des clés répertoriées ci-dessous ont accès aux 7 moteurs.
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Mode Sans Clé Actif :</span> Vous pouvez interroger directement{' '}
                <code className="font-mono bg-[#060e1d] px-2 py-0.5 rounded-lg text-amber-300 border border-amber-500/30">
                  http://127.0.0.1:8090/v1
                </code>{' '}
                sans renseigner d'API Key dans vos logiciels.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Formulaire de création de clé */}
      <div className="rounded-3xl border border-sky-700/40 bg-[#0c1833]/85 backdrop-blur-md p-6 sm:p-7 space-y-4 shadow-xl shadow-sky-950/30">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Plus className="w-4 h-4 text-sky-400" />
            <span>Créer une nouvelle clé API</span>
          </h3>
          <p className="text-xs text-sky-200/70 mt-0.5">
            Générez un jeton sécurisé pour configurer un nouvel environnement ou un nouvel outil.
          </p>
        </div>

        <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            id="new-key-name-input"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Nom ou identification (ex: Cursor IDE, Extension VS Code, Terminal CLI)"
            className="flex-1 rounded-2xl border border-sky-800/60 bg-[#060e1d] px-4 py-3 text-xs text-white placeholder:text-sky-400/30 focus:outline-none focus:border-sky-400 transition-colors"
          />
          <button
            type="submit"
            id="create-key-submit-btn"
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-300 hover:to-cyan-300 text-slate-950 text-xs font-bold transition-all shadow-md shadow-sky-500/20 cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 hover:-translate-y-0.5"
          >
            <KeyRound className="w-4 h-4" />
            <span>Générer la clé</span>
          </button>
        </form>
      </div>

      {/* Tableau des clés enregistrées bien arrondi */}
      <div className="rounded-3xl border border-sky-700/40 bg-[#0c1833]/85 backdrop-blur-md overflow-hidden shadow-xl shadow-sky-950/30">
        <div className="p-6 border-b border-sky-800/40 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-base tracking-tight">
              Clés API Enregistrées ({keys.length})
            </h3>
            <p className="text-xs text-sky-200/70 mt-0.5">
              La clé active est utilisée automatiquement lors de vos essais dans la Console.
            </p>
          </div>
        </div>

        {keys.length === 0 ? (
          <div className="p-8 text-center text-xs text-sky-300/60">
            Aucune clé API n'est actuellement enregistrée. Créez-en une à l'aide du formulaire ci-dessus.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-sky-800/40 bg-[#071124] text-sky-300 font-bold">
                  <th className="py-4 px-5">Nom</th>
                  <th className="py-4 px-5">Jeton API</th>
                  <th className="py-4 px-5">Date</th>
                  <th className="py-4 px-5">Statut</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-800/30">
                {keys.map((k) => {
                  const isCurrentActive = activeKey === k.key;
                  const isVisible = visibleKeys[k.id];

                  return (
                    <tr
                      key={k.id}
                      className={`hover:bg-sky-950/40 transition-colors ${
                        isCurrentActive ? 'bg-sky-500/10' : ''
                      }`}
                    >
                      <td className="py-4 px-5 font-bold text-white">{k.name}</td>
                      <td className="py-4 px-5 font-mono text-sky-200">
                        <div className="flex items-center gap-2">
                          <span>{isVisible ? k.key : maskKey(k.key)}</span>
                          <button
                            onClick={() => toggleVisibility(k.id)}
                            className="text-sky-400/80 hover:text-sky-200 cursor-pointer p-1"
                            title={isVisible ? 'Masquer' : 'Afficher'}
                          >
                            {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-sky-300/70">{k.createdAt}</td>
                      <td className="py-4 px-5">
                        {isCurrentActive ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-400 text-slate-950">
                            ACTIVE
                          </span>
                        ) : (
                          <button
                            onClick={() => onSelectActiveKey(k.key)}
                            className="text-sky-400 hover:text-sky-200 underline underline-offset-2 cursor-pointer font-bold"
                          >
                            Activer
                          </button>
                        )}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => copyToClipboard(k.key)}
                            className="px-3 py-1.5 rounded-xl border border-sky-700/50 bg-[#081226] hover:bg-sky-900/60 text-sky-200 font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            {copiedKey === k.key ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-sky-400" />
                            )}
                            <span>{copiedKey === k.key ? 'Copié' : 'Copier'}</span>
                          </button>
                          <button
                            onClick={() => onDeleteKey(k.id)}
                            className="p-2 rounded-xl text-rose-400/70 hover:text-rose-300 hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Supprimer la clé"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
