import React, {
  useState, useEffect
} from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { format, parseISO, differenceInDays, subDays, addDays, isToday, parse } from 'date-fns';
import axios from 'axios';
import ScheduleTab from './components/ScheduleTab';
import TrackerTab from './components/TrackerTab';
import TrendsTab from './components/TrendsTab';
import FadeTheSweepTab from './components/FadeTheSweepTab';
import FadeTheRockiesTab from './components/FadeTheRockiesTab';
import KRateUndersTab from './components/KRateUndersTab';
import EnhancedPicksOfTheDay from './components/EnhancedPicksOfTheDay';
import './components/EnhancedPicksOfTheDay.css';
import PitchingOutsPredictor from './components/PitchingOutsPredictor';
import { MemberstackProvider, useMemberstack } from '@memberstack/react';
import Login from './components/Login';

// Create a wrapper component for the main app content
function MainApp() {
  const { member, memberstack } = useMemberstack();
  const [activeTab, setActiveTab] = useState('picks');
  const [scheduleData, setScheduleData] = useState([]);
  const [travelGames, setTravelGames] = useState([]);
  const [matchups, setMatchups] = useState([]);
  const [seasonTravelGames, setSeasonTravelGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seasonLoading, setSeasonLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(new Date().setDate(new Date().getDate() + 7)), 'yyyy-MM-dd'));
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [trendsData, setTrendsData] = useState({
    travelTypes: {
      'Home to Away': { wins: 0, losses: 0 },
      'Away to Away': { wins: 0, losses: 0 },
      'Away to Home': { wins: 0, losses: 0 },
      'Home to Home (no Rest)': { wins: 0, losses: 0 },
      'Home to Home (with Rest)': { wins: 0, losses: 0 }
    },
    comparisons: {
      'Home to Away vs Away to Home': { first: 0, second: 0 },
      'Away to Away vs Away to Home': { first: 0, second: 0 },
      'Home to Away vs Home to Home (no Rest)': { first: 0, second: 0 },
      'Away to Away vs Home to Home (no Rest)': { first: 0, second: 0 },
      'Home to Away vs Home to Home (with Rest)': { first: 0, second: 0 },
      'Away to Away vs Home to Home (with Rest)': { first: 0, second: 0 }
    }
  });
  const [seasonYear, setSeasonYear] = useState(new Date().getFullYear());
  const [picksOfTheDay, setPicksOfTheDay] = useState({
    travel: [],
    sweep: [],
    rockies: []
  });
  const [picksLoading, setPicksLoading] = useState(true);
  const [seasonStats, setSeasonStats] = useState({
    byType: {
      'Home to Away': { wins: 0, losses: 0, total: 0, percentage: 0 },
      'Away to Away': { wins: 0, losses: 0, total: 0, percentage: 0 },
      'Away to Home': { wins: 0, losses: 0, total: 0, percentage: 0 },
      'Home to Home (no Rest)': { wins: 0, losses: 0, total: 0, percentage: 0 },
      'Home to Home (with Rest)': { wins: 0, losses: 0, total: 0, percentage: 0 },
    }
  });

  // Constants
  const ROCKIES_TEAM_ID = 115; // MLB API ID for Colorado Rockies

  useEffect(() => {
    fetchSchedule();
    fetchPicksOfTheDay();
  }, []);

  useEffect(() => {
    if (activeTab === 'schedule') {
      fetchDailySchedule();
    }
  }, [selectedDate, activeTab]);

  useEffect(() => {
    if (activeTab === 'trends') {
      fetchSeasonData();
    }
  }, [activeTab, seasonYear]);

  const getGameTimeFromSchedule = (gamePk, scheduledGames) => {
    // Go through each date in the schedule data
    for (const dateData of scheduledGames) {
      if (!dateData.games) continue;

      // Look for the game with matching gamePk
      const game = dateData.games.find(g => g.gamePk === gamePk);
      if (game && game.gameDate) {
        // Extract and format the time from gameDate
        const gameDateTime = new Date(game.gameDate);
        return format(gameDateTime, 'h:mm a');
      }
    }
    return null; // Return null if game not found
  };

  // Fetch all data needed for picks of the day
  const fetchPicksOfTheDay = async () => {
    setPicksLoading(true);
    try {
      const today = new Date();
      const startDateForPicks = format(today, 'yyyy-MM-dd');

      console.log("Fetching picks for date:", startDateForPicks);

      // Fetch data for today's games
      const response = await axios.get(
        `https://statsapi.mlb.com/api/v1/schedule?startDate=${startDateForPicks}&endDate=${startDateForPicks}&sportId=1&hydrate=team,venue,game(content(summary)),linescore,seriesStatus`
      );

      if (response.data && response.data.dates && response.data.dates.length > 0) {
        const dateData = response.data.dates[0];

        // Look back 7 days to get context for today's games
        const lookbackStartDate = format(subDays(today, 7), 'yyyy-MM-dd');
        const lookbackResponse = await axios.get(
          `https://statsapi.mlb.com/api/v1/schedule?startDate=${lookbackStartDate}&endDate=${startDateForPicks}&sportId=1&hydrate=team,venue,game(content(summary)),linescore,seriesStatus`
        );

        // Process previous games to get context
        const teamLastGame = getTeamLastGames(7, lookbackResponse.data.dates || []);

        // Get the picks for each strategy
        const travelPicks = findTravelPicksOfTheDay(dateData, teamLastGame);

        // Use improved sweep picks function
        const sweepPicks = findImprovedSweepPicksOfTheDay(dateData, lookbackResponse.data.dates || []);

        const rockiesPicks = findRockiesPicksOfTheDay(dateData);

        // Log for debugging
        console.log("Travel Picks Found:", travelPicks.length, travelPicks);
        console.log("Sweep Picks Found:", sweepPicks.length, sweepPicks);
        console.log("Rockies Picks Found:", rockiesPicks.length, rockiesPicks);

        // Ensure we're setting the picks with proper structure
        const picks = {
          travel: Array.isArray(travelPicks) ? travelPicks : [],
          sweep: Array.isArray(sweepPicks) ? sweepPicks : [],
          rockies: Array.isArray(rockiesPicks) ? rockiesPicks : []
        };

        // Update state with found picks
        setPicksOfTheDay(picks);

        // Also make sure we have stats data by fetching season data if needed
        if (!seasonStats.byType ||
          Object.values(seasonStats.byType).every(stat => stat.total === 0)) {
          console.log("No season stats detected, fetching season data...");
          fetchSeasonData();
        }
      } else {
        console.log("No games found for today");
        setPicksOfTheDay({
          travel: [],
          sweep: [],
          rockies: []
        });
      }
    } catch (error) {
      console.error('Error fetching picks of the day:', error);
      setPicksOfTheDay({
        travel: [],
        sweep: [],
        rockies: []
      });
    } finally {
      setPicksLoading(false);
    }
  };

  // Find the best travel picks of the day
  const findTravelPicksOfTheDay = (dateData, teamLastGame) => {
    const travelPicksList = [];
    console.log("Finding travel picks of the day...");

    // If teamLastGame isn't provided, fall back to getting it from cached data
    const teamLastGameData = teamLastGame || getTeamLastGames(7);

    // Debug logging of all games in dateData
    console.log(`Processing ${dateData.games ? dateData.games.length : 0} games for travel picks`);

    dateData.games.forEach(game => {
      try {
        const awayTeam = game.teams.away.team;
        const homeTeam = game.teams.home.team;
        const venue = game.venue.name;

        // Log each game we're analyzing
        console.log(`Analyzing game: ${awayTeam.name} @ ${homeTeam.name}`);

        // Check travel status for both teams
        const awayTeamPrevious = teamLastGameData[awayTeam.id] || null;
        const homeTeamPrevious = teamLastGameData[homeTeam.id] || null;

        let awayTravelType = "REST DAY";
        let homeTravelType = "REST DAY";

        if (awayTeamPrevious) {
          const awayDayDifference = differenceInDays(
            new Date(dateData.date),
            new Date(awayTeamPrevious.date)
          );

          if (awayDayDifference === 1) {
            // The team played yesterday
            if (awayTeamPrevious.venue !== venue) {
              // Had to travel - different venue means travel required
              awayTravelType = awayTeamPrevious.isHome ? 'Home to Away' : 'Away to Away';
            }
          }
        }

        if (homeTeamPrevious) {
          const homeDayDifference = differenceInDays(
            new Date(dateData.date),
            new Date(homeTeamPrevious.date)
          );

          if (homeDayDifference === 1) {
            // The team played yesterday
            if (homeTeamPrevious.venue !== venue) {
              // Had to travel - different venue means travel required
              homeTravelType = homeTeamPrevious.isHome ? 'Home to Away' : 'Away to Home';
            } else {
              // Same venue - no travel required
              homeTravelType = homeTeamPrevious.isHome ? 'Home to Home (no Rest)' : 'Away to Away (Same Venue)';
            }
          } else if (homeDayDifference > 1) {
            // Had rest day(s)
            if (homeTeamPrevious.isHome && venue === homeTeamPrevious.venue) {
              homeTravelType = 'Home to Home (with Rest)';
            }
          }
        }

        console.log(`Travel types - Away: ${awayTravelType}, Home: ${homeTravelType}`);

        // Look for favorable matchups based on trends
        // 1. Home team with rest vs traveling away team
        if ((homeTravelType === 'Home to Home (with Rest)' || homeTravelType === 'Home to Home (no Rest)') &&
          (awayTravelType === 'Away to Away' || awayTravelType === 'Home to Away')) {
          console.log(`Found travel advantage: ${homeTeam.name} (${homeTravelType}) vs ${awayTeam.name} (${awayTravelType})`);
          travelPicksList.push({
            gamePk: game.gamePk,
            recommendedBet: homeTeam.name,
            reason: `${homeTeam.name} (${homeTravelType}) vs ${awayTeam.name} (${awayTravelType})`,
            venue: venue,
            confidence: homeTravelType === 'Home to Home (with Rest)' ? 'High' : 'Medium',
            awayTeam: awayTeam,
            homeTeam: homeTeam,
            awayTravelType,
            homeTravelType,
            // Add game time if available
            gameTime: game.gameDate ? format(new Date(game.gameDate), 'h:mm a') : null
          });
        }

        // 2. Away to Home advantage over Away to Away
        else if (homeTravelType === 'Away to Home' && awayTravelType === 'Away to Away') {
          console.log(`Found travel advantage: ${homeTeam.name} (${homeTravelType}) vs ${awayTeam.name} (${awayTravelType})`);
          travelPicksList.push({
            gamePk: game.gamePk,
            recommendedBet: homeTeam.name,
            reason: `${homeTeam.name} (${homeTravelType}) vs ${awayTeam.name} (${awayTravelType})`,
            venue: venue,
            confidence: 'Medium',
            awayTeam: awayTeam,
            homeTeam: homeTeam,
            awayTravelType,
            homeTravelType,
            // Add game time if available
            gameTime: game.gameDate ? format(new Date(game.gameDate), 'h:mm a') : null
          });
        }
      } catch (error) {
        console.error(`Error processing game for travel picks:`, error);
      }
    });

    // Sort by confidence (High first)
    const sortedPicks = travelPicksList.sort((a, b) => {
      if (a.confidence === 'High' && b.confidence !== 'High') return -1;
      if (a.confidence !== 'High' && b.confidence === 'High') return 1;
      return 0;
    });

    console.log(`Found ${sortedPicks.length} travel advantage picks`);
    return sortedPicks;
  };

  // Helper function to get the last game for all teams
  const getTeamLastGames = (lookbackDays, lookbackData = []) => {
    const teamLastGame = {};
    const today = new Date();
    const startLookback = new Date(today);
    startLookback.setDate(startLookback.getDate() - lookbackDays);

    // Use the provided lookback data or fall back to cached scheduleData
    const dataToUse = lookbackData.length > 0 ? lookbackData : scheduleData;

    dataToUse.forEach(dateData => {
      const gameDate = new Date(dateData.date);
      if (gameDate >= startLookback && gameDate < today) {
        dateData.games.forEach(game => {
          const awayTeam = game.teams.away.team;
          const homeTeam = game.teams.home.team;
          const venue = game.venue.name;

          // Only consider completed games
          if (game.status && game.status.statusCode === 'F') {
            // Check if this is the most recent game for the away team
            if (!teamLastGame[awayTeam.id] || new Date(teamLastGame[awayTeam.id].date) < gameDate) {
              teamLastGame[awayTeam.id] = {
                date: dateData.date,
                venue: venue,
                isHome: false
              };
            }

            // Check if this is the most recent game for the home team
            if (!teamLastGame[homeTeam.id] || new Date(teamLastGame[homeTeam.id].date) < gameDate) {
              teamLastGame[homeTeam.id] = {
                date: dateData.date,
                venue: venue,
                isHome: true
              };
            }
          }
        });
      }
    });

    return teamLastGame;
  };

  // Find fade the sweep picks of the day
  // Completing the improved findImprovedSweepPicksOfTheDay function for App.js

  const findImprovedSweepPicksOfTheDay = (dateData, lookbackDates) => {
    const sweepPicksList = [];

    // Group all games into series (current and past dates)
    const seriesMap = {};

    // First, process the historical dates to build series context
    if (lookbackDates && lookbackDates.length > 0) {
      lookbackDates.forEach(date => {
        if (!date.games) return;

        date.games.forEach(game => {
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

          // Add the game to the series
          if (game.status && game.status.statusCode === 'F') {
            seriesMap[seriesKey].games.push({
              date: date.date,
              gamePk: game.gamePk,
              seriesGameNumber: parseInt(game.seriesGameNumber, 10),
              awayScore: game.teams.away.score,
              homeScore: game.teams.home.score,
              awayWon: game.teams.away.score > game.teams.home.score,
              homeWon: game.teams.home.score > game.teams.away.score,
              status: 'Final'
            });
          }
        });
      });
    }

    // Now process today's games and check for sweep opportunities
    dateData.games.forEach(game => {
      // Skip games that aren't MLB regular season
      if (game.seriesGameNumber === undefined || game.gamesInSeries === undefined) {
        return;
      }

      const awayTeam = game.teams.away.team;
      const homeTeam = game.teams.home.team;
      const venue = game.venue.name;

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

      // Check if this is the final game of the series
      const isFinalGame = parseInt(game.seriesGameNumber, 10) === parseInt(game.gamesInSeries, 10);

      if (isFinalGame) {
        // Get all previous games in this series
        const previousGames = seriesMap[seriesKey].games.filter(g =>
          g.seriesGameNumber < parseInt(game.seriesGameNumber, 10)
        );

        // Only consider completed games
        const completedPreviousGames = previousGames.filter(g => g.status === 'Final');

        // Need at least 2 completed previous games to consider a sweep scenario
        if (completedPreviousGames.length >= 2) {
          // Check if home team has lost all previous games
          const homeTeamLostAll = completedPreviousGames.every(g => !g.homeWon);

          // Check if away team has lost all previous games
          const awayTeamLostAll = completedPreviousGames.every(g => !g.awayWon);

          // Add to pick list if we found a sweep scenario
          if (homeTeamLostAll && completedPreviousGames.length >= 2) {
            // Home team has lost all games, potential fade the sweep for home team
            sweepPicksList.push({
              gamePk: game.gamePk,
              recommendedBet: homeTeam.name,
              reason: `${homeTeam.name} has lost ${completedPreviousGames.length} straight games in this series`,
              venue: venue,
              confidence: 'Medium',
              teamToFade: homeTeam,
              opposingTeam: awayTeam,
              previousLosses: completedPreviousGames.length
            });
            console.log(`Found sweep opportunity: ${homeTeam.name} has lost ${completedPreviousGames.length} straight games`);
          }
          else if (awayTeamLostAll && completedPreviousGames.length >= 2) {
            // Away team has lost all games, potential fade the sweep for away team
            sweepPicksList.push({
              gamePk: game.gamePk,
              recommendedBet: awayTeam.name,
              reason: `${awayTeam.name} has lost ${completedPreviousGames.length} straight games in this series`,
              venue: venue,
              confidence: 'Medium',
              teamToFade: awayTeam,
              opposingTeam: homeTeam,
              previousLosses: completedPreviousGames.length
            });
            console.log(`Found sweep opportunity: ${awayTeam.name} has lost ${completedPreviousGames.length} straight games`);
          }
        }
      }
    });

    // Alternative method: Check seriesStatus if available
    dateData.games.forEach(game => {
      if (game.seriesGameNumber === undefined || game.gamesInSeries === undefined) {
        return;
      }

      // If this is the final game of a series and there is series status info
      if (parseInt(game.seriesGameNumber, 10) === parseInt(game.gamesInSeries, 10) &&
        game.seriesStatus && game.seriesStatus.isVersus) {

        const seriesHomeWins = game.seriesStatus.homeWins || 0;
        const seriesAwayWins = game.seriesStatus.awayWins || 0;
        const awayTeam = game.teams.away.team;
        const homeTeam = game.teams.home.team;

        // Check for sweep potential - one team has lost all previous games and this is the final game
        if (seriesHomeWins === 0 && seriesAwayWins >= 2) {
          // Home team has lost all games, potential fade the sweep for home team
          sweepPicksList.push({
            gamePk: game.gamePk,
            recommendedBet: homeTeam.name,
            reason: `${homeTeam.name} has lost ${seriesAwayWins} straight games in this series`,
            venue: game.venue.name,
            confidence: 'Medium',
            teamToFade: homeTeam,
            opposingTeam: awayTeam,
            previousLosses: seriesAwayWins
          });
          console.log(`[seriesStatus] Found sweep opportunity: ${homeTeam.name} has lost ${seriesAwayWins} straight games`);
        }
        else if (seriesAwayWins === 0 && seriesHomeWins >= 2) {
          // Away team has lost all games, potential fade the sweep for away team
          sweepPicksList.push({
            gamePk: game.gamePk,
            recommendedBet: awayTeam.name,
            reason: `${awayTeam.name} has lost ${seriesHomeWins} straight games in this series`,
            venue: game.venue.name,
            confidence: 'Medium',
            teamToFade: awayTeam,
            opposingTeam: homeTeam,
            previousLosses: seriesHomeWins
          });
          console.log(`[seriesStatus] Found sweep opportunity: ${awayTeam.name} has lost ${seriesHomeWins} straight games`);
        }
      }
    });

    // Remove any duplicates based on game ID
    const uniquePicks = {};
    sweepPicksList.forEach(pick => {
      uniquePicks[pick.gamePk] = pick;
    });

    return Object.values(uniquePicks);
  };

  // Find Rockies picks of the day
  const findRockiesPicksOfTheDay = (dateData) => {
    const rockiesPicksList = [];

    dateData.games.forEach(game => {
      // Check if Rockies are playing in this game
      const awayTeam = game.teams.away.team;
      const homeTeam = game.teams.home.team;

      if (awayTeam.id === ROCKIES_TEAM_ID || homeTeam.id === ROCKIES_TEAM_ID) {
        // Determine if Rockies are home or away
        const isRockiesHome = homeTeam.id === ROCKIES_TEAM_ID;
        const opponent = isRockiesHome ? awayTeam : homeTeam;

        rockiesPicksList.push({
          gamePk: game.gamePk,
          recommendedBet: `${opponent.name} -1.5`,
          reason: isRockiesHome ? "Rockies at home (Coors Field effect)" : "Rockies on the road (historically poor)",
          venue: game.venue.name,
          confidence: 'Medium',
          opponent: opponent,
          isRockiesHome: isRockiesHome
        });
      }
    });

    return rockiesPicksList;
  };

  // Replace your fetchSeasonData function in App.js with this improved version
  const fetchSeasonData = async () => {
    setSeasonLoading(true);
    try {
      // Define season start and end dates
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

      // For debugging, limit to a smaller number of chunks in development
      const isDev = process.env.NODE_ENV === 'development';
      let chunkCount = 0;
      const maxChunks = isDev ? 3 : 10; // Limit chunks in dev for faster loading

      while (currentChunkStart < endDate && chunkCount < maxChunks) {
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
          console.error(`Error fetching chunk ${chunkCount}:`, error);
        }

        // Move to next chunk
        currentChunkStart.setDate(currentChunkStart.getDate() + chunkSize);
        chunkCount++;
      }

      console.log(`Fetched data for ${allDates.length} days`);

      // Process all the data
      if (allDates.length > 0) {
        const { travelGamesList } = findTravelGames(allDates);
        console.log(`Found ${travelGamesList.length} travel games`);

        if (travelGamesList.length > 0) {
          setSeasonTravelGames(travelGamesList);
          updateTrendsData(travelGamesList);
        }
      }
    } catch (error) {
      console.error('Error fetching MLB season data:', error);
    } finally {
      setSeasonLoading(false);
    }
  };

  const fetchDailySchedule = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `https://statsapi.mlb.com/api/v1/schedule?date=${selectedDate}&sportId=1&hydrate=team,venue,game(content(summary)),linescore`
      );

      if (response.data && response.data.dates && response.data.dates.length > 0) {
        setScheduleData(response.data.dates);
      } else {
        setScheduleData([]);
      }
    } catch (error) {
      console.error('Error fetching daily MLB schedule:', error);
      setScheduleData([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedule = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `https://statsapi.mlb.com/api/v1/schedule?startDate=${startDate}&endDate=${endDate}&sportId=1&hydrate=team,venue,game(content(summary)),linescore`
      );

      if (response.data && response.data.dates) {
        setScheduleData(response.data.dates);
        const { travelGamesList, matchupsList } = findTravelGames(response.data.dates);
        setTravelGames(travelGamesList);
        setMatchups(matchupsList);
      }
    } catch (error) {
      console.error('Error fetching MLB schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const findTravelGames = (dates) => {
    // Create a map to track where each team played last
    const teamLastGame = {};
    const travelGamesList = [];
    const matchupsList = [];

    // Process all dates in sequence
    dates.forEach((dateData) => {
      const currentDate = dateData.date;
      const dateMatchups = [];

      // Process each game for the current date
      dateData.games.forEach((game) => {
        const awayTeam = game.teams.away.team;
        const homeTeam = game.teams.home.team;
        const venue = game.venue.name;

        // Get game result if available
        let awayTeamWon = null;
        let homeTeamWon = null;

        if (game.status && game.status.statusCode === 'F') {
          // Game is finished
          if (game.teams.away.score !== undefined && game.teams.home.score !== undefined) {
            awayTeamWon = game.teams.away.score > game.teams.home.score;
            homeTeamWon = game.teams.home.score > game.teams.away.score;
          }
        }

        // Check travel status for both teams
        const awayTeamPrevious = teamLastGame[awayTeam.id] || null;
        const homeTeamPrevious = teamLastGame[homeTeam.id] || null;

        // Determine travel types
        let awayTravelType = "REST DAY";  // Default to REST DAY if no previous game
        let homeTravelType = "REST DAY";  // Default to REST DAY if no previous game
        let awayPreviousGame = "None (REST DAY)";
        let homePreviousGame = "None (REST DAY)";

        if (awayTeamPrevious) {
          const awayDayDifference = differenceInDays(
            parseISO(currentDate),
            parseISO(awayTeamPrevious.date)
          );

          if (awayDayDifference === 1) {
            // The team played yesterday
            awayPreviousGame = `${awayTeamPrevious.isHome ? 'Home' : 'Away'} at ${awayTeamPrevious.venue}`;

            if (awayTeamPrevious.venue !== venue) {
              // Had to travel - different venue means travel required
              awayTravelType = awayTeamPrevious.isHome ? 'Home to Away' : 'Away to Away';

              // Add to travel games list
              travelGamesList.push({
                date: currentDate,
                team: awayTeam.name,
                teamId: awayTeam.id,
                previousGame: awayPreviousGame,
                currentGame: `Away at ${venue}`,
                opponent: homeTeam.name,
                opponentId: homeTeam.id,
                teamTravel: awayTravelType,
                opponentTravel: homeTeamPrevious ?
                  (homeTeamPrevious.venue !== venue && differenceInDays(parseISO(currentDate), parseISO(homeTeamPrevious.date)) === 1 ?
                    (homeTeamPrevious.isHome ? 'Home to Away' : 'Away to Home') :
                    (differenceInDays(parseISO(currentDate), parseISO(homeTeamPrevious.date)) === 1 ? 'Home to Home (no Rest)' : 'REST DAY')) :
                  'REST DAY',
                travelType: awayTravelType,
                won: awayTeamWon,
                gamePk: game.gamePk
              });
            } else {
              // Same venue - no travel required
              awayTravelType = 'Away to Away (Same Venue)';
            }
          }
        }

        if (homeTeamPrevious) {
          const homeDayDifference = differenceInDays(
            parseISO(currentDate),
            parseISO(homeTeamPrevious.date)
          );

          if (homeDayDifference === 1) {
            // The team played yesterday
            homePreviousGame = `${homeTeamPrevious.isHome ? 'Home' : 'Away'} at ${homeTeamPrevious.venue}`;

            if (homeTeamPrevious.venue !== venue) {
              // Had to travel - different venue means travel required
              homeTravelType = homeTeamPrevious.isHome ? 'Home to Away' : 'Away to Home';

              // Add to traditional travel games list (only for actual travel)
              if (homeTravelType === "Away to Home") {
                travelGamesList.push({
                  date: currentDate,
                  team: homeTeam.name,
                  teamId: homeTeam.id,
                  previousGame: homePreviousGame,
                  currentGame: `Home at ${venue}`,
                  opponent: awayTeam.name,
                  opponentId: awayTeam.id,
                  teamTravel: homeTravelType,
                  opponentTravel: awayTeamPrevious ?
                    (awayTeamPrevious.venue !== venue && differenceInDays(parseISO(currentDate), parseISO(awayTeamPrevious.date)) === 1 ?
                      (awayTeamPrevious.isHome ? 'Home to Away' : 'Away to Away') :
                      (differenceInDays(parseISO(currentDate), parseISO(awayTeamPrevious.date)) === 1 ? 'Away to Away (Same Venue)' : 'REST DAY')) :
                    'REST DAY',
                  travelType: homeTravelType,
                  won: homeTeamWon,
                  gamePk: game.gamePk
                });
              }
            } else {
              // Same venue - no travel required
              homeTravelType = homeTeamPrevious.isHome ? 'Home to Home (no Rest)' : 'Away to Away (Same Venue)';
            }
          } else if (homeDayDifference > 1) {
            // Had rest day(s)
            homePreviousGame = `${homeTeamPrevious.isHome ? 'Home' : 'Away'} at ${homeTeamPrevious.venue} (${homeDayDifference - 1} rest day(s))`;

            if (homeTeamPrevious.isHome && venue === homeTeamPrevious.venue) {
              homeTravelType = 'Home to Home (with Rest)';
            }
          }
        }

        // Add to matchups list
        dateMatchups.push({
          date: currentDate,
          gamePk: game.gamePk,
          venue: venue,
          awayTeam: {
            name: awayTeam.name,
            id: awayTeam.id,
            previousGame: awayPreviousGame,
            currentGame: `Away at ${venue}`,
            travelType: awayTravelType,
            won: awayTeamWon
          },
          homeTeam: {
            name: homeTeam.name,
            id: homeTeam.id,
            previousGame: homePreviousGame,
            currentGame: `Home at ${venue}`,
            travelType: homeTravelType,
            won: homeTeamWon
          },
          status: game.status ? game.status.detailedState : 'Scheduled',
          score: game.status && game.status.statusCode === 'F' ?
            `${game.teams.away.score}-${game.teams.home.score}` : null
        });

        // Update the last game for both teams
        teamLastGame[awayTeam.id] = {
          date: currentDate,
          venue: venue,
          isHome: false
        };

        teamLastGame[homeTeam.id] = {
          date: currentDate,
          venue: venue,
          isHome: true
        };
      });

      if (dateMatchups.length > 0) {
        matchupsList.push({
          date: currentDate,
          matchups: dateMatchups
        });
      }
    });

    return { travelGamesList, matchupsList };
  };

  // Replace your updateTrendsData function in App.js with this improved version
  const updateTrendsData = (travelGames) => {
    console.log("Updating trends data with", travelGames.length, "travel games");

    // Create a copy of the current trends data
    const newTrendsData = {
      travelTypes: {
        'Home to Away': { wins: 0, losses: 0 },
        'Away to Away': { wins: 0, losses: 0 },
        'Away to Home': { wins: 0, losses: 0 },
        'Home to Home (no Rest)': { wins: 0, losses: 0 },
        'Home to Home (with Rest)': { wins: 0, losses: 0 }
      },
      comparisons: {
        'Home to Away vs Away to Home': { first: 0, second: 0 },
        'Away to Away vs Away to Home': { first: 0, second: 0 },
        'Home to Away vs Home to Home (no Rest)': { first: 0, second: 0 },
        'Away to Away vs Home to Home (no Rest)': { first: 0, second: 0 },
        'Home to Away vs Home to Home (with Rest)': { first: 0, second: 0 },
        'Away to Away vs Home to Home (with Rest)': { first: 0, second: 0 }
      }
    };

    // Calculate wins and losses for each travel type
    travelGames.forEach(game => {
      if (game.travelType in newTrendsData.travelTypes) {
        if (game.won === true) {
          newTrendsData.travelTypes[game.travelType].wins++;
        } else if (game.won === false) {
          newTrendsData.travelTypes[game.travelType].losses++;
        }
      }
    });

    console.log("Calculated travel type stats:", newTrendsData.travelTypes);

    // Calculate comparisons - we'll do this by comparing win percentages
    const winPercentages = {};

    Object.keys(newTrendsData.travelTypes).forEach(type => {
      const { wins, losses } = newTrendsData.travelTypes[type];
      const total = wins + losses;
      winPercentages[type] = total > 0 ? wins / total : 0;
    });

    // Now update the comparisons
    newTrendsData.comparisons['Home to Away vs Away to Home'].first =
      winPercentages['Home to Away'] > winPercentages['Away to Home'] ? 1 : 0;
    newTrendsData.comparisons['Home to Away vs Away to Home'].second =
      winPercentages['Away to Home'] > winPercentages['Home to Away'] ? 1 : 0;

    newTrendsData.comparisons['Away to Away vs Away to Home'].first =
      winPercentages['Away to Away'] > winPercentages['Away to Home'] ? 1 : 0;
    newTrendsData.comparisons['Away to Away vs Away to Home'].second =
      winPercentages['Away to Home'] > winPercentages['Away to Away'] ? 1 : 0;

    newTrendsData.comparisons['Home to Away vs Home to Home (no Rest)'].first =
      winPercentages['Home to Away'] > winPercentages['Home to Home (no Rest)'] ? 1 : 0;
    newTrendsData.comparisons['Home to Away vs Home to Home (no Rest)'].second =
      winPercentages['Home to Home (no Rest)'] > winPercentages['Home to Away'] ? 1 : 0;

    newTrendsData.comparisons['Away to Away vs Home to Home (no Rest)'].first =
      winPercentages['Away to Away'] > winPercentages['Home to Home (no Rest)'] ? 1 : 0;
    newTrendsData.comparisons['Away to Away vs Home to Home (no Rest)'].second =
      winPercentages['Home to Home (no Rest)'] > winPercentages['Away to Away'] ? 1 : 0;

    newTrendsData.comparisons['Home to Away vs Home to Home (with Rest)'].first =
      winPercentages['Home to Away'] > winPercentages['Home to Home (with Rest)'] ? 1 : 0;
    newTrendsData.comparisons['Home to Away vs Home to Home (with Rest)'].second =
      winPercentages['Home to Home (with Rest)'] > winPercentages['Home to Away'] ? 1 : 0;

    newTrendsData.comparisons['Away to Away vs Home to Home (with Rest)'].first =
      winPercentages['Away to Away'] > winPercentages['Home to Home (with Rest)'] ? 1 : 0;
    newTrendsData.comparisons['Away to Away vs Home to Home (with Rest)'].second =
      winPercentages['Home to Home (with Rest)'] > winPercentages['Away to Away'] ? 1 : 0;

    setTrendsData(newTrendsData);

    // Also update the seasonStats
    const newSeasonStats = {
      byType: {}
    };

    Object.keys(newTrendsData.travelTypes).forEach(type => {
      const wins = newTrendsData.travelTypes[type].wins;
      const losses = newTrendsData.travelTypes[type].losses;
      const total = wins + losses;
      const percentage = total > 0 ? ((wins / total) * 100).toFixed(1) : '0.0';

      newSeasonStats.byType[type] = {
        wins,
        losses,
        total,
        percentage
      };
    });

    console.log("Updated season stats:", newSeasonStats);
    setSeasonStats(newSeasonStats);
  };

  const handleDateChange = (e, type) => {
    if (type === 'start') {
      setStartDate(e.target.value);
    } else if (type === 'end') {
      setEndDate(e.target.value);
    } else if (type === 'daily') {
      setSelectedDate(e.target.value);
    }
  };

  const handleSeasonYearChange = (e) => {
    setSeasonYear(parseInt(e.target.value));
  };

  const refreshAll = () => {
    fetchSchedule();
    fetchPicksOfTheDay();
  };

  const handleLogout = async () => {
    try {
      await memberstack.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>MLB Travel Schedule Tracker</h1>
        <p>Track and analyze MLB team travel patterns and performance</p>
        {member && (
          <div className="user-controls">
            <span className="user-email">{member.email}</span>
            <button onClick={handleLogout} className="logout-button">Logout</button>
          </div>
        )}
      </header>

      <div className="tabs">
        <button
          className={`tab-button ${activeTab === 'picks' ? 'active' : ''}`}
          onClick={() => setActiveTab('picks')}
        >
          Picks of The Day
        </button>
        <button
          className={`tab-button ${activeTab === 'trends' ? 'active' : ''}`}
          onClick={() => setActiveTab('trends')}
        >
          Travel Trends
        </button>
        <button
          className={`tab-button ${activeTab === 'fade' ? 'active' : ''}`}
          onClick={() => setActiveTab('fade')}
        >
          Fade The Sweep
        </button>
        <button
          className={`tab-button ${activeTab === 'rockies' ? 'active' : ''}`}
          onClick={() => setActiveTab('rockies')}
        >
          Fade The Rockies
        </button>
        <button
          className={`tab-button ${activeTab === 'krate' ? 'active' : ''}`}
          onClick={() => setActiveTab('krate')}
        >
          K-Rate Unders
        </button>
        <button
          className={`tab-button ${activeTab === 'outs' ? 'active' : ''}`}
          onClick={() => setActiveTab('outs')}
        >
          Pitching Outs
        </button>
        <button
          className={`tab-button ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          Daily Schedule
        </button>
        <button
          className={`tab-button ${activeTab === 'tracker' ? 'active' : ''}`}
          onClick={() => setActiveTab('tracker')}
        >
          Travel Tracker
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'picks' && (
          <EnhancedPicksOfTheDay
            picksOfTheDay={picksOfTheDay}
            picksLoading={picksLoading}
            trendsData={trendsData}
            seasonStats={seasonStats && seasonStats.byType ? seasonStats : {
              byType: {
                'Home to Away': { wins: 0, losses: 0, total: 0, percentage: 0 },
                'Away to Away': { wins: 0, losses: 0, total: 0, percentage: 0 },
                'Away to Home': { wins: 0, losses: 0, total: 0, percentage: 0 },
                'Home to Home (no Rest)': { wins: 0, losses: 0, total: 0, percentage: 0 },
                'Home to Home (with Rest)': { wins: 0, losses: 0, total: 0, percentage: 0 },
              }
            }}
            refreshAll={refreshAll}
          />
        )}

        {activeTab === 'schedule' && (
          <ScheduleTab
            loading={loading}
            scheduleData={scheduleData}
            selectedDate={selectedDate}
            handleDateChange={handleDateChange}
            fetchDailySchedule={fetchDailySchedule}
            matchups={matchups}
            travelGames={travelGames}
          />
        )}

        {activeTab === 'tracker' && (
          <TrackerTab
            loading={loading}
            travelGames={travelGames}
            matchups={matchups}
            scheduleData={scheduleData}
            startDate={startDate}
            endDate={endDate}
            handleDateChange={handleDateChange}
            fetchSchedule={fetchSchedule}
          />
        )}

        {activeTab === 'trends' && (
          <TrendsTab
            trendsData={trendsData}
            seasonTravelGames={seasonTravelGames}
            loading={seasonLoading}
            seasonYear={seasonYear}
            handleSeasonYearChange={handleSeasonYearChange}
          />
        )}

        {activeTab === 'fade' && (
          <FadeTheSweepTab />
        )}

        {activeTab === 'rockies' && (
          <FadeTheRockiesTab />
        )}

        {activeTab === 'krate' && (
          <KRateUndersTab />
        )}

        {activeTab === 'outs' && (
          <PitchingOutsPredictor />
        )}
      </div>
    </div>
  );
}

// Main App component with routing
function App() {
  const memberstack = {
    publicKey: process.env.REACT_APP_MEMBERSTACK_PUBLIC_KEY
  };

  // Debug log
  console.log('Memberstack public key exists:', !!process.env.REACT_APP_MEMBERSTACK_PUBLIC_KEY);

  return (
    <MemberstackProvider config={memberstack}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainApp />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </MemberstackProvider>
  );
}

export default App;