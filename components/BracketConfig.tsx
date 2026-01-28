import React, { useEffect } from 'react';
import { BracketDefinition, Group } from '../types';

interface BracketConfigProps {
  bracket: BracketDefinition;
  setBracket: (b: BracketDefinition) => void;
  groups: Group[];
  setGroups: (groups: Group[]) => void;
}

const TOURNAMENT_STAGES = [
  { label: 'Round of 64', value: 'R64', zones: ['Bracket A', 'Bracket B', 'Bracket C', 'Bracket D', 'Bracket E', 'Bracket F', 'Bracket G', 'Bracket H'] },
  { label: 'Round of 32', value: 'R32', zones: ['Bracket 1', 'Bracket 2', 'Bracket 3', 'Bracket 4'] },
  { label: 'Round of 16', value: 'R16', zones: ['Q1', 'Q2', 'Q3', 'Q4'] },
  { label: 'Quarter-Finals', value: 'QF', zones: ['Top Half', 'Bottom Half'] },
  { label: 'Semi-Finals', value: 'SF', zones: ['Top Half', 'Bottom Half'] },
  { label: 'Finals', value: 'F', zones: ['Finals'] },
];

export const BracketConfig: React.FC<BracketConfigProps> = ({ bracket, setBracket, groups, setGroups }) => {

  const toggleGroupZone = (groupId: string, zoneName: string, isSelected: boolean) => {
    setGroups(groups.map(g => {
      if (g.id !== groupId) return g;
      return { ...g, zone: isSelected ? zoneName : (g.zone === zoneName ? '' : g.zone) };
    }));
  };

  const handleStageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const stage = TOURNAMENT_STAGES.find(s => s.value === e.target.value);
    if (stage) {
      setBracket({
        ...bracket,
        name: stage.label,
        zones: stage.zones
      });
    }
  };

  const currentStageValue = TOURNAMENT_STAGES.find(s => s.label === bracket.name)?.value || 'QF';

  return (
    <div className="space-y-8">

      {/* Configuration Section */}
      <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-4">1. Post-Group Stage Structure</h3>
        <p className="text-sm text-slate-500 mb-4">Define how the tournament proceeds after the group stage.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Advancing Teams per Group</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                className="w-20 p-2 border border-slate-300 rounded"
                value={bracket.advancingPerGroup || 2}
                onChange={(e) => setBracket({ ...bracket, advancingPerGroup: parseInt(e.target.value) || 1 })}
                onFocus={(e) => e.target.select()}
              />
              <span className="text-sm text-slate-500">teams qualify from each group</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Total qualifiers: {groups.length * (bracket.advancingPerGroup || 2)} teams
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Elimination Stage Starts At:</label>
            <select
              className="w-full p-2 border border-slate-300 rounded bg-white"
              value={currentStageValue}
              onChange={handleStageChange}
            >
              {TOURNAMENT_STAGES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <div className="mt-2 text-xs text-slate-500">
              This creates <strong>{bracket.zones.length}</strong> separate zones for seed separation logic.
            </div>
          </div>
        </div>
      </div>

      {/* Visual Mapping Section */}
      <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-1">2. Map Groups to Bracket Zones</h3>
        <p className="text-sm text-slate-500 mb-6">
          Assign which Groups feed into which part of the bracket.
          <br /><span className="italic">Use the <strong>"Seed Bracket Separation"</strong> rule to ensure top seeds don't meet until the final of these zones.</span>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {bracket.zones.map((zoneName) => (
            <div key={zoneName} className="border border-slate-300 rounded-lg overflow-hidden flex flex-col">
              <div className="bg-slate-100 p-3 border-b border-slate-300 font-semibold text-slate-700 flex justify-between items-center">
                <span>{zoneName}</span>
                <span className="text-xs font-normal bg-white px-2 py-0.5 rounded border border-slate-200">
                  {groups.filter(g => g.zone === zoneName).length} Groups Assigned
                </span>
              </div>
              <div className="p-4 bg-slate-50 flex-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Feed Groups:</p>
                <div className="space-y-2">
                  {groups.map((group) => {
                    const isAssignedToThis = group.zone === zoneName;
                    const isAssignedElsewhere = group.zone && group.zone !== zoneName;

                    return (
                      <label
                        key={group.id}
                        className={`flex items-center p-2 rounded border transition ${isAssignedToThis
                            ? 'bg-white border-brand-300 shadow-sm'
                            : isAssignedElsewhere
                              ? 'opacity-50 grayscale border-transparent'
                              : 'bg-white border-transparent hover:border-slate-300'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={isAssignedToThis}
                          disabled={isAssignedElsewhere} // Prevent multi-zone assignment logic for simplicity
                          onChange={(e) => toggleGroupZone(group.id, zoneName, e.target.checked)}
                          className="h-4 w-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                        />
                        <span className={`ml-3 text-sm ${isAssignedToThis ? 'font-medium text-slate-800' : 'text-slate-600'}`}>
                          {group.name}
                        </span>
                        {isAssignedElsewhere && <span className="ml-auto text-xs text-slate-400">({group.zone})</span>}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
