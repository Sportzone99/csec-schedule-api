const { convertToMountainTime } = require('../utils/timezone');

// Calgary Roughnecks identifiers
const CALGARY_TEAM_ID = 524;
const CALGARY_TEAM_CODE = 'CGY';

function transformNLLData(data, league) {
  if (!data || !data.phases) {
    return [];
  }

  // Extract all matches from phases -> weeks -> matches
  const allMatches = [];
  data.phases.forEach(phase => {
    if (phase.weeks && Array.isArray(phase.weeks)) {
      phase.weeks.forEach(week => {
        if (week.matches && Array.isArray(week.matches)) {
          allMatches.push(...week.matches);
        }
      });
    }
  });

  if (allMatches.length === 0) {
    return [];
  }

  // Filter for Calgary Roughnecks games and transform
  return allMatches
    .filter(match => {
      // Check if Calgary is home or away
      const homeTeamId = match.squads?.home?.id;
      const awayTeamId = match.squads?.away?.id;
      const homeTeamCode = match.squads?.home?.code;
      const awayTeamCode = match.squads?.away?.code;
      
      return homeTeamId === CALGARY_TEAM_ID || 
             awayTeamId === CALGARY_TEAM_ID ||
             homeTeamCode === CALGARY_TEAM_CODE ||
             awayTeamCode === CALGARY_TEAM_CODE;
    })
    .map(match => {
      if (!match) return null;

      const homeSquad = match.squads?.home;
      const awaySquad = match.squads?.away;

      if (!homeSquad || !awaySquad) {
        return null;
      }

      // Determine if Calgary is home or away
      const isCalgaryHome = homeSquad.id === CALGARY_TEAM_ID || homeSquad.code === CALGARY_TEAM_CODE;
      
      // For unified format, we'll preserve actual home/away status
      // Calgary can be either home or away
      const homeTeam = homeSquad;
      const awayTeam = awaySquad;

      // Convert date/time to Mountain Time
      let gameDate;
      if (match.date?.utcMatchStart) {
        gameDate = new Date(match.date.utcMatchStart);
      } else if (match.date?.startDate && match.date?.startTime) {
        // Combine date and time if UTC not available
        gameDate = new Date(`${match.date.startDate}T${match.date.startTime}`);
      } else {
        return null; // Skip if no date
      }

      if (isNaN(gameDate.getTime())) {
        return null; // Skip invalid dates
      }

      const { date, time } = convertToMountainTime(gameDate);

      // Determine game status
      const statusCode = match.status?.code || '';
      const statusName = match.status?.name || '';
      const isCompleted = statusCode === 'COMP' || 
                         statusName === 'Complete' ||
                         statusName === 'Final';

      // Extract scores
      let homeScore = null;
      let awayScore = null;
      let overtime = false;
      let shootout = false;

      if (isCompleted) {
        // Extract scores from home and away squads
        homeScore = homeSquad.score?.goals || homeSquad.score?.score || null;
        awayScore = awaySquad.score?.goals || awaySquad.score?.score || null;

        // Check for overtime - NLL doesn't typically have OT in regular season
        // but check period count or status
        if (match.status?.period > 4) {
          overtime = true;
        }
      }

      const gameId = match.id || null;
      
      // Construct linkToSummary URL - NLL website structure
      let linkToSummary = null;
      if (gameId) {
        // NLL game links typically use game ID
        linkToSummary = `https://nll.com/game/${gameId}`;
      }

      // Get venue information
      const venue = match.venue?.name || 'TBD';
      const venueTimeZone = match.venue?.timeZone || null;

      // Construct logo URLs using tricode
      const homeTricode = homeTeam.code || null;
      const awayTricode = awayTeam.code || null;
      const homeLogo = homeTricode ? `https://d9xhqsanh0o19.cloudfront.net/logos/${homeTricode}.png` : null;
      const awayLogo = awayTricode ? `https://d9xhqsanh0o19.cloudfront.net/logos/${awayTricode}.png` : null;

      return {
        gameId: gameId,
        date,
        time,
        location: venue,
        homeTeam: homeTeam.displayName || `${homeTeam.name} ${homeTeam.nickname}` || 'TBD',
        awayTeam: awayTeam.displayName || `${awayTeam.name} ${awayTeam.nickname}` || 'TBD',
        homeTeamId: homeTeam.id || null,
        awayTeamId: awayTeam.id || null,
        homeTricode: homeTricode,
        awayTricode: awayTricode,
        homeLogo: homeLogo,
        awayLogo: awayLogo,
        league,
        ticketLink: null, // Not provided in schedule endpoint
        homeScore,
        awayScore,
        linkToSummary,
        overtime,
        shootout
      };
    })
    .filter(game => game !== null); // Remove any null entries
}

module.exports = {
  transformNLLData
};

