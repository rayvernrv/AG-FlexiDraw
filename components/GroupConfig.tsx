import React from 'react';
import { Group, BracketDefinition } from '../types';

interface GroupConfigProps {
  groups: Group[];
  setGroups: (groups: Group[]) => void;
  totalTeams: number;
  bracket: BracketDefinition;
}

export const GroupConfig: React.FC<GroupConfigProps> = ({ groups, setGroups, totalTeams, bracket }) => {

  const totalCapacity = groups.reduce((sum, g) => sum + g.capacity, 0);
  const isCapacityMatch = totalCapacity === totalTeams;

  const addGroup = () => {
    const newGroup: Group = {
      id: Math.random().toString(36).substr(2, 9),
      name: `Group ${String.fromCharCode(65 + groups.length)}`, // A, B, C...
      capacity: 4,
      zone: bracket.zones[0] || '',
      teams: []
    };
    setGroups([...groups, newGroup]);
  };

  const removeGroup = (id: string) => {
    setGroups(groups.filter(g => g.id !== id));
  };

  const updateGroup = (id: string, updates: Partial<Group>) => {
    setGroups(groups.map(g => g.id === id ? { ...g, ...updates } : g));
  };

  return (
    <div className="space-y-6">
      {/* Validation Banner */}
      {!isCapacityMatch && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-sm flex items-center gap-3 animate-pulse">
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-bold text-red-800 text-sm">Capacity Mismatch Detected</p>
            <p className="text-red-700 text-xs">
              Total Teams ({totalTeams}) must match Total Capacity ({totalCapacity}).
              Please adjust your groups before proceeding to Brackets or Results.
            </p>
          </div>
        </div>
      )}

      {isCapacityMatch && groups.length > 0 && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded shadow-sm flex items-center gap-3">
          <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-green-800 text-sm font-medium">Capacity verified! You can now configure brackets or run the draw.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-brand-500">
          <p className="text-slate-500 text-sm">Total Teams</p>
          <p className="text-2xl font-bold text-slate-800">{totalTeams}</p>
        </div>
        <div className={`bg-white p-4 rounded-lg shadow border-l-4 ${isCapacityMatch ? 'border-green-500' : 'border-red-500'}`}>
          <p className="text-slate-500 text-sm">Total Capacity</p>
          <p className="text-2xl font-bold text-slate-800">{totalCapacity}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
          <p className="text-slate-500 text-sm">Group Count</p>
          <p className="text-2xl font-bold text-slate-800">{groups.length}</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow border border-slate-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Groups Configuration</h3>
          <button
            onClick={addGroup}
            className="bg-brand-600 text-white px-3 py-1 rounded text-sm hover:bg-brand-700"
          >
            + Add Group
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <div key={group.id} className="border border-slate-200 rounded p-3 relative hover:border-brand-300 transition bg-slate-50">
              <button
                onClick={() => removeGroup(group.id)}
                className="absolute top-2 right-2 text-slate-400 hover:text-red-500"
              >
                &times;
              </button>

              <div className="mb-2">
                <label className="block text-xs text-slate-500 mb-1">Group Name</label>
                <input
                  type="text"
                  className="w-full p-1 border border-slate-300 rounded text-sm"
                  value={group.name}
                  onChange={(e) => updateGroup(group.id, { name: e.target.value })}
                />
              </div>

              <div className="mb-2">
                <label className="block text-xs text-slate-500 mb-1">Zone / Bracket</label>
                <select
                  className="w-full p-1 border border-slate-300 rounded text-sm bg-slate-50"
                  value={group.zone || ''}
                  onChange={(e) => updateGroup(group.id, { zone: e.target.value })}
                >
                  <option value="">-- No Zone --</option>
                  {bracket.zones.map((z, idx) => (
                    <option key={idx} value={z}>{z}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Capacity</label>
                <input
                  type="number"
                  className={`w-full p-1 border rounded text-sm ${!isCapacityMatch ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
                  value={group.capacity}
                  onChange={(e) => updateGroup(group.id, { capacity: parseInt(e.target.value) || 0 })}
                  onFocus={(e) => e.target.select()}
                />
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-400 mt-4 text-right">Configure available zones in the <strong>Brackets</strong> tab.</p>
      </div>
    </div>
  );
};