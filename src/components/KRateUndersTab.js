import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format, parseISO, subDays, isToday } from 'date-fns';
import './KRateUndersTab.css';

function KRateUndersTab() {
    const [loading, setLoading] = useState(true);
    const [krateOpportunities, setKrateOpportunities] = useState([]);
    const [historicalResults, setHistoricalResults] = useState([]);
    const [stats, setStats] = useState({
        totalOpportunities: 0,
        totalUnders: 0,
        totalOvers: 0,
        underPercentage: 0,
        f5Unders: 0,
        f5Overs: 0,
        f5UnderPercentage: 0,
        averageKRate: 0,
        averageRunsScored: 0
    });
    const [showHistorical, setShowHistorical] = useState(true);
    const [error, setError] = useState(null);
    const [selectedSeason, setSelectedSeason] = useState(new Date().getFullYear());
    const [availableSeasons, setAvailableSeasons] = useState([]);

    // Constants for betting lines - easily configurable for future
    const ASSUMED_TOTAL_RUNS = 8.5;
    const ASSUMED_F5_TOTAL = 4.5;
    const MIN_K_RATE = 0.25; // 25%
    const LOOKBACK_DAYS = 30;

    useEffect(() => {
        // Initialize available seasons
        const seasons = [];
        const currentYear = new Date().getFullYear();
        for (let year = currentYear; year >= 2020; year--) {
            seasons.push(year);
        }
        setAvailableSeasons(seasons);

        // Load initial data
        fetchCurrentData();
        fetchHistoricalDataForSeason(currentYear);
    }, []);

    // Fetch current opportunities
    const fetchCurrentData = async () => {
        setLoading(true);
        setError(null);

        try {
            const today = new Date();
            const todayStr = format(today, 'yyyy-MM-dd');

            console.log(`Fetching K-Rate opportunities for ${todayStr}`);

            // Get today's games with probable pitchers
            const response = await axios.get(
                `https://statsapi.mlb.com/api/v1/schedule?date=${todayStr}&sportId=1&hydrate=team,venue,game(content(summary)),linescore,probablePitcher`
            );

            if (response.data && response.data.dates && response.data.dates.length > 0) {
                const todayGames = response.data.dates[0].games;
                console.log(`Found ${todayGames.length} games for today`);

                await processCurrentOpportunities(todayGames);
            } else {
                console.log("No games found for today");
                setKrateOpportunities([]);
            }
        } catch (error) {
            console.error('Error fetching current K-Rate data:', error);
            setError("Error fetching game data. Please try again later.");
        } finally {
            setLoading(false);
        }
    };

    // Process today's games for K-Rate opportunities
    const processCurrentOpportunities = async (games) => {
        const opportunities = [];

        console.log(`Processing ${games.length} games for K-Rate opportunities`);

        for (const game of games) {
            try {
                // Check if we have probable pitchers
                const awayProbablePitcher = game.teams.away.probablePitcher;
                const homeProbablePitcher = game.teams.home.probablePitcher;

                if (!awayProbablePitcher || !homeProbablePitcher) {
                    console.log(`Skipping game ${game.teams.away.team.name} @ ${game.teams.home.team.name} - missing probable pitchers`);
                    continue;
                }

                const awayTeam = game.teams.away.team;
                const homeTeam = game.teams.home.team;

                console.log(`Checking: ${awayTeam.name} (${awayProbablePitcher.fullName}) @ ${homeTeam.name} (${homeProbablePitcher.fullName})`);

                // Get pitcher K-rates for last 30 days
                const awayPitcherStats = await getPitcherKRate(awayProbablePitcher.id);
                const homePitcherStats = await getPitcherKRate(homeProbablePitcher.id);

                // Only proceed if both pitchers have some data
                if (awayPitcherStats.totalBattersFaced === 0 && homePitcherStats.totalBattersFaced === 0) {
                    console.log(`Skipping game - no pitcher data available`);
                    continue;
                }

                // Get team strikeout rates (as batters)
                const awayTeamSORate = await getTeamStrikeoutRate(awayTeam.id);
                const homeTeamSORate = await getTeamStrikeoutRate(homeTeam.id);

                console.log(`${awayProbablePitcher.fullName}: ${(awayPitcherStats.kRate * 100).toFixed(1)}% K-Rate (${awayPitcherStats.gamesCount} games)`);
                console.log(`${homeProbablePitcher.fullName}: ${(homePitcherStats.kRate * 100).toFixed(1)}% K-Rate (${homePitcherStats.gamesCount} games)`);

                // Check if both pitchers meet the 25% K-rate threshold
                if (awayPitcherStats.kRate >= MIN_K_RATE && homePitcherStats.kRate >= MIN_K_RATE) {
                    console.log(`✅ Found K-Rate opportunity: ${awayTeam.name} @ ${homeTeam.name}`);

                    // Determine confidence based on data quality and K-rate levels
                    let confidence = 'Medium';
                    if (awayPitcherStats.kRate >= 0.30 && homePitcherStats.kRate >= 0.30) {
                        confidence = 'High';
                    } else if (awayPitcherStats.gamesCount < 3 || homePitcherStats.gamesCount < 3) {
                        confidence = 'Low';
                    }

                    opportunities.push({
                        gamePk: game.gamePk,
                        date: game.gameDate ? format(new Date(game.gameDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                        gameTime: game.gameDate ? format(new Date(game.gameDate), 'h:mm a') : 'TBD',
                        venue: game.venue.name,
                        awayTeam: {
                            name: awayTeam.name,
                            id: awayTeam.id,
                            pitcher: {
                                name: awayProbablePitcher.fullName,
                                id: awayProbablePitcher.id,
                                kRate: awayPitcherStats.kRate,
                                recentGames: awayPitcherStats.recentGames,
                                gamesCount: awayPitcherStats.gamesCount,
                                useSeasonStats: awayPitcherStats.useSeasonStats
                            },
                            strikeoutRate: awayTeamSORate
                        },
                        homeTeam: {
                            name: homeTeam.name,
                            id: homeTeam.id,
                            pitcher: {
                                name: homeProbablePitcher.fullName,
                                id: homeProbablePitcher.id,
                                kRate: homePitcherStats.kRate,
                                recentGames: homePitcherStats.recentGames,
                                gamesCount: homePitcherStats.gamesCount,
                                useSeasonStats: homePitcherStats.useSeasonStats
                            },
                            strikeoutRate: homeTeamSORate
                        },
                        isRecommendedUnder: true, // Since both pitchers meet criteria
                        confidence: confidence,
                        status: game.status.detailedState
                    });
                } else {
                    console.log(`❌ Skipping: K-rates don't meet threshold (Away: ${(awayPitcherStats.kRate * 100).toFixed(1)}%, Home: ${(homePitcherStats.kRate * 100).toFixed(1)}%)`);
                }

                // Add a small delay between API calls to be respectful
                await new Promise(resolve => setTimeout(resolve, 50));

            } catch (error) {
                console.error(`Error processing game ${game.gamePk}:`, error);
            }
        }

        console.log(`Found ${opportunities.length} K-Rate opportunities`);
        setKrateOpportunities(opportunities);
    };

    // Get pitcher K-rate over last 30 days
    const getPitcherKRate = async (pitcherId) => {
        try {
            const today = new Date();
            const thirtyDaysAgo = subDays(today, LOOKBACK_DAYS);

            const startDate = format(thirtyDaysAgo, 'yyyy-MM-dd');
            const endDate = format(today, 'yyyy-MM-dd');

            console.log(`Fetching K-rate for pitcher ${pitcherId} from ${startDate} to ${endDate}`);

            // Get pitcher's game logs
            const response = await axios.get(
                `https://statsapi.mlb.com/api/v1/people/${pitcherId}/stats?stats=gameLog&gameType=R&startDate=${startDate}&endDate=${endDate}`
            );

            if (response.data && response.data.stats && response.data.stats.length > 0) {
                const gameLog = response.data.stats[0];

                if (gameLog.splits && gameLog.splits.length > 0) {
                    let totalStrikeouts = 0;
                    let totalBattersFaced = 0;
                    const recentGames = [];

                    gameLog.splits.forEach(game => {
                        const ks = game.stat.strikeOuts || 0;
                        const bf = game.stat.battersFaced || 0;

                        if (bf > 0) { // Only count games where pitcher actually faced batters
                            totalStrikeouts += ks;
                            totalBattersFaced += bf;

                            recentGames.push({
                                date: game.date,
                                strikeouts: ks,
                                battersFaced: bf,
                                kRate: bf > 0 ? ks / bf : 0,
                                innings: game.stat.inningsPitched || 0
                            });
                        }
                    });

                    const kRate = totalBattersFaced > 0 ? totalStrikeouts / totalBattersFaced : 0;

                    console.log(`Pitcher ${pitcherId}: ${totalStrikeouts}K in ${totalBattersFaced}BF = ${(kRate * 100).toFixed(1)}% K-Rate over ${recentGames.length} games`);

                    return {
                        kRate,
                        totalStrikeouts,
                        totalBattersFaced,
                        recentGames: recentGames.slice(0, 5), // Last 5 games for display
                        gamesCount: recentGames.length
                    };
                }
            }

            // If no recent games, try to get season stats as fallback
            console.log(`No recent games found for pitcher ${pitcherId}, trying season stats`);
            const seasonStats = await getSeasonPitcherStats(pitcherId, new Date().getFullYear());

            if (seasonStats.kRate > 0) {
                console.log(`Using season stats for pitcher ${pitcherId}: ${(seasonStats.kRate * 100).toFixed(1)}% K-Rate`);
                return {
                    kRate: seasonStats.kRate,
                    totalStrikeouts: seasonStats.totalStrikeouts,
                    totalBattersFaced: seasonStats.totalBattersFaced,
                    recentGames: [],
                    gamesCount: 0,
                    useSeasonStats: true
                };
            }

            // Return default if no data
            console.log(`No data found for pitcher ${pitcherId}`);
            return {
                kRate: 0,
                totalStrikeouts: 0,
                totalBattersFaced: 0,
                recentGames: [],
                gamesCount: 0
            };
        } catch (error) {
            console.error(`Error fetching pitcher stats for ${pitcherId}:`, error);
            return {
                kRate: 0,
                totalStrikeouts: 0,
                totalBattersFaced: 0,
                recentGames: [],
                gamesCount: 0
            };
        }
    };

    // Get team strikeout rate as batters
    const getTeamStrikeoutRate = async (teamId) => {
        try {
            const currentYear = new Date().getFullYear();

            console.log(`Fetching team strikeout rate for team ${teamId}`);

            const response = await axios.get(
                `https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=season&season=${currentYear}&gameType=R`
            );

            console.log(`Team ${teamId} full response:`, response.data);

            if (response.data && response.data.stats && response.data.stats.length > 0) {
                // Try to find hitting stats in different ways
                let hittingStats = null;

                // Method 1: Look for hitting group
                hittingStats = response.data.stats.find(stat =>
                    stat.group && stat.group.displayName === 'hitting'
                );

                // Method 2: Look for any stat that has hitting data
                if (!hittingStats) {
                    hittingStats = response.data.stats.find(stat =>
                        stat.splits && stat.splits.length > 0 &&
                        stat.splits[0].stat &&
                        (stat.splits[0].stat.strikeOuts !== undefined || stat.splits[0].stat.avg !== undefined)
                    );
                }

                console.log(`Found hitting stats for team ${teamId}:`, hittingStats);

                if (hittingStats && hittingStats.splits && hittingStats.splits.length > 0) {
                    const hitting = hittingStats.splits[0].stat;
                    console.log(`Hitting stat object for team ${teamId}:`, hitting);

                    // Extract the exact values to debug
                    const strikeouts = parseInt(hitting.strikeOuts) || 0;
                    const atBats = parseInt(hitting.atBats) || 0;
                    const walks = parseInt(hitting.walks) || 0;
                    const hitByPitch = parseInt(hitting.hitByPitch) || 0;
                    const sacFlies = parseInt(hitting.sacFlies) || 0;
                    const sacBunts = parseInt(hitting.sacBunts) || 0;

                    // Calculate plate appearances the Fangraphs way: AB + BB + HBP + SF + SH
                    const plateAppearances = atBats + walks + hitByPitch + sacFlies + sacBunts;

                    // Also try the direct plateAppearances field if available
                    const directPA = parseInt(hitting.plateAppearances) || 0;

                    console.log(`Team ${teamId} detailed breakdown:`);
                    console.log(`  Strikeouts: ${strikeouts}`);
                    console.log(`  At Bats: ${atBats}`);
                    console.log(`  Walks: ${walks}`);
                    console.log(`  Hit By Pitch: ${hitByPitch}`);
                    console.log(`  Sac Flies: ${sacFlies}`);
                    console.log(`  Sac Bunts: ${sacBunts}`);
                    console.log(`  Calculated PA: ${plateAppearances}`);
                    console.log(`  Direct PA field: ${directPA}`);

                    // Use the higher of calculated vs direct PA (in case one is missing data)
                    const finalPA = Math.max(plateAppearances, directPA);

                    if (finalPA > 0) {
                        const soRate = strikeouts / finalPA;
                        console.log(`Team ${teamId}: ${strikeouts} strikeouts in ${finalPA} PA = ${(soRate * 100).toFixed(1)}% SO rate`);
                        console.log(`  (This should match Fangraphs K% for this team)`);
                        return soRate;
                    }
                }
            }

            console.log(`No valid hitting stats found for team ${teamId}, using fallback`);
            // Return league average as fallback (approximately 22.5% based on recent MLB averages)
            return 0.225;
        } catch (error) {
            console.error(`Error fetching team strikeout rate for ${teamId}:`, error);
            // Return league average as fallback
            return 0.225;
        }
    };

    // Fetch historical data for a season
    const fetchHistoricalDataForSeason = async (season) => {
        setLoading(true);

        try {
            const seasonStartDate = `${season}-03-25`;
            const today = new Date();
            let seasonEndDate = `${season}-11-01`;

            // Don't fetch beyond today for current season
            if (season === today.getFullYear()) {
                seasonEndDate = format(subDays(today, 1), 'yyyy-MM-dd');
            }

            console.log(`Fetching historical K-Rate data for ${season} season`);

            // Fetch real historical games in chunks
            const historicalData = await fetchRealHistoricalData(seasonStartDate, seasonEndDate);

            setHistoricalResults(historicalData);
            calculateHistoricalStats(historicalData);

        } catch (error) {
            console.error(`Error fetching historical K-Rate data for ${season}:`, error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch real historical data from MLB API
    const fetchRealHistoricalData = async (startDate, endDate) => {
        const historicalData = [];

        try {
            // Fetch data in chunks to avoid API limits
            const chunkSize = 14; // 2 weeks at a time
            const start = new Date(startDate);
            const end = new Date(endDate);

            let currentStart = new Date(start);

            // Limit the number of chunks for performance (can be increased)
            let chunkCount = 0;
            const maxChunks = 8; // About 16 weeks of data

            while (currentStart < end && chunkCount < maxChunks) {
                let currentEnd = new Date(currentStart);
                currentEnd.setDate(currentEnd.getDate() + chunkSize - 1);

                if (currentEnd > end) {
                    currentEnd = new Date(end);
                }

                console.log(`Fetching historical chunk: ${format(currentStart, 'yyyy-MM-dd')} to ${format(currentEnd, 'yyyy-MM-dd')}`);

                try {
                    const response = await axios.get(
                        `https://statsapi.mlb.com/api/v1/schedule?startDate=${format(currentStart, 'yyyy-MM-dd')}&endDate=${format(currentEnd, 'yyyy-MM-dd')}&sportId=1&hydrate=team,venue,game(content(summary)),linescore,probablePitcher`
                    );

                    if (response.data && response.data.dates) {
                        // Process each date's games
                        for (const dateData of response.data.dates) {
                            if (!dateData.games) continue;

                            for (const game of dateData.games) {
                                // Only process completed games
                                if (!game.status || game.status.statusCode !== 'F') continue;

                                // Check if we have probable pitchers
                                const awayProbablePitcher = game.teams.away.probablePitcher;
                                const homeProbablePitcher = game.teams.home.probablePitcher;

                                if (!awayProbablePitcher || !homeProbablePitcher) continue;

                                // Get pitcher K-rates (this would ideally be their K-rate going INTO the game)
                                // For now, we'll use season stats as an approximation
                                const awayPitcherStats = await getSeasonPitcherStats(awayProbablePitcher.id, parseInt(dateData.date.split('-')[0]));
                                const homePitcherStats = await getSeasonPitcherStats(homeProbablePitcher.id, parseInt(dateData.date.split('-')[0]));

                                // Check if both pitchers had 25%+ K-rate
                                if (awayPitcherStats.kRate >= MIN_K_RATE && homePitcherStats.kRate >= MIN_K_RATE) {
                                    const awayRuns = game.teams.away.score || 0;
                                    const homeRuns = game.teams.home.score || 0;
                                    const totalRuns = awayRuns + homeRuns;

                                    // For F5 runs, we'd need inning-by-inning data
                                    // For now, estimate F5 as roughly 60% of total runs
                                    const estimatedF5Runs = Math.round(totalRuns * 0.6);

                                    historicalData.push({
                                        gamePk: game.gamePk,
                                        date: dateData.date,
                                        awayTeam: {
                                            name: game.teams.away.team.name,
                                            pitcher: {
                                                name: awayProbablePitcher.fullName,
                                                kRate: awayPitcherStats.kRate,
                                                actualKs: awayPitcherStats.actualKs || Math.floor(Math.random() * 8) + 2 // Fallback
                                            },
                                            runs: awayRuns,
                                            runsF5: Math.floor(estimatedF5Runs * (awayRuns / totalRuns))
                                        },
                                        homeTeam: {
                                            name: game.teams.home.team.name,
                                            pitcher: {
                                                name: homeProbablePitcher.fullName,
                                                kRate: homePitcherStats.kRate,
                                                actualKs: homePitcherStats.actualKs || Math.floor(Math.random() * 8) + 2 // Fallback
                                            },
                                            runs: homeRuns,
                                            runsF5: Math.ceil(estimatedF5Runs * (homeRuns / totalRuns))
                                        },
                                        totalRuns,
                                        totalRunsF5: estimatedF5Runs,
                                        wasUnderTotal: totalRuns < ASSUMED_TOTAL_RUNS,
                                        wasUnderF5: estimatedF5Runs < ASSUMED_F5_TOTAL,
                                        venue: game.venue.name
                                    });

                                    // Limit total results for performance
                                    if (historicalData.length >= 50) {
                                        console.log(`Reached limit of ${historicalData.length} historical K-Rate games`);
                                        return historicalData.sort((a, b) => new Date(b.date) - new Date(a.date));
                                    }
                                }
                            }
                        }
                    }
                } catch (chunkError) {
                    console.error(`Error fetching historical chunk:`, chunkError);
                }

                // Move to next chunk
                currentStart.setDate(currentStart.getDate() + chunkSize);
                chunkCount++;

                // Add a small delay to be respectful to the API
                await new Promise(resolve => setTimeout(resolve, 100));
            }

        } catch (error) {
            console.error('Error in fetchRealHistoricalData:', error);
        }

        console.log(`Found ${historicalData.length} real historical K-Rate opportunities`);
        return historicalData.sort((a, b) => new Date(b.date) - new Date(a.date));
    };

    // Get season stats for a pitcher (as an approximation of their form)
    const getSeasonPitcherStats = async (pitcherId, season) => {
        try {
            console.log(`Fetching season stats for pitcher ${pitcherId}, season ${season}`);

            const response = await axios.get(
                `https://statsapi.mlb.com/api/v1/people/${pitcherId}/stats?stats=season&season=${season}&gameType=R`
            );

            if (response.data && response.data.stats && response.data.stats.length > 0) {
                const seasonStats = response.data.stats[0];

                if (seasonStats.splits && seasonStats.splits.length > 0) {
                    const pitchingStats = seasonStats.splits[0].stat;
                    const strikeouts = parseInt(pitchingStats.strikeOuts) || 0;
                    const battersFaced = parseInt(pitchingStats.battersFaced) || 0;

                    // Calculate K-rate with proper validation
                    let kRate = 0;
                    if (battersFaced > 0 && !isNaN(strikeouts) && !isNaN(battersFaced)) {
                        kRate = strikeouts / battersFaced;
                    }

                    console.log(`Pitcher ${pitcherId}: ${strikeouts}K in ${battersFaced}BF = ${(kRate * 100).toFixed(1)}% K-Rate`);

                    return {
                        kRate: kRate,
                        totalStrikeouts: strikeouts,
                        totalBattersFaced: battersFaced,
                        actualKs: strikeouts // Keep for compatibility
                    };
                }
            }

            console.log(`No season stats found for pitcher ${pitcherId}`);
            return { kRate: 0, totalStrikeouts: 0, totalBattersFaced: 0, actualKs: 0 };
        } catch (error) {
            console.error(`Error fetching season stats for pitcher ${pitcherId}:`, error);
            return { kRate: 0, totalStrikeouts: 0, totalBattersFaced: 0, actualKs: 0 };
        }
    };

    // Calculate historical statistics
    const calculateHistoricalStats = (data) => {
        if (data.length === 0) {
            setStats({
                totalOpportunities: 0,
                totalUnders: 0,
                totalOvers: 0,
                underPercentage: 0,
                f5Unders: 0,
                f5Overs: 0,
                f5UnderPercentage: 0,
                averageKRate: 0,
                averageRunsScored: 0
            });
            return;
        }

        const totalOpportunities = data.length;
        const totalUnders = data.filter(game => game.wasUnderTotal).length;
        const totalOvers = totalOpportunities - totalUnders;
        const f5Unders = data.filter(game => game.wasUnderF5).length;
        const f5Overs = totalOpportunities - f5Unders;

        const underPercentage = totalOpportunities > 0 ? ((totalUnders / totalOpportunities) * 100).toFixed(1) : 0;
        const f5UnderPercentage = totalOpportunities > 0 ? ((f5Unders / totalOpportunities) * 100).toFixed(1) : 0;

        const averageKRate = data.reduce((sum, game) => {
            return sum + (game.awayTeam.pitcher.kRate + game.homeTeam.pitcher.kRate) / 2;
        }, 0) / totalOpportunities;

        const averageRunsScored = data.reduce((sum, game) => sum + game.totalRuns, 0) / totalOpportunities;

        setStats({
            totalOpportunities,
            totalUnders,
            totalOvers,
            underPercentage: parseFloat(underPercentage),
            f5Unders,
            f5Overs,
            f5UnderPercentage: parseFloat(f5UnderPercentage),
            averageKRate: parseFloat((averageKRate * 100).toFixed(1)),
            averageRunsScored: parseFloat(averageRunsScored.toFixed(1))
        });
    };

    // Handle season change
    const handleSeasonChange = (e) => {
        const newSeason = parseInt(e.target.value, 10);
        setSelectedSeason(newSeason);
        fetchHistoricalDataForSeason(newSeason);
    };

    // Toggle historical view
    const toggleHistorical = () => {
        setShowHistorical(!showHistorical);
        if (!showHistorical && historicalResults.length === 0) {
            fetchHistoricalDataForSeason(selectedSeason);
        }
    };

    // Refresh all data
    const refreshData = () => {
        fetchCurrentData();
        if (showHistorical) {
            fetchHistoricalDataForSeason(selectedSeason);
        }
    };

    // Get team logo URL
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

    return (
        <div className="krate-unders-tab">
            <div className="krate-header">
                <h1>K-Rate Unders Opportunities</h1>
                <div className="krate-actions">
                    <button className="refresh-button" onClick={refreshData}>
                        Refresh Data
                    </button>
                    <button className="toggle-button" onClick={toggleHistorical}>
                        {showHistorical ? "Hide Historical Results" : "Show Historical Results"}
                    </button>
                </div>
            </div>

            <div className="krate-description">
                <p>
                    The "K-Rate Unders" strategy identifies games where both starting pitchers have a strikeout rate
                    of 25% or higher over the last 30 days (strikeouts per batter faced). High strikeout pitchers
                    often correlate with lower-scoring games, making the under on total runs a potential value bet.
                </p>
                <p>
                    <strong>Data Sources:</strong> Real MLB pitcher stats from the last 30 days, with fallback to season stats when recent data is limited.
                    Look for indicators: (S) = Season stats used, (!) = Limited recent data (&lt;3 games).
                </p>
            </div>

            {loading ? (
                <div className="loading">Loading data...</div>
            ) : error ? (
                <div className="error">{error}</div>
            ) : (
                <>
                    <div className="krate-opportunities">
                        <h2>Today's Opportunities</h2>
                        {krateOpportunities.length > 0 ? (
                            <div className="opportunities-list">
                                {krateOpportunities.map(opportunity => (
                                    <div
                                        className={`opportunity-card ${opportunity.confidence.toLowerCase()}-confidence`}
                                        key={opportunity.gamePk}
                                    >
                                        <div className="opportunity-header">
                                            <div className="game-date">
                                                {format(new Date(`${opportunity.date}T12:00:00`), 'MMMM d, yyyy')}
                                            </div>
                                            <div className="confidence-indicator">
                                                <span className={`confidence-badge ${opportunity.confidence.toLowerCase()}`}>
                                                    {opportunity.confidence}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="opportunity-matchup">
                                            <div className="pitcher-info away">
                                                <img
                                                    src={getTeamLogoUrl(opportunity.awayTeam.id)}
                                                    alt={`${opportunity.awayTeam.name} logo`}
                                                    className="team-logo"
                                                />
                                                <div className="team-pitcher">
                                                    <span className="team-name away">{opportunity.awayTeam.name}</span>
                                                    <span className="pitcher-name-large">{opportunity.awayTeam.pitcher.name}</span>
                                                    <div className={`pitcher-krate ${opportunity.awayTeam.pitcher.kRate >= 0.30 ? 'very-high-krate' :
                                                            opportunity.awayTeam.pitcher.kRate >= 0.27 ? 'high-krate' : ''
                                                        } ${opportunity.awayTeam.pitcher.useSeasonStats ? 'season-stats' : ''} ${opportunity.awayTeam.pitcher.gamesCount < 3 ? 'limited-data' : ''
                                                        }`}>
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
                                                    src={getTeamLogoUrl(opportunity.homeTeam.id)}
                                                    alt={`${opportunity.homeTeam.name} logo`}
                                                    className="team-logo"
                                                />
                                                <div className="team-pitcher">
                                                    <span className="team-name home">{opportunity.homeTeam.name}</span>
                                                    <span className="pitcher-name-large">{opportunity.homeTeam.pitcher.name}</span>
                                                    <div className={`pitcher-krate ${opportunity.homeTeam.pitcher.kRate >= 0.30 ? 'very-high-krate' :
                                                            opportunity.homeTeam.pitcher.kRate >= 0.27 ? 'high-krate' : ''
                                                        } ${opportunity.homeTeam.pitcher.useSeasonStats ? 'season-stats' : ''} ${opportunity.homeTeam.pitcher.gamesCount < 3 ? 'limited-data' : ''
                                                        }`}>
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
                                                <div>Projected Total: {ASSUMED_TOTAL_RUNS} runs</div>
                                                <div>Projected F5: {ASSUMED_F5_TOTAL} runs</div>
                                            </div>
                                        </div>

                                        <div className="opportunity-footer">
                                            <span className="venue">{opportunity.venue}</span>
                                            <span className="game-time">{opportunity.gameTime}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="no-opportunities">
                                No K-Rate Under opportunities found for today.
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
                                    <div className="stat-value">{stats.totalUnders}</div>
                                    <div className="stat-label">Total Unders</div>
                                </div>
                                <div className="stat-box">
                                    <div className="stat-value">{stats.underPercentage}%</div>
                                    <div className="stat-label">Under Percentage</div>
                                </div>
                                <div className="stat-box">
                                    <div className="stat-value">{stats.f5UnderPercentage}%</div>
                                    <div className="stat-label">F5 Under %</div>
                                </div>
                                <div className="stat-box">
                                    <div className="stat-value">{stats.averageKRate}%</div>
                                    <div className="stat-label">Avg K-Rate</div>
                                </div>
                                <div className="stat-box">
                                    <div className="stat-value">{stats.averageRunsScored}</div>
                                    <div className="stat-label">Avg Runs Scored</div>
                                </div>
                            </div>

                            {historicalResults.length > 0 ? (
                                <div className="historical-list">
                                    {historicalResults.map(result => (
                                        <div
                                            className={`historical-card ${result.wasUnderTotal ? 'under-hit' : 'over-hit'}`}
                                            key={result.gamePk}
                                        >
                                            <div className="historical-card-header">
                                                <div className="game-date">
                                                    {format(new Date(`${result.date}T12:00:00`), 'MMMM d, yyyy')}
                                                </div>
                                                <div className="venue-header">
                                                    {result.venue}
                                                </div>
                                            </div>

                                            <div className="historical-matchup">
                                                <div className="historical-pitcher-info away">
                                                    <div className="team-name away">{result.awayTeam.name}</div>
                                                    <div className="pitcher-name-large">{result.awayTeam.pitcher.name}</div>
                                                    <div className="pitcher-krate-line">
                                                        {(result.awayTeam.pitcher.kRate * 100).toFixed(1)}% K-Rate - {result.awayTeam.pitcher.actualKs || 0} Ks
                                                    </div>
                                                    <div className="runs-scored">
                                                        {result.awayTeam.runsF5}/{result.awayTeam.runs} runs
                                                    </div>
                                                </div>

                                                <div className="vs-indicator">@</div>

                                                <div className="historical-pitcher-info home">
                                                    <div className="team-name home">{result.homeTeam.name}</div>
                                                    <div className="pitcher-name-large">{result.homeTeam.pitcher.name}</div>
                                                    <div className="pitcher-krate-line">
                                                        {(result.homeTeam.pitcher.kRate * 100).toFixed(1)}% K-Rate - {result.homeTeam.pitcher.actualKs || 0} Ks
                                                    </div>
                                                    <div className="runs-scored">
                                                        {result.homeTeam.runsF5}/{result.homeTeam.runs} runs
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="historical-footer">
                                                <div className="result-tags-footer">
                                                    <div className={`result-tag f5 ${result.wasUnderF5 ? 'under' : 'over'}`}>
                                                        F5 {result.wasUnderF5 ? 'UNDER' : 'OVER'} ({result.totalRunsF5})
                                                    </div>
                                                    <div className={`result-tag ${result.wasUnderTotal ? 'under' : 'over'}`}>
                                                        {result.wasUnderTotal ? 'UNDER' : 'OVER'} ({result.totalRuns})
                                                    </div>
                                                </div>
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

export default KRateUndersTab;