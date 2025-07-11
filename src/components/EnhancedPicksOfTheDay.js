import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fetchOdds, formatOdds } from '../services/oddsApi';

function EnhancedPicksOfTheDay({
    picksOfTheDay,
    picksLoading,
    trendsData,
    seasonStats,
    scheduleData,
    refreshAll,
    krateUndersPicks
}) {
    const [expandedPick, setExpandedPick] = useState(null);
    const [sortedPicks, setSortedPicks] = useState({
        travel: [],
        sweep: []
    });
    const [oddsData, setOddsData] = useState({});

    // Enhanced debug logging for data inspection
    useEffect(() => {
        console.log("EnhancedPicksOfTheDay - Received picks data:", {
            travel: picksOfTheDay?.travel?.length || 0,
            sweep: picksOfTheDay?.sweep?.length || 0,
            fullPicks: picksOfTheDay
        });
    }, [picksOfTheDay]);

    // SIMPLIFIED APPROACH: Sort picks by game time and ensure all picks are processed
    useEffect(() => {
        if (picksOfTheDay) {
            console.log("Processing picksOfTheDay:", picksOfTheDay);

            // Function to safely get game time (from the MLB API or fallback to default time)
            const getGameTime = (pick) => {
                // Default time if not available
                if (!pick.gameTime) return new Date();

                try {
                    // Try to parse the time format (e.g., "7:10 PM")
                    const [time, meridiem] = pick.gameTime.split(' ');
                    const [hour, minute] = time.split(':');

                    const date = new Date();
                    let hourInt = parseInt(hour);

                    // Convert 12-hour format to 24-hour
                    if (meridiem === 'PM' && hourInt < 12) {
                        hourInt += 12;
                    } else if (meridiem === 'AM' && hourInt === 12) {
                        hourInt = 0;
                    }

                    date.setHours(hourInt, parseInt(minute), 0, 0);
                    return date;
                } catch (e) {
                    console.error("Error parsing game time:", pick.gameTime, e);
                    return new Date(); // Default to current time on error
                }
            };

            // Make defensive copies and ensure we have arrays
            const travelPicks = Array.isArray(picksOfTheDay.travel) ? [...picksOfTheDay.travel] : [];
            const sweepPicks = Array.isArray(picksOfTheDay.sweep) ? [...picksOfTheDay.sweep] : [];

            // Log before sorting to validate the initial data
            console.log("BEFORE SORTING - travel picks:", travelPicks);

            // Create new arrays with sorting rather than mutating the original
            const sortedTravel = [...travelPicks].sort((a, b) => getGameTime(a) - getGameTime(b));
            const sortedSweep = [...sweepPicks].sort((a, b) => getGameTime(a) - getGameTime(b));

            // Log after sorting to check for any issues
            console.log("AFTER SORTING - travel picks:", sortedTravel);

            // Show first few picks to help debug
            if (sortedTravel.length > 0) {
                console.log("First travel pick:", JSON.stringify(sortedTravel[0], null, 2));
            }

            // Set the sorted picks
            setSortedPicks({
                travel: sortedTravel,
                sweep: sortedSweep
            });
        }
    }, [picksOfTheDay]);

    // NEW useEffect HOOK FOR INITIAL DATA LOAD
    useEffect(() => {
        // If we have no picks or no stats, trigger a refresh
        const hasPicks = picksOfTheDay?.travel?.length > 0 ||
            picksOfTheDay?.sweep?.length > 0;

        const hasStats = seasonStats?.byType &&
            Object.values(seasonStats.byType).some(stat => stat.total > 0);

        if (!hasPicks || !hasStats) {
            console.log("Missing necessary data, triggering refresh");
            refreshAll();
        }
    }, []);

    // Process game data for potential auto-detection (if needed later)
    useEffect(() => {
        if (scheduleData && Array.isArray(scheduleData)) {
            // Get today's games
            const today = new Date();
            const formattedToday = format(today, 'yyyy-MM-dd');
            const todayGames = scheduleData.find(date => date.date === formattedToday)?.games || [];

            console.log(`Found ${todayGames.length} games for today`);
        }
    }, [scheduleData]);

    // Fetch odds when picks change
    const handleFetchOdds = async () => {
        if (!picksOfTheDay) return;
        const picks = [
            ...(picksOfTheDay.travel || []),
            ...(picksOfTheDay.sweep || [])
        ];
        if (picks.length > 0) {
            const odds = await fetchOdds(picks);
            setOddsData(odds);
        }
    };

    // Function to check if a pick is expanded
    const isPickExpanded = (gamePk, pickType) => {
        return expandedPick && expandedPick.gamePk === gamePk && expandedPick.type === pickType;
    };

    // Function to toggle expanded state of a pick
    const toggleExpandPick = (gamePk, pickType) => {
        if (isPickExpanded(gamePk, pickType)) {
            setExpandedPick(null);
        } else {
            setExpandedPick({ gamePk, type: pickType });
        }
    };

    // Helper function to get team logo URL
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

    // Helper function to get team color
    const getTeamColor = (teamId) => {
        const TEAM_COLORS = {
            // American League East
            110: '#df4601', // Baltimore Orioles
            111: '#bd3039', // Boston Red Sox
            147: '#003087', // New York Yankees
            139: '#092c5c', // Tampa Bay Rays
            141: '#134a8e', // Toronto Blue Jays

            // American League Central
            145: '#27251f', // Chicago White Sox
            114: '#e31937', // Cleveland Guardians
            116: '#0c2340', // Detroit Tigers
            118: '#004687', // Kansas City Royals
            142: '#002b5c', // Minnesota Twins

            // American League West
            117: '#eb6e1f', // Houston Astros
            108: '#ba0021', // Los Angeles Angels
            133: '#003831', // Oakland Athletics
            136: '#0c2c56', // Seattle Mariners
            140: '#c0111f', // Texas Rangers

            // National League East
            144: '#ce1141', // Atlanta Braves
            146: '#00a3e0', // Miami Marlins
            121: '#ff5910', // New York Mets
            143: '#e81828', // Philadelphia Phillies
            120: '#ab0003', // Washington Nationals

            // National League Central
            112: '#0e3386', // Chicago Cubs
            113: '#c6011f', // Cincinnati Reds
            158: '#12284b', // Milwaukee Brewers
            134: '#27251f', // Pittsburgh Pirates
            138: '#c41e3a', // St. Louis Cardinals

            // National League West
            109: '#a71930', // Arizona Diamondbacks
            115: '#33006f', // Colorado Rockies
            119: '#005a9c', // Los Angeles Dodgers
            135: '#2f241d', // San Diego Padres
            137: '#fd5a1e', // San Francisco Giants
        };

        return TEAM_COLORS[teamId] || '#333'; // Default color if not found
    };

    // Get win percentage for a travel type matchup from the season stats
    const getTravelTypeStats = (travelType, opponentTravelType) => {
        console.log('Getting travel type stats for:', { travelType, opponentTravelType });
        console.log('Current seasonStats:', seasonStats);

        if (!seasonStats || !seasonStats.matchups) {
            console.log('No seasonStats or matchups found');
            return { wins: 0, losses: 0, percentage: 0, total: 0 };
        }

        // Create the matchup key in the same format as TrendsTab
        const matchupKey = `${travelType} vs ${opponentTravelType}`;
        const reverseMatchupKey = `${opponentTravelType} vs ${travelType}`;
        
        console.log('Looking for matchup keys:', { matchupKey, reverseMatchupKey });
        console.log('Available matchups:', Object.keys(seasonStats.matchups));
        
        // Try both directions of the matchup
        const matchup = seasonStats.matchups[matchupKey] || seasonStats.matchups[reverseMatchupKey];
        
        console.log('Found matchup:', matchup);
        
        if (!matchup) {
            console.log('No matchup found for either key');
            return { wins: 0, losses: 0, percentage: 0, total: 0 };
        }

        // Determine which side of the matchup we're looking at
        const isFirstType = matchupKey.startsWith(travelType);
        const stats = isFirstType ? matchup.first : matchup.second;

        console.log('Selected stats:', { isFirstType, stats });

        return {
            wins: stats.wins || 0,
            losses: stats.losses || 0,
            total: (stats.wins || 0) + (stats.losses || 0),
            percentage: ((stats.wins || 0) / ((stats.wins || 0) + (stats.losses || 0)) * 100).toFixed(1)
        };
    };

    // Helper function to get travel type for a team (used for potential auto-detection)
    const getTravelTypeForTeam = (teamId, isHome) => {
        // Try to get travel type from trendsData
        if (trendsData && trendsData.teams && trendsData.teams[teamId]) {
            const teamData = trendsData.teams[teamId];
            if (teamData && teamData.currentTravelType) {
                return teamData.currentTravelType;
            }
        }

        // For testing/fallback - provide reasonable travel types based on common patterns
        // These fallbacks will help ensure we can see travel picks even without complete trendsData
        const travelTypes = [
            'Home to Home (with Rest)',
            'Home to Home (no Rest)',
            'Away to Home',
            'Home to Away',
            'Away to Away'
        ];

        // Assign more likely travel types based on whether team is home or away
        if (isHome) {
            return travelTypes[Math.floor(Math.random() * 3)]; // More likely to be one of the home types
        } else {
            return travelTypes[Math.floor(Math.random() * 2) + 3]; // More likely to be one of the away types
        }
    };

    // Helper function to get odds for a pick
    const getPickOdds = (pick) => {
        if (!pick || !pick.gamePk || !oddsData[pick.gamePk]) {
            console.log('No odds for pick:', pick);
            return '';
        }
        const gameOdds = oddsData[pick.gamePk];
        const teamName = pick.recommendedBet;
        let odds = '';
        if (gameOdds.homeTeam.name === teamName) {
            odds = formatOdds(gameOdds.homeTeam.odds);
        } else if (gameOdds.awayTeam.name === teamName) {
            odds = formatOdds(gameOdds.awayTeam.odds);
        }
        console.log('Odds for pick:', pick, '->', odds);
        return odds;
    };

    // Render a travel pick card
    const renderTravelPickCard = (pick) => {
        if (!pick || !pick.gamePk) {
            console.error("Invalid travel pick:", pick);
            return null;
        }

        console.log("Rendering travel pick:", pick);

        // Handle missing team IDs for older data formats
        const awayTeamId = pick.awayTeam?.id || 0;
        const homeTeamId = pick.homeTeam?.id || 0;

        // Get team logos and colors
        const awayTeamLogo = getTeamLogoUrl(awayTeamId);
        const homeTeamLogo = getTeamLogoUrl(homeTeamId);
        const awayTeamColor = getTeamColor(awayTeamId);
        const homeTeamColor = getTeamColor(homeTeamId);

        const isExpanded = isPickExpanded(pick.gamePk, 'travel');

        return (
            <div className={`pick-card ${isExpanded ? 'expanded' : ''} has-strategy`} key={pick.gamePk}>
                <div className="pick-header">
                    <div className="game-time-status">
                        <div className="recommended-bet-highlight-header">
                            {pick.recommendedBet} ({getPickOdds(pick)})
                        </div>
                    </div>
                    <div className="strategy-indicators">
                        <div className="strategy-icon travel-advantage" title="Travel Advantage">
                            ✈️
                        </div>
                    </div>
                </div>

                <div className="matchup">
                    <div className="teams">
                        <div className="team-container">
                            <img
                                src={awayTeamLogo}
                                alt={`${pick.awayTeam?.name || "Away Team"} logo`}
                                className="team-logo"
                            />
                            <span
                                className="away-team"
                                style={{ color: awayTeamColor }}
                            >
                                {pick.awayTeam?.name || "Away Team"}
                            </span>
                            {/* Added travel type under team name */}
                            <span className="team-travel-label">
                                {pick.awayTravelType || "Unknown Travel"}
                            </span>
                        </div>
                        <span className="versus">@</span>
                        <div className="team-container">
                            <img
                                src={homeTeamLogo}
                                alt={`${pick.homeTeam?.name || "Home Team"} logo`}
                                className="team-logo"
                            />
                            <span
                                className="home-team"
                                style={{ color: homeTeamColor }}
                            >
                                {pick.homeTeam?.name || "Home Team"}
                            </span>
                            {/* Added travel type under team name */}
                            <span className="team-travel-label">
                                {pick.homeTravelType || "Unknown Travel"}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="pick-footer">
                    <span className="game-time">{pick.gameTime || 'Time TBD'}</span>
                    <span className="venue">{pick.venue || 'Venue TBD'}</span>
                </div>
            </div >
        );
    };

    // Render a sweep pick card
    const renderSweepPickCard = (pick) => {
        if (!pick || !pick.gamePk) {
            console.error("Invalid sweep pick:", pick);
            return null;
        }

        const isExpanded = isPickExpanded(pick.gamePk, 'sweep');

        // If we have the team objects with their IDs
        let awayTeamId, homeTeamId, awayTeamName, homeTeamName;

        if (pick.teamToFade && pick.opposingTeam) {
            // Determine which is home/away
            // For sweep picks, the team to fade is the one that lost previous games
            const isTeamToFadeHome = !pick.teamToFade.isAway; // Assuming we have this info

            if (isTeamToFadeHome) {
                homeTeamId = pick.teamToFade.id;
                awayTeamId = pick.opposingTeam.id;
                homeTeamName = pick.teamToFade.name;
                awayTeamName = pick.opposingTeam.name;
            } else {
                homeTeamId = pick.opposingTeam.id;
                awayTeamId = pick.teamToFade.id;
                homeTeamName = pick.opposingTeam.name;
                awayTeamName = pick.teamToFade.name;
            }
        } else {
            // Fallback if full team data is not available
            awayTeamId = 0;
            homeTeamId = 0;
            awayTeamName = "Away Team";
            homeTeamName = "Home Team";
        }

        // Get team logos and colors
        const awayTeamLogo = getTeamLogoUrl(awayTeamId);
        const homeTeamLogo = getTeamLogoUrl(homeTeamId);
        const awayTeamColor = getTeamColor(awayTeamId);
        const homeTeamColor = getTeamColor(homeTeamId);

        return (
            <div className={`pick-card ${isExpanded ? 'expanded' : ''} has-strategy`} key={pick.gamePk}>
                <div className="pick-header">
                    <div className="game-time-status">
                        <div className="recommended-bet-highlight-header">
                            <strong>Pick:</strong> {pick.recommendedBet} {getPickOdds(pick)}
                        </div>
                    </div>
                    <div className="strategy-indicators">
                        <div className="strategy-icon fade-sweep" title="Fade the Sweep">
                            🧹
                        </div>
                    </div>
                </div>

                <div className="matchup">
                    <div className="teams">
                        {pick.teamToFade && pick.opposingTeam ? (
                            <>
                                <div className="team-container">
                                    <img
                                        src={awayTeamLogo}
                                        alt={`${awayTeamName} logo`}
                                        className="team-logo"
                                    />
                                    <span
                                        className="away-team"
                                        style={{ color: awayTeamColor }}
                                    >
                                        {awayTeamName}
                                    </span>
                                </div>
                                <span className="versus">@</span>
                                <div className="team-container">
                                    <img
                                        src={homeTeamLogo}
                                        alt={`${homeTeamName} logo`}
                                        className="team-logo"
                                    />
                                    <span
                                        className="home-team"
                                        style={{ color: homeTeamColor }}
                                    >
                                        {homeTeamName}
                                    </span>
                                </div>
                            </>
                        ) : (
                            <>
                                <span>{pick.recommendedBet || "Unknown"} (Matchup details unavailable)</span>
                            </>
                        )}
                    </div>
                </div>

                <div className="pick-details">
                    {/* Remove the centered pick recommendation since it's now in the header */}

                    <div className="reason">
                        <strong>Reason:</strong> {pick.reason || "Fade the Sweep Strategy"}
                    </div>
                    <button
                        className="detail-toggle-button"
                        onClick={() => toggleExpandPick(pick.gamePk, 'sweep')}
                    >
                        {isExpanded ? 'Hide Analysis' : 'Show Analysis'}
                    </button>

                    {isExpanded && (
                        <div className="expanded-details">
                            <div className="sweep-analysis">
                                <h4>Sweep Analysis</h4>
                                <p>
                                    {pick.teamToFade ?
                                        `${pick.teamToFade.name} has lost ${pick.previousLosses || "multiple"} consecutive games in this series. Historically, teams are more likely to avoid getting swept in the final game of a series.` :
                                        "This pick is based on the 'Fade the Sweep' strategy, where teams are statistically more likely to avoid being swept in the final game of a series."}
                                </p>
                                {pick.previousLosses && (
                                    <div className="sweep-stats">
                                        <div className="stat-item">
                                            <span className="stat-label">Previous Losses:</span>
                                            <span className="stat-value">{pick.previousLosses}</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-label">Game Type:</span>
                                            <span className="stat-value">Final Game of Series</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="pick-footer">
                    <span className="game-time">{pick.gameTime || 'Time TBD'}</span>
                    <span className="venue">{pick.venue || 'Venue TBD'}</span>
                </div>
            </div>
        );
    };

    // Render a K-Rate Unders pick card
    const renderKRateUndersCard = (opportunity) => {
        if (!opportunity) return null;
        const awayTeamLogo = getTeamLogoUrl(opportunity.awayTeam.id);
        const homeTeamLogo = getTeamLogoUrl(opportunity.homeTeam.id);
        // Use the same structure and classes as KRateUndersTab.js
        return (
            <div className={`opportunity-card ${opportunity.confidence.toLowerCase()}-confidence`} key={opportunity.gamePk}>
                <div className="opportunity-header">
                    <div className="game-date">
                        {opportunity.date ? new Date(opportunity.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                    </div>
                    <div className="confidence-indicator">
                        <span className={`confidence-badge ${opportunity.confidence.toLowerCase()}`}>{opportunity.confidence}</span>
                    </div>
                </div>
                <div className="opportunity-matchup">
                    <div className="pitcher-info away">
                        <img
                            src={awayTeamLogo}
                            alt={`${opportunity.awayTeam.name} logo`}
                            className="team-logo"
                        />
                        <div className="team-pitcher">
                            <span className="team-name away">{opportunity.awayTeam.name}</span>
                            <span className="pitcher-name-large">{opportunity.awayTeam.pitcher.name}</span>
                            <div className={`pitcher-krate ${opportunity.awayTeam.pitcher.kRate >= 0.30 ? 'very-high-krate' :
                                    opportunity.awayTeam.pitcher.kRate >= 0.27 ? 'high-krate' : ''
                                } ${opportunity.awayTeam.pitcher.useSeasonStats ? 'season-stats' : ''} ${opportunity.awayTeam.pitcher.gamesCount < 3 ? 'limited-data' : ''}`}>
                                {opportunity.awayTeam.pitcher.kRate && !isNaN(opportunity.awayTeam.pitcher.kRate) ?
                                    `${(opportunity.awayTeam.pitcher.kRate * 100).toFixed(1)}% K-Rate` :
                                    'K-Rate Data N/A'
                                }
                                {opportunity.awayTeam.pitcher.useSeasonStats && (
                                    <span className="data-quality-indicator season" title="Using season stats">S</span>
                                )}
                                {opportunity.awayTeam.pitcher.gamesCount < 3 && !opportunity.awayTeam.pitcher.useSeasonStats && (
                                    <span className="data-quality-indicator limited" title="Limited recent data">!</span>
                                )}
                            </div>
                        </div>
                        <div className="team-so-rate">
                            Opponent SO Rate: {(opportunity.homeTeam.strikeoutRate * 100).toFixed(1)}%
                        </div>
                        {opportunity.awayTeam.pitcher.gamesCount > 0 && (
                            <div className="pitcher-recent-data">
                                {opportunity.awayTeam.pitcher.useSeasonStats ? 'Season stats' : `Last ${opportunity.awayTeam.pitcher.gamesCount} games`}
                            </div>
                        )}
                    </div>
                    <div className="vs-indicator">@</div>
                    <div className="pitcher-info home">
                        <img
                            src={homeTeamLogo}
                            alt={`${opportunity.homeTeam.name} logo`}
                            className="team-logo"
                        />
                        <div className="team-pitcher">
                            <span className="team-name home">{opportunity.homeTeam.name}</span>
                            <span className="pitcher-name-large">{opportunity.homeTeam.pitcher.name}</span>
                            <div className={`pitcher-krate ${opportunity.homeTeam.pitcher.kRate >= 0.30 ? 'very-high-krate' :
                                    opportunity.homeTeam.pitcher.kRate >= 0.27 ? 'high-krate' : ''
                                } ${opportunity.homeTeam.pitcher.useSeasonStats ? 'season-stats' : ''} ${opportunity.homeTeam.pitcher.gamesCount < 3 ? 'limited-data' : ''}`}>
                                {(opportunity.homeTeam.pitcher.kRate * 100).toFixed(1)}% K-Rate
                                {opportunity.homeTeam.pitcher.useSeasonStats && (
                                    <span className="data-quality-indicator season" title="Using season stats">S</span>
                                )}
                                {opportunity.homeTeam.pitcher.gamesCount < 3 && !opportunity.homeTeam.pitcher.useSeasonStats && (
                                    <span className="data-quality-indicator limited" title="Limited recent data">!</span>
                                )}
                            </div>
                        </div>
                        <div className="team-so-rate">
                            Opponent SO Rate: {(opportunity.awayTeam.strikeoutRate * 100).toFixed(1)}%
                        </div>
                        {opportunity.homeTeam.pitcher.gamesCount > 0 && (
                            <div className="pitcher-recent-data">
                                {opportunity.homeTeam.pitcher.useSeasonStats ? 'Season stats' : `Last ${opportunity.homeTeam.pitcher.gamesCount} games`}
                            </div>
                        )}
                    </div>
                </div>
                <div className="opportunity-details">
                    <div className={`recommendation-tag confidence-${opportunity.confidence.toLowerCase()}`}>
                        Recommended Under Bet ({opportunity.confidence} Confidence)
                    </div>
                    <div className="betting-lines">
                        <div>Projected Total: 8.5 runs</div>
                        <div>Projected F5: 4.5 runs</div>
                    </div>
                </div>
                <div className="opportunity-footer">
                    <span className="venue">{opportunity.venue}</span>
                    <span className="game-time">{opportunity.gameTime}</span>
                </div>
            </div>
        );
    };

    // SINGLE RETURN STATEMENT FOR THE COMPONENT
    return (
        <div className="enhanced-picks-container">
            <div className="picks-header">
                <h2>Today's Free Picks</h2>
                <div className="picks-actions">
                    <button className="refresh-button copy-button" onClick={() => {
                        let message = "MLB System Betting Picks\n\n";

                        // 1. List all travel type records
                        if (seasonStats && seasonStats.byType) {
                            message += "**Travel Picks:**\n\n";
                            Object.entries(seasonStats.byType).forEach(([type, stats]) => {
                                message += `${type} [${stats.wins}-${stats.losses}]\n`;
                            });
                            message += "\n";
                        }

                        // 2. Group today's travel picks by matchup type
                        const matchupGroups = {};
                        sortedPicks.travel.forEach(pick => {
                            const homeType = pick.homeTravelType;
                            const awayType = pick.awayTravelType;
                            const matchupKey = `${awayType} vs ${homeType}`;
                            if (!matchupGroups[matchupKey]) matchupGroups[matchupKey] = [];
                            matchupGroups[matchupKey].push(pick);
                        });

                        // 3. Output 'Home to Away vs Away to Home' first if present
                        const specialMatchup = 'Home to Away vs Away to Home';
                        if (matchupGroups[specialMatchup]) {
                            const picks = matchupGroups[specialMatchup];
                            const [awayType, homeType] = specialMatchup.split(' vs ');
                            const awayStats = seasonStats?.byType?.[awayType] || { wins: 0, losses: 0 };
                            const homeStats = seasonStats?.byType?.[homeType] || { wins: 0, losses: 0 };
                            message += `${awayType} [${awayStats.wins}-${awayStats.losses}] vs ${homeType} [${homeStats.wins}-${homeStats.losses}]:\n`;
                            picks.forEach(pick => {
                                const awayOdds = oddsData[pick.gamePk]?.awayTeam ? formatOdds(oddsData[pick.gamePk].awayTeam.odds) : '';
                                const homeOdds = oddsData[pick.gamePk]?.homeTeam ? formatOdds(oddsData[pick.gamePk].homeTeam.odds) : '';
                                message += `${pick.awayTeam?.name || "Away"} [${awayOdds}] @ ${pick.homeTeam?.name || "Home"} [${homeOdds}]\n`;
                            });
                            message += "\n";
                            delete matchupGroups[specialMatchup];
                        }

                        // 4. Output the rest of the matchups
                        Object.entries(matchupGroups).forEach(([matchupKey, picks]) => {
                            const [awayType, homeType] = matchupKey.split(' vs ');
                            const awayStats = seasonStats?.byType?.[awayType] || { wins: 0, losses: 0 };
                            const homeStats = seasonStats?.byType?.[homeType] || { wins: 0, losses: 0 };
                            message += `${awayType} [${awayStats.wins}-${awayStats.losses}] vs ${homeType} [${homeStats.wins}-${homeStats.losses}]:\n`;
                            picks.forEach(pick => {
                                const awayOdds = oddsData[pick.gamePk]?.awayTeam ? formatOdds(oddsData[pick.gamePk].awayTeam.odds) : '';
                                const homeOdds = oddsData[pick.gamePk]?.homeTeam ? formatOdds(oddsData[pick.gamePk].homeTeam.odds) : '';
                                message += `${pick.awayTeam?.name || "Away"} [${awayOdds}] @ ${pick.homeTeam?.name || "Home"} [${homeOdds}]\n`;
                            });
                            message += "\n";
                        });

                        // 5. Fade the Sweep picks
                        message += "Fade The Sweep Picks:\n\n";
                        if (sortedPicks.sweep && sortedPicks.sweep.length > 0) {
                            sortedPicks.sweep.forEach(pick => {
                                message += `${pick.recommendedBet || "Unknown"}\n`;
                            });
                        }

                        // Copy to clipboard
                        navigator.clipboard.writeText(message)
                            .then(() => alert("Picks copied to clipboard!"))
                            .catch(err => console.error("Failed to copy: ", err));
                    }}>
                        Copy Picks
                    </button>
                    <button className="refresh-button" onClick={handleFetchOdds}>
                        Fetch Odds
                    </button>
                </div>
            </div>

            {picksLoading ? (
                <div className="loading">Loading picks...</div>
            ) : (
                <div className="picks-rows">
                    {/* Travel Picks Row */}
                    <div className="pick-row">
                        <h3>Travel Picks ({sortedPicks.travel?.length || 0})</h3>
                        {sortedPicks.travel && sortedPicks.travel.length > 0 ? (
                            <div className="picks-list">
                                {sortedPicks.travel
                                    .filter(pick =>
                                        pick.homeTravelType === 'Home to Home (no Rest)' ||
                                        pick.homeTravelType === 'Home to Home (with Rest)'
                                    )
                                    .map(pick => renderTravelPickCard(pick))}
                            </div>
                        ) : (
                            <div className="no-picks">No travel picks available for today.</div>
                        )}
                    </div>

                    {/* Fade the Sweep Row */}
                    <div className="pick-row">
                        <h3>Fade the Sweep ({sortedPicks.sweep?.length || 0})</h3>
                        {sortedPicks.sweep && sortedPicks.sweep.length > 0 ? (
                            <div className="picks-list">
                                {sortedPicks.sweep.map(pick => renderSweepPickCard(pick))}
                            </div>
                        ) : (
                            <div className="no-picks">No sweep opportunities today.</div>
                        )}
                    </div>

                    {/* K-Rate Unders Row */}
                    <div className="pick-row">
                        <h3>K-Rate Unders ({krateUndersPicks?.length || 0})</h3>
                        {krateUndersPicks && krateUndersPicks.length > 0 ? (
                            <div className="picks-list">
                                {krateUndersPicks.map(opportunity => renderKRateUndersCard(opportunity))}
                            </div>
                        ) : (
                            <div className="no-picks">No K-Rate Under picks available for today.</div>
                        )}
                    </div>

                    {/* Pitching Out Projections Row */}
                    <div className="pick-row">
                        <h3>Pitching Out Projections (0)</h3>
                        <div className="no-picks">No Pitching Out Projections available for today.</div>
                    </div>
                </div>
            )}

            <pre>{JSON.stringify(oddsData, null, 2)}</pre>
        </div>
    );
}

export default EnhancedPicksOfTheDay;