import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import './TrackerTab.css';

function TrackerTab({ loading, travelGames, matchups, scheduleData, startDate, endDate, handleDateChange, fetchSchedule }) {
    const [viewMode, setViewMode] = useState('matchups'); // 'matchups' or 'travel'

    // Helper function to get team logo URL
    const getTeamLogoUrl = (teamId) => {
        const TEAM_LOGOS = {
            // American League East
            110: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/110.svg', // Baltimore Orioles
            111: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/111.svg', // Boston Red Sox
            147: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/147.svg', // New York Yankees
            139: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/139.svg', // Tampa Bay Rays
            141: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/141.svg', // Toronto Blue Jays

            // American League Central
            145: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/145.svg', // Chicago White Sox
            114: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/114.svg', // Cleveland Guardians
            116: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/116.svg', // Detroit Tigers
            118: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/118.svg', // Kansas City Royals
            142: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/142.svg', // Minnesota Twins

            // American League West
            117: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/117.svg', // Houston Astros
            108: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/108.svg', // Los Angeles Angels
            133: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/133.svg', // Oakland Athletics
            136: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/136.svg', // Seattle Mariners
            140: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/140.svg', // Texas Rangers

            // National League East
            144: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/144.svg', // Atlanta Braves
            146: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/146.svg', // Miami Marlins
            121: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/121.svg', // New York Mets
            143: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/143.svg', // Philadelphia Phillies
            120: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/120.svg', // Washington Nationals

            // National League Central
            112: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/112.svg', // Chicago Cubs
            113: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/113.svg', // Cincinnati Reds
            158: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/158.svg', // Milwaukee Brewers
            134: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/134.svg', // Pittsburgh Pirates
            138: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/138.svg', // St. Louis Cardinals

            // National League West
            109: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/109.svg', // Arizona Diamondbacks
            115: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/115.svg', // Colorado Rockies
            119: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/119.svg', // Los Angeles Dodgers
            135: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/135.svg', // San Diego Padres
            137: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/137.svg'  // San Francisco Giants
        };

        return TEAM_LOGOS[teamId] || 'https://www.mlbstatic.com/team-logos/league-on-dark/1.svg'; // Fallback to MLB logo
    };

    // Get result class for win/loss styling
    const getResultClass = (won) => {
        if (won === true) return 'win-card';
        if (won === false) return 'loss-card';
        return '';
    };

    return (
        <div className="tracker-tab">
            <div className="date-controls">
                <div>
                    <label htmlFor="start-date">Start Date:</label>
                    <input
                        type="date"
                        id="start-date"
                        value={startDate}
                        onChange={(e) => handleDateChange(e, 'start')}
                    />
                </div>
                <div>
                    <label htmlFor="end-date">End Date:</label>
                    <input
                        type="date"
                        id="end-date"
                        value={endDate}
                        onChange={(e) => handleDateChange(e, 'end')}
                    />
                </div>
                <button onClick={fetchSchedule}>Refresh Data</button>
            </div>

            <div className="view-toggle">
                <button
                    className={`view-button ${viewMode === 'matchups' ? 'active' : ''}`}
                    onClick={() => setViewMode('matchups')}
                >
                    Matchups View
                </button>
                <button
                    className={`view-button ${viewMode === 'travel' ? 'active' : ''}`}
                    onClick={() => setViewMode('travel')}
                >
                    Travel Games View
                </button>
            </div>

            {loading ? (
                <div className="loading">Loading MLB schedule data...</div>
            ) : (
                <div className="content">
                    {viewMode === 'matchups' ? (
                        // Matchups View
                        <div className="matchups-view">
                            <h2>Game Matchups with Travel Data</h2>
                            {matchups.length > 0 ? (
                                matchups.map((dateData) => (
                                    <div key={dateData.date} className="date-section">
                                        <h3>{format(parseISO(dateData.date), 'EEEE, MMMM d, yyyy')}</h3>
                                        <div className="travel-games">
                                            {dateData.matchups.map((matchup) => {
                                                // Determine away and home team info
                                                const awayTeamName = matchup.awayTeam.name;
                                                const homeTeamName = matchup.homeTeam.name;
                                                const awayTeamId = matchup.awayTeam.id;
                                                const homeTeamId = matchup.homeTeam.id;

                                                // Get team logos
                                                const awayTeamLogo = getTeamLogoUrl(awayTeamId);
                                                const homeTeamLogo = getTeamLogoUrl(homeTeamId);

                                                // Determine overall result class
                                                const hasResult = matchup.awayTeam.won !== null || matchup.homeTeam.won !== null;
                                                let resultClass = '';
                                                if (hasResult) {
                                                    // Use home team result for card styling
                                                    resultClass = getResultClass(matchup.homeTeam.won);
                                                }

                                                return (
                                                    <div key={matchup.gamePk} className={`game-card ${resultClass}`}>
                                                        <div className="game-header">
                                                            <div className="game-date">
                                                                {format(parseISO(matchup.date), 'MMMM d, yyyy')}
                                                            </div>
                                                            <div className="game-venue">{matchup.venue}</div>
                                                        </div>

                                                        <div className="matchup">
                                                            <div className="teams">
                                                                <div className="team-container">
                                                                    <img
                                                                        src={awayTeamLogo}
                                                                        alt={`${awayTeamName} logo`}
                                                                        className="team-logo"
                                                                    />
                                                                    <span className="away-team">{awayTeamName}</span>
                                                                </div>

                                                                <span className="versus">@</span>

                                                                <div className="team-container">
                                                                    <img
                                                                        src={homeTeamLogo}
                                                                        alt={`${homeTeamName} logo`}
                                                                        className="team-logo"
                                                                    />
                                                                    <span className="home-team">{homeTeamName}</span>
                                                                </div>
                                                            </div>
                                                            {matchup.score && (
                                                                <div className="score">Final: {matchup.score}</div>
                                                            )}
                                                        </div>

                                                        <div className="game-details">
                                                            <div><strong>Status:</strong> {matchup.status}</div>

                                                            <div className="team-details away">
                                                                <strong>{matchup.awayTeam.name} (Away):</strong>
                                                                <div>Previous: {matchup.awayTeam.previousGame}</div>
                                                                <div>Current: {matchup.awayTeam.currentGame}</div>
                                                                <div>Travel Type: {matchup.awayTeam.travelType}</div>
                                                                {matchup.awayTeam.won !== null && (
                                                                    <div className={`game-result ${matchup.awayTeam.won ? 'win' : 'loss'}`}>
                                                                        Result: {matchup.awayTeam.won ? 'Win' : 'Loss'}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="team-details home">
                                                                <strong>{matchup.homeTeam.name} (Home):</strong>
                                                                <div>Previous: {matchup.homeTeam.previousGame}</div>
                                                                <div>Current: {matchup.homeTeam.currentGame}</div>
                                                                <div>Travel Type: {matchup.homeTeam.travelType}</div>
                                                                {matchup.homeTeam.won !== null && (
                                                                    <div className={`game-result ${matchup.homeTeam.won ? 'win' : 'loss'}`}>
                                                                        Result: {matchup.homeTeam.won ? 'Win' : 'Loss'}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {(matchup.awayTeam.travelType.includes('to Away') && !matchup.awayTeam.travelType.includes('Same')) ||
                                                                (matchup.homeTeam.travelType.includes('to Home') && !matchup.homeTeam.travelType.includes('Same')) ? (
                                                                <div className="travel-indicator">
                                                                    <span className="icon">✈️</span> Travel Required
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="no-games">No matchups found in the selected date range.</div>
                            )}
                        </div>
                    ) : (
                        // Traditional Travel Games View
                        <div className="travel-view">
                            <h2>Travel Games</h2>
                            {travelGames.length > 0 ? (
                                <div className="travel-games">
                                    {travelGames.map((game, index) => {
                                        const resultClass = getResultClass(game.won);

                                        return (
                                            <div key={index} className={`game-card ${resultClass}`}>
                                                <div className="game-header">
                                                    <div className="game-date">
                                                        {format(parseISO(game.date), 'MMMM d, yyyy')}
                                                    </div>
                                                </div>

                                                <div className="game-team">
                                                    <span className="team-name">{game.team}</span>
                                                    <span className="at">vs</span>
                                                    <span className="opponent">{game.opponent}</span>
                                                </div>

                                                <div className="game-details">
                                                    <div><strong>Previous Game:</strong> {game.previousGame}</div>
                                                    <div><strong>Current Game:</strong> {game.currentGame}</div>
                                                    <div><strong>{game.team} Travel:</strong> {game.travelType}</div>
                                                    <div><strong>Opponent Travel:</strong> {game.opponentTravel || 'Unknown'}</div>
                                                    {game.won !== null && (
                                                        <div className={`game-result ${game.won ? 'win' : 'loss'}`}>
                                                            Result: {game.won ? 'Win' : 'Loss'}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="no-games">No travel games found in the selected date range.</div>
                            )}

                            <div className="schedule">
                                <h2>Full Schedule</h2>
                                {scheduleData.map((dateData) => (
                                    <div key={dateData.date} className="date-section">
                                        <h3>{format(parseISO(dateData.date), 'EEEE, MMMM d, yyyy')}</h3>
                                        <div className="games-list">
                                            {dateData.games.map((game) => (
                                                <div key={game.gamePk} className="game-item">
                                                    <span className="away-team">{game.teams.away.team.name}</span>
                                                    {game.status && game.status.statusCode === 'F' && (
                                                        <span className="score">{game.teams.away.score}-{game.teams.home.score}</span>
                                                    )}
                                                    <span className="at">@</span>
                                                    <span className="home-team">{game.teams.home.team.name}</span>
                                                    <span className="venue">{game.venue.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default TrackerTab;