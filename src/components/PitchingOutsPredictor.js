import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import './PitchingOutsPredictor.css';

function PitchingOutsPredictor() {
    const [loading, setLoading] = useState(true);
    const [predictions, setPredictions] = useState([]);
    const [expandedPrediction, setExpandedPrediction] = useState(null);
    const [error, setError] = useState(null);

    // API Keys and URLs
    const ODDS_API_KEY = '08a430878d7c6b2b6df96e12309d423a';
    const ODDS_API_URL = 'https://api.the-odds-api.com/v4';

    useEffect(() => {
        fetchPredictions();
    }, []);

    const fetchPredictions = async () => {
        setLoading(true);
        setError(null);

        try {
            const today = new Date();
            const todayStr = format(today, 'yyyy-MM-dd');

            console.log(`Fetching pitching predictions for ${todayStr}`);

            // Fetch today's games
            const scheduleResponse = await axios.get(
                `https://statsapi.mlb.com/api/v1/schedule?date=${todayStr}&sportId=1&hydrate=team,venue,game(content(summary)),linescore,probablePitcher`
            );

            if (scheduleResponse.data?.dates?.[0]?.games) {
                const games = scheduleResponse.data.dates[0].games;
                console.log(`Found ${games.length} games for today`);

                // Fetch betting odds
                const oddsData = await fetchBettingOdds();

                // Process each game
                const processedPredictions = [];
                for (const game of games) {
                    try {
                        const prediction = await processGame(game, oddsData);
                        if (prediction) {
                            processedPredictions.push(prediction);
                        }
                    } catch (error) {
                        console.error(`Error processing game ${game.gamePk}:`, error.message || JSON.stringify(error));
                    }
                }

                console.log(`Generated ${processedPredictions.length} predictions`);
                setPredictions(processedPredictions);
            } else {
                console.log("No games found for today");
                setPredictions([]);
            }
        } catch (error) {
            console.error('Error fetching pitching predictions:', error.message || JSON.stringify(error));
            setError(error.message || JSON.stringify(error));
        } finally {
            setLoading(false);
        }
    };

    const fetchBettingOdds = async () => {
        try {
            console.log("=== DEBUGGING ODDS API ===");
            console.log("API Key (first 8 chars):", ODDS_API_KEY.substring(0, 8) + "...");

            // First, check what sports are available
            console.log("1. Fetching available sports...");
            const sportsResponse = await axios.get(
                `${ODDS_API_URL}/sports`,
                {
                    params: {
                        apiKey: ODDS_API_KEY
                    }
                }
            );

            console.log("Available sports:", sportsResponse.data?.filter(sport =>
                sport.key.includes('baseball') || sport.key.includes('mlb')
            ));

            // Try different sport keys
            const possibleSportKeys = [
                'baseball_mlb',
                'americanfootball_nfl', // Test with a known working sport
                'basketball_nba'
            ];

            for (const sportKey of possibleSportKeys) {
                console.log(`\n2. Testing sport key: ${sportKey}`);

                try {
                    const testResponse = await axios.get(
                        `${ODDS_API_URL}/sports/${sportKey}/odds`,
                        {
                            params: {
                                apiKey: ODDS_API_KEY,
                                regions: 'us',
                                oddsFormat: 'american',
                                dateFormat: 'iso'
                            }
                        }
                    );

                    console.log(`${sportKey} - Games found:`, testResponse.data?.length || 0);

                    if (testResponse.data && testResponse.data.length > 0) {
                        const firstGame = testResponse.data[0];
                        console.log(`${sportKey} - First game structure:`, {
                            away_team: firstGame.away_team,
                            home_team: firstGame.home_team,
                            bookmakers: firstGame.bookmakers?.length || 0,
                            commence_time: firstGame.commence_time
                        });

                        if (firstGame.bookmakers && firstGame.bookmakers.length > 0) {
                            const markets = firstGame.bookmakers[0].markets;
                            console.log(`${sportKey} - Available markets:`, markets?.map(m => m.key) || []);

                            // If this is MLB, let's see what we can get with different market requests
                            if (sportKey === 'baseball_mlb') {
                                console.log("\n3. Testing specific MLB markets...");

                                const marketTests = [
                                    'h2h,spreads,totals',
                                    'pitcher_strikeouts',
                                    'pitcher_outs_recorded',
                                    'pitcher_innings_pitched',
                                    'player_props',
                                    'alternate_spreads',
                                    'alternate_totals'
                                ];

                                for (const marketTest of marketTests) {
                                    try {
                                        const marketResponse = await axios.get(
                                            `${ODDS_API_URL}/sports/${sportKey}/odds`,
                                            {
                                                params: {
                                                    apiKey: ODDS_API_KEY,
                                                    regions: 'us',
                                                    markets: marketTest,
                                                    oddsFormat: 'american',
                                                    dateFormat: 'iso'
                                                }
                                            }
                                        );

                                        if (marketResponse.data && marketResponse.data.length > 0) {
                                            const gameWithMarkets = marketResponse.data[0];
                                            if (gameWithMarkets.bookmakers && gameWithMarkets.bookmakers.length > 0) {
                                                const availableMarkets = gameWithMarkets.bookmakers[0].markets;
                                                console.log(`Market test "${marketTest}" - Found markets:`,
                                                    availableMarkets?.map(m => ({
                                                        key: m.key,
                                                        outcomes: m.outcomes?.length || 0
                                                    })) || []
                                                );
                                            }
                                        }
                                    } catch (marketError) {
                                        console.log(`Market test "${marketTest}" failed:`, marketError.response?.status || marketError.message);
                                    }
                                }

                                // Return the basic MLB data we found
                                return testResponse.data;
                            }
                        }
                    }
                } catch (sportError) {
                    console.log(`${sportKey} failed:`, sportError.response?.status || sportError.message);
                }
            }

            console.log("=== END ODDS API DEBUGGING ===");
            return [];

        } catch (error) {
            console.error('Error in odds API debugging:', error.response?.data || error.message);
            return [];
        }
    };

    const processGame = async (game, oddsData) => {
        // Check if we have probable pitchers
        const awayProbablePitcher = game.teams.away.probablePitcher;
        const homeProbablePitcher = game.teams.home.probablePitcher;

        console.log(`Processing game: ${game.teams.away.team.name} @ ${game.teams.home.team.name}`);
        console.log(`Away pitcher:`, awayProbablePitcher?.fullName || 'Not available');
        console.log(`Home pitcher:`, homeProbablePitcher?.fullName || 'Not available');

        if (!awayProbablePitcher || !homeProbablePitcher) {
            console.log(`Skipping game - missing probable pitchers`);
            return null;
        }

        const awayTeam = game.teams.away.team;
        const homeTeam = game.teams.home.team;

        // Process both pitchers
        console.log(`\n--- Processing Away Pitcher: ${awayProbablePitcher.fullName} ---`);
        const awayPitcherPrediction = await processPitcher(
            awayProbablePitcher,
            homeTeam,
            game,
            oddsData,
            false
        );

        console.log(`\n--- Processing Home Pitcher: ${homeProbablePitcher.fullName} ---`);
        const homePitcherPrediction = await processPitcher(
            homeProbablePitcher,
            awayTeam,
            game,
            oddsData,
            true
        );

        const predictions = [];
        if (awayPitcherPrediction) {
            console.log(`✅ Away pitcher prediction created for ${awayProbablePitcher.fullName}`);
            predictions.push(awayPitcherPrediction);
        } else {
            console.log(`❌ Failed to create away pitcher prediction for ${awayProbablePitcher.fullName}`);
        }

        if (homePitcherPrediction) {
            console.log(`✅ Home pitcher prediction created for ${homeProbablePitcher.fullName}`);
            predictions.push(homePitcherPrediction);
        } else {
            console.log(`❌ Failed to create home pitcher prediction for ${homeProbablePitcher.fullName}`);
        }

        console.log(`Game processing complete. Generated ${predictions.length} predictions.\n`);

        return predictions.length > 0 ? predictions : null;
    };

    const processPitcher = async (pitcher, opposingTeam, game, oddsData, isHome) => {
        try {
            // Get pitcher stats
            const pitcherStats = await getPitcherStats(pitcher.id);
            const opposingTeamStats = await getTeamStats(opposingTeam.id);

            // Get betting line
            const bettingLine = findBettingLine(game, pitcher, oddsData);

            // Make prediction
            const prediction = makePrediction(pitcherStats, opposingTeamStats, game, isHome);

            return {
                gamePk: game.gamePk,
                gameTime: game.gameDate ? format(new Date(game.gameDate), 'h:mm a') : 'TBD',
                venue: game.venue.name,
                pitcher: {
                    name: pitcher.fullName,
                    id: pitcher.id,
                    team: isHome ? game.teams.home.team.name : game.teams.away.team.name,
                    teamId: isHome ? game.teams.home.team.id : game.teams.away.team.id,
                    isHome
                },
                opposingTeam: {
                    name: opposingTeam.name,
                    id: opposingTeam.id,
                    stats: opposingTeamStats
                },
                prediction: prediction.outsRecorded,
                confidence: prediction.confidence,
                analysisFactors: prediction.factors,
                bettingLine: bettingLine,
                recommendation: getBettingRecommendation(prediction.outsRecorded, bettingLine),
                pitcherStats: pitcherStats
            };
        } catch (error) {
            console.error(`Error processing pitcher ${pitcher.fullName}:`, error.message || JSON.stringify(error));
            return null;
        }
    };

    const getPitcherStats = async (pitcherId) => {
        try {
            const currentYear = new Date().getFullYear();

            console.log(`Fetching pitcher stats for pitcher ${pitcherId}`);

            // Get season stats
            const response = await axios.get(
                `https://statsapi.mlb.com/api/v1/people/${pitcherId}/stats?stats=season&season=${currentYear}&gameType=R`
            );

            console.log(`Pitcher ${pitcherId} season stats response:`, response.data);

            if (response.data?.stats?.[0]?.splits?.[0]) {
                const stats = response.data.stats[0].splits[0].stat;
                console.log(`Pitcher ${pitcherId} season stats:`, stats);

                // Get recent game logs
                const gameLogResponse = await axios.get(
                    `https://statsapi.mlb.com/api/v1/people/${pitcherId}/stats?stats=gameLog&season=${currentYear}&gameType=R`
                );

                console.log(`Pitcher ${pitcherId} game log response:`, gameLogResponse.data);

                const recentGames = gameLogResponse.data?.stats?.[0]?.splits?.slice(0, 5) || [];
                console.log(`Pitcher ${pitcherId} recent games:`, recentGames.length);

                const pitcherData = {
                    era: parseFloat(stats.era) || 0,
                    whip: parseFloat(stats.whip) || 0,
                    strikeOuts: parseInt(stats.strikeOuts) || 0,
                    walks: parseInt(stats.walks) || 0,
                    hits: parseInt(stats.hits) || 0,
                    inningsPitched: parseFloat(stats.inningsPitched) || 0,
                    gamesPitched: parseInt(stats.gamesPitched) || 0,
                    gamesStarted: parseInt(stats.gamesStarted) || 0,
                    pitchesThrown: parseInt(stats.pitchesThrown) || 0,
                    battersFaced: parseInt(stats.battersFaced) || 0,
                    outsRecorded: parseInt(stats.outs) || 0,
                    recentGames: recentGames.map(game => ({
                        date: game.date,
                        outsRecorded: parseInt(game.stat.outs) || 0,
                        inningsPitched: parseFloat(game.stat.inningsPitched) || 0,
                        strikeOuts: parseInt(game.stat.strikeOuts) || 0,
                        hits: parseInt(game.stat.hits) || 0,
                        walks: parseInt(game.stat.walks) || 0,
                        pitchesThrown: parseInt(game.stat.pitchesThrown) || 0
                    }))
                };

                console.log(`Processed pitcher ${pitcherId} data:`, pitcherData);
                return pitcherData;
            }

            console.log(`No season stats found for pitcher ${pitcherId}`);
            return null;
        } catch (error) {
            console.error(`Error fetching pitcher stats for ${pitcherId}:`, error.message || JSON.stringify(error));
            return null;
        }
    };

    const getTeamStats = async (teamId) => {
        try {
            const currentYear = new Date().getFullYear();

            console.log(`Fetching team stats for team ${teamId}`);

            const response = await axios.get(
                `https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=season&season=${currentYear}&gameType=R`
            );

            console.log(`Team ${teamId} stats response:`, response.data);

            if (response.data?.stats) {
                // Log all available stat groups to see what we have
                console.log(`Available stat groups for team ${teamId}:`,
                    response.data.stats.map(stat => ({
                        type: stat.type?.displayName,
                        group: stat.group?.displayName
                    }))
                );

                // Try multiple ways to find hitting stats
                let hittingStats = response.data.stats.find(stat =>
                    stat.group?.displayName === 'hitting'
                );

                if (!hittingStats) {
                    hittingStats = response.data.stats.find(stat =>
                        stat.type?.displayName === 'season' &&
                        stat.splits?.[0]?.stat?.avg !== undefined
                    );
                }

                if (!hittingStats && response.data.stats.length > 0) {
                    // Just use the first stat group and see what we get
                    hittingStats = response.data.stats[0];
                    console.log(`Using first available stats group:`, hittingStats);
                }

                if (hittingStats?.splits?.[0]) {
                    const stats = hittingStats.splits[0].stat;

                    console.log(`Team ${teamId} hitting stats found:`, stats);

                    return {
                        avg: parseFloat(stats.avg) || 0,
                        obp: parseFloat(stats.obp) || 0,
                        slg: parseFloat(stats.slg) || 0,
                        ops: parseFloat(stats.ops) || (parseFloat(stats.obp) + parseFloat(stats.slg)) || 0,
                        strikeOuts: parseInt(stats.strikeOuts) || 0,
                        walks: parseInt(stats.walks) || 0,
                        hits: parseInt(stats.hits) || 0,
                        atBats: parseInt(stats.atBats) || 0,
                        plateAppearances: parseInt(stats.plateAppearances) || parseInt(stats.atBats) + parseInt(stats.walks) || 0,
                        homeRuns: parseInt(stats.homeRuns) || 0
                    };
                }
            }

            console.log(`No hitting stats found for team ${teamId}, using defaults`);
            // Return league average defaults if no data found
            return {
                avg: 0.250,
                obp: 0.320,
                slg: 0.430,
                ops: 0.750,
                strikeOuts: 1000,
                walks: 500,
                hits: 1200,
                atBats: 4800,
                plateAppearances: 5400,
                homeRuns: 150
            };

        } catch (error) {
            console.error(`Error fetching team stats for ${teamId}:`, error.message || JSON.stringify(error));
            // Return league averages as fallback
            return {
                avg: 0.250,
                obp: 0.320,
                slg: 0.430,
                ops: 0.750,
                strikeOuts: 1000,
                walks: 500,
                hits: 1200,
                atBats: 4800,
                plateAppearances: 5400,
                homeRuns: 150
            };
        }
    };

    const findBettingLine = (game, pitcher, oddsData) => {
        try {
            console.log(`Looking for betting line for ${pitcher.fullName}`);
            console.log(`Game: ${game.teams.away.team.name} @ ${game.teams.home.team.name}`);

            // Find the game in odds data
            const gameOdds = oddsData.find(odds => {
                const awayTeam = game.teams.away.team.name.toLowerCase();
                const homeTeam = game.teams.home.team.name.toLowerCase();
                const oddsAway = odds.away_team.toLowerCase();
                const oddsHome = odds.home_team.toLowerCase();

                // More flexible matching
                const awayMatch = awayTeam.includes(oddsAway.split(' ').pop()) ||
                    oddsAway.includes(awayTeam.split(' ').pop()) ||
                    awayTeam.split(' ').pop().includes(oddsAway.split(' ').pop());
                const homeMatch = homeTeam.includes(oddsHome.split(' ').pop()) ||
                    oddsHome.includes(homeTeam.split(' ').pop()) ||
                    homeTeam.split(' ').pop().includes(oddsHome.split(' ').pop());

                return awayMatch && homeMatch;
            });

            console.log(`Found game odds:`, gameOdds ? 'Yes' : 'No');

            if (gameOdds?.bookmakers) {
                console.log(`Available markets:`, gameOdds.bookmakers[0]?.markets?.map(m => m.key) || []);

                // Look for pitcher-related markets
                for (const bookmaker of gameOdds.bookmakers) {
                    // Try multiple market types
                    const pitcherMarkets = ['pitcher_outs_recorded', 'pitcher_strikeouts', 'pitcher_innings_pitched'];

                    for (const marketKey of pitcherMarkets) {
                        const market = bookmaker.markets.find(m => m.key === marketKey);

                        if (market) {
                            console.log(`Found ${marketKey} market with ${market.outcomes?.length || 0} outcomes`);

                            // Find the specific pitcher's line
                            const pitcherOutcome = market.outcomes.find(outcome => {
                                const outcomeDesc = outcome.description?.toLowerCase() || '';
                                const pitcherName = pitcher.fullName.toLowerCase();
                                const lastName = pitcherName.split(' ').pop();

                                return outcomeDesc.includes(pitcherName) ||
                                    outcomeDesc.includes(lastName);
                            });

                            if (pitcherOutcome) {
                                console.log(`Found pitcher line:`, pitcherOutcome);

                                // Convert based on market type
                                let line = parseFloat(pitcherOutcome.point) || 15.5;
                                if (marketKey === 'pitcher_innings_pitched') {
                                    line = line * 3; // Convert innings to outs
                                } else if (marketKey === 'pitcher_strikeouts') {
                                    line = line * 1.8; // Rough conversion from Ks to outs
                                }

                                return {
                                    line: line,
                                    overOdds: pitcherOutcome.name === 'Over' ? pitcherOutcome.price : null,
                                    underOdds: pitcherOutcome.name === 'Under' ? pitcherOutcome.price : null,
                                    bookmaker: bookmaker.title,
                                    marketType: marketKey
                                };
                            }
                        }
                    }
                }
            }

            // Generate a more realistic fallback based on pitcher data
            console.log("No betting line found, generating estimate based on pitcher data");

            // Use pitcher's season average as estimate
            let estimatedLine = 15.5; // Default fallback

            // If we have pitcher data, use that for a better estimate
            if (game.teams.away.probablePitcher?.id === pitcher.id ||
                game.teams.home.probablePitcher?.id === pitcher.id) {
                // This will be more accurate once we get pitcher stats
                const avgInningsPerStart = 5.5; // League average
                estimatedLine = avgInningsPerStart * 3; // Convert to outs

                // Add some variance based on pitcher quality (placeholder)
                estimatedLine += (Math.random() * 4 - 2); // +/- 2 outs variance
                estimatedLine = Math.round(estimatedLine * 2) / 2; // Round to nearest 0.5
            }

            return {
                line: estimatedLine,
                overOdds: -110,
                underOdds: -110,
                bookmaker: 'Estimated (No live odds available)',
                marketType: 'estimated'
            };
        } catch (error) {
            console.error('Error finding betting line:', error.message || JSON.stringify(error));
            return {
                line: 15.5,
                overOdds: -110,
                underOdds: -110,
                bookmaker: 'Error - Using Default',
                marketType: 'fallback'
            };
        }
    };

    const makePrediction = (pitcherStats, teamStats, game, isHome) => {
        console.log(`Making prediction for pitcher:`, pitcherStats);
        console.log(`Against team:`, teamStats);

        if (!pitcherStats || !teamStats) {
            console.log("Missing stats, using fallback prediction");
            return {
                outsRecorded: 15.0,
                confidence: 'Low',
                factors: ['Limited data available - using baseline estimate']
            };
        }

        const factors = [];
        let baseOuts = 15.0; // Start with a reasonable baseline

        // Factor 1: Pitcher's season average
        if (pitcherStats.gamesStarted > 0 && pitcherStats.outsRecorded > 0) {
            const avgOutsPerStart = pitcherStats.outsRecorded / pitcherStats.gamesStarted;
            console.log(`Pitcher season average: ${avgOutsPerStart.toFixed(1)} outs per start`);

            factors.push(`Season average: ${avgOutsPerStart.toFixed(1)} outs per start (${pitcherStats.gamesStarted} starts)`);
            baseOuts = avgOutsPerStart;
        } else {
            console.log("No season starts data available, using baseline");
            factors.push(`No season data available - using baseline estimate`);
        }

        // Factor 2: Recent form (last 5 games)
        if (pitcherStats.recentGames && pitcherStats.recentGames.length >= 3) {
            const recentAvgOuts = pitcherStats.recentGames.reduce((sum, game) =>
                sum + (game.outsRecorded || 0), 0) / pitcherStats.recentGames.length;

            const avgOutsPerStart = pitcherStats.gamesStarted > 0 ?
                pitcherStats.outsRecorded / pitcherStats.gamesStarted : 15.0;

            const recentFormAdjustment = (recentAvgOuts - avgOutsPerStart) * 0.4;
            baseOuts += recentFormAdjustment;

            console.log(`Recent form adjustment: ${recentFormAdjustment.toFixed(1)}`);
            factors.push(`Recent form: ${recentAvgOuts.toFixed(1)} outs avg in last ${pitcherStats.recentGames.length} games (${recentFormAdjustment > 0 ? '+' : ''}${recentFormAdjustment.toFixed(1)})`);
        } else {
            factors.push(`Insufficient recent games data (${pitcherStats.recentGames?.length || 0} games)`);
        }

        // Factor 3: Opposing team's offensive strength
        if (teamStats.ops && teamStats.ops > 0) {
            const leagueAvgOPS = 0.750; // Approximate MLB average
            const opsAdjustment = (leagueAvgOPS - teamStats.ops) * 6; // Increased scale factor
            baseOuts += opsAdjustment;

            console.log(`OPS adjustment: ${opsAdjustment.toFixed(1)}`);
            factors.push(`Opposing team OPS: ${teamStats.ops.toFixed(3)} vs league avg (${opsAdjustment > 0 ? '+' : ''}${opsAdjustment.toFixed(1)})`);
        } else {
            factors.push(`No opposing team OPS data available`);
        }

        // Factor 4: Pitcher efficiency (WHIP)
        if (pitcherStats.whip && pitcherStats.whip > 0) {
            const leagueAvgWHIP = 1.30; // Approximate MLB average
            const whipAdjustment = (leagueAvgWHIP - pitcherStats.whip) * 3; // Scale factor
            baseOuts += whipAdjustment;

            console.log(`WHIP adjustment: ${whipAdjustment.toFixed(1)}`);
            factors.push(`Pitcher WHIP: ${pitcherStats.whip.toFixed(2)} vs league avg (${whipAdjustment > 0 ? '+' : ''}${whipAdjustment.toFixed(1)})`);
        } else {
            factors.push(`No WHIP data available`);
        }

        // Factor 5: Home/Away adjustment
        const homeAdjustment = isHome ? 0.8 : -0.8;
        baseOuts += homeAdjustment;
        factors.push(`${isHome ? 'Home' : 'Away'} start: ${homeAdjustment > 0 ? '+' : ''}${homeAdjustment.toFixed(1)}`);

        // Factor 6: Strikeout rate consideration
        if (pitcherStats.strikeOuts > 0 && pitcherStats.battersFaced > 0) {
            const kRate = pitcherStats.strikeOuts / pitcherStats.battersFaced;
            let kRateAdjustment = 0;

            if (kRate > 0.28) { // Very high K rate
                kRateAdjustment = 2.0;
            } else if (kRate > 0.24) { // High K rate
                kRateAdjustment = 1.2;
            } else if (kRate < 0.18) { // Low K rate
                kRateAdjustment = -1.5;
            }

            baseOuts += kRateAdjustment;
            factors.push(`K-rate (${(kRate * 100).toFixed(1)}%): ${kRateAdjustment > 0 ? '+' : ''}${kRateAdjustment.toFixed(1)}`);
        } else {
            factors.push(`No strikeout rate data available`);
        }

        // Determine confidence level
        let confidence = 'Medium';
        if (pitcherStats.recentGames && pitcherStats.recentGames.length >= 5 && pitcherStats.gamesStarted >= 10) {
            confidence = 'High';
        } else if (!pitcherStats.recentGames || pitcherStats.recentGames.length < 3 || pitcherStats.gamesStarted < 5) {
            confidence = 'Low';
        }

        // Ensure reasonable bounds (between 3 and 27 outs)
        baseOuts = Math.max(3.0, Math.min(27.0, baseOuts));

        console.log(`Final prediction: ${baseOuts.toFixed(1)} outs with ${confidence} confidence`);

        return {
            outsRecorded: baseOuts,
            confidence: confidence,
            factors: factors
        };
    };

    const getBettingRecommendation = (prediction, bettingLine) => {
        if (!bettingLine) return null;

        const difference = prediction - bettingLine.line;
        const threshold = 1.5; // Need at least 1.5 out difference to recommend

        if (Math.abs(difference) < threshold) {
            return {
                recommendation: 'No Bet',
                reason: `Prediction too close to line (${Math.abs(difference).toFixed(1)} outs difference)`
            };
        }

        if (difference > threshold) {
            return {
                recommendation: 'BET OVER',
                reason: `Prediction ${difference.toFixed(1)} outs higher than line`,
                confidence: difference > 3 ? 'High' : difference > 2 ? 'Medium' : 'Low'
            };
        } else {
            return {
                recommendation: 'BET UNDER',
                reason: `Prediction ${Math.abs(difference).toFixed(1)} outs lower than line`,
                confidence: Math.abs(difference) > 3 ? 'High' : Math.abs(difference) > 2 ? 'Medium' : 'Low'
            };
        }
    };

    const toggleExpandPrediction = (gamePk, pitcherId) => {
        const key = `${gamePk}-${pitcherId}`;
        if (expandedPrediction === key) {
            setExpandedPrediction(null);
        } else {
            setExpandedPrediction(key);
        }
    };

    const isExpanded = (gamePk, pitcherId) => {
        return expandedPrediction === `${gamePk}-${pitcherId}`;
    };

    const getTeamLogoUrl = (teamId) => {
        const TEAM_LOGOS = {
            110: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/110.svg',
            111: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/111.svg',
            147: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/147.svg',
            139: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/139.svg',
            141: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/141.svg',
            145: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/145.svg',
            114: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/114.svg',
            116: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/116.svg',
            118: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/118.svg',
            142: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/142.svg',
            117: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/117.svg',
            108: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/108.svg',
            133: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/133.svg',
            136: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/136.svg',
            140: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/140.svg',
            144: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/144.svg',
            146: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/146.svg',
            121: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/121.svg',
            143: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/143.svg',
            120: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/120.svg',
            112: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/112.svg',
            113: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/113.svg',
            158: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/158.svg',
            134: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/134.svg',
            138: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/138.svg',
            109: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/109.svg',
            115: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/115.svg',
            119: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/119.svg',
            135: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/135.svg',
            137: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/137.svg'
        };
        return TEAM_LOGOS[teamId] || 'https://www.mlbstatic.com/team-logos/league-on-dark/1.svg';
    };

    // Flatten predictions array for display
    const flatPredictions = predictions.flat().filter(Boolean);

    return (
        <div className="pitching-outs-predictor">
            <div className="predictor-header">
                <h2>Pitching Outs Predictor - {format(new Date(), 'MMMM d, yyyy')}</h2>
                <button className="refresh-button" onClick={fetchPredictions}>
                    Refresh Predictions
                </button>
            </div>

            {loading ? (
                <div className="loading">Loading predictions...</div>
            ) : error ? (
                <div className="error">{error}</div>
            ) : flatPredictions.length === 0 ? (
                <div className="no-predictions">No predictions available for today.</div>
            ) : (
                <div className="predictions-container">
                    <div className="predictions-list">
                        {flatPredictions.map(prediction => (
                            <div key={`${prediction.gamePk}-${prediction.pitcher.id}`}
                                className={`prediction-card ${isExpanded(prediction.gamePk, prediction.pitcher.id) ? 'expanded' : ''}`}>

                                <div className="prediction-header">
                                    <div className="pitcher-info">
                                        <img
                                            src={getTeamLogoUrl(prediction.pitcher.teamId)}
                                            alt={`${prediction.pitcher.team} logo`}
                                            className="team-logo"
                                            style={{ margin: '10px' }}
                                        />
                                        <div className="pitcher-details">
                                            <span className="pitcher-name">{prediction.pitcher.name}</span>
                                            <span className="pitcher-team">{prediction.pitcher.team}</span>
                                        </div>
                                    </div>
                                    <div className="confidence-indicator">
                                        <span className={`confidence-badge ${prediction.confidence.toLowerCase()}`}>
                                            {prediction.confidence}
                                        </span>
                                    </div>
                                </div>

                                <div className="prediction-content">
                                    <div className="prediction-line">
                                        <span className="prediction-label">Predicted:</span>
                                        <span className="prediction-value">{prediction.prediction.toFixed(1)} outs</span>
                                    </div>
                                    <div className="betting-line">
                                        <span className="line-label">Line:</span>
                                        <span className="line-value">{prediction.bettingLine.line} outs</span>
                                    </div>

                                    {prediction.recommendation && (
                                        <div className={`recommendation ${prediction.recommendation.recommendation.includes('OVER') ? 'bet-over' :
                                            prediction.recommendation.recommendation.includes('UNDER') ? 'bet-under' : 'no-bet'}`}>
                                            <strong>{prediction.recommendation.recommendation}</strong>
                                            <span className="recommendation-reason">{prediction.recommendation.reason}</span>
                                        </div>
                                    )}

                                    <button
                                        className="analysis-toggle-button"
                                        onClick={() => toggleExpandPrediction(prediction.gamePk, prediction.pitcher.id)}
                                    >
                                        {isExpanded(prediction.gamePk, prediction.pitcher.id) ? 'Hide Analysis' : 'Show Analysis'}
                                    </button>

                                    {isExpanded(prediction.gamePk, prediction.pitcher.id) && (
                                        <div className="prediction-analysis">
                                            <h4>Prediction Analysis</h4>
                                            <div className="analysis-factors">
                                                <h5>Key Factors:</h5>
                                                <ul>
                                                    {(prediction.analysisFactors || ['No analysis factors available']).map((factor, index) => (
                                                        <li key={index}>{factor}</li>
                                                    ))}
                                                </ul>
                                            </div>

                                            <div className="matchup-details">
                                                <h5>Matchup Details:</h5>
                                                <div className="matchup-stats">
                                                    <div className="pitcher-stats">
                                                        <strong>Pitcher Stats:</strong>
                                                        <div>ERA: {prediction.pitcherStats?.era?.toFixed(2) || 'N/A'}</div>
                                                        <div>WHIP: {prediction.pitcherStats?.whip?.toFixed(2) || 'N/A'}</div>
                                                        <div>Season Outs: {prediction.pitcherStats?.outsRecorded || 'N/A'}</div>
                                                        <div>Starts: {prediction.pitcherStats?.gamesStarted || 'N/A'}</div>
                                                        <div>Recent Games: {prediction.pitcherStats?.recentGames?.length || 0}</div>
                                                    </div>
                                                    <div className="opponent-stats">
                                                        <strong>vs {prediction.opposingTeam?.name || 'Opponent'}:</strong>
                                                        <div>Team AVG: {prediction.opposingTeam?.stats?.avg?.toFixed(3) || 'N/A'}</div>
                                                        <div>Team OPS: {prediction.opposingTeam?.stats?.ops?.toFixed(3) || 'N/A'}</div>
                                                        <div>Team K Rate: {
                                                            prediction.opposingTeam?.stats?.strikeOuts && prediction.opposingTeam?.stats?.plateAppearances
                                                                ? ((prediction.opposingTeam.stats.strikeOuts / prediction.opposingTeam.stats.plateAppearances) * 100).toFixed(1) + '%'
                                                                : 'N/A'
                                                        }</div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="betting-details">
                                                <h5>Betting Information:</h5>
                                                <div>Line: {prediction.bettingLine?.line || 'N/A'} outs</div>
                                                <div>Over: {prediction.bettingLine?.overOdds || 'N/A'}</div>
                                                <div>Under: {prediction.bettingLine?.underOdds || 'N/A'}</div>
                                                <div>Source: {prediction.bettingLine?.bookmaker || 'N/A'}</div>
                                                {prediction.bettingLine?.marketType && (
                                                    <div>Market Type: {prediction.bettingLine.marketType}</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="prediction-footer">
                                    <span className="game-time">{prediction.gameTime}</span>
                                    <span className="venue">{prediction.venue}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default PitchingOutsPredictor;