import React, { useState, useRef, useMemo } from 'react';
import { Team, Group, DrawMode } from '../types';

interface EntityConfigProps {
  teams: Team[];
  setTeams: (teams: Team[]) => void;
  setGroups: (groups: Group[]) => void;
  drawMode: DrawMode;
}

export const EntityConfig: React.FC<EntityConfigProps> = ({ teams, setTeams, setGroups, drawMode }) => {
  const [newOrgName, setNewOrgName] = useState('');
  const [teamCount, setTeamCount] = useState(1);
  const [targetGroupCount, setTargetGroupCount] = useState(4);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Actions ---

  const addOrg = () => {
    if (!newOrgName.trim()) return;

    const newTeams: Team[] = [];
    for (let i = 0; i < teamCount; i++) {
      newTeams.push({
        id: Math.random().toString(36).substr(2, 9),
        name: `${newOrgName} - Team ${i + 1}`,
        organization: newOrgName,
        seed: null,
        tags: [`Team ${i + 1}`]
      });
    }

    setTeams([...teams, ...newTeams]);
    setNewOrgName('');
    setTeamCount(1);
  };

  const updateTeam = (id: string, updates: Partial<Team>) => {
    setTeams(teams.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const removeTeam = (id: string) => {
    setTeams(teams.filter(t => t.id !== id));
  };

  const distributeGroups = () => {
    const numGroups = Math.max(1, targetGroupCount);
    const totalTeams = teams.length;

    // Calculate base capacity and remainder
    const baseCapacity = Math.floor(totalTeams / numGroups);
    const remainder = totalTeams % numGroups;

    const newGroups: Group[] = [];

    for (let i = 0; i < numGroups; i++) {
      // Distribute remainder one by one to the first few groups
      const extraSlot = i < remainder ? 1 : 0;
      const capacity = baseCapacity + extraSlot;

      newGroups.push({
        id: Math.random().toString(36).substr(2, 9),
        name: `Group ${String.fromCharCode(65 + i)}`,
        capacity: Math.max(1, capacity), // Ensure at least 1 capacity if teams exist, else user can fix
        zone: '', // Reset zone, user maps later
        teams: []
      });
    }

    setGroups(newGroups);
  };

  const downloadTemplate = () => {
    const headers = "Name,Organization,Seed";
    const example1 = "John Doe,Club A,1";
    const example2 = "Jane Smith,Club B,";
    const content = [headers, example1, example2].join('\n');

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `flexidraw_import_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      const parsedTeams: Team[] = [];

      lines.forEach((line, index) => {
        const parts = line.split(',');
        // Basic check to skip header if it looks like "Name,Organization..."
        if (index === 0 && parts[0].toLowerCase().includes('name') && parts[1]?.toLowerCase().includes('org')) {
          return;
        }

        if (parts.length >= 2) {
          const name = parts[0].trim();
          const org = parts[1].trim();
          const seedStr = parts[2]?.trim();
          const seed = seedStr && !isNaN(parseInt(seedStr)) ? parseInt(seedStr) : null;

          parsedTeams.push({
            id: Math.random().toString(36).substr(2, 9),
            name,
            organization: org,
            seed,
            tags: []
          });
        }
      });

      setTeams([...teams, ...parsedTeams]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // --- Duplicate Detection ---

  const duplicates = useMemo(() => {
    const seen = new Set<string>();
    const dupIds = new Set<string>();

    teams.forEach(t => {
      const key = `${t.name.toLowerCase()}|${t.organization.toLowerCase()}`;
      if (seen.has(key)) {
        dupIds.add(t.id);
        // Find the original to mark it too if needed, but for now we mark subsequent ones
        // Actually, let's mark ALL instances of the duplicate
        teams.filter(ot => ot.name.toLowerCase() === t.name.toLowerCase() && ot.organization.toLowerCase() === t.organization.toLowerCase())
          .forEach(dt => dupIds.add(dt.id));
      } else {
        seen.add(key);
      }
    });
    return dupIds;
  }, [teams]);

  const removeAllDuplicates = () => {
    // Keep the first instance, remove others
    const seen = new Set<string>();
    const uniqueTeams: Team[] = [];

    teams.forEach(t => {
      const key = `${t.name.toLowerCase()}|${t.organization.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueTeams.push(t);
      }
    });
    setTeams(uniqueTeams);
  };

  return (
    <div className="space-y-6">

      {/* 1. Add / Import Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-lg shadow border border-slate-200">
          <h3 className="text-lg font-semibold mb-4 text-slate-800">Manually Add Organization</h3>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Organization Name</label>
              <input
                type="text"
                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="e.g. Club X"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addOrg()}
              />
            </div>
            <div className="w-20">
              <label className="block text-xs text-slate-500 mb-1">Count</label>
              <input
                type="number"
                min="1"
                max="20"
                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-brand-500 outline-none"
                value={teamCount}
                onChange={(e) => setTeamCount(parseInt(e.target.value) || 1)}
                onFocus={(e) => e.target.select()}
              />
            </div>
            <button
              onClick={addOrg}
              className="bg-brand-600 text-white px-4 py-2 rounded hover:bg-brand-700 transition h-[42px]"
            >
              Add
            </button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-800">Import CSV</h3>
            <button onClick={downloadTemplate} className="text-brand-600 text-xs hover:underline flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              Template
            </button>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Format: Name, Organization, Seed(optional)</label>
              <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="block w-full text-sm text-slate-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded file:border-0
                    file:text-sm file:font-semibold
                    file:bg-brand-50 file:text-brand-700
                    hover:file:bg-brand-100"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Group Distribution Settings - Only show in Group Stage mode */}
      {drawMode === 'group' && (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-blue-900">Configure Groups</h4>
            <p className="text-sm text-blue-700">Automatically distribute these {teams.length} teams into groups.</p>
          </div>
          <div className="flex items-center gap-3 bg-white p-2 rounded border border-blue-100">
            <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Distribute into:</label>
            <input
              type="number"
              min="1"
              className="w-16 p-1 border border-slate-300 rounded text-center"
              value={targetGroupCount}
              onChange={(e) => setTargetGroupCount(parseInt(e.target.value) || 1)}
              onFocus={(e) => e.target.select()}
            />
            <span className="text-sm font-medium text-slate-700">Groups</span>
            <button
              onClick={distributeGroups}
              className="ml-2 bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 font-medium"
            >
              Generate Groups
            </button>
          </div>
        </div>
      )}

      {/* 3. Team List */}
      <div className="bg-white p-4 rounded-lg shadow border border-slate-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Teams List ({teams.length})</h3>
          <div className="flex gap-4">
            {duplicates.size > 0 && (
              <button onClick={removeAllDuplicates} className="text-red-600 bg-red-50 border border-red-200 px-3 py-1 rounded text-sm font-medium hover:bg-red-100">
                Remove Duplicates ({duplicates.size})
              </button>
            )}
            <button onClick={() => setTeams([])} className="text-slate-500 text-sm hover:underline">Clear All</button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-2 w-10">#</th>
                <th className="p-2">Name</th>
                <th className="p-2">Organization</th>
                <th className="p-2">Seed</th>
                <th className="p-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teams.map((team, idx) => {
                const isDup = duplicates.has(team.id);
                return (
                  <tr key={team.id} className={`hover:bg-slate-50 group ${isDup ? 'bg-red-50' : ''}`}>
                    <td className="p-2 text-slate-400 text-xs">{idx + 1}</td>
                    <td className="p-2">
                      <input
                        className={`bg-transparent border-none focus:ring-1 focus:ring-brand-500 rounded w-full ${isDup ? 'text-red-700 font-medium' : ''}`}
                        value={team.name}
                        onChange={(e) => updateTeam(team.id, { name: e.target.value })}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className={`bg-transparent border-none focus:ring-1 focus:ring-brand-500 rounded w-full ${isDup ? 'text-red-700 font-medium' : ''}`}
                        value={team.organization}
                        onChange={(e) => updateTeam(team.id, { organization: e.target.value })}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        className="bg-transparent border border-slate-200 rounded w-16 px-1 text-center"
                        value={team.seed || ''}
                        placeholder="-"
                        onChange={(e) => updateTeam(team.id, { seed: e.target.value ? parseInt(e.target.value) : null })}
                        onFocus={(e) => e.target.select()}
                      />
                    </td>
                    <td className="p-2 text-right">
                      <button
                        onClick={() => removeTeam(team.id)}
                        className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};