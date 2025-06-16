import React from 'react';
import './PickScroller.css';

function PickScroller({ picks, loading }) {
    if (loading) {
        return <div className="pick-scroller-loading">Loading picks...</div>;
    }

    if (!picks || picks.length === 0) {
        return <div className="pick-scroller-empty">No picks available for today.</div>;
    }

    return (
        <div className="pick-scroller-container">
            <div className="pick-scroller-header">
                <h3>Today's Travel Picks</h3>
            </div>
            <div className="pick-scroller">
                <div className="pick-scroller-track">
                    {picks.map(pick => (
                        <div key={pick.gamePk} className="pick-scroller-card">
                            <div className="pick-card-header">
                                <div className="recommended-bet">
                                    <strong>Pick:</strong> {pick.recommendedBet || "Unknown"}
                                </div>
                                <div className="strategy-icon travel-advantage" title="Travel Advantage">
                                    ✈️
                                </div>
                            </div>
                            <div className="pick-card-matchup">
                                <div className="team away">
                                    <span className="team-name">{pick.awayTeam?.name || "Away"}</span>
                                    <span className="travel-type">{pick.awayTravelType}</span>
                                </div>
                                <div className="vs">@</div>
                                <div className="team home">
                                    <span className="team-name">{pick.homeTeam?.name || "Home"}</span>
                                    <span className="travel-type">{pick.homeTravelType}</span>
                                </div>
                            </div>
                            <div className="pick-card-footer">
                                <span className="game-time">{pick.gameTime || 'Time TBD'}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default PickScroller; 