import React from 'react';
import { Rule, RuleType, Team, Group } from '../types';

interface RuleConfigProps {
  rules: Rule[];
  setRules: (rules: Rule[]) => void;
  teams: Team[];
  groups: Group[];
}

export const RuleConfig: React.FC<RuleConfigProps> = ({ rules, setRules, teams, groups }) => {
  
  const toggleRule = (id: string) => {
    setRules(rules.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r));
  };

  const addRule = (type: RuleType) => {
    let name = 'New Rule';
    if (type === RuleType.MUTUAL_EXCLUSION) name = 'New Attribute Exclusion';
    if (type === RuleType.SEED_SEPARATION) name = 'New Seed Group Separation';
    if (type === RuleType.ZONE_SEPARATION) name = 'New Seed Bracket/Zone Separation';
    if (type === RuleType.TEAM_LOCK) name = 'New Team Assignment';

    const newRule: Rule = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      type,
      isActive: true,
      params: type === RuleType.MUTUAL_EXCLUSION 
        ? { attribute: 'organization' }
        : type === RuleType.TEAM_LOCK
          ? { teamId: '', groupId: '' }
          : { seeds: [1, 2] }
    };
    setRules([...rules, newRule]);
  };

  const deleteRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 mb-4 flex-wrap">
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
      </div>

      <div className="space-y-4">
        {rules.map((rule) => (
          <div 
            key={rule.id} 
            className={`p-4 rounded-lg border flex items-start justify-between transition ${
              rule.isActive ? 'bg-white border-brand-200 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-70'
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
              </div>
            </div>

            <button onClick={() => deleteRule(rule.id)} className="text-slate-400 hover:text-red-500 ml-4">
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
