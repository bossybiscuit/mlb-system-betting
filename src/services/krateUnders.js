import axios from 'axios';
import { format, subDays } from 'date-fns';

// Constants for betting lines
const ASSUMED_TOTAL_RUNS = 8.5;
const ASSUMED_F5_TOTAL = 4.5;
const MIN_K_RATE = 0.25; // 25%
const LOOKBACK_DAYS = 30;

// Get pitcher K-rate over last 30 days
async function getPitcherKRate(pitcherId) {
    try {
        const today = new Date();
        const thirtyDaysAgo = subDays(today, LOOKBACK_DAYS);
        const startDate = format(thirtyDaysAgo, 'yyyy-MM-dd');
        const endDate = format(today, 'yyyy-MM-dd');
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
                    if (bf > 0) {
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
                return {
                    kRate,
                    totalStrikeouts,
                    totalBattersFaced,
                    recentGames: recentGames.slice(0, 5),
                    gamesCount: recentGames.length
                };
            }
        }
        // If no recent games, try to get season stats as fallback
        const seasonStats = await getSeasonPitcherStats(pitcherId, new Date().getFullYear());
        if (seasonStats.kRate > 0) {
            return {
                kRate: seasonStats.kRate,
                totalStrikeouts: seasonStats.totalStrikeouts,
                totalBattersFaced: seasonStats.totalBattersFaced,
                recentGames: [],
                gamesCount: 0,
                useSeasonStats: true
            };
        }
        return {
            kRate: 0,
            totalStrikeouts: 0,
            totalBattersFaced: 0,
            recentGames: [],
            gamesCount: 0
        };
    } catch {
        return {
            kRate: 0,
            totalStrikeouts: 0,
            totalBattersFaced: 0,
            recentGames: [],
            gamesCount: 0
        };
    }
}

// Get season stats for a pitcher
async function getSeasonPitcherStats(pitcherId, season) {
    try {
        const response = await axios.get(
            `https://statsapi.mlb.com/api/v1/people/${pitcherId}/stats?stats=season&season=${season}&gameType=R`
        );
        if (response.data && response.data.stats && response.data.stats.length > 0) {
            const seasonStats = response.data.stats[0];
            if (seasonStats.splits && seasonStats.splits.length > 0) {
                const pitchingStats = seasonStats.splits[0].stat;
                const strikeouts = parseInt(pitchingStats.strikeOuts) || 0;
                const battersFaced = parseInt(pitchingStats.battersFaced) || 0;
                let kRate = 0;
                if (battersFaced > 0 && !isNaN(strikeouts) && !isNaN(battersFaced)) {
                    kRate = strikeouts / battersFaced;
                }
                return {
                    kRate: kRate,
                    totalStrikeouts: strikeouts,
                    totalBattersFaced: battersFaced,
                    actualKs: strikeouts
                };
            }
        }
        return { kRate: 0, totalStrikeouts: 0, totalBattersFaced: 0, actualKs: 0 };
    } catch {
        return { kRate: 0, totalStrikeouts: 0, totalBattersFaced: 0, actualKs: 0 };
    }
}

// Get team strikeout rate as batters
async function getTeamStrikeoutRate(teamId) {
    try {
        const currentYear = new Date().getFullYear();
        const response = await axios.get(
            `https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=season&season=${currentYear}&gameType=R`
        );
        if (response.data && response.data.stats && response.data.stats.length > 0) {
            let hittingStats = response.data.stats.find(stat =>
                stat.group && stat.group.displayName === 'hitting'
            );
            if (!hittingStats) {
                hittingStats = response.data.stats.find(stat =>
                    stat.splits && stat.splits.length > 0 &&
                    stat.splits[0].stat &&
                    (stat.splits[0].stat.strikeOuts !== undefined || stat.splits[0].stat.avg !== undefined)
                );
            }
            if (hittingStats && hittingStats.splits && hittingStats.splits.length > 0) {
                const hitting = hittingStats.splits[0].stat;
                const strikeouts = parseInt(hitting.strikeOuts) || 0;
                const atBats = parseInt(hitting.atBats) || 0;
                const walks = parseInt(hitting.walks) || 0;
                const hitByPitch = parseInt(hitting.hitByPitch) || 0;
                const sacFlies = parseInt(hitting.sacFlies) || 0;
                const sacBunts = parseInt(hitting.sacBunts) || 0;
                const plateAppearances = atBats + walks + hitByPitch + sacFlies + sacBunts;
                const directPA = parseInt(hitting.plateAppearances) || 0;
                const finalPA = Math.max(plateAppearances, directPA);
                if (finalPA > 0) {
                    return strikeouts / finalPA;
                }
            }
        }
        return 0.225;
    } catch {
        return 0.225;
    }
}

// Main function to fetch today's K Rate Unders opportunities
export async function fetchKRateUndersOpportunities() {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    try {
        const response = await axios.get(
            `https://statsapi.mlb.com/api/v1/schedule?date=${todayStr}&sportId=1&hydrate=team,venue,game(content(summary)),linescore,probablePitcher`
        );
        if (response.data && response.data.dates && response.data.dates.length > 0) {
            const todayGames = response.data.dates[0].games;
            const opportunities = [];
            for (const game of todayGames) {
                const awayProbablePitcher = game.teams.away.probablePitcher;
                const homeProbablePitcher = game.teams.home.probablePitcher;
                if (!awayProbablePitcher || !homeProbablePitcher) continue;
                const awayTeam = game.teams.away.team;
                const homeTeam = game.teams.home.team;
                const awayPitcherStats = await getPitcherKRate(awayProbablePitcher.id);
                const homePitcherStats = await getPitcherKRate(homeProbablePitcher.id);
                if (awayPitcherStats.totalBattersFaced === 0 && homePitcherStats.totalBattersFaced === 0) continue;
                const awayTeamSORate = await getTeamStrikeoutRate(awayTeam.id);
                const homeTeamSORate = await getTeamStrikeoutRate(homeTeam.id);
                if (awayPitcherStats.kRate >= MIN_K_RATE && homePitcherStats.kRate >= MIN_K_RATE) {
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
                        isRecommendedUnder: true,
                        confidence: confidence,
                        status: game.status.detailedState
                    });
                }
            }
            return opportunities;
        } else {
            return [];
        }
    } catch (error) {
        return [];
    }
} 