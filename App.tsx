import React, { useState, useEffect } from 'react';
import { Team, Group, Rule, DrawResult, BracketDefinition, DrawMode, EliminationBracket, EliminationDrawResult, BracketSlot, Matchup, SavedMatchupSchedule } from './types';
import { INITIAL_TEAMS, INITIAL_GROUPS, INITIAL_RULES } from './constants';
import { EntityConfig } from './components/EntityConfig';
import { GroupConfig } from './components/GroupConfig';
import { RuleConfig } from './components/RuleConfig';
import { EliminationConfig } from './components/EliminationConfig';
import { EliminationBracketView } from './components/EliminationBracketView';
import { runDraw } from './services/drawEngine';
import { runEliminationDraw } from './services/bracketDrawEngine';
import { generateVBACode } from './services/vbaGenerator';
import { generateMatchups } from './services/matchupEngine';
import { saveMatchupSchedule, loadMatchupSchedules, deleteMatchupSchedule, updateMatchupSchedule } from './services/storageService';
import { ResultsRankings } from './components/ResultsRankings';

// Helper to generate initial elimination bracket
const generateInitialEliminationBracket = (slotCount: number, roundName: string): EliminationBracket => ({
  roundName,
  totalSlots: slotCount,
  slots: Array.from({ length: slotCount }, (_, i): BracketSlot => ({
    id: Math.random().toString(36).substr(2, 9),
    position: i,
    team: null,
    isFixed: false
  }))
});

