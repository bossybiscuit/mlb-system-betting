import React, { useState, useEffect } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import axios from 'axios';
import PickScroller from './PickScroller';
import './TrendsTab.css';
import { fetchOdds, formatOdds } from '../services/oddsApi';


function TrendsTab({ trendsData, seasonTravelGames, loading, seasonYear, handleSeasonYearChange, picksOfTheDay, picksLoading }) {
    const [showAllGames, setShowAllGames] = useState(false);
    const [selectedType, setSelectedType] = useState(null);
    const [selectedComparison, setSelectedComparison] = useState(null);
    const [selectedTeam, setSelectedTeam] = useState('');
    const [seasonStats, setSeasonStats] = useState({
        byType: {
            'Home to Away': { wins: 0, losses: 0, total: 0, percentage: 0 },
            'Away to Away': { wins: 0, losses: 0, total: 0, percentage: 0 },
            'Away to Home': { wins: 0, losses: 0, total: 0, percentage: 0 },
            'Home to Home (no Rest)': { wins: 0, losses: 0, total: 0, percentage: 0 },
            'Home to Home (with Rest)': { wins: 0, losses: 0, total: 0, percentage: 0 },
        }
    });
    const [seasonGamesList, setSeasonGamesList] = useState([]);
    const [seasonHomeVsTravelGames, setSeasonHomeVsTravelGames] = useState([]);
    const [seasonLoading, setSeasonLoading] = useState(true);
    const [oddsData, setOddsData] = useState({});

    // Direct matchup stats for comparison
    const [matchupStats, setMatchupStats] = useState({
        'Home to Away vs Away to Home': { first: { wins: 0, losses: 0 }, second: { wins: 0, losses: 0 }, games: [] },
        'Away to Away vs Away to Home': { first: { wins: 0, losses: 0 }, second: { wins: 0, losses: 0 }, games: [] },
        'Home to Away vs Home to Home (no Rest)': { first: { wins: 0, losses: 0 }, second: { wins: 0, losses: 0 }, games: [] },
        'Away to Away vs Home to Home (no Rest)': { first: { wins: 0, losses: 0 }, second: { wins: 0, losses: 0 }, games: [] },
        'Home to Away vs Home to Home (Rest)': { first: { wins: 0, losses: 0 }, second: { wins: 0, losses: 0 }, games: [] },
        'Away to Away vs Home to Home (Rest)': { first: { wins: 0, losses: 0 }, second: { wins: 0, losses: 0 }, games: [] },
    });

    useEffect(() => {
        fetchSeasonData();
    }, [seasonYear]);

    // Fetch data for the whole season
    const fetchSeasonData = async () => {
        setSeasonLoading(true);
        try {
            // Define season dates - starting from March 27
            const seasonStartDate = `${seasonYear}-03-27`;
            const seasonEndDate = `${seasonYear}-11-01`;  // Usually ends by November

            // Fetch data in chunks to avoid overwhelming the API
            const chunkSize = 30; // Days per chunk
            const startDate = new Date(seasonStartDate);
            const endDate = new Date(seasonEndDate);
            const today = new Date();

            // Don't fetch beyond today's date
            if (endDate > today) {
                endDate.setTime(today.getTime());
            }

            const allDates = [];
            let currentChunkStart = new Date(startDate);

            while (currentChunkStart < endDate) {
                let currentChunkEnd = new Date(currentChunkStart);
                currentChunkEnd.setDate(currentChunkEnd.getDate() + chunkSize - 1);

                if (currentChunkEnd > endDate) {
                    currentChunkEnd = new Date(endDate);
                }

                console.log(`Fetching from ${format(currentChunkStart, 'yyyy-MM-dd')} to ${format(currentChunkEnd, 'yyyy-MM-dd')}`);

                try {
                    const response = await axios.get(
                        `https://statsapi.mlb.com/api/v1/schedule?startDate=${format(currentChunkStart, 'yyyy-MM-dd')}&endDate=${format(currentChunkEnd, 'yyyy-MM-dd')}&sportId=1&hydrate=team,venue,game(content(summary)),linescore`
                    );

                    if (response.data && response.data.dates) {
                        allDates.push(...response.data.dates);
                    }
                } catch (error) {
                    console.error(`Error fetching chunk from ${format(currentChunkStart, 'yyyy-MM-dd')} to ${format(currentChunkEnd, 'yyyy-MM-dd')}:`, error);
                }

                // Move to next chunk
                currentChunkStart.setDate(currentChunkStart.getDate() + chunkSize);
            }

            console.log(`Fetched data for ${allDates.length} days`);

            // Validate data integrity
            const validGamesCount = allDates.reduce((count, date) => {
                return count + (date.games ? date.games.length : 0);
            }, 0);

            console.log(`Total valid games found: ${validGamesCount}`);

            // Process the data
            const { games, directMatchups } = processGames(allDates);
            console.log(`Processed games: ${games.length}`);
            setSeasonGamesList(games);

            // Calculate stats for all game types
            const statsResult = calculateStats(games);
            setSeasonStats(statsResult);

            // Calculate direct matchup stats
            calculateDirectMatchupStats(games, directMatchups);
        } catch (error) {
            console.error('Error fetching MLB season data:', error);
        } finally {
            setSeasonLoading(false);
        }
    };

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

    const processGames = (dates) => {
        // Create a map to track where each team played last
        const teamGames = {};
        const processedGames = [];
        const directMatchups = [];
        const gameIds = new Set(); // Track unique game IDs to avoid duplicates

        // First pass - record all games for each team
        dates.forEach((dateData) => {
            const currentDate = dateData.date;

            dateData.games.forEach((game) => {
                // Only process MLB regular season games
                if (game.status && (game.status.abstractGameState === 'Final' || game.status.abstractGameState === 'Live')) {
                    const awayTeam = game.teams.away.team;
                    const homeTeam = game.teams.home.team;
                    const venue = game.venue.name;

                    // Initialize team games arrays if needed
                    if (!teamGames[awayTeam.id]) teamGames[awayTeam.id] = [];
                    if (!teamGames[homeTeam.id]) teamGames[homeTeam.id] = [];

                    // Add this game to each team's list
                    teamGames[awayTeam.id].push({
                        date: currentDate,
                        venue: venue,
                        isHome: false,
                        opponent: homeTeam,
                        gameId: game.gamePk
                    });

                    teamGames[homeTeam.id].push({
                        date: currentDate,
                        venue: venue,
                        isHome: true,
                        opponent: awayTeam,
                        gameId: game.gamePk
                    });
                }
            });
        });

        // Second pass - sort games by date for each team
        Object.keys(teamGames).forEach(teamId => {
            teamGames[teamId].sort((a, b) =>
                new Date(a.date) - new Date(b.date)
            );
        });

        // Third pass - process all dates in sequence
        dates.forEach((dateData) => {
            const currentDate = dateData.date;

            dateData.games.forEach((game) => {
                // Skip if we've already processed this game
                if (gameIds.has(game.gamePk)) return;
                gameIds.add(game.gamePk);

                // Only process MLB regular season games
                if (!game.status || (game.status.abstractGameState !== 'Final' && game.status.abstractGameState !== 'Live')) {
                    return;
                }

                const awayTeam = game.teams.away.team;
                const homeTeam = game.teams.home.team;
                const venue = game.venue.name;

                // Get game result if available
                let awayTeamWon = null;
                let homeTeamWon = null;

                if (game.status && game.status.statusCode === 'F') {
                    if (game.teams.away.score !== undefined && game.teams.home.score !== undefined) {
                        awayTeamWon = game.teams.away.score > game.teams.home.score;
                        homeTeamWon = game.teams.home.score > game.teams.away.score;
                    }
                }

                // Process away team travel
                let awayTeamTravelType = "Rest Day";
                let awayTeamHadToTravel = false;
                let awayTeamRestDays = 0;

                // Find previous game for away team
                const awayTeamGames = teamGames[awayTeam.id];
                const currentGameIndex = awayTeamGames.findIndex(g => g.date === currentDate);

                if (currentGameIndex > 0) {
                    const prevGame = awayTeamGames[currentGameIndex - 1];
                    const dayDiff = differenceInDays(
                        new Date(`${currentDate}T12:00:00`),
                        new Date(`${prevGame.date}T12:00:00`)
                    );

                    if (dayDiff === 1) {
                        // Played yesterday - ONLY these count as travel types
                        if (prevGame.venue !== venue) {
                            // Had to travel
                            awayTeamTravelType = prevGame.isHome ? 'Home to Away' : 'Away to Away';
                            awayTeamHadToTravel = true;
                        } else {
                            // Same venue (rare, but possible)
                            awayTeamTravelType = prevGame.isHome ? 'Home to Home (no Rest)' : 'Away to Away (Same Venue)';
                            // Only set had to travel to true for actual traveling scenarios
                            awayTeamHadToTravel = false;
                        }
                    } else {
                        // Had rest day(s) - do NOT count as travel types
                        awayTeamRestDays = dayDiff - 1;

                        // If there was a rest day, we don't classify it as a travel game
                        if (prevGame.isHome) {
                            awayTeamTravelType = `Rest Day (Home)`;
                        } else {
                            awayTeamTravelType = `Rest Day (Away)`;
                        }
                        awayTeamHadToTravel = false;
                    }
                } else {
                    // First game of the season
                    awayTeamTravelType = "Rest Day (First Game)";
                }

                // Process home team travel
                let homeTeamTravelType = "Rest Day";
                let homeTeamHadToTravel = false;
                let homeTeamRestDays = 0;

                // Find previous game for home team
                const homeTeamGames = teamGames[homeTeam.id];
                const homeGameIndex = homeTeamGames.findIndex(g => g.date === currentDate);

                if (homeGameIndex > 0) {
                    const prevGame = homeTeamGames[homeGameIndex - 1];
                    const dayDiff = differenceInDays(
                        new Date(`${currentDate}T12:00:00`),
                        new Date(`${prevGame.date}T12:00:00`)
                    );

                    if (dayDiff === 1) {
                        // Played yesterday - ONLY these count as travel types
                        if (prevGame.venue !== venue) {
                            // Had to travel
                            homeTeamTravelType = prevGame.isHome ? 'Home to Away' : 'Away to Home';
                            homeTeamHadToTravel = true;
                        } else {
                            // Same venue
                            homeTeamTravelType = prevGame.isHome ? 'Home to Home (no Rest)' : 'Away to Away (Same Venue)';
                            homeTeamHadToTravel = false;
                        }
                    } else {
                        // Had rest day(s) - do NOT count as travel types
                        homeTeamRestDays = dayDiff - 1;

                        if (prevGame.isHome && homeTeamGames[homeGameIndex].isHome) {
                            homeTeamTravelType = 'Home to Home (Rest)';
                            homeTeamHadToTravel = false;
                        } else {
                            // If there was a rest day, we don't classify it as a travel game
                            if (prevGame.isHome) {
                                homeTeamTravelType = `Rest Day (Home)`;
                            } else {
                                homeTeamTravelType = `Rest Day (Away)`;
                            }
                            homeTeamHadToTravel = false;
                        }
                    }
                } else {
                    // First game of the season
                    homeTeamTravelType = "Rest Day (First Game)";
                }

                // Create game objects for both teams
                const homeTeamGameObj = {
                    date: currentDate,
                    team: homeTeam.name,
                    teamId: homeTeam.id,
                    opponent: awayTeam.name,
                    opponentId: awayTeam.id,
                    teamTravel: homeTeamTravelType,
                    opponentTravel: awayTeamTravelType,
                    travelType: homeTeamTravelType,
                    won: homeTeamWon,
                    gamePk: game.gamePk,
                    venue: venue,
                    isHome: true,
                    restDays: homeTeamRestDays
                };

                const awayTeamGameObj = {
                    date: currentDate,
                    team: awayTeam.name,
                    teamId: awayTeam.id,
                    opponent: homeTeam.name,
                    opponentId: homeTeam.id,
                    teamTravel: awayTeamTravelType,
                    opponentTravel: homeTeamTravelType,
                    travelType: awayTeamTravelType,
                    won: awayTeamWon,
                    gamePk: game.gamePk,
                    venue: venue,
                    isHome: false,
                    restDays: awayTeamRestDays
                };

                // Validation check - confirm teams and venues
                const homeTeamHistory = teamGames[homeTeam.id];
                const awayTeamHistory = teamGames[awayTeam.id];

                // Confirm this game exists in the team's history
                const awayGameIndex = awayTeamHistory.findIndex(g => g.gameId === game.gamePk);
                const homeGameIndexFromHistory = homeTeamHistory.findIndex(g => g.gameId === game.gamePk);

                if (awayGameIndex >= 0 && homeGameIndexFromHistory >= 0) {
                    processedGames.push(homeTeamGameObj);
                    processedGames.push(awayTeamGameObj);
                }

                // Create direct matchup data
                if (homeTeamTravelType === 'Home to Home (no Rest)' &&
                    (awayTeamTravelType === 'Away to Away' || awayTeamTravelType === 'Home to Away')) {
                    directMatchups.push({
                        date: currentDate,
                        homeTeam: {
                            name: homeTeam.name,
                            travelType: homeTeamTravelType,
                            won: homeTeamWon
                        },
                        awayTeam: {
                            name: awayTeam.name,
                            travelType: awayTeamTravelType,
                            won: awayTeamWon
                        },
                        venue: venue,
                        gamePk: game.gamePk,
                        matchupKey: `${awayTeamTravelType} vs ${homeTeamTravelType}`,
                        isAwayFirst: true
                    });
                }
                else if (homeTeamTravelType === 'Home to Home (Rest)' &&
                    (awayTeamTravelType === 'Away to Away' || awayTeamTravelType === 'Home to Away')) {
                    directMatchups.push({
                        date: currentDate,
                        homeTeam: {
                            name: homeTeam.name,
                            travelType: homeTeamTravelType,
                            won: homeTeamWon
                        },
                        awayTeam: {
                            name: awayTeam.name,
                            travelType: awayTeamTravelType,
                            won: awayTeamWon
                        },
                        venue: venue,
                        gamePk: game.gamePk,
                        matchupKey: `${awayTeamTravelType} vs ${homeTeamTravelType}`,
                        isAwayFirst: true
                    });
                }
                else if (homeTeamTravelType === 'Away to Home' &&
                    (awayTeamTravelType === 'Away to Away' || awayTeamTravelType === 'Home to Away')) {
                    directMatchups.push({
                        date: currentDate,
                        homeTeam: {
                            name: homeTeam.name,
                            travelType: homeTeamTravelType,
                            won: homeTeamWon
                        },
                        awayTeam: {
                            name: awayTeam.name,
                            travelType: awayTeamTravelType,
                            won: awayTeamWon
                        },
                        venue: venue,
                        gamePk: game.gamePk,
                        matchupKey: `${awayTeamTravelType} vs ${homeTeamTravelType}`,
                        isAwayFirst: true
                    });
                }
            });
        });

        // Return processed filtered games
        return {
            games: processedGames.filter(game => {
                // Additional validation - make sure we don't have any incorrectly mapped games
                if (!game.team || !game.opponent || !game.venue) {
                    return false;
                }
                return true;
            }), directMatchups
        };
    };

    const calculateStats = (games) => {
        const byType = {
            'Home to Away': { wins: 0, losses: 0, total: 0, percentage: 0 },
            'Away to Away': { wins: 0, losses: 0, total: 0, percentage: 0 },
            'Away to Home': { wins: 0, losses: 0, total: 0, percentage: 0 },
            'Home to Home (no Rest)': { wins: 0, losses: 0, total: 0, percentage: 0 },
            'Home to Home (Rest)': { wins: 0, losses: 0, total: 0, percentage: 0 }
        };

        // Process all games
        games.forEach(game => {
            // Only count completed games with a result
            if (game.won === true || game.won === false) {
                // For Home to Home (no Rest) and Home to Home (with Rest), only count when 
                // playing against Away to Away or Home to Away
                if ((game.travelType === 'Home to Home (no Rest)' || game.travelType === 'Home to Home (with Rest)') &&
                    (game.opponentTravel !== 'Away to Away' && game.opponentTravel !== 'Home to Away')) {
                    return; // Skip this game as it doesn't meet the criteria
                }

                // Skip games at the same away venue (not true Away to Away scenario)
                if (game.travelType === 'Away to Away (Same Venue)') {
                    return; // Skip games where team stays at same away venue
                }

                // Update stats for this travel type - handle special cases
                if (game.travelType === 'Away to Away (Same Venue)') {
                    // Skip, don't count as Away to Away
                } else if (byType[game.travelType]) {
                    if (game.won === true) {
                        byType[game.travelType].wins++;
                    } else {
                        byType[game.travelType].losses++;
                    }
                }
            }
        });

        // Calculate totals and percentages
        Object.keys(byType).forEach(type => {
            const typeTotal = byType[type].wins + byType[type].losses;
            byType[type].total = typeTotal;
            byType[type].percentage = typeTotal > 0 ?
                ((byType[type].wins / typeTotal) * 100).toFixed(1) : 0;
        });

        return { byType };
    };

    const calculateDirectMatchupStats = (games, directMatchups) => {
        const stats = {
            'Home to Away vs Away to Home': { first: { wins: 0, losses: 0 }, second: { wins: 0, losses: 0 }, games: [] },
            'Away to Away vs Away to Home': { first: { wins: 0, losses: 0 }, second: { wins: 0, losses: 0 }, games: [] },
            'Home to Away vs Home to Home (no Rest)': { first: { wins: 0, losses: 0 }, second: { wins: 0, losses: 0 }, games: [] },
            'Away to Away vs Home to Home (no Rest)': { first: { wins: 0, losses: 0 }, second: { wins: 0, losses: 0 }, games: [] },
            'Home to Away vs Home to Home (Rest)': { first: { wins: 0, losses: 0 }, second: { wins: 0, losses: 0 }, games: [] },
            'Away to Away vs Home to Home (Rest)': { first: { wins: 0, losses: 0 }, second: { wins: 0, losses: 0 }, games: [] }
        };

        // For each game, find direct matchups
        games.forEach(game => {
            // Only consider completed games
            if (game.won === null) return;

            // We're only interested in specific matchups
            const matchupTypePairs = [
                ['Home to Away', 'Away to Home'],
                ['Away to Away', 'Away to Home'],
                ['Home to Away', 'Home to Home (no Rest)'],
                ['Away to Away', 'Home to Home (no Rest)'],
                ['Home to Away', 'Home to Home (Rest)'],
                ['Away to Away', 'Home to Home (Rest)']
            ];

            // Check if this game qualifies for any of our tracked matchups
            for (const [firstType, secondType] of matchupTypePairs) {
                const matchupKey = `${firstType} vs ${secondType}`;

                // Check if this game is a matchup between firstType and secondType
                if ((game.travelType === firstType && game.opponentTravel === secondType) ||
                    (game.travelType === secondType && game.opponentTravel === firstType)) {

                    // Determine which type this team represents in the matchup
                    const isFirstType = game.travelType === firstType;

                    // Update stats for the appropriate type
                    if (isFirstType) {
                        if (game.won) {
                            stats[matchupKey].first.wins++;
                        } else {
                            stats[matchupKey].first.losses++;
                        }
                    } else {
                        if (game.won) {
                            stats[matchupKey].second.wins++;
                        } else {
                            stats[matchupKey].second.losses++;
                        }
                    }

                    // Add to the games list if not already there (avoid duplicates)
                    const isGameInList = stats[matchupKey].games.some(g => g.gamePk === game.gamePk);
                    if (!isGameInList) {
                        stats[matchupKey].games.push(game);
                    }
                }
            }
        });

        setMatchupStats(stats);
    };

    // Get unique teams from the games list
    const getUniqueTeams = () => {
        const teamsMap = new Map();  // Using Map to ensure uniqueness by team ID
        seasonGamesList.forEach(game => {
            if (!teamsMap.has(game.teamId)) {
                teamsMap.set(game.teamId, { id: game.teamId, name: game.team });
            }
            if (!teamsMap.has(game.opponentId)) {
                teamsMap.set(game.opponentId, { id: game.opponentId, name: game.opponent });
            }
        });
        return Array.from(teamsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    };

    // Update getFilteredGames to include team filtering
    const getFilteredGames = () => {
        let filtered = seasonGamesList;
        
        // Apply travel type/comparison filters first
        if (selectedComparison) {
            filtered = matchupStats[selectedComparison]?.games || [];
        } else if (selectedType) {
            if (selectedType === 'Home to Home (no Rest)' || selectedType === 'Home to Home (Rest)') {
                filtered = filtered.filter(game =>
                    game.travelType === selectedType &&
                    (game.opponentTravel === 'Away to Away' || game.opponentTravel === 'Home to Away')
                );
            } else if (selectedType === 'Away to Away') {
                filtered = filtered.filter(game =>
                    game.travelType === 'Away to Away' && game.travelType !== 'Away to Away (Same Venue)'
                );
            } else {
                filtered = filtered.filter(game => game.travelType === selectedType);
            }
        }

        // Then apply team filter if a team is selected
        if (selectedTeam) {
            filtered = filtered.filter(game => 
                game.teamId === Number(selectedTeam) || game.opponentId === Number(selectedTeam)
            );
        }

        return filtered;
    };

    const filteredGames = getFilteredGames();

    // Limit the number of games shown unless showing all
    const displayedGames = showAllGames ? filteredGames : filteredGames.slice(0, 20);

    // Travel types we're interested in
    const travelTypes = [
        'Home to Away',
        'Away to Away',
        'Away to Home',
        'Home to Home (no Rest)',
        'Home to Home (Rest)'
    ];

    // Predefined comparison pairs
    const comparisonPairs = [
        ['Home to Away', 'Away to Home'],
        ['Away to Away', 'Away to Home'],
        ['Home to Away', 'Home to Home (no Rest)'],
        ['Away to Away', 'Home to Home (no Rest)'],
        ['Home to Away', 'Home to Home (Rest)'],
        ['Away to Away', 'Home to Home (Rest)']
    ];

    // Build comparison stats for display
    const comparisonStats = comparisonPairs.map(([firstType, secondType]) => {
        // Create the key for looking up in matchupStats
        const matchupKey = `${firstType} vs ${secondType}`;

        // Get the stats
        const statsData = matchupStats[matchupKey];

        // Get the win-loss data
        const firstWins = statsData?.first.wins || 0;
        const firstLosses = statsData?.first.losses || 0;
        const secondWins = statsData?.second.wins || 0;
        const secondLosses = statsData?.second.losses || 0;

        // Calculate totals and percentages
        const firstTotal = firstWins + firstLosses;
        const secondTotal = secondWins + secondLosses;

        const firstWinPct = firstTotal > 0 ? ((firstWins / firstTotal) * 100).toFixed(1) : '0.0';
        const secondWinPct = secondTotal > 0 ? ((secondWins / secondTotal) * 100).toFixed(1) : '0.0';

        // Determine leader
        let leader = parseFloat(firstWinPct) > parseFloat(secondWinPct)
            ? firstType
            : parseFloat(secondWinPct) > parseFloat(firstWinPct)
                ? secondType
                : 'Tie';

        if (firstTotal === 0 && secondTotal === 0) {
            leader = 'No Data';
        }

        return {
            comparison: matchupKey,
            firstType,
            secondType,
            firstWins,
            firstLosses,
            secondWins,
            secondLosses,
            firstWinPct,
            secondWinPct,
            leader,
            games: statsData?.games || []
        };
    });

    // Clear all selections including team filter
    const clearSelections = () => {
        setSelectedType(null);
        setSelectedComparison(null);
        setShowAllGames(false);
        setSelectedTeam('');  // Reset to empty string
    };

    // Handle team selection change
    const handleTeamSelectionChange = (event) => {
        setSelectedTeam(event.target.value);
    };

    // Get the result class for a game card
    const getResultClass = (game) => {
        if (game.won === true) return 'win-card';
        if (game.won === false) return 'loss-card';
        return '';
    };

    // Get CSS class for travel type visualization
    const getTravelTypeClass = (travelType) => {
        if (!travelType) return 'travel-unknown';
        if (travelType === 'Away to Away') return 'travel-away-to-away';
        if (travelType === 'Away to Away (Same Venue)') return 'travel-away-to-away-same';
        if (travelType === 'Home to Away') return 'travel-home-to-away';
        if (travelType.includes('Rest Day (Away)')) return 'travel-rest-day-away';
        if (travelType.includes('Rest Day (Home)')) return 'travel-rest-day-home';
        if (travelType === 'Home to Home (no Rest)') return 'travel-home-to-home-no-rest';
        if (travelType === 'Home to Home (Rest)') return 'travel-home-to-home-with-rest';
        if (travelType === 'Away to Home') return 'travel-away-to-home';
        if (travelType.includes('Rest Day (First Game)')) return 'travel-rest-day-first';
        return 'travel-unknown';
    };

    const handleFetchOdds = async () => {
        if (!displayedGames || displayedGames.length === 0) return;
        const picks = displayedGames.map(game => ({
            gamePk: game.gamePk,
            homeTeam: { name: game.isHome ? game.team : game.opponent },
            awayTeam: { name: game.isHome ? game.opponent : game.team },
            gameTime: game.gameTime || '',
            gameDate: game.date ? `${game.date}T00:00:00` : undefined
        }));
        const odds = await fetchOdds(picks);
        setOddsData(odds);
    };

    const getGameOdds = (game) => {
        if (!game || !game.gamePk || !oddsData[game.gamePk]) return '';
        const gameOdds = oddsData[game.gamePk];
        const homeName = game.isHome ? game.team : game.opponent;
        if (gameOdds.homeTeam.name === homeName) {
            return formatOdds(gameOdds.homeTeam.odds);
        }
        return '';
    };

    return (
        <div className="trends-tab">
            <PickScroller 
                picks={picksOfTheDay?.travel || []} 
                loading={picksLoading} 
            />

            <div className="trends-section">
                <h2>Analysis</h2>
                <div className="analysis-content">
                    <p>
                        This analysis compares team performance across different travel scenarios for the {seasonYear} MLB season.
                        The data shows how teams perform when traveling and how home teams perform against traveling opponents.
                    </p>
                    
                    <p>
                        You can use this data to identify potential betting opportunities by understanding how travel affects team performance in MLB games.
                    </p>
                </div>
            </div>
            
            <div className="season-controls">
                <div className="year-select">
                    <label htmlFor="season-year">MLB Season:</label>
                    <select
                        id="season-year"
                        value={seasonYear}
                        onChange={handleSeasonYearChange}
                    >
                        {[2020, 2021, 2022, 2023, 2024, 2025].map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>
                <div className="season-status">
                    {seasonLoading ? 'Loading season data...' : `${seasonYear} MLB Season (from March 27): ${seasonGamesList.length} games analyzed`}
                </div>
            </div>

            {seasonLoading ? (
                <div className="loading">Loading season data...</div>
            ) : (
                <>
                    <div className="trends-section">
                        <h2>Travel Type Performance</h2>
                        <div className="stats-table-container">
                            <table className="stats-table">
                                <thead>
                                    <tr>
                                        <th>Travel Type</th>
                                        <th>Wins</th>
                                        <th>Losses</th>
                                        <th>Total Games</th>
                                        <th>Win %</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {travelTypes.map(type => (
                                        <tr key={type}>
                                            <td>{type}</td>
                                            <td>{seasonStats.byType[type].wins}</td>
                                            <td>{seasonStats.byType[type].losses}</td>
                                            <td>{seasonStats.byType[type].total}</td>
                                            <td className={parseFloat(seasonStats.byType[type].percentage) >= 50 ? 'positive' : 'negative'}>
                                                {seasonStats.byType[type].percentage}%
                                            </td>
                                            <td>
                                                <button
                                                    className="view-details-button"
                                                    onClick={() => {
                                                        clearSelections();
                                                        setSelectedType(type);
                                                    }}
                                                >
                                                    View Games
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="trends-section">
                        <h2>Travel Type Comparisons</h2>
                        <div className="comparison-container">
                            {comparisonStats.map(comp => (
                                <div key={comp.comparison} className="comparison-card">
                                    <h3>{comp.comparison}</h3>
                                    <div className="comparison-results">
                                        <div className="result-item">
                                            <span className="type">{comp.firstType}:</span>
                                            <span className="win-rate">
                                                {comp.firstWinPct}% ({comp.firstWins}-{comp.firstLosses})
                                            </span>
                                        </div>
                                        <div className="result-item">
                                            <span className="type">{comp.secondType}:</span>
                                            <span className="win-rate">
                                                {comp.secondWinPct}% ({comp.secondWins}-{comp.secondLosses})
                                            </span>
                                        </div>
                                    </div>
                                    <div className="comparison-actions">
                                        <div className="comparison-summary">
                                            <strong>Better Performance:</strong> {comp.leader}
                                        </div>
                                        {comp.firstWins + comp.firstLosses + comp.secondWins + comp.secondLosses > 0 && (
                                            <button
                                                className="view-details-button"
                                                onClick={() => {
                                                    clearSelections();
                                                    setSelectedComparison(comp.comparison);
                                                }}
                                            >
                                                View Games
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {(selectedType || selectedComparison || selectedTeam) && (
                        <div className="trends-section">
                            <div className="section-header">
                                <h2>
                                    {selectedComparison ? `${selectedComparison} Games` : 
                                     selectedType ? `${selectedType} Games` : 'Filtered Games'}
                                    <div className="filter-controls">
                                        <select
                                            className="team-filter-select"
                                            value={selectedTeam}
                                            onChange={handleTeamSelectionChange}
                                        >
                                            <option value="">Select a Team</option>
                                            {getUniqueTeams().map(team => (
                                                <option key={team.id} value={team.id}>
                                                    {team.name}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            className="clear-filter-button"
                                            onClick={clearSelections}
                                        >
                                            Clear Filters
                                        </button>
                                    </div>
                                </h2>
                            </div>

                            <div className="game-list">
                                {displayedGames.length > 0 ? (
                                    <>
                                        <div className="travel-games">
                                            {displayedGames.map((game, index) => {
                                                // Determine away and home team info
                                                const awayTeamName = game.isHome ? game.opponent : game.team;
                                                const homeTeamName = game.isHome ? game.team : game.opponent;
                                                const awayTeamId = game.isHome ? game.opponentId : game.teamId;
                                                const homeTeamId = game.isHome ? game.teamId : game.opponentId;
                                                const awayTravelType = game.isHome ? game.opponentTravel : game.teamTravel;
                                                const homeTravelType = game.isHome ? game.teamTravel : game.opponentTravel;
                                                const awayTeamWon = game.isHome ? !game.won : game.won;
                                                const homeTeamWon = game.isHome ? game.won : !game.won;

                                                // Get team logos
                                                const awayTeamLogo = getTeamLogoUrl(awayTeamId);
                                                const homeTeamLogo = getTeamLogoUrl(homeTeamId);

                                                return (
                                                    <div key={index} className={`game-card ${getResultClass(game)}`}>
                                                        <div className="game-header">
                                                            <div className="game-date">{format(new Date(`${game.date}T12:00:00`), 'MMMM d, yyyy')}</div>
                                                            <div className="game-venue">{game.venue}</div>
                                                        </div>

                                                        <div className="matchup">
                                                            <div className="teams">
                                                                <div className="team-container">
                                                                    <img
                                                                        src={awayTeamLogo}
                                                                        alt={`${awayTeamName} logo`}
                                                                        className="team-logo"
                                                                    />
                                                                    <span className={`team-name team-${awayTeamId} away-team`}>
                                                                        {awayTeamName}
                                                                    </span>
                                                                    <span className="team-travel-label">
                                                                        {awayTravelType}
                                                                    </span>
                                                                    <div className={`game-result ${awayTeamWon ? 'win' : 'loss'}`}>
                                                                    {awayTeamWon ? 'Won' : 'Lost'}
                                                                </div>
                                                                </div>

                                                                <span className="versus">@</span>

                                                                <div className="team-container">
                                                                    <img
                                                                        src={homeTeamLogo}
                                                                        alt={`${homeTeamName} logo`}
                                                                        className="team-logo"
                                                                    />
                                                                    <span className={`team-name team-${homeTeamId} home-team`}>
                                                                        {homeTeamName} {getGameOdds(game)}
                                                                    </span>
                                                                    <span className="team-travel-label">
                                                                        {homeTravelType}
                                                                    </span>
                                                                    <div className={`game-result ${homeTeamWon ? 'win' : 'loss'}`}>
                                                                    {homeTeamWon ? 'Won' : 'Lost'}
                                                                </div>
                                                                </div>
                                                                
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {filteredGames.length > 20 && (
                                            <div className="show-more">
                                                <button
                                                    onClick={() => setShowAllGames(!showAllGames)}
                                                    className="show-more-button"
                                                >
                                                    {showAllGames ? `Show Less (${filteredGames.length} total)` : `Show All (${filteredGames.length} total)`}
                                                </button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <p>No games found with this criteria.</p>
                                )}
                            </div>
                        </div>
                    )}

                    <button className="refresh-button" onClick={handleFetchOdds}>
                        Fetch Odds
                    </button>

                </>
            )}
        </div>
    );
}

export default TrendsTab;