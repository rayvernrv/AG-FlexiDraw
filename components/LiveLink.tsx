import React, { useState } from 'react';
import { liveSyncService, LiveTournamentData, ResultsState } from '../services/liveSyncService';
import { SavedMatchupSchedule, SavedEliminationSchedule } from '../types';

interface LiveLinkProps {
    name: string;
    type: 'group' | 'elimination';
    schedule: SavedMatchupSchedule | SavedEliminationSchedule;
    resultsState: ResultsState;
    currentLiveId?: string;
    onLiveIdCreated: (id: string) => void;
}

export const LiveLink: React.FC<LiveLinkProps> = ({ 
    name, type, schedule, resultsState, currentLiveId, onLiveIdCreated 
}) => {
    const [isPublishing, setIsPublishing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copySuccess, setCopySuccess] = useState(false);

    // Auto-sync effect
    React.useEffect(() => {
        if (!currentLiveId) return;

        const timeoutId = setTimeout(async () => {
            try {
                const data: LiveTournamentData = { schedule, resultsState };
                await liveSyncService.publishTournament(name, type, data, currentLiveId);
            } catch (err) {
                console.error("Auto-sync failed:", err);
            }
        }, 2000); // 2 second debounce

        return () => clearTimeout(timeoutId);
    }, [schedule, resultsState, currentLiveId, name, type]);

    const handlePublish = async () => {
        setIsPublishing(true);
        setError(null);
        try {
            const data: LiveTournamentData = { schedule, resultsState };
            const id = await liveSyncService.publishTournament(name, type, data, currentLiveId);
            onLiveIdCreated(id);
        } catch (err) {
            setError('Failed to publish. Check your connection.');
            console.error(err);
        } finally {
            setIsPublishing(false);
        }
    };

    const liveUrl = currentLiveId ? `${window.location.origin}${window.location.pathname}?liveId=${currentLiveId}` : '';

    const handleCopy = () => {
        navigator.clipboard.writeText(liveUrl);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    const handleTerminate = async () => {
        if (!currentLiveId) return;
        if (!confirm("Are you sure you want to stop live sync? This will kill the live link for everyone!")) return;
        
        setIsPublishing(true);
        try {
            await liveSyncService.terminateTournament(currentLiveId);
            onLiveIdCreated(''); // Clear liveId using callback
        } catch (err) {
            setError('Failed to stop sync.');
            console.error(err);
        } finally {
            setIsPublishing(false);
        }
    };

    return (
        <div className={`p-4 rounded-xl border-2 transition-all duration-300 ${
            currentLiveId ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'
        }`}>
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex-1">
                    <h4 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-tighter text-sm">
                        {currentLiveId ? '🌍 Live Sync Active' : '📡 Offline Mode'}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">
                        {currentLiveId 
                            ? 'Your tournament is being broadcasted live to anyone with the link.' 
                            : 'Publish your tournament to share live results with an audience.'}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {currentLiveId ? (
                        <>
                            <div className="flex bg-white rounded-lg border border-green-200 overflow-hidden shadow-sm">
                                <div className="px-3 py-2 text-xs font-mono text-slate-400 select-all overflow-hidden max-w-[150px] lg:max-w-[250px] whitespace-nowrap">
                                    {liveUrl}
                                </div>
                                <button 
                                    onClick={handleCopy}
                                    className="bg-green-100 px-3 py-2 text-green-700 text-xs font-bold hover:bg-green-200 transition border-l border-green-200"
                                >
                                    {copySuccess ? 'Copied!' : 'Copy Link'}
                                </button>
                            </div>
                            <button 
                                onClick={handlePublish}
                                disabled={isPublishing}
                                className="bg-white border border-green-200 text-green-700 p-2 rounded-lg hover:bg-green-50 transition shadow-sm"
                                title="Sync Now"
                            >
                                <svg className={`w-4 h-4 ${isPublishing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                                </svg>
                            </button>
                            <button 
                                onClick={handleTerminate}
                                disabled={isPublishing}
                                className="bg-red-50 border border-red-200 text-red-600 p-2 rounded-lg hover:bg-red-100 transition shadow-sm"
                                title="Stop Live"
                            >
                                <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM8.5 9.5v5a.5.5 0 00.5.5h5a.5.5 0 00.5-.5v-5a.5.5 0 00-.5-.5h-5a.5.5 0 00-.5.5z" />
                                </svg>
                            </button>
                        </>
                    ) : (
                        <button 
                            onClick={handlePublish}
                            disabled={isPublishing}
                            className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-2 rounded-lg font-black uppercase tracking-widest text-xs shadow-lg transition transform active:scale-95 disabled:bg-slate-400"
                        >
                            {isPublishing ? 'Publishing...' : 'Go Live Now'}
                        </button>
                    )}
                </div>
            </div>
            {error && <p className="text-[10px] text-red-500 mt-2 font-bold uppercase">{error}</p>}
        </div>
    );
};
