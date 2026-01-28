import React, { useState } from 'react';
import { Rule, RuleType, Team, Group, DrawMode } from '../types';

interface RuleConfigProps {
  rules: Rule[];
  setRules: (rules: Rule[]) => void;
  teams: Team[];
  groups: Group[];
  drawMode: DrawMode;
}

export const RuleConfig: React.FC<RuleConfigProps> = ({ rules, setRules, teams, groups, drawMode }) => {

  const toggleRule = (id: string) => {
    setRules(rules.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r));
  };

  const addRule = (type: RuleType) => {
    let name = 'New Rule';
    let params: Rule['params'] = {};

    switch (type) {
      case RuleType.MUTUAL_EXCLUSION:
        name = 'New Attribute Exclusion';
        params = { attribute: 'organization' };
        break;
      case RuleType.SEED_SEPARATION:
        name = 'New Seed Group Separation';
        params = { seeds: [1, 2] };
        break;
      case RuleType.ZONE_SEPARATION:
        name = 'New Seed Bracket/Zone Separation';
        params = { seeds: [1, 2] };
        break;
      case RuleType.TEAM_LOCK:
        name = 'New Team Assignment';
        params = { teamId: '', groupId: '' };
        break;
      case RuleType.HALF_SEPARATION:
        name = 'New Half Separation';
        params = { teamIds: [] };
        break;
    }

    const newRule: Rule = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      type,
      isActive: true,
      params
    };
    setRules([...rules, newRule]);
  };

  const deleteRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  const toggleTeamInHalfSeparation = (ruleId: string, teamId: string) => {
    setRules(rules.map(r => {
      if (r.id !== ruleId) return r;
      const currentTeamIds = r.params.teamIds || [];
      const isSelected = currentTeamIds.includes(teamId);
      const newTeamIds = isSelected
        ? currentTeamIds.filter(id => id !== teamId)
        : [...currentTeamIds, teamId];
      return { ...r, params: { ...r.params, teamIds: newTeamIds } };
    }));
  };

  // Filter rules based on draw mode
  const filteredRules = rules.filter(rule => {
    if (drawMode === 'elimination') {
      // In elimination mode, show HALF_SEPARATION and hide group-specific rules
      return rule.type === RuleType.HALF_SEPARATION;
    } else {
      // In group mode, hide HALF_SEPARATION
      return rule.type !== RuleType.HALF_SEPARATION;
    }
  });

  return (
    <div className="space-y-6">
      {/* Rule Mode Info */}
      <div className={`p-4 rounded-lg border ${drawMode === 'elimination'
          ? 'bg-orange-50 border-orange-200'
          : 'bg-blue-50 border-blue-200'
        }`}>
        <p className={`text-sm ${drawMode === 'elimination' ? 'text-orange-800' : 'text-blue-800'}`}>
          <strong>{drawMode === 'elimination' ? '🏆 Elimination Bracket Rules' : '📊 Group Stage Rules'}</strong>
          <br />
          {drawMode === 'elimination'
            ? 'These rules apply to direct bracket elimination draws. Use Half Separation to keep teams in different halves.'
            : 'These rules apply to group stage draws. You can control team separation by organization, seeds, zones, etc.'}
        </p>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {drawMode === 'group' && (
          <>
            <button
              onClick={() => addRule(RuleType.MUTUAL_EXCLUSION)}
              className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded shadow-sm hover:bg-slate-50 text-sm"
            >
              + Attribute Exclusion
            </button>
            <button
              onClick={() => addRule(RuleType.SEED_SEPARATION)}
              className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded shadow-sm hover:bg-slate-50 text-sm"
            >
              + Seed Group Separation
            </button>
            <button
              onClick={() => addRule(RuleType.ZONE_SEPARATION)}
              className="bg-white border border-purple-200 text-purple-700 px-4 py-2 rounded shadow-sm hover:bg-purple-50 text-sm"
            >
              + Seed Bracket Separation
            </button>
            <button
              onClick={() => addRule(RuleType.TEAM_LOCK)}
              className="bg-white border border-yellow-300 text-yellow-800 px-4 py-2 rounded shadow-sm hover:bg-yellow-50 text-sm font-medium"
            >
              + Lock Team to Group
            </button>
          </>
        )}

        {drawMode === 'elimination' && (
          <button
            onClick={() => addRule(RuleType.HALF_SEPARATION)}
            className="bg-white border border-orange-300 text-orange-800 px-4 py-2 rounded shadow-sm hover:bg-orange-50 text-sm font-medium"
          >
            + Half Separation Rule
          </button>
        )}
      </div>

      <div className="space-y-4">
        {filteredRules.map((rule) => (
          <div
            key={rule.id}
            className={`p-4 rounded-lg border flex items-start justify-between transition ${rule.isActive ? 'bg-white border-brand-200 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-70'
              }`}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={rule.isActive}
                  onChange={() => toggleRule(rule.id)}
                  className="w-4 h-4 text-brand-600 rounded"
                />
                <input
                  value={rule.name}
                  onChange={(e) => setRules(rules.map(r => r.id === rule.id ? { ...r, name: e.target.value } : r))}
                  className={`font-semibold bg-transparent border-none p-0 focus:ring-0 w-full ${rule.isActive ? 'text-slate-800' : 'text-slate-500'}`}
                />
              </div>

              <div className="text-sm text-slate-600 ml-6">
                {rule.type === RuleType.MUTUAL_EXCLUSION && (
                  <div className="flex items-center gap-2">
                    <span>Prevent teams with same</span>
                    <select
                      value={rule.params.attribute as string}
                      onChange={(e) => setRules(rules.map(r => r.id === rule.id ? { ...r, params: { ...r.params, attribute: e.target.value } } : r))}
                      className="border border-slate-300 rounded px-2 py-1 bg-white"
                    >
                      <option value="organization">Organization</option>
                      <option value="name">Name</option>
                    </select>
                    <span>in the same group.</span>
                  </div>
                )}

                {rule.type === RuleType.SEED_SEPARATION && (
                  <div className="flex items-center gap-2">
                    <span>Keep seeds</span>
                    <input
                      type="text"
                      className="border border-slate-300 rounded px-2 py-1 w-24 text-center bg-white"
                      value={rule.params.seeds?.join(', ') || ''}
                      onChange={(e) => {
                        const seeds = e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                        setRules(rules.map(r => r.id === rule.id ? { ...r, params: { ...r.params, seeds } } : r));
                      }}
                    />
                    <span>apart in <strong>Groups</strong>.</span>
                  </div>
                )}

                {rule.type === RuleType.ZONE_SEPARATION && (
                  <div className="flex items-center gap-2">
                    <span>Keep seeds</span>
                    <input
                      type="text"
                      className="border border-slate-300 rounded px-2 py-1 w-24 text-center bg-white"
                      value={rule.params.seeds?.join(', ') || ''}
                      onChange={(e) => {
                        const seeds = e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                        setRules(rules.map(r => r.id === rule.id ? { ...r, params: { ...r.params, seeds } } : r));
                      }}
                    />
                    <span>apart in <strong>Zones</strong>.</span>
                  </div>
                )}

                {rule.type === RuleType.TEAM_LOCK && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2">
                    <span>Force</span>
                    <select
                      value={rule.params.teamId || ''}
                      onChange={(e) => setRules(rules.map(r => r.id === rule.id ? { ...r, params: { ...r.params, teamId: e.target.value } } : r))}
                      className="border border-slate-300 rounded px-2 py-1 bg-white max-w-[200px]"
                    >
                      <option value="">-- Select Team --</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <span>into</span>
                    <select
                      value={rule.params.groupId || ''}
                      onChange={(e) => setRules(rules.map(r => r.id === rule.id ? { ...r, params: { ...r.params, groupId: e.target.value } } : r))}
                      className="border border-slate-300 rounded px-2 py-1 bg-white"
                    >
                      <option value="">-- Select Group --</option>
                      {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>
                )}

                {rule.type === RuleType.HALF_SEPARATION && (
                  <div className="mt-2">
                    <p className="mb-2 text-slate-500">
                      Select teams that must be placed in <strong>different halves</strong> of the bracket (they won't meet until the final):
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {teams.map(t => {
                        const isSelected = rule.params.teamIds?.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            onClick={() => toggleTeamInHalfSeparation(rule.id, t.id)}
                            className={`px-3 py-1.5 rounded-full text-sm border transition ${isSelected
                                ? 'bg-orange-100 border-orange-400 text-orange-800 font-medium'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                              }`}
                          >
                            {isSelected && <span className="mr-1">✓</span>}
                            {t.name}
                            {t.seed && <span className="text-xs ml-1 opacity-70">[{t.seed}]</span>}
                          </button>
                        );
                      })}
                    </div>
                    {(rule.params.teamIds?.length || 0) >= 2 && (
                      <p className="mt-3 text-xs text-green-600">
                        ✓ {rule.params.teamIds!.length} teams selected — they will be split between top and bottom halves.
                      </p>
                    )}
                    {(rule.params.teamIds?.length || 0) === 1 && (
                      <p className="mt-3 text-xs text-amber-600">
                        ⚠ Select at least 2 teams for separation to work.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button onClick={() => deleteRule(rule.id)} className="text-slate-400 hover:text-red-500 ml-4">
              Delete
            </button>
          </div>
        ))}

        {filteredRules.length === 0 && (
          <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
            <p>No {drawMode === 'elimination' ? 'elimination bracket' : 'group stage'} rules configured.</p>
            <p className="text-sm mt-1">Click a button above to add a rule.</p>
          </div>
        )}
      </div>
    </div>
  );
};
