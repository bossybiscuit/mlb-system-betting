import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format, parseISO, isToday, addDays, subDays, isSameDay } from 'date-fns';
import { fetchOdds, formatOdds } from '../services/oddsApi';
import './FadeTheRockiesTab.css';

function FadeTheRockiesTab() {
    const [loading, setLoading] = useState(true);
    const [rockiesGames, setRockiesGames] = useState([]);
    const [historicalResults, setHistoricalResults] = useState([]);
    const [stats, setStats] = useState({
        totalOpportunities: 0,
        rockiesLosses: 0,
        rockiesWins: 0,
        winPercentage: 0,
        coverPercentage: 0,
        totalCover: 0
    });
    const [showHistorical, setShowHistorical] = useState(true); // Always true now
    const [error, setError] = useState(null);
    const [oddsData, setOddsData] = useState({});

    // Constants
    const ROCKIES_TEAM_ID = 115; // MLB API ID for Colorado Rockies

    useEffect(() => {
        fetchCurrentData();
        fetchHistoricalData();
    }, []);

    // Fetch data for the whole season
    const fetchCurrentData = async () => {
        setLoading(true);
        setError(null);

        try {
            const today = new Date();

            // Get data for a range of dates (today + 7 days)
            const startDate = format(today, 'yyyy-MM-dd');
            const endDate = format(addDays(today, 7), 'yyyy-MM-dd');

            const response = await axios.get(
                `https://statsapi.mlb.com/api/v1/schedule?startDate=${startDate}&endDate=${endDate}&sportId=1&hydrate=team,venue,game(content(summary)),linescore,game(date)`
            );

            if (response.data && response.data.dates) {
                processScheduleData(response.data.dates);
            } else {
                setError("No game data available");
            }
        } catch (error) {
            console.error('Error fetching MLB data:', error);
            setError("Error fetching game data. Please try again later.");
        } finally {
            setLoading(false);
        }
    };

    // Fetch historical results of Rockies games
    const fetchHistoricalData = async () => {
        setLoading(true);

        try {
            // Get past data to analyze historical Rockies results
            const today = new Date();
            // Set the season start to March 28th of the current year
            const seasonStart = new Date(today.getFullYear(), 2, 28); // March 28th (month is 0-indexed)

            const startDate = format(seasonStart, 'yyyy-MM-dd');
            const endDate = format(subDays(today, 1), 'yyyy-MM-dd'); // Yesterday

            const response = await axios.get(
                `https://statsapi.mlb.com/api/v1/schedule?startDate=${startDate}&endDate=${endDate}&sportId=1&hydrate=team,venue,game(content(summary)),linescore&teamId=${ROCKIES_TEAM_ID}`
            );

            if (response.data && response.data.dates) {
                processHistoricalData(response.data.dates);
            }
        } catch (error) {
            console.error('Error fetching historical MLB data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Process schedule data to find Rockies games
    const processScheduleData = (dates) => {
        const rockiesGamesList = [];

        dates.forEach(dateData => {
            const currentDate = dateData.date;

            dateData.games.forEach(game => {
                // Check if Rockies are playing in this game
                const awayTeam = game.teams.away.team;
                const homeTeam = game.teams.home.team;

                if (awayTeam.id === ROCKIES_TEAM_ID || homeTeam.id === ROCKIES_TEAM_ID) {
                    // Determine if Rockies are home or away
                    const isRockiesHome = homeTeam.id === ROCKIES_TEAM_ID;
                    const opponent = isRockiesHome ? awayTeam : homeTeam;

                    // Get game status and potential result
                    let gameStatus = "Scheduled";
                    let rockiesScore = null;
                    let opponentScore = null;
                    let run_line_cover = null;
                    let gameTime = null;

                    if (game.gameDate) {
                        // Format the game time
                        const gameDateTime = new Date(game.gameDate);
                        gameTime = format(gameDateTime, 'h:mm a');
                    }

                    if (game.status) {
                        if (game.status.abstractGameState === 'Final') {
                            gameStatus = "Final";

                            if (game.teams.away.score !== undefined && game.teams.home.score !== undefined) {
                                rockiesScore = isRockiesHome ? game.teams.home.score : game.teams.away.score;
                                opponentScore = isRockiesHome ? game.teams.away.score : game.teams.home.score;

                                // Calculate if opponent covered -1.5 run line
                                run_line_cover = (opponentScore - rockiesScore > 1);
                            }
                        } else if (game.status.abstractGameState === 'Live') {
                            gameStatus = "In Progress";
                            rockiesScore = isRockiesHome ? game.teams.home.score : game.teams.away.score;
                            opponentScore = isRockiesHome ? game.teams.away.score : game.teams.home.score;
                        } else if (game.status.detailedState === 'Postponed') {
                            gameStatus = "Postponed";
                        }
                    }

                    rockiesGamesList.push({
                        gamePk: game.gamePk,
                        date: currentDate,
                        gameDate: new Date(currentDate),
                        gameTime: gameTime,
                        opponent: opponent,
                        isRockiesHome: isRockiesHome,
                        venue: game.venue.name,
                        status: gameStatus,
                        rockiesScore: rockiesScore,
                        opponentScore: opponentScore,
                        run_line_cover: run_line_cover
                    });
                }
            });
        });

        // Sort games by date
        rockiesGamesList.sort((a, b) => new Date(a.date) - new Date(b.date));

        setRockiesGames(rockiesGamesList);
    };

    // Process historical data to analyze past Rockies games
    const processHistoricalData = (dates) => {
        const rockiesGamesList = [];

        dates.forEach(dateData => {
            const currentDate = dateData.date;

            dateData.games.forEach(game => {
                // Check if Rockies are playing in this game
                const awayTeam = game.teams.away.team;
                const homeTeam = game.teams.home.team;

                if (awayTeam.id === ROCKIES_TEAM_ID || homeTeam.id === ROCKIES_TEAM_ID) {
                    // Determine if Rockies are home or away
                    const isRockiesHome = homeTeam.id === ROCKIES_TEAM_ID;
                    const opponent = isRockiesHome ? awayTeam : homeTeam;

                    // Skip games that aren't finished or were postponed/canceled
                    if (game.status && game.status.abstractGameState === 'Final' &&
                        game.status.statusCode === 'F' &&
                        game.teams.away.score !== undefined && game.teams.home.score !== undefined) {

                        const rockiesScore = isRockiesHome ? game.teams.home.score : game.teams.away.score;
                        const opponentScore = isRockiesHome ? game.teams.away.score : game.teams.home.score;

                        // Calculate if opponent covered -1.5 run line
                        const run_line_cover = (opponentScore - rockiesScore > 1);
                        const rockiesWon = rockiesScore > opponentScore;
                        const margin = Math.abs(opponentScore - rockiesScore);

                        // Only add games with valid scores and margins
                        if (!isNaN(margin)) {
                            rockiesGamesList.push({
                                gamePk: game.gamePk,
                                date: currentDate,
                                gameDate: new Date(currentDate),
                                opponent: opponent,
                                isRockiesHome: isRockiesHome,
                                venue: game.venue.name,
                                rockiesScore: rockiesScore,
                                opponentScore: opponentScore,
                                rockiesWon: rockiesWon,
                                run_line_cover: run_line_cover,
                                margin: margin
                            });
                        }
                    }
                }
            });
        });

        // Sort games by date (most recent first for historical view)
        rockiesGamesList.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Calculate stats
        const totalOpportunities = rockiesGamesList.length;
        const totalCover = rockiesGamesList.filter(game => game.run_line_cover).length;
        const runLineLosses = totalOpportunities - totalCover;
        const rockiesWins = rockiesGamesList.filter(game => game.rockiesWon).length;
        const rockiesLosses = totalOpportunities - rockiesWins;

        const winPercentage = totalOpportunities > 0 ? ((rockiesLosses / totalOpportunities) * 100).toFixed(1) : 0;
        const coverPercentage = totalOpportunities > 0 ? ((totalCover / totalOpportunities) * 100).toFixed(1) : 0;

        setHistoricalResults(rockiesGamesList);
        setStats({
            totalOpportunities,
            rockiesLosses,
            rockiesWins,
            winPercentage,
            coverPercentage,
            totalCover,
            runLineLosses
        });
    };

    const handleFetchOdds = async () => {
        if (!rockiesGames || rockiesGames.length === 0) return;
        const gameIds = rockiesGames
            .filter(game => isToday(new Date(`${game.date}T12:00:00`)))
            .map(game => game.gamePk);
        if (gameIds.length > 0) {
            const odds = await fetchOdds(rockiesGames.filter(game => gameIds.includes(game.gamePk)));
            setOddsData(odds);
        }
    };

    // Helper function to get odds for a game
    const getGameOdds = (game) => {
        if (!game || !game.gamePk || !oddsData[game.gamePk]) return '';
        
        const gameOdds = oddsData[game.gamePk];
        const teamName = game.opponent.name;
        
        if (gameOdds.homeTeam.name === teamName) {
            return formatOdds(gameOdds.homeTeam.odds);
        } else if (gameOdds.awayTeam.name === teamName) {
            return formatOdds(gameOdds.awayTeam.odds);
        }
        
        return '';
    };

    const refreshData = () => {
        fetchCurrentData();
        fetchHistoricalData();
    };

    return (
        <div className="fade-the-rockies-tab">
            <div className="fade-header">
                <h1>Fade The Rockies (Run Line) Opportunities</h1>
                <div className="fade-actions">
                    <button className="refresh-button" onClick={refreshData}>
                        Refresh Data
                    </button>
                    <button className="refresh-button" onClick={handleFetchOdds}>
                        Fetch Odds
                    </button>
                </div>
            </div>

            <div className="fade-description-container">
                <div className="fade-description">
                    <p>
                        "Fade The Rockies" is a betting strategy where you bet against the Colorado Rockies at the -1.5 run line.
                        This means you're betting that the opponent will win by 2 or more runs. This strategy takes advantage of
                        the Rockies' typically poor road performance and high-scoring games at Coors Field.
                    </p>
                </div>

                {!loading && rockiesGames.filter(game => isToday(new Date(`${game.date}T12:00:00`))).length > 0 && (
                    <div className="todays-picks">
                        <h3>Today's Rockies Pick</h3>
                        {rockiesGames
                            .filter(game => isToday(new Date(`${game.date}T12:00:00`)))
                            .map(game => (
                                <div className="today-pick-card" key={game.gamePk}>
                                    <div className="pick-header">
                                        <div className="matchup">
                                            <span className={game.isRockiesHome ? 'away-team' : 'home-team'}>
                                                {game.opponent.name}
                                            </span>
                                            {" @ "}
                                            <span className={game.isRockiesHome ? 'home-team' : 'away-team'}>
                                                Colorado Rockies
                                            </span>
                                        </div>
                                    </div>
                                    <div className="pick-details">
                                        <div className="recommended-bet">
                                            <strong>Pick:</strong> {game.opponent.name} -1.5 {getGameOdds(game)}
                                        </div>
                                        <div className="status">
                                            {game.status === "Scheduled" && game.gameTime ?
                                                `${game.gameTime}` :
                                                game.status}
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                )}
            </div>

            {loading ? (
                <div className="loading">Loading data...</div>
            ) : error ? (
                <div className="error">{error}</div>
            ) : (
                <>
                    {showHistorical && (
                        <div className="historical-results">
                            <h2>Historical Results</h2>
                            <div className="stats-container">
                                <div className="stat-box">
                                    <div className="stat-value">{stats.totalOpportunities}</div>
                                    <div className="stat-label">Total Games</div>
                                </div>
                                <div className="stat-box">
                                    <div className="stat-value">{stats.totalCover}</div>
                                    <div className="stat-label">Run Line Covers</div>
                                </div>
                                <div className="stat-box">
                                    <div className="stat-value">{stats.runLineLosses}</div>
                                    <div className="stat-label">Run Line Losses</div>
                                </div>
                                <div className="stat-box">
                                    <div className="stat-value">{stats.coverPercentage}%</div>
                                    <div className="stat-label">Cover Percentage</div>
                                </div>
                            </div>

                            {historicalResults.length > 0 ? (
                                <div className="historical-list">
                                    {historicalResults.map(game => (
                                        <div
                                            className={`historical-card ${game.run_line_cover ? 'run-line-covered' : 'run-line-lost'}`}
                                            key={game.gamePk}
                                        >
                                            <div className="historical-header">
                                                <div className="matchup">
                                                    <span className={game.isRockiesHome ? 'home-team' : 'away-team'}>
                                                        Colorado Rockies
                                                    </span>
                                                    {" vs "}
                                                    <span className={!game.isRockiesHome ? 'home-team' : 'away-team'}>
                                                        {game.opponent.name}
                                                    </span>
                                                </div>
                                                <div className="game-info">
                                                    <span className="date">{format(new Date(`${game.date}T12:00:00`), 'MMMM d, yyyy')}</span>
                                                    <span className="venue">at {game.venue}</span>
                                                </div>
                                                <div className="result-tag">
                                                    {game.run_line_cover ? 'Run Line Covered' : 'Run Line Lost'}
                                                </div>
                                            </div>
                                            <div className="historical-details">
                                                <div className="score-result">
                                                    <strong>Final:</strong> {game.opponent.name} {game.opponentScore} - Rockies {game.rockiesScore}
                                                </div>
                                                <div className="run-line-details">
                                                    <span className="margin">Margin: {Math.abs(game.opponentScore - game.rockiesScore)} runs</span>
                                                    <span className="location-note">
                                                        {game.isRockiesHome ? "Rockies at home" : "Rockies on the road"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="loading-historical">Loading historical data...</div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default FadeTheRockiesTab;