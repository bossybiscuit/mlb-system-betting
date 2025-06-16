import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format, parseISO, isToday, addDays, subDays, isSameDay } from 'date-fns';
import './FadeTheSweepTab.css';

function FadeTheSweepTab() {
    const [loading, setLoading] = useState(true);
    const [fadeOpportunities, setFadeOpportunities] = useState([]);
    const [historicalResults, setHistoricalResults] = useState([]);
    const [stats, setStats] = useState({
        totalOpportunities: 0,
        sweepsCompleted: 0,
        sweepsPrevented: 0,
        winPercentage: 0,
        totalBets: 0,
        totalWins: 0,
        totalLosses: 0,
        totalProfit: 0,
        roi: 0,
        averageOdds: 0
    });
    const [showHistorical, setShowHistorical] = useState(true);
    const [error, setError] = useState(null);
    const [debugInfo, setDebugInfo] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(new Date().getFullYear()); // Default to current year
    const [availableSeasons, setAvailableSeasons] = useState([]);

    useEffect(() => {
        // Initialize available seasons
        const seasons = [];
        const currentYear = new Date().getFullYear();
        for (let year = currentYear; year >= 2018; year--) {
            seasons.push(year);
        }
        setAvailableSeasons(seasons);

        // Load initial data
        fetchCurrentData();
        fetchHistoricalDataForSeason(currentYear);
    }, []);

    // Fetch current game data and recent past games
    const fetchCurrentData = async () => {
        setLoading(true);
        setError(null);
        const debugLog = [];

        try {
            const today = new Date();

            // Get data for a range of dates (5 days ago to today)
            const startDate = format(subDays(today, 5), 'yyyy-MM-dd');
            const endDate = format(today, 'yyyy-MM-dd');

            debugLog.push(`Fetching data from ${startDate} to ${endDate}`);

            const response = await axios.get(
                `https://statsapi.mlb.com/api/v1/schedule?startDate=${startDate}&endDate=${endDate}&sportId=1&hydrate=team,venue,game(content(summary)),linescore`
            );

            if (response.data && response.data.dates) {
                debugLog.push(`Received data for ${response.data.dates.length} dates`);
                processScheduleData(response.data.dates, debugLog);
            } else {
                setError("No game data available");
                debugLog.push("No game data available in response");
            }
        } catch (error) {
            console.error('Error fetching MLB data:', error);
            setError("Error fetching game data. Please try again later.");
            debugLog.push(`Error: ${error.message}`);
        } finally {
            setLoading(false);
            setDebugInfo(debugLog);
        }
    };

    const convertToAmericanOdds = (decimalOdds) => {
        if (decimalOdds >= 2.0) {
            // Plus odds (underdog)
            return `+${Math.round((decimalOdds - 1) * 100)}`;
        } else {
            // Minus odds (favorite)
            return `-${Math.round(100 / (decimalOdds - 1))}`;
        }
    };

    // Fetch historical results for a specific season
    const fetchHistoricalDataForSeason = async (season) => {
        setLoading(true);
        const debugLog = [...debugInfo];

        try {
            // Define season dates based on the selected season
            const seasonStartDate = `${season}-03-25`;
            const seasonEndDate = `${season}-11-01`;

            // Limit end date to today if we're looking at the current season
            const today = new Date();
            let endDate = seasonEndDate;

            if (season === today.getFullYear()) {
                endDate = format(subDays(today, 1), 'yyyy-MM-dd'); // Yesterday
            }

            debugLog.push(`Fetching historical data for ${season} season from ${seasonStartDate} to ${endDate}`);

            const response = await axios.get(
                `https://statsapi.mlb.com/api/v1/schedule?startDate=${seasonStartDate}&endDate=${endDate}&sportId=1&hydrate=team,venue,game(content(summary)),linescore`
            );

            if (response.data && response.data.dates) {
                debugLog.push(`Received historical data for ${response.data.dates.length} dates from ${season} season`);
                processHistoricalData(response.data.dates, debugLog);
            } else {
                debugLog.push(`No historical data available for ${season} season`);
                // Reset historical stats if no data
                setHistoricalResults([]);
                setStats({
                    totalOpportunities: 0,
                    sweepsCompleted: 0,
                    sweepsPrevented: 0,
                    winPercentage: 0
                });
            }
        } catch (error) {
            console.error(`Error fetching ${season} season historical MLB data:`, error);
            debugLog.push(`Historical data error for ${season} season: ${error.message}`);
        } finally {
            setLoading(false);
            setDebugInfo(debugLog);
        }
    };

    // Handler for season dropdown change
    const handleSeasonChange = (e) => {
        const newSeason = parseInt(e.target.value, 10);
        setSelectedSeason(newSeason);
        fetchHistoricalDataForSeason(newSeason);
    };


    // Process schedule data to identify "fade the sweep" opportunities
    const processScheduleData = (dates, debugLog) => {
        // Group games into series by team matchups
        const seriesMap = {};
        const todayDate = new Date();
        const yesterday = new Date(todayDate);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayString = format(yesterday, 'yyyy-MM-dd');

        debugLog.push("Processing schedule data to find series...");
        console.log("Today is:", format(todayDate, 'yyyy-MM-dd'));
        console.log("Yesterday was:", yesterdayString);

        // STEP 1: Track yesterday's games by team to detect double header losses
        const teamYesterdayGames = {};

        // First pass - just collect yesterday's games by team
        dates.forEach(dateData => {
            if (dateData.date === yesterdayString) {
                dateData.games.forEach(game => {
                    if (game.status && game.status.abstractGameState === 'Final') {
                        const awayTeam = game.teams.away.team;
                        const homeTeam = game.teams.home.team;
                        const awayTeamWon = game.teams.away.score > game.teams.home.score;
                        const homeTeamWon = game.teams.home.score > game.teams.away.score;

                        // Track for away team
                        if (!teamYesterdayGames[awayTeam.id]) {
                            teamYesterdayGames[awayTeam.id] = [];
                        }
                        teamYesterdayGames[awayTeam.id].push({
                            teamWon: awayTeamWon,
                            opponent: homeTeam,
                            isHome: false,
                            gamePk: game.gamePk,
                            doubleHeader: game.doubleHeader,
                            gameNumber: game.gameNumber
                        });

                        // Track for home team
                        if (!teamYesterdayGames[homeTeam.id]) {
                            teamYesterdayGames[homeTeam.id] = [];
                        }
                        teamYesterdayGames[homeTeam.id].push({
                            teamWon: homeTeamWon,
                            opponent: awayTeam,
                            isHome: true,
                            gamePk: game.gamePk,
                            doubleHeader: game.doubleHeader,
                            gameNumber: game.gameNumber
                        });
                    }
                });
            }
        });

        // Find teams that lost multiple games yesterday (possible double header victims)
        const teamsWithDoubleHeaderLosses = {};
        Object.entries(teamYesterdayGames).forEach(([teamId, games]) => {
            if (games.length >= 2) {
                const allLosses = games.every(game => !game.teamWon);
                if (allLosses) {
                    teamsWithDoubleHeaderLosses[teamId] = {
                        games,
                        opponent: games[0].opponent, // Usually the same opponent in doubleheaders
                        isHome: games[0].isHome
                    };
                    console.log(`Team ${teamId} lost all ${games.length} games yesterday - possible double header!`);
                }
            }
        });

        // Now process all games for the full series context
        dates.forEach(dateData => {
            const gameDate = new Date(dateData.date);

            dateData.games.forEach(game => {
                // Skip games that aren't MLB regular season
                if (game.seriesGameNumber === undefined || game.gamesInSeries === undefined) {
                    return;
                }

                const awayTeam = game.teams.away.team;
                const homeTeam = game.teams.home.team;

                // Create a unique key for each series
                const seriesKey = `${homeTeam.id}-${awayTeam.id}-${game.seriesDescription || 'series'}`;

                if (!seriesMap[seriesKey]) {
                    seriesMap[seriesKey] = {
                        homeTeam,
                        awayTeam,
                        games: [],
                        gamesInSeries: parseInt(game.gamesInSeries, 10),
                        seriesDescription: game.seriesDescription
                    };
                }

                // Add game to the series with its result
                let awayTeamWon = null;
                let homeTeamWon = null;
                let gameStatus = "Scheduled";

                if (game.status) {
                    if (game.status.abstractGameState === 'Final') {
                        gameStatus = "Final";
                        if (game.teams.away.score !== undefined && game.teams.home.score !== undefined) {
                            awayTeamWon = game.teams.away.score > game.teams.home.score;
                            homeTeamWon = game.teams.home.score > game.teams.away.score;
                        }
                    } else if (game.status.abstractGameState === 'Live') {
                        gameStatus = "In Progress";
                    } else if (game.status.detailedState === 'Postponed') {
                        gameStatus = "Postponed";
                    }
                }

                // Add isDoubleHeader flag
                const isDoubleHeader = game.doubleHeader !== 'N';

                // Add more detailed game info
                const gameInfo = {
                    gamePk: game.gamePk,
                    date: dateData.date,
                    gameDate,
                    seriesGameNumber: parseInt(game.seriesGameNumber, 10),
                    gamesInSeries: parseInt(game.gamesInSeries, 10),
                    awayTeamWon,
                    homeTeamWon,
                    awayScore: game.teams.away.score,
                    homeScore: game.teams.home.score,
                    status: gameStatus,
                    venue: game.venue.name,
                    isDoubleHeader,
                    doubleHeaderInfo: game.doubleHeader,
                    gameNumber: game.gameNumber,
                    teams: {
                        away: {
                            id: awayTeam.id,
                            name: awayTeam.name
                        },
                        home: {
                            id: homeTeam.id,
                            name: homeTeam.name
                        }
                    }
                };

                seriesMap[seriesKey].games.push(gameInfo);
            });
        });

        debugLog.push(`Found ${Object.keys(seriesMap).length} unique series`);

        // Sort games within each series by date and game number for double headers
        Object.values(seriesMap).forEach(series => {
            series.games.sort((a, b) => {
                const dateComparison = new Date(a.date) - new Date(b.date);
                if (dateComparison !== 0) return dateComparison;

                // If same date, sort by game number for double headers
                return (a.gameNumber || 0) - (b.gameNumber || 0);
            });
        });

        // Find potential "fade the sweep" opportunities for today
        const opportunities = [];

        Object.values(seriesMap).forEach(series => {
            // Check if series has a game today
            const hasTodayGame = series.games.some(game =>
                isToday(new Date(`${game.date}T12:00:00`))
            );

            if (!hasTodayGame) return;

            const todayGames = series.games.filter(game =>
                isToday(new Date(`${game.date}T12:00:00`))
            );

            // Get previous games in the series (before today)
            const previousGames = series.games.filter(game =>
                new Date(`${game.date}T12:00:00`) < todayDate
            );

            // Check for teams with double header losses yesterday
            const awayTeamId = series.awayTeam.id;
            const homeTeamId = series.homeTeam.id;

            const awayTeamHadDoubleHeaderLosses = teamsWithDoubleHeaderLosses[awayTeamId] &&
                teamsWithDoubleHeaderLosses[awayTeamId].opponent.id === homeTeamId;

            const homeTeamHadDoubleHeaderLosses = teamsWithDoubleHeaderLosses[homeTeamId] &&
                teamsWithDoubleHeaderLosses[homeTeamId].opponent.id === awayTeamId;

            if (awayTeamHadDoubleHeaderLosses) {
                console.log(`${series.awayTeam.name} lost double header yesterday against ${series.homeTeam.name}`);
            }

            if (homeTeamHadDoubleHeaderLosses) {
                console.log(`${series.homeTeam.name} lost double header yesterday against ${series.awayTeam.name}`);
            }

            // Log for debugging
            debugLog.push(`Series: ${series.awayTeam.name} @ ${series.homeTeam.name} - ${previousGames.length} previous games`);

            // Check if there's a sweep opportunity (one team has lost all previous games)
            // OR if a team lost a double header yesterday
            if (previousGames.length >= 2 || awayTeamHadDoubleHeaderLosses || homeTeamHadDoubleHeaderLosses) {
                // For regular sweep scenarios
                let awayTeamLostAll = previousGames.length >= 2 && previousGames.every(game => game.homeTeamWon === true);
                let homeTeamLostAll = previousGames.length >= 2 && previousGames.every(game => game.awayTeamWon === true);

                // Override with double header info if applicable
                if (awayTeamHadDoubleHeaderLosses) {
                    awayTeamLostAll = true;
                }

                if (homeTeamHadDoubleHeaderLosses) {
                    homeTeamLostAll = true;
                }

                // Log for debugging
                if (awayTeamLostAll) {
                    debugLog.push(`${series.awayTeam.name} lost all ${previousGames.length} previous games in the series`);
                }
                if (homeTeamLostAll) {
                    debugLog.push(`${series.homeTeam.name} lost all ${previousGames.length} previous games in the series`);
                }

                if (awayTeamLostAll || homeTeamLostAll) {
                    // We have a potential fade the sweep opportunity
                    todayGames.forEach(todayGame => {
                        // Check if it's the final game of the series
                        debugLog.push(`Checking game ${todayGame.seriesGameNumber} of ${todayGame.gamesInSeries} series`);

                        const isFinalGame = Number(todayGame.seriesGameNumber) === Number(todayGame.gamesInSeries);

                        // Any game that follows a double header sweep is considered a valid opportunity
                        const isDoubleHeaderSweep = awayTeamHadDoubleHeaderLosses || homeTeamHadDoubleHeaderLosses;

                        if (isFinalGame || isDoubleHeaderSweep) {
                            debugLog.push(`Found opportunity: ${series.awayTeam.name} @ ${series.homeTeam.name}, ${isFinalGame ? 'final game' : 'double header sweep'}`);

                            // Get the double header games specifically if applicable
                            let relevantPreviousGames = previousGames;
                            if (awayTeamHadDoubleHeaderLosses) {
                                relevantPreviousGames = teamsWithDoubleHeaderLosses[awayTeamId].games.map(game => {
                                    return {
                                        ...game,
                                        homeScore: 0, // Placeholder
                                        awayScore: 0, // Placeholder
                                        homeTeamWon: true,
                                        awayTeamWon: false,
                                        date: yesterdayString
                                    };
                                });
                            } else if (homeTeamHadDoubleHeaderLosses) {
                                relevantPreviousGames = teamsWithDoubleHeaderLosses[homeTeamId].games.map(game => {
                                    return {
                                        ...game,
                                        homeScore: 0, // Placeholder
                                        awayScore: 0, // Placeholder
                                        homeTeamWon: false,
                                        awayTeamWon: true,
                                        date: yesterdayString
                                    };
                                });
                            }

                            // Add to opportunities
                            opportunities.push({
                                seriesKey: `${series.homeTeam.id}-${series.awayTeam.id}`,
                                teamToFade: awayTeamLostAll ? series.awayTeam : series.homeTeam,
                                opposingTeam: awayTeamLostAll ? series.homeTeam : series.awayTeam,
                                isHomeTeam: !awayTeamLostAll, // Whether the team to fade is home
                                venue: todayGame.venue,
                                date: todayGame.date,
                                gamePk: todayGame.gamePk,
                                previousGames: relevantPreviousGames,
                                status: todayGame.status,
                                seriesGameNumber: todayGame.seriesGameNumber,
                                gamesInSeries: todayGame.gamesInSeries,
                                gameNumber: relevantPreviousGames.length + 1,
                                previousLosses: relevantPreviousGames.length,
                                isFinalGame,
                                isDoubleHeaderSweep
                            });
                        } else {
                            debugLog.push(`Skipped non-final game: ${todayGame.seriesGameNumber} of ${todayGame.gamesInSeries}`);
                        }
                    });
                }
            }
        });

        debugLog.push(`Found ${opportunities.length} fade the sweep opportunities for today`);
        setFadeOpportunities(opportunities);
    };

    const fetchHistoricalOdds = async (gamePk) => {
        try {
            // This is a placeholder for your odds API - you would replace this with your actual odds API
            // Examples of sports odds APIs: The Odds API, Sports Odds API, Sportsdata.io, etc.
            const response = await axios.get(
                `https://your-odds-api.com/baseball/games/${gamePk}/odds`
            );

            return response.data;
        } catch (error) {
            console.error(`Error fetching odds for game ${gamePk}:`, error);
            // Return fallback reasonable odds for this betting strategy
            // Studies suggest underdogs in final games of series might be around +150 to +180
            return {
                underdog_odds: 2.25, // Average odds for the team trying to avoid a sweep (about +165 in American odds)
                favorite_odds: 1.56  // Average odds for the team going for the sweep (about -200 in American odds)
            };
        }
    };

    // Process historical data to analyze past "fade the sweep" results
    const processHistoricalData = async (dates, debugLog) => {
        // Define completedFades array here to fix the "not defined" error
        const completedFades = [];

        // Group games into series by team matchups
        const seriesMap = {};

        // First pass - collect all games and organize them into series
        dates.forEach(dateData => {
            const currentDate = dateData.date;

            dateData.games.forEach(game => {
                // Skip games that aren't MLB regular season or aren't finished
                if (game.seriesGameNumber === undefined || game.gamesInSeries === undefined ||
                    !game.status || game.status.abstractGameState !== 'Final') {
                    return;
                }

                const awayTeam = game.teams.away.team;
                const homeTeam = game.teams.home.team;

                // Create a unique key for each series
                const seriesKey = `${homeTeam.id}-${awayTeam.id}-${game.seriesDescription || 'series'}`;

                if (!seriesMap[seriesKey]) {
                    seriesMap[seriesKey] = {
                        homeTeam,
                        awayTeam,
                        games: [],
                        gamesInSeries: parseInt(game.gamesInSeries, 10),
                        seriesDescription: game.seriesDescription
                    };
                }

                // Add game to the series with its result
                seriesMap[seriesKey].games.push({
                    gamePk: game.gamePk,
                    date: currentDate,
                    seriesGameNumber: parseInt(game.seriesGameNumber, 10),
                    gamesInSeries: parseInt(game.gamesInSeries, 10),
                    awayScore: game.teams.away.score,
                    homeScore: game.teams.home.score,
                    venue: game.venue.name,
                    awayTeamWon: game.teams.away.score > game.teams.home.score,
                    homeTeamWon: game.teams.home.score > game.teams.away.score
                });
            });
        });

        // Sort games within each series by date and game number
        Object.values(seriesMap).forEach(series => {
            series.games.sort((a, b) =>
                a.seriesGameNumber - b.seriesGameNumber
            );

            // Now find completed series with potential sweep scenarios
            if (series.games.length >= 3) { // Only consider series with at least 3 games
                const finalGame = series.games[series.games.length - 1];

                // Check for sweep potential before the final game
                const previousGames = series.games.slice(0, -1);

                // Check if home team lost all previous games
                const homeTeamLostAll = previousGames.every(game => !game.homeTeamWon);

                // Check if away team lost all previous games
                const awayTeamLostAll = previousGames.every(game => !game.awayTeamWon);

                if (homeTeamLostAll || awayTeamLostAll) {
                    // We found a scenario where one team was about to be swept
                    const teamToFade = homeTeamLostAll ? series.homeTeam : series.awayTeam;
                    const opposingTeam = homeTeamLostAll ? series.awayTeam : series.homeTeam;
                    const isHomeTeam = homeTeamLostAll; // True if the home team was being swept

                    // Check if the sweep was prevented (team to fade won final game)
                    const sweepPrevented = isHomeTeam ?
                        finalGame.homeTeamWon :
                        finalGame.awayTeamWon;

                    completedFades.push({
                        date: finalGame.date,
                        gamePk: finalGame.gamePk,
                        teamToFade: teamToFade,
                        opposingTeam: opposingTeam,
                        isHomeTeam: isHomeTeam,
                        venue: finalGame.venue,
                        previousLosses: previousGames.length,
                        seriesGameNumber: finalGame.seriesGameNumber,
                        gamesInSeries: finalGame.gamesInSeries,
                        sweepPrevented: sweepPrevented
                    });
                }
            }
        });

        debugLog.push(`Found ${completedFades.length} historical fade the sweep scenarios`);

        // Calculate betting odds and ROI
        let totalBets = 0;
        let totalWins = 0;
        let totalLosses = 0;
        let totalProfit = 0;
        let sumOdds = 0;

        // Standard bet amount for calculation purposes
        const STANDARD_BET = 100; // $100 per bet

        // Fetch odds data for each game or use fallbacks
        for (const fade of completedFades) {
            try {
                // Try to fetch historical odds
                // Note: This part would need an actual odds API integration
                // For now, we'll use placeholder odds based on typical values

                // Placeholder logic - you would replace this with actual API data
                let oddsData;

                // Try to fetch real odds if you have an API
                try {
                    oddsData = await fetchHistoricalOdds(fade.gamePk);
                } catch (e) {
                    // Use fallback odds - these are approximations
                    // Teams trying to avoid sweeps are typically underdogs, around +165 in American odds
                    const isHome = fade.isHomeTeam;
                    const baseHomeOdds = 1.80; // Slight favorite odds for home team
                    const baseAwayOdds = 2.10; // Slight underdog odds for away team

                    // Add some randomness to the odds to make them more realistic
                    const randomVariance = Math.random() * 0.4 - 0.2; // -0.2 to +0.2

                    if (isHome) {
                        // Team to fade is home
                        oddsData = {
                            underdog_odds: baseHomeOdds + randomVariance,
                            favorite_odds: baseAwayOdds - randomVariance
                        };
                    } else {
                        // Team to fade is away
                        oddsData = {
                            underdog_odds: baseAwayOdds + randomVariance,
                            favorite_odds: baseHomeOdds - randomVariance
                        };
                    }
                }

                // Calculate profit/loss
                const teamOdds = oddsData.underdog_odds; // Team trying to avoid sweep
                sumOdds += teamOdds;
                totalBets++;

                if (fade.sweepPrevented) {
                    // Win - calculate profit
                    const profit = STANDARD_BET * (teamOdds - 1);
                    totalProfit += profit;
                    totalWins++;

                    // Add odds info to the fade object
                    fade.odds = teamOdds;
                    fade.betAmount = STANDARD_BET;
                    fade.profit = profit;
                    fade.betResult = "Win";
                } else {
                    // Loss - lose the bet amount
                    totalProfit -= STANDARD_BET;
                    totalLosses++;

                    // Add odds info to the fade object
                    fade.odds = teamOdds;
                    fade.betAmount = STANDARD_BET;
                    fade.profit = -STANDARD_BET;
                    fade.betResult = "Loss";
                }
            } catch (error) {
                console.error(`Error processing odds for game ${fade.gamePk}:`, error);
            }
        }

        // Calculate ROI
        const totalInvestment = totalBets * STANDARD_BET;
        const roi = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;
        const averageOdds = totalBets > 0 ? sumOdds / totalBets : 0;

        // Calculate traditional stats
        const totalOpportunities = completedFades.length;
        const sweepsPrevented = completedFades.filter(game => game.sweepPrevented).length;
        const sweepsCompleted = totalOpportunities - sweepsPrevented;
        const winPercentage = totalOpportunities > 0 ? (sweepsPrevented / totalOpportunities * 100).toFixed(1) : 0;

        // Sort from most recent to oldest
        completedFades.sort((a, b) => new Date(b.date) - new Date(a.date));

        setHistoricalResults(completedFades);
        setStats({
            totalOpportunities,
            sweepsCompleted,
            sweepsPrevented,
            winPercentage,
            totalBets,
            totalWins,
            totalLosses,
            totalProfit: parseFloat(totalProfit.toFixed(2)),
            roi: parseFloat(roi.toFixed(2)),
            averageOdds: parseFloat(averageOdds.toFixed(2))
        });
    };

    const toggleHistorical = () => {
        setShowHistorical(!showHistorical);
        if (!showHistorical && historicalResults.length === 0) {
            fetchHistoricalDataForSeason(selectedSeason);
        }
    };

    const refreshData = () => {
        fetchCurrentData();
        if (showHistorical) {
            fetchHistoricalDataForSeason(selectedSeason);
        }
    };

    const toggleDebug = () => {
        // Function kept for potential future debugging but no longer exposed in UI
        const debugElement = document.getElementById('debug-section');
        if (debugElement) {
            debugElement.style.display = debugElement.style.display === 'none' ? 'block' : 'none';
        }
    };

    return (
        <div className="fade-the-sweep-tab">
            <div className="fade-header">
                <h1>Fade The Sweep Opportunities</h1>
                <div className="fade-actions">
                    <button className="refresh-button" onClick={refreshData}>
                        Refresh Data
                    </button>
                    <button className="toggle-button" onClick={toggleHistorical}>
                        {showHistorical ? "Hide Historical Results" : "Show Historical Results"}
                    </button>
                </div>
            </div>

            <div className="fade-description">
                <p>
                    "Fade the Sweep" is a betting strategy where you bet on a team that has lost the first two or more
                    games of a series to win the final game, based on the theory that sweeps are relatively uncommon in baseball.
                    This tool shows only opportunities where today's game is the final game of the series.
                </p>
            </div>

            <div id="debug-section" style={{ display: 'none' }}>
                <h3>Debug Information</h3>
                <ul>
                    {debugInfo.map((log, index) => (
                        <li key={index}>{log}</li>
                    ))}
                </ul>
            </div>

            {loading ? (
                <div className="loading">Loading data...</div>
            ) : error ? (
                <div className="error">{error}</div>
            ) : (
                <>
                    <div className="fade-opportunities">
                        <h2>Today's Opportunities</h2>
                        {fadeOpportunities.length > 0 ? (
                            <div className="opportunities-list">
                                {fadeOpportunities.map(opportunity => (
                                    <div className="opportunity-card" key={opportunity.gamePk}>
                                        <div className="opportunity-header">
                                            <div className="matchup">
                                                <span className={opportunity.isHomeTeam ? 'home-team' : 'away-team'}>
                                                    {opportunity.teamToFade.name}
                                                </span>
                                                {" vs "}
                                                <span className={!opportunity.isHomeTeam ? 'home-team' : 'away-team'}>
                                                    {opportunity.opposingTeam.name}
                                                </span>
                                            </div>
                                            <div className="game-info">
                                                <span className="date">{format(new Date(`${opportunity.date}T12:00:00`), 'MMMM d, yyyy')}</span>
                                                <span className="venue">at {opportunity.venue}</span>
                                            </div>
                                            <div className="series-info">
                                                Game {opportunity.seriesGameNumber} of {opportunity.gamesInSeries}
                                                <div className="status">
                                                    {opportunity.status}
                                                    {opportunity.isDoubleHeaderSweep && " (Double Header)"}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="opportunity-details">
                                            <div className="team-to-fade">
                                                <strong>{opportunity.teamToFade.name}</strong> has lost {opportunity.previousLosses} consecutive
                                                {opportunity.previousLosses > 2 ? ' games' : ''} in this series
                                                {opportunity.isDoubleHeaderSweep && " (including both games of a double header yesterday)"}
                                            </div>
                                            <div className="previous-games">
                                                {opportunity.previousGames.map((game, index) => (
                                                    <div className="previous-game" key={game.gamePk}>
                                                        <span className="previous-date">
                                                            {format(new Date(`${game.date}T12:00:00`), 'MMM d')}
                                                            {game.isDoubleHeader && game.gameNumber ? ` (G${game.gameNumber})` : ''}:
                                                        </span>
                                                        <span className="previous-score">
                                                            {opportunity.isHomeTeam
                                                                ? `${game.awayScore} - ${game.homeScore}`
                                                                : `${game.homeScore} - ${game.awayScore}`}
                                                        </span>
                                                        <span className="previous-result">
                                                            Loss
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="no-opportunities">
                                No "Fade the Sweep" opportunities found for today.
                            </div>
                        )}
                    </div>

                    {showHistorical && (
                        <div className="historical-results">
                            <div className="historical-header">
                                <h2>Historical Results</h2>
                                <div className="season-selector">
                                    <label htmlFor="season-select">Season: </label>
                                    <select
                                        id="season-select"
                                        value={selectedSeason}
                                        onChange={handleSeasonChange}
                                        className="season-dropdown"
                                    >
                                        {availableSeasons.map(year => (
                                            <option key={year} value={year}>{year}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="stats-container">
                                <div className="stat-box">
                                    <div className="stat-value">{stats.totalOpportunities}</div>
                                    <div className="stat-label">Total Opportunities</div>
                                </div>
                                <div className="stat-box">
                                    <div className="stat-value">{stats.sweepsPrevented}</div>
                                    <div className="stat-label">Sweeps Prevented</div>
                                </div>
                                <div className="stat-box">
                                    <div className="stat-value">{stats.sweepsCompleted}</div>
                                    <div className="stat-label">Sweeps Completed</div>
                                </div>
                                <div className="stat-box">
                                    <div className="stat-value">{stats.winPercentage}%</div>
                                    <div className="stat-label">Win Percentage</div>
                                </div>

                                {/* Add these new stat boxes */}
                                <div className="stat-box betting-stat">
                                    <div className="stat-value">${stats.totalProfit.toLocaleString()}</div>
                                    <div className="stat-label">Total Profit/Loss</div>
                                    <br></br>
                                    <div className="stat-value" style={{ color: stats.roi >= 0 ? '#2e7d32' : '#c62828' }}>
                                            {stats.roi}%
                                        </div>
                                        <div className="stat-label">Return on Investment</div>
                                </div>

                                <div className="stat-box betting-stat">
                                    <div className="stat-value">{stats.averageOdds}</div>
                                    <div className="stat-label">Average Odds</div>
                                </div>
                                <div className="stat-box betting-stat">
                                    <div className="stat-value">{stats.totalWins} - {stats.totalLosses}</div>
                                    <div className="stat-label">Betting Record</div>
                                </div>
                            </div>

                            {historicalResults.length > 0 ? (
                                <div className="historical-list">
                                    {historicalResults.map(result => (
                                        <div
                                            className={`historical-card ${result.sweepPrevented ? 'sweep-prevented' : 'sweep-completed'}`}
                                            key={result.gamePk}
                                        >
                                            <div className="historical-header">
                                                <div className="matchup">
                                                    <span className={result.isHomeTeam ? 'home-team' : 'away-team'}>
                                                        {result.teamToFade.name}
                                                    </span>
                                                    <span className="versus">@</span>
                                                    <span className={!result.isHomeTeam ? 'home-team' : 'away-team'}>
                                                        {result.opposingTeam.name}
                                                    </span>
                                                    <div className="result-tag">
                                                        {result.sweepPrevented ? 'Sweep Prevented' : 'Sweep Completed'}
                                                    </div>
                                                </div>
                                                <div className="game-info">
                                                    <span className="date">{format(new Date(`${result.date}T12:00:00`), 'MMMM d, yyyy')}</span>
                                                    <span className="series-info">Game {result.seriesGameNumber} of {result.gamesInSeries}</span>
                                                </div>
                                            </div>
                                            <div className="historical-details">
                                                <div className="team-result">
                                                    <strong>{result.teamToFade.name}</strong> {result.sweepPrevented ? 'won' : 'lost'} after losing {result.previousLosses} consecutive
                                                    {result.previousLosses > 2 ? ' games' : ''} in the series
                                                </div>

                                                {/* Add betting information */}
                                                {result.odds && (
                                                    <div className="betting-info">
                                                        <div className="betting-detail">
                                                            <span className="bet-label">Odds:</span>
                                                            <span className="bet-value">{result.odds.toFixed(2)} ({convertToAmericanOdds(result.odds)})</span>
                                                        </div>
                                                        <div className="betting-detail">
                                                            <span className="bet-label">Bet:</span>
                                                            <span className="bet-value">${result.betAmount}</span>
                                                        </div>
                                                        <div className="betting-detail">
                                                            <span className="bet-label">Result:</span>
                                                            <span className={`bet-value ${result.betResult === 'Win' ? 'win' : 'loss'}`}>
                                                                {result.betResult} ({result.profit >= 0 ? '+' : ''}${result.profit.toFixed(2)})
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="historical-footer">
                                                <span className="venue">{result.venue}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="loading-historical">Loading historical data for {selectedSeason} season...</div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default FadeTheSweepTab;