import React, { useState } from 'react';
import { Team, Group, Rule, DrawResult, BracketDefinition } from './types';
import { INITIAL_TEAMS, INITIAL_GROUPS, INITIAL_RULES } from './constants';
import { EntityConfig } from './components/EntityConfig';
import { GroupConfig } from './components/GroupConfig';
import { RuleConfig } from './components/RuleConfig';
import { BracketConfig } from './components/BracketConfig';
import { runDraw } from './services/drawEngine';
import { generateVBACode } from './services/vbaGenerator';

const App = () => {
  const [activeTab, setActiveTab] = useState<'teams' | 'groups' | 'brackets' | 'rules' | 'draw'>('teams');
  
  // State
  const [teams, setTeams] = useState<Team[]>(INITIAL_TEAMS);
  const [groups, setGroups] = useState<Group[]>(INITIAL_GROUPS);
  const [rules, setRules] = useState<Rule[]>(INITIAL_RULES);
  const [bracket, setBracket] = useState<BracketDefinition>({ 
    name: '2 Halves (Top / Bottom)', 
    zones: ['Top Half', 'Bottom Half'],
    advancingPerGroup: 2
  });
  
  const [lastResult, setLastResult] = useState<DrawResult | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const totalCapacity = groups.reduce((sum, g) => sum + g.capacity, 0);
  const isSetupValid = totalCapacity === teams.length;

  const handleTabChange = (tabId: 'teams' | 'groups' | 'brackets' | 'rules' | 'draw') => {
    // Block transition from Groups if capacity is wrong, unless going to Teams to fix count
    if (activeTab === 'groups' && tabId !== 'teams' && !isSetupValid) {
        alert("Total Group Capacity must match Total Team Count before proceeding!");
        return;
    }
    setActiveTab(tabId);
  };

  const handleDraw = async () => {
    if (!isSetupValid) {
        alert("Cannot run draw: Group capacity does not match team count.");
        return;
    }
    setIsDrawing(true);
    // Tiny delay to allow UI to update to "Drawing..." state
    setTimeout(() => {
      const result = runDraw(teams, groups, rules);
      setLastResult({
        ...result,
        executionTimeMs: 0 // Calculated in engine usually, but passed here
      });
      setIsDrawing(false);
    }, 100);
  };

  const downloadCSV = () => {
    if (!lastResult?.success) return;
    
    // Header
    const headers = ['Group', 'Zone/Bracket', 'Team Name', 'Organization', 'Seed'];
    
    // Rows
    const rows = lastResult.groups.flatMap(g => 
      g.teams.map(t => [
        `"${g.name}"`, 
        `"${g.zone || ''}"`, 
        `"${t.name}"`, 
        `"${t.organization}"`, 
        t.seed || ''
      ].join(','))
    );

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `tournament_draw_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadVBA = () => {
    const code = generateVBACode();
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `FlexiDraw_Logic.bas`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 shadow-lg sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-500 rounded flex items-center justify-center font-bold text-lg">F</div>
            <h1 className="text-xl font-bold tracking-tight">FlexiDraw <span className="text-slate-400 font-normal text-sm ml-2">Tournament System</span></h1>
          </div>
          <button 
            onClick={() => { 
                if (!isSetupValid) {
                    alert("Adjust group capacity to match team count first!");
                    setActiveTab('groups');
                    return;
                }
                setActiveTab('draw'); 
                handleDraw(); 
            }}
            className={`${isSetupValid ? 'bg-brand-600 hover:bg-brand-500' : 'bg-slate-600 cursor-not-allowed'} text-white px-6 py-2 rounded-full font-semibold shadow-md transition transform active:scale-95 flex items-center gap-2`}
          >
            <span>Run Draw</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Sidebar Nav */}
        <nav className="md:col-span-3 lg:col-span-2 space-y-1">
          {[
            { id: 'teams', label: '1. Teams & Orgs', count: teams.length },
            { id: 'groups', label: '2. Groups', count: groups.length },
            { id: 'brackets', label: '3. Brackets', count: bracket.zones.length },
            { id: 'rules', label: '4. Rules', count: rules.filter(r => r.isActive).length },
            { id: 'draw', label: 'Results', count: lastResult ? (lastResult.success ? '✓' : '✗') : '-' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as any)}
              className={`w-full text-left px-4 py-3 rounded-lg flex justify-between items-center transition ${
                activeTab === tab.id 
                  ? 'bg-white text-brand-600 shadow font-semibold ring-1 ring-slate-200' 
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-brand-100 text-brand-700' : 'bg-slate-200 text-slate-600'}`}>
                {tab.count}
              </span>
            </button>
          ))}

          <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-100 text-xs text-blue-800">
            <p className="font-bold mb-1">Current Setup:</p>
            <p>{teams.length} Teams</p>
            <p className={`font-semibold ${!isSetupValid ? 'text-red-600' : ''}`}>
                {groups.length} Groups ({totalCapacity} slots)
            </p>
            <p className="mt-2 text-blue-600 italic">Modify config in tabs, then click Run Draw.</p>
          </div>
        </nav>

        {/* Panel Content */}
        <div className="md:col-span-9 lg:col-span-10">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[500px] p-6">
            
            {activeTab === 'teams' && (
              <div>
                <h2 className="text-2xl font-bold text-slate-800 mb-6">Team Configuration</h2>
                <EntityConfig teams={teams} setTeams={setTeams} setGroups={setGroups} />
              </div>
            )}

            {activeTab === 'groups' && (
              <div>
                <h2 className="text-2xl font-bold text-slate-800 mb-6">Group Configuration</h2>
                <GroupConfig groups={groups} setGroups={setGroups} totalTeams={teams.length} bracket={bracket} />
              </div>
            )}

            {activeTab === 'brackets' && (
              <div>
                <h2 className="text-2xl font-bold text-slate-800 mb-6">Bracket Definition</h2>
                <BracketConfig 
                  bracket={bracket} 
                  setBracket={setBracket} 
                  groups={groups} 
                  setGroups={setGroups} 
                />
              </div>
            )}

            {activeTab === 'rules' && (
              <div>
                <h2 className="text-2xl font-bold text-slate-800 mb-6">Rule Engine</h2>
                <RuleConfig rules={rules} setRules={setRules} teams={teams} groups={groups} />
              </div>
            )}

            {activeTab === 'draw' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-slate-800">Draw Results</h2>
                  <div className="flex gap-3">
                     <button onClick={downloadVBA} className="flex items-center gap-2 text-slate-600 border border-slate-200 bg-slate-50 px-3 py-1.5 rounded hover:bg-slate-100 transition text-sm font-medium">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
                        Export Excel Macro (VBA)
                     </button>
                     {lastResult?.success && (
                       <button onClick={downloadCSV} className="flex items-center gap-2 text-green-600 border border-green-200 bg-green-50 px-3 py-1.5 rounded hover:bg-green-100 transition text-sm font-medium">
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                         Export CSV
                       </button>
                     )}
                     <button onClick={handleDraw} disabled={isDrawing} className="text-brand-600 hover:underline text-sm ml-2">
                        Re-roll
                     </button>
                  </div>
                </div>

                {isDrawing ? (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                    <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-4"></div>
                    <p>Solving constraints...</p>
                  </div>
                ) : !lastResult ? (
                  <div className="text-center py-20 text-slate-400 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                    <p>No draw generated yet.</p>
                    <button onClick={handleDraw} className="mt-4 text-brand-600 font-semibold">Click to Generate</button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Status Banner */}
                    <div className={`p-4 rounded-lg border flex items-start gap-3 ${lastResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                      <div className="text-2xl">{lastResult.success ? '✓' : '!'}</div>
                      <div>
                        <h3 className="font-bold">{lastResult.success ? 'Draw Successful' : 'Draw Failed'}</h3>
                        <div className="text-sm mt-1 space-y-1 opacity-90">
                          {lastResult.logs.map((log, i) => <p key={i}>{log}</p>)}
                        </div>
                      </div>
                    </div>

                    {/* Results Grid */}
                    {lastResult.success && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {lastResult.groups.map(g => (
                          <div key={g.id} className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                            <div className="bg-slate-100 p-3 border-b border-slate-200 flex justify-between items-center">
                              <div>
                                <span className="font-bold text-slate-700">{g.name}</span>
                                {g.zone && <span className="text-xs text-slate-500 ml-2">({g.zone})</span>}
                              </div>
                              <span className="text-xs text-slate-500 bg-white px-2 py-0.5 rounded border">{g.teams.length}/{g.capacity}</span>
                            </div>
                            <div className="p-2 space-y-1 bg-white">
                              {g.teams.map(t => (
                                <div key={t.id} className="flex justify-between items-center p-2 hover:bg-brand-50 rounded group">
                                  <div>
                                    <div className="font-medium text-slate-800">{t.name}</div>
                                    <div className="text-xs text-slate-500">{t.organization}</div>
                                  </div>
                                  {t.seed && (
                                    <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-bold border border-yellow-200">
                                      Seed {t.seed}
                                    </span>
                                  )}
                                </div>
                              ))}
                              {g.teams.length === 0 && <div className="p-4 text-center text-slate-400 text-sm italic">Empty Group</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
};

export default App;