const App = () => {
  // Draw Mode: 'group' for traditional group stage, 'elimination' for direct bracket
  const [drawMode, setDrawMode] = useState<DrawMode>('group');

  const [activeTab, setActiveTab] = useState<'teams' | 'groups' | 'elimination' | 'rules' | 'draw' | 'results'>('teams');

  // State
  const [teams, setTeams] = useState<Team[]>(INITIAL_TEAMS);
  const [groups, setGroups] = useState<Group[]>(INITIAL_GROUPS);
  const [rules, setRules] = useState<Rule[]>(INITIAL_RULES);

  // Elimination bracket state
  const [eliminationBracket, setEliminationBracket] = useState<EliminationBracket>(
    generateInitialEliminationBracket(16, 'Round of 16')
  );

  const [lastResult, setLastResult] = useState<DrawResult | null>(null);
  const [lastEliminationResult, setLastEliminationResult] = useState<EliminationDrawResult | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Matchup state
  const [drawConfirmed, setDrawConfirmed] = useState(false);
  const [roundRobinCount, setRoundRobinCount] = useState(1);
  const [generatedMatchups, setGeneratedMatchups] = useState<Matchup[]>([]);
  const [showRoundRobinPrompt, setShowRoundRobinPrompt] = useState(false);
  const [savedSchedules, setSavedSchedules] = useState<SavedMatchupSchedule[]>([]);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [editingScheduleName, setEditingScheduleName] = useState('');
  const [saveName, setSaveName] = useState('');

  const totalCapacity = groups.reduce((sum, g) => sum + g.capacity, 0);
  const isGroupSetupValid = totalCapacity === teams.length;

  // Elimination validation: at least 2 teams filled in brackets
  const eliminationFilledSlots = eliminationBracket.slots.filter(s => s.team).length;
  const isEliminationSetupValid = eliminationFilledSlots >= 2;

  const isSetupValid = drawMode === 'group' ? isGroupSetupValid : isEliminationSetupValid;

  // Load saved schedules from localStorage on mount
  useEffect(() => {
    setSavedSchedules(loadMatchupSchedules());
  }, []);

  const handleTabChange = (tabId: typeof activeTab) => {
    // For group mode, block transition from Groups if capacity is wrong
    if (drawMode === 'group' && activeTab === 'groups' && tabId !== 'teams' && !isGroupSetupValid) {
      alert("Total Group Capacity must match Total Team Count before proceeding!");
      return;
    }
    setActiveTab(tabId);
  };

  const handleDrawModeChange = (mode: DrawMode) => {
    setDrawMode(mode);
    setActiveTab(mode === 'group' ? 'teams' : 'elimination');
    setLastResult(null);
    setLastEliminationResult(null);
    // Reset matchup state
    setDrawConfirmed(false);
    setGeneratedMatchups([]);
    setShowRoundRobinPrompt(false);
  };

  const handleDraw = async () => {
    if (!isSetupValid) {
      alert(drawMode === 'group'
        ? "Cannot run draw: Group capacity does not match team count."
        : 'Need at least 2 teams in the bracket to run draw.');
      return;
    }
    setIsDrawing(true);

    setTimeout(() => {
      if (drawMode === 'group') {
        const result = runDraw(teams, groups, rules);
        setLastResult({
          ...result,
          executionTimeMs: 0
        });
        setLastEliminationResult(null);
        // Reset matchup state on new draw
        setDrawConfirmed(false);
        setGeneratedMatchups([]);
        setShowRoundRobinPrompt(false);
      } else {
        // Elimination mode: extract teams from filled slots and run draw
        handleFinalizeElimination('randomize');
      }
      setIsDrawing(false);
    }, 100);
  };

  // Handle elimination bracket finalization from EliminationConfig
  const handleFinalizeElimination = (mode: 'randomize' | 'use_as_is') => {
    const logs: string[] = [];
    const workingSlots: BracketSlot[] = eliminationBracket.slots.map(s => ({ ...s }));

    if (mode === 'use_as_is') {
      // Use the bracket exactly as configured
      logs.push(`Using bracket as-is with ${workingSlots.filter(s => s.team).length} teams`);
      const emptyCount = workingSlots.filter(s => !s.team).length;
      if (emptyCount > 0) {
        logs.push(`⚠ ${emptyCount} slot(s) are empty (BYE)`);
      }

      setLastEliminationResult({
        success: true,
        bracket: { ...eliminationBracket, slots: workingSlots },
        logs
      });
    } else {
      // Randomize: shuffle unlocked teams
      const lockedSlots = workingSlots.filter(s => s.isFixed && s.team);
      const unlockedFilledSlots = workingSlots.filter(s => !s.isFixed && s.team);
      const emptySlots = workingSlots.filter(s => !s.isFixed && !s.team);

      // Collect all unlocked teams
      const unlockedTeams = unlockedFilledSlots.map(s => s.team!);

      // Shuffle
      for (let i = unlockedTeams.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [unlockedTeams[i], unlockedTeams[j]] = [unlockedTeams[j], unlockedTeams[i]];
      }

      // Reassign shuffled teams to unlocked+filled positions
      let teamIdx = 0;
      const finalSlots = workingSlots.map(s => {
        if (s.isFixed && s.team) return s; // locked — keep
        if (s.team) {
          // Was filled but unlocked — assign shuffled team
          return { ...s, team: unlockedTeams[teamIdx++] };
        }
        return s; // empty — keep empty
      });

      logs.push(`Randomized ${unlockedTeams.length} unlocked team(s)`);
      if (lockedSlots.length > 0) {
        logs.push(`🔒 ${lockedSlots.length} team(s) kept in locked positions`);
      }
      const stillEmpty = finalSlots.filter(s => !s.team).length;
      if (stillEmpty > 0) {
        logs.push(`⚠ ${stillEmpty} slot(s) are empty (BYE)`);
      }
      logs.push(`Successfully drew into ${eliminationBracket.roundName}`);

      setLastEliminationResult({
        success: true,
        bracket: { ...eliminationBracket, slots: finalSlots },
        logs
      });
    }

    setLastResult(null);
    setActiveTab('draw');
  };

  const downloadCSV = () => {
    if (drawMode === 'group') {
      if (!lastResult?.success) return;

      const headers = ['Group', 'Team Name', 'Organization', 'Seed'];
      const rows = lastResult.groups.flatMap(g =>
        g.teams.map(t => [
          `"${g.name}"`,
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
      link.setAttribute('download', `tournament_draw_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      if (!lastEliminationResult?.success) return;

      const headers = ['Position', 'Half', 'Team Name', 'Organization', 'Seed', 'Fixed'];
      const halfwayPoint = lastEliminationResult.bracket.totalSlots / 2;
      const rows = lastEliminationResult.bracket.slots.map(slot => [
        slot.position + 1,
        slot.position < halfwayPoint ? 'Top Half' : 'Bottom Half',
        `"${slot.team?.name || 'TBD'}"`,
        `"${slot.team?.organization || ''}"`,
        slot.team?.seed || '',
        slot.isFixed ? 'Yes' : 'No'
      ].join(','));

      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `bracket_draw_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
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

  // Define tabs based on draw mode
  const getTabs = () => {
    if (drawMode === 'group') {
      return [
        { id: 'teams' as const, label: '1. Teams & Orgs', count: teams.length },
        { id: 'groups' as const, label: '2. Groups', count: groups.length },
        { id: 'rules' as const, label: '3. Rules', count: rules.filter(r => r.isActive && r.type !== 'HALF_SEPARATION').length },
        { id: 'draw' as const, label: '4. Draw', count: lastResult ? (lastResult.success ? '✓' : '✗') : '-' },
        { id: 'results' as const, label: '5. Results & Rankings', count: savedSchedules.length },
      ];
    } else {
      return [
        { id: 'elimination' as const, label: '1. Bracket Setup', count: `${eliminationFilledSlots}/${eliminationBracket.totalSlots}` },
        { id: 'draw' as const, label: '2. Results', count: lastEliminationResult ? (lastEliminationResult.success ? '✓' : '✗') : '-' },
      ];
    }
  };

  const hasResult = drawMode === 'group' ? lastResult?.success : lastEliminationResult?.success;

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 shadow-lg sticky top-0 z-10">
        <div className="w-full xl:max-w-[1400px] 2xl:max-w-full mx-auto flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-500 rounded flex items-center justify-center font-bold text-lg">F</div>
            <h1 className="text-xl font-bold tracking-tight">FlexiDraw <span className="text-slate-400 font-normal text-sm ml-2">Tournament System</span></h1>
          </div>
          {drawMode === 'group' ? (
            <button
              onClick={() => {
                if (!isGroupSetupValid) {
                  alert("Adjust group capacity to match team count first!");
                  setActiveTab('groups');
                  return;
                }
                setActiveTab('draw');
                handleDraw();
              }}
              className={`${isGroupSetupValid ? 'bg-brand-600 hover:bg-brand-500' : 'bg-slate-600 cursor-not-allowed'} text-white px-6 py-2 rounded-full font-semibold shadow-md transition transform active:scale-95 flex items-center gap-2`}
            >
              <span>Run Draw</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </button>
          ) : (
            <button
              onClick={() => setActiveTab('elimination')}
              className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-2 rounded-full font-semibold shadow-md transition transform active:scale-95 flex items-center gap-2"
            >
              <span>Bracket Setup</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full xl:max-w-[1400px] 2xl:max-w-full mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-6">

        {/* Sidebar Nav */}
        <nav className="md:col-span-3 lg:col-span-2 space-y-1">

          {/* Draw Mode Toggle */}
          <div className="mb-4 p-3 bg-slate-100 rounded-lg border border-slate-200">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Draw Mode</p>
            <div className="flex gap-1">
              <button
                onClick={() => handleDrawModeChange('group')}
                className={`flex-1 py-2 px-3 rounded text-sm font-medium transition ${drawMode === 'group'
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                  }`}
              >
                📊 Group Stage
              </button>
              <button
                onClick={() => handleDrawModeChange('elimination')}
                className={`flex-1 py-2 px-3 rounded text-sm font-medium transition ${drawMode === 'elimination'
                  ? 'bg-orange-600 text-white shadow'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                  }`}
              >
                🏆 Direct Bracket
              </button>
            </div>
          </div>

          {getTabs().map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`w-full text-left px-4 py-3 rounded-lg flex justify-between items-center transition ${activeTab === tab.id
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

          <div className={`mt-8 p-4 rounded-lg border text-xs ${drawMode === 'elimination' ? 'bg-orange-50 border-orange-100 text-orange-800' : 'bg-blue-50 border-blue-100 text-blue-800'
            }`}>
            <p className="font-bold mb-1">Current Setup:</p>
            {drawMode === 'group' ? (
              <>
                <p>{teams.length} Teams</p>
                <p className={`font-semibold ${!isGroupSetupValid ? 'text-red-600' : ''}`}>
                  {groups.length} Groups ({totalCapacity} slots)
                </p>
                <p className="mt-2 italic text-blue-600">Modify config in tabs, then click Run Draw.</p>
              </>
            ) : (
              <>
                <p className="font-semibold">{eliminationBracket.roundName}</p>
                <p>{eliminationFilledSlots}/{eliminationBracket.totalSlots} slots filled</p>
                {eliminationBracket.slots.filter(s => s.isFixed).length > 0 && (
                  <p>🔒 {eliminationBracket.slots.filter(s => s.isFixed).length} locked</p>
                )}
                <p className="mt-2 italic text-orange-600">Set up bracket, then finalize.</p>
              </>
            )}
          </div>
        </nav>

        {/* Panel Content */}
        <div className="md:col-span-9 lg:col-span-10">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[500px] p-6">

            {activeTab === 'teams' && drawMode === 'group' && (
              <div>
                <h2 className="text-2xl font-bold text-slate-800 mb-6">Team Configuration</h2>
                <EntityConfig teams={teams} setTeams={setTeams} setGroups={setGroups} drawMode={drawMode} />
              </div>
            )}

            {activeTab === 'groups' && drawMode === 'group' && (
              <div>
                <h2 className="text-2xl font-bold text-slate-800 mb-6">Group Configuration</h2>
                <GroupConfig groups={groups} setGroups={setGroups} totalTeams={teams.length} />
              </div>
            )}

            {activeTab === 'elimination' && drawMode === 'elimination' && (
              <div>
                <h2 className="text-2xl font-bold text-slate-800 mb-6">Elimination Bracket Setup</h2>
                <EliminationConfig
                  eliminationBracket={eliminationBracket}
                  setEliminationBracket={setEliminationBracket}
                  onFinalizeDrawMode={handleFinalizeElimination}
                />
              </div>
            )}

            {activeTab === 'rules' && drawMode === 'group' && (
              <div>
                <h2 className="text-2xl font-bold text-slate-800 mb-6">Rule Engine</h2>
                <RuleConfig
                  rules={rules}
                  setRules={setRules}
                  teams={teams}
                  groups={groups}
                  drawMode={drawMode}
                />
              </div>
            )}

            {activeTab === 'draw' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-slate-800">Draw Results</h2>
                  <div className="flex gap-3">
                    {drawMode === 'group' && (
                      <button onClick={downloadVBA} className="flex items-center gap-2 text-slate-600 border border-slate-200 bg-slate-50 px-3 py-1.5 rounded hover:bg-slate-100 transition text-sm font-medium">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
                        Export Excel Macro (VBA)
                      </button>
                    )}
                    {hasResult && (
                      <button onClick={downloadCSV} className="flex items-center gap-2 text-green-600 border border-green-200 bg-green-50 px-3 py-1.5 rounded hover:bg-green-100 transition text-sm font-medium">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        Export CSV
                      </button>
                    )}
                    <button
                      onClick={() => drawMode === 'group' ? handleDraw() : handleFinalizeElimination('randomize')}
                      disabled={isDrawing}
                      className="text-brand-600 hover:underline text-sm ml-2"
                    >
                      Re-roll
                    </button>
                  </div>
                </div>

                {isDrawing ? (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                    <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-4"></div>
                    <p>{drawMode === 'group' ? 'Solving constraints...' : 'Drawing bracket...'}</p>
                  </div>
                ) : drawMode === 'group' ? (
                  // GROUP STAGE RESULTS
                  !lastResult ? (
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
                                    {t.seed != null && t.seed > 0 && (
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

                      {/* Confirm / Matchup Generation Flow */}
                      {lastResult.success && !drawConfirmed && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                          <p className="text-blue-800 font-semibold text-lg mb-2">Confirm this draw?</p>
                          <p className="text-blue-600 text-sm mb-4">Once confirmed, you can generate matchup schedules.</p>
                          <button
                            onClick={() => {
                              setDrawConfirmed(true);
                              setShowRoundRobinPrompt(true);
                            }}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
                          >
                            ✓ Confirm Draw
                          </button>
                        </div>
                      )}

                      {/* Round Robin Prompt */}
                      {showRoundRobinPrompt && (
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                          <h4 className="font-bold text-purple-800 mb-2">How many times should teams play each other?</h4>
                          <p className="text-purple-600 text-sm mb-4">
                            1 = Single Round Robin &nbsp;|&nbsp; 2 = Double Round Robin &nbsp;|&nbsp; n = Custom
                          </p>
                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              min="1"
                              max="10"
                              className="w-20 p-2 border border-purple-300 rounded text-center text-lg font-bold"
                              value={roundRobinCount}
                              onChange={(e) => setRoundRobinCount(Math.max(1, parseInt(e.target.value) || 1))}
                              onFocus={(e) => e.target.select()}
                            />
                            <button
                              onClick={() => {
                                if (lastResult?.success) {
                                  const matchups = generateMatchups(lastResult.groups, roundRobinCount);
                                  setGeneratedMatchups(matchups);
                                  setShowRoundRobinPrompt(false);
                                }
                              }}
                              className="bg-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700 transition"
                            >
                              Generate Matchups
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Generated Matchups Display */}
                      {generatedMatchups.length > 0 && (
                        <div className="space-y-6">
                          <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-800">
                              Matchups ({roundRobinCount}x Round Robin)
                            </h3>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Schedule name..."
                                className="p-2 border border-slate-300 rounded text-sm"
                                value={saveName}
                                onChange={(e) => setSaveName(e.target.value)}
                              />
                              <button
                                onClick={() => {
                                  if (!saveName.trim()) {
                                    alert('Please enter a name for this schedule.');
                                    return;
                                  }
                                  if (!lastResult?.success) return;
                                  const schedule: SavedMatchupSchedule = {
                                    id: Math.random().toString(36).substring(2, 9),
                                    name: saveName.trim(),
                                    createdAt: new Date().toISOString(),
                                    groups: lastResult.groups,
                                    matchups: generatedMatchups,
                                    roundRobinCount,
                                  };
                                  saveMatchupSchedule(schedule);
                                  setSavedSchedules(loadMatchupSchedules());
                                  setSaveName('');
                                }}
                                className="bg-green-600 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-green-700 transition"
                              >
                                💾 Save
                              </button>
                            </div>
                          </div>

                          {/* Group matchups */}
                          {lastResult?.success && lastResult.groups.map(g => {
                            const groupMatchups = generatedMatchups.filter(m => m.groupId === g.id);
                            if (groupMatchups.length === 0) return null;
                            return (
                              <div key={g.id} className="border border-slate-200 rounded-lg overflow-hidden">
                                <div className="bg-slate-100 p-3 border-b border-slate-200">
                                  <span className="font-bold text-slate-700">{g.name}</span>
                                  <span className="text-xs text-slate-500 ml-2">({groupMatchups.length} matches)</span>
                                </div>
                                <div className="p-3 space-y-1 bg-white">
                                  {Array.from({ length: roundRobinCount }, (_, roundIdx) => {
                                    const roundMatchups = groupMatchups.filter(m => m.round === roundIdx + 1);
                                    return (
                                      <div key={roundIdx}>
                                        {roundRobinCount > 1 && (
                                          <p className="text-xs font-bold text-slate-400 uppercase mt-2 mb-1">Round {roundIdx + 1}</p>
                                        )}
                                        {roundMatchups.map(m => (
                                          <div key={m.id} className="flex items-center p-2 hover:bg-slate-50 rounded text-sm">
                                            <span className="font-medium text-slate-700 flex-1 text-right">{m.teamA.name}</span>
                                            <span className="mx-3 text-slate-400 font-bold">vs</span>
                                            <span className="font-medium text-slate-700 flex-1">{m.teamB.name}</span>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Saved Schedules */}
                      {savedSchedules.length > 0 && (
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                          <div className="bg-slate-100 p-3 border-b border-slate-200">
                            <span className="font-bold text-slate-700">📁 Saved Schedules</span>
                          </div>
                          <div className="p-3 space-y-2 bg-white">
                            {savedSchedules.map(s => (
                              <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200 hover:border-slate-300 transition">
                                {editingScheduleId === s.id ? (
                                  <div className="flex items-center gap-2 flex-1">
                                    <input
                                      type="text"
                                      className="p-1 border border-slate-300 rounded text-sm flex-1"
                                      value={editingScheduleName}
                                      onChange={(e) => setEditingScheduleName(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          updateMatchupSchedule(s.id, { name: editingScheduleName });
                                          setSavedSchedules(loadMatchupSchedules());
                                          setEditingScheduleId(null);
                                        }
                                      }}
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => {
                                        updateMatchupSchedule(s.id, { name: editingScheduleName });
                                        setSavedSchedules(loadMatchupSchedules());
                                        setEditingScheduleId(null);
                                      }}
                                      className="text-green-600 text-xs font-medium hover:underline"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setEditingScheduleId(null)}
                                      className="text-slate-400 text-xs hover:underline"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <div>
                                      <p className="font-medium text-slate-800 text-sm">{s.name}</p>
                                      <p className="text-xs text-slate-500">
                                        {s.groups.length} groups · {s.matchups.length} matches · {s.roundRobinCount}x RR
                                        <span className="ml-2">{new Date(s.createdAt).toLocaleDateString()}</span>
                                      </p>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => {
                                          setGeneratedMatchups(s.matchups);
                                          setRoundRobinCount(s.roundRobinCount);
                                          setDrawConfirmed(true);
                                          setShowRoundRobinPrompt(false);
                                          setLastResult({
                                            success: true,
                                            groups: s.groups,
                                            logs: [`Loaded schedule: ${s.name}`],
                                            executionTimeMs: 0,
                                          });
                                        }}
                                        className="text-blue-600 text-xs font-medium hover:underline"
                                      >
                                        Load
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingScheduleId(s.id);
                                          setEditingScheduleName(s.name);
                                        }}
                                        className="text-slate-500 text-xs font-medium hover:underline"
                                      >
                                        Rename
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (confirm(`Delete "${s.name}"?`)) {
                                            deleteMatchupSchedule(s.id);
                                            setSavedSchedules(loadMatchupSchedules());
                                          }
                                        }}
                                        className="text-red-500 text-xs font-medium hover:underline"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  // ELIMINATION BRACKET RESULTS
                  !lastEliminationResult ? (
                    <div className="text-center py-20 text-slate-400 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                      <p>No bracket draw generated yet.</p>
                      <button onClick={handleDraw} className="mt-4 text-orange-600 font-semibold">Click to Generate</button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Status Banner */}
                      <div className={`p-4 rounded-lg border flex items-start gap-3 ${lastEliminationResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                        <div className="text-2xl">{lastEliminationResult.success ? '🏆' : '!'}</div>
                        <div>
                          <h3 className="font-bold">{lastEliminationResult.success ? 'Bracket Draw Complete' : 'Draw Failed'}</h3>
                          <div className="text-sm mt-1 space-y-1 opacity-90">
                            {lastEliminationResult.logs.map((log, i) => <p key={i}>{log}</p>)}
                          </div>
                        </div>
                      </div>

                      {/* Bracket Visualization */}
                      {lastEliminationResult.success && (
                        <EliminationBracketView
                          bracket={lastEliminationResult.bracket}
                          showResult={true}
                        />
                      )}
                    </div>
                  )
                )}
              </div>
            )}

            {activeTab === 'results' && drawMode === 'group' && (
              <ResultsRankings />
            )}

          </div>
        </div>
      </main>
    </div>
  );
};

export default App;