const ODDS_API_KEY = '08a430878d7c6b2b6df96e12309d423a';
const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4/sports/baseball_mlb/odds';

// Helper to parse time to Date object (UTC)
const parseCommenceTime = (isoString) => new Date(isoString);

// Helper to get pick's game time as Date (try to parse from pick)
const getPickDateTime = (pick) => {
    // Try to use pick.gameDate if available (should be ISO string)
    if (pick.gameDate) return new Date(pick.gameDate);
    // Fallback: try to parse from pick.gameTime and today
    // (Assumes pick.gameTime is like '6:45 PM' and game is today)
    try {
        const today = new Date();
        const [time, modifier] = pick.gameTime.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (modifier === 'PM' && hours !== 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        const date = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes);
        return date;
    } catch {
        return null;
    }
};

// Main odds fetcher: accepts picks array, returns odds mapped by pick.gamePk
export const fetchOdds = async (picks) => {
    try {
        const response = await fetch(`${ODDS_API_BASE_URL}?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h&oddsFormat=american`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        // DEBUG: Log the picks and API response
        console.log('Requested picks:', picks);
        console.log('Odds API response:', data);

        // For each pick, try to find a matching odds game
        const oddsMap = {};
        picks.forEach(pick => {
            const pickHome = pick.homeTeam?.name;
            const pickAway = pick.awayTeam?.name;
            const pickTime = getPickDateTime(pick);
            if (!pickHome || !pickAway || !pickTime) return;

            // Find a game in odds data that matches both teams and is within 15 minutes of pickTime
            const match = data.find(game => {
                if (!game.home_team || !game.away_team || !game.commence_time) return false;
                if (game.home_team !== pickHome || game.away_team !== pickAway) return false;
                const oddsTime = parseCommenceTime(game.commence_time);
                const diff = Math.abs(oddsTime - pickTime) / 60000; // difference in minutes
                return diff <= 15;
            });
            if (match) {
                // Get best odds for each team
                let homeOdds = null, awayOdds = null;
                match.bookmakers.forEach(bookmaker => {
                    bookmaker.markets[0].outcomes.forEach(outcome => {
                        if (outcome.name === match.home_team && (!homeOdds || Math.abs(outcome.price) < Math.abs(homeOdds))) {
                            homeOdds = outcome.price;
                        }
                        if (outcome.name === match.away_team && (!awayOdds || Math.abs(outcome.price) < Math.abs(awayOdds))) {
                            awayOdds = outcome.price;
                        }
                    });
                });
                oddsMap[pick.gamePk] = {
                    homeTeam: {
                        name: match.home_team,
                        odds: homeOdds
                    },
                    awayTeam: {
                        name: match.away_team,
                        odds: awayOdds
                    }
                };
            }
        });
        return oddsMap;
    } catch (error) {
        console.error('Error fetching odds:', error.message || JSON.stringify(error));
        return { error: error.message || JSON.stringify(error) };
    }
};

// Helper function to format odds for display
export const formatOdds = (odds) => {
    if (odds === null || odds === undefined) return '';
    return odds > 0 ? `+${odds}` : `${odds}`;
}; 