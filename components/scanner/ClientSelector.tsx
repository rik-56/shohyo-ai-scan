import React, { useState } from 'react';
import { Briefcase, Plus, X, ChevronDown } from 'lucide-react';

interface ClientSelectorProps {
  clients: string[];
  selectedClient: string;
  onClientChange: (client: string) => void;
  onClientAdd: (name: string) => void;
  onClientDelete: (name: string) => void;
  isMobile: boolean;
}

export const ClientSelector: React.FC<ClientSelectorProps> = ({
  clients,
  selectedClient,
  onClientChange,
  onClientAdd,
  onClientDelete,
  isMobile
}) => {
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');

  const handleAddClient = () => {
    if (!newClientName.trim()) return;
    onClientAdd(newClientName.trim());
    setNewClientName('');
    setIsAddingClient(false);
  };

  const handleDeleteClient = (clientName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (clients.length <= 1) return;
    onClientDelete(clientName);
  };

  if (isMobile) {
    return (
      <div className="pb-4">
        <label className="text-xs font-medium text-slate-500 mb-2 block">クライアント選択</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <select
              value={selectedClient}
              onChange={(e) => onClientChange(e.target.value)}
              className="w-full appearance-none px-4 py-3 pr-10 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              aria-label="クライアント選択"
            >
              {clients.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ChevronDown className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          <button
            onClick={() => setIsAddingClient(true)}
            className="px-4 py-3 bg-orange-600 text-white rounded-lg font-medium flex items-center gap-1 hover:bg-orange-700 transition-all"
            aria-label="新しいクライアントを追加"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {isAddingClient && (
          <div className="mt-3 flex items-center gap-2 p-3 bg-white border border-orange-300 rounded-lg">
            <input
              autoFocus
              value={newClientName}
              onChange={e => setNewClientName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddClient()}
              placeholder="会社名を入力"
              className="flex-1 text-sm outline-none bg-transparent"
              aria-label="新しいクライアント名"
            />
            <button
              onClick={handleAddClient}
              className="bg-orange-600 text-white px-3 py-1.5 rounded font-medium text-sm"
              aria-label="クライアントを追加"
            >
              追加
            </button>
            <button
              onClick={() => { setIsAddingClient(false); setNewClientName(''); }}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 flex gap-2 min-w-max"
      role="tablist"
      aria-label="クライアント選択"
    >
      {clients.map((c) => (
        <div
          key={c}
          role="tab"
          tabIndex={0}
          aria-selected={selectedClient === c}
          onClick={() => onClientChange(c)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClientChange(c);
            }
          }}
          className={`group relative flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer border transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
            selectedClient === c
              ? 'bg-orange-600 border-orange-600 text-white font-medium'
              : 'bg-white border-slate-200 text-slate-600 hover:border-orange-300 hover:text-orange-600'
          }`}
        >
          <Briefcase className="w-4 h-4" />{c}
          {clients.length > 1 && (
            <button
              onClick={(e) => handleDeleteClient(c, e)}
              className="opacity-0 group-hover:opacity-100 p-0.5 focus:opacity-100"
              aria-label={`${c}を削除`}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}
      {isAddingClient ? (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-orange-300 rounded-lg">
          <input
            autoFocus
            value={newClientName}
            onChange={e => setNewClientName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddClient()}
            placeholder="会社名"
            className="text-sm outline-none w-32 bg-transparent"
            aria-label="新しいクライアント名"
          />
          <button
            onClick={handleAddClient}
            className="bg-orange-600 text-white p-1 rounded"
            aria-label="クライアントを追加"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsAddingClient(true)}
          className="flex items-center gap-1 px-4 py-2 text-slate-400 border border-dashed border-slate-300 rounded-lg bg-white hover:border-orange-300 hover:text-orange-600 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
          aria-label="新しいクライアントを追加"
        >
          <Plus className="w-4 h-4" />追加
        </button>
      )}
    </div>
  );
};
