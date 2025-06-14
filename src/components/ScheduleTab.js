import React, { useState, useEffect } from 'react';
import { format, parseISO, isToday } from 'date-fns';
import './ScheduleTab.css';

function ScheduleTab({ loading, scheduleData, selectedDate, handleDateChange, fetchDailySchedule, matchups, travelGames }) {
    const [todayMatchups, setTodayMatchups] = useState([]);

    useEffect(() => {
        if (scheduleData.length === 0) {
            fetchDailySchedule();
        }

        // Process matchups for the selected date
        processTodayMatchups();
    }, [selectedDate, matchups]);

    // Find matchups for the selected date
    const processTodayMatchups = () => {
        if (!matchups || matchups.length === 0) {
            setTodayMatchups([]);
            return;
        }

        // Find matchups for the selected date
        const todayData = matchups.find(day => day.date === selectedDate);
        if (!todayData || !todayData.matchups) {
            setTodayMatchups([]);
            return;
        }

        setTodayMatchups(todayData.matchups);
    };

    // Check if a game has travel advantage
    const hasTravelAdvantage = (game) => {
        if (!game) return false;

        const awayTravel = game.awayTeam.travelType;
        const homeTravel = game.homeTeam.travelType;

        // Home team advantage cases
        if ((homeTravel === 'Home to Home' || homeTravel === 'Home to Home (no Rest)' || homeTravel === 'Home to Home (with Rest)') &&
            (awayTravel === 'Home to Away' || awayTravel === 'Away to Away')) {
            return 'home';
        }
        // More advantage cases
        else if (homeTravel === 'Away to Home' &&
            (awayTravel === 'Home to Away' || awayTravel === 'Away to Away')) {
            return 'home';
        }

        return false;
    };

    // Check if a game is a Fade the Sweep scenario
    // This is a placeholder function - replace with real logic based on your data
    const hasFadeSweep = (game) => {
        // Check your series data to see if this is a potential sweep game
        // Example logic: team has lost first 2 games of a series and this is the final game
        return false; // Replace with actual logic
    };

    // Check if a game is a Fade the Rockies scenario
    const hasFadeRockies = (game) => {
        if (!game) return false;

        // Check if the Rockies are playing in this game
        const ROCKIES_TEAM_ID = 115; // MLB API ID for Colorado Rockies
        return game.awayTeam.id === ROCKIES_TEAM_ID || game.homeTeam.id === ROCKIES_TEAM_ID;
    };

    // Function to get team logo URL
    const getTeamLogoUrl = (teamId) => {
        // Using the hardcoded mapping approach for reliability
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

    return (
        <div className="schedule-tab">
            <div className="schedule-controls">
                <div className="date-selector">
                    <label htmlFor="date-input">Select Date:</label>
                    <input
                        type="date"
                        id="date-input"
                        value={selectedDate}
                        onChange={(e) => handleDateChange(e, 'daily')}
                    />
                    <button className="refresh-button" onClick={fetchDailySchedule}>
                        Refresh Schedule
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading">Loading schedule data...</div>
            ) : scheduleData.length === 0 ? (
                <div className="no-games">No games scheduled for this date.</div>
            ) : (
                <div className="schedule-content">
                    <h2>MLB Schedule - {format(new Date(selectedDate), 'MMMM d, yyyy')}</h2>
                    <div className="game-list">
                        {scheduleData.map((dateData) => {
                            if (dateData.date === selectedDate) {
                                return dateData.games.map((game) => {
                                    const gameTime = new Date(game.gameDate);
                                    const awayTeam = game.teams.away.team.name;
                                    const awayTeamId = game.teams.away.team.id;
                                    const homeTeam = game.teams.home.team.name;
                                    const homeTeamId = game.teams.home.team.id;
                                    const venue = game.venue.name;
                                    const gameStatus = game.status.detailedState;

                                    // Get team logo URLs
                                    const awayTeamLogo = getTeamLogoUrl(awayTeamId);
                                    const homeTeamLogo = getTeamLogoUrl(homeTeamId);

                                    // Find the matching matchup data with travel info
                                    const matchup = todayMatchups.find(m => m.gamePk === game.gamePk);

                                    // Check for special betting scenarios
                                    const travelAdvantage = matchup ? hasTravelAdvantage(matchup) : false;
                                    const fadeSweep = matchup ? hasFadeSweep(matchup) : false;
                                    const fadeRockies = matchup ? hasFadeRockies(matchup) : false;

                                    // Add special class if any strategy applies
                                    const hasStrategy = travelAdvantage || fadeSweep || fadeRockies;

                                    return (
                                        <div className={`game-card ${hasStrategy ? 'has-strategy' : ''}`} key={game.gamePk}>
                                            <div className="game-header">
                                                <span className="game-time-status">
                                                    {format(gameTime, 'h:mm a')} - {gameStatus}
                                                </span>

                                                {/* Strategy indicators in the header right */}
                                                <div className="strategy-indicators">
                                                    {travelAdvantage && (
                                                        <div className="strategy-icon travel-advantage" title="Travel Advantage">
                                                            ✈️
                                                        </div>
                                                    )}
                                                    {fadeSweep && (
                                                        <div className="strategy-icon fade-sweep" title="Fade the Sweep">
                                                            🧹
                                                        </div>
                                                    )}
                                                    {fadeRockies && (
                                                        <div className="strategy-icon fade-rockies" title="Fade the Rockies">
                                                            🏔️
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="matchup">
                                                <div className="teams">
                                                    <div className="team-column">
                                                        <img src={awayTeamLogo} alt={`${awayTeam} logo`} className="team-logo" />
                                                        <span className={`team-name team-${awayTeamId}`}>{awayTeam}</span>
                                                    </div>

                                                    <div className="versus">@</div>

                                                    <div className="team-column">
                                                        <img src={homeTeamLogo} alt={`${homeTeam} logo`} className="team-logo" />
                                                        <span className={`team-name team-${homeTeamId}`}>{homeTeam}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="game-footer">
                                                <span className="venue">{venue}</span>
                                            </div>
                                        </div>
                                    );
                                });
                            }
                            return null;
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ScheduleTab;