const { convertToMountainTime } = require('../utils/timezone');

function transformHockeyTechData(data, league) {
  if (!data) {
    return [];
  }

  // Handle different possible response structures
  let games = [];
  if (data.SiteKit && data.SiteKit.Schedule) {
    const schedule = data.SiteKit.Schedule;
    games = Array.isArray(schedule) ? schedule : [schedule];
  } else if (data.Schedule) {
    games = Array.isArray(data.Schedule) ? data.Schedule : [data.Schedule];
  } else if (Array.isArray(data)) {
    games = data;
  }

  if (games.length === 0) {
    return [];
  }

  return games.map(game => {
    if (!game) return null;

    // Get team IDs - handle both nested objects and flat fields
    let homeTeamId = null;
    let awayTeamId = null;
    
    // Try nested object first
    if (game.home_team && typeof game.home_team === 'object' && game.home_team.id) {
      homeTeamId = game.home_team.id;
    } else if (game.homeTeam && typeof game.homeTeam === 'object' && game.homeTeam.id) {
      homeTeamId = game.homeTeam.id;
    } else {
      // Try flat fields (WHL/AHL format)
      homeTeamId = game.home_team_id || game.homeTeamId || 
                   (typeof game.home_team === 'string' ? parseInt(game.home_team) : game.home_team) ||
                   (typeof game.home_team === 'number' ? game.home_team : null);
    }
    
    if (game.visiting_team && typeof game.visiting_team === 'object' && game.visiting_team.id) {
      awayTeamId = game.visiting_team.id;
    } else if (game.visitingTeam && typeof game.visitingTeam === 'object' && game.visitingTeam.id) {
      awayTeamId = game.visitingTeam.id;
    } else {
      // Try flat fields (WHL/AHL format)
      awayTeamId = game.visiting_team_id || game.visitingTeamId || 
                  (typeof game.visiting_team === 'string' ? parseInt(game.visiting_team) : game.visiting_team) ||
                  (typeof game.visiting_team === 'number' ? game.visiting_team : null);
    }
    
    // Convert date/time to Mountain Time
    let gameDate;
    // Try ISO8601 format first (WHL format)
    if (game.GameDateISO8601) {
      gameDate = new Date(game.GameDateISO8601);
    } else if (game.date_time_played) {
      gameDate = new Date(game.date_time_played);
    } else if (game.date_played) {
      gameDate = new Date(game.date_played);
      // If time is provided separately, combine with date
      if (game.schedule_time) {
        const timeStr = game.schedule_time.toString();
        const [hours, minutes, seconds] = timeStr.split(':');
        gameDate.setHours(parseInt(hours) || 0, parseInt(minutes) || 0, parseInt(seconds) || 0);
      }
    } else if (game.game_date) {
      gameDate = new Date(game.game_date);
    } else if (game.date) {
      gameDate = new Date(game.date);
    } else if (game.start_time) {
      gameDate = new Date(game.start_time);
    } else if (game.datetime) {
      gameDate = new Date(game.datetime);
    } else {
      return null; // Skip if no date
    }

    if (isNaN(gameDate.getTime())) {
      return null; // Skip invalid dates
    }

    // If time is provided separately, combine with date
    if (game.game_time && !game.GameDateISO8601 && !game.date_time_played) {
      const timeStr = game.game_time.toString();
      const [hours, minutes] = timeStr.includes(':') ? timeStr.split(':') : [timeStr.substring(0, 2), timeStr.substring(2)];
      gameDate.setHours(parseInt(hours) || 0, parseInt(minutes) || 0, 0, 0);
    } else if (game.time && !game.GameDateISO8601 && !game.date_time_played) {
      const timeStr = game.time.toString();
      const [hours, minutes] = timeStr.includes(':') ? timeStr.split(':') : [timeStr.substring(0, 2), timeStr.substring(2)];
      gameDate.setHours(parseInt(hours) || 0, parseInt(minutes) || 0, 0, 0);
    } else if (game.start_time_local && !game.GameDateISO8601 && !game.date_time_played) {
      const timeStr = game.start_time_local.toString();
      const [hours, minutes] = timeStr.includes(':') ? timeStr.split(':') : [timeStr.substring(0, 2), timeStr.substring(2)];
      gameDate.setHours(parseInt(hours) || 0, parseInt(minutes) || 0, 0, 0);
    }

    const { date, time } = convertToMountainTime(gameDate);

    // Determine game status
    const gameStatus = game.game_status || game.status || game.state || 'Scheduled';
    const isCompleted = gameStatus === 'Final' || gameStatus === 'Final/OT' || 
                       gameStatus === 'Final/SO' || gameStatus === 'Completed' ||
                       gameStatus === 'F' || game.final === '1' || game.final === 1;

    // Extract scores - handle string and number formats
    let homeScore = null;
    let awayScore = null;
    let overtime = false;
    let shootout = false;

    if (isCompleted) {
      // Handle WHL format: home_goal_count, visiting_goal_count (as strings)
      if (game.home_goal_count !== undefined) {
        homeScore = parseInt(game.home_goal_count) || null;
      } else if (game.home_team_score !== undefined) {
        homeScore = parseInt(game.home_team_score) || null;
      } else if (game.home_score !== undefined) {
        homeScore = parseInt(game.home_score) || null;
      } else if (game.homeScore !== undefined) {
        homeScore = parseInt(game.homeScore) || null;
      }
      
      if (game.visiting_goal_count !== undefined) {
        awayScore = parseInt(game.visiting_goal_count) || null;
      } else if (game.visiting_team_score !== undefined) {
        awayScore = parseInt(game.visiting_team_score) || null;
      } else if (game.visiting_score !== undefined) {
        awayScore = parseInt(game.visiting_score) || null;
      } else if (game.away_score !== undefined) {
        awayScore = parseInt(game.away_score) || null;
      } else if (game.awayScore !== undefined) {
        awayScore = parseInt(game.awayScore) || null;
      }
      
      // Check for overtime/shootout - handle string "0"/"1" format
      const otValue = game.overtime !== undefined ? (game.overtime === '1' || game.overtime === 1 || game.overtime === true) : false;
      const soValue = game.shootout !== undefined ? (game.shootout === '1' || game.shootout === 1 || game.shootout === true) : false;
      
      overtime = gameStatus === 'Final/OT' || gameStatus === 'Final/SO' || 
                (game.period && parseInt(game.period) > 3) ||
                otValue;
      shootout = gameStatus === 'Final/SO' || soValue;
    }

    // Construct logo URLs based on league
    const homeLogo = homeTeamId ? `https://assets.leaguestat.com/${league.toLowerCase()}/logos/${homeTeamId}.png` : null;
    const awayLogo = awayTeamId ? `https://assets.leaguestat.com/${league.toLowerCase()}/logos/${awayTeamId}.png` : null;

    // Get team names - prioritize flat fields (WHL/AHL format)
    const homeTeamName = game.home_team_name || 
                        (game.home_team && typeof game.home_team === 'object' ? (game.home_team.name || game.home_team.nickname || game.home_team.full_name) : null) ||
                        game.homeTeamName || 'TBD';
    const awayTeamName = game.visiting_team_name || 
                        (game.visiting_team && typeof game.visiting_team === 'object' ? (game.visiting_team.name || game.visiting_team.nickname || game.visiting_team.full_name) : null) ||
                        game.visitingTeamName ||
                        game.away_team_name || game.awayTeamName || 'TBD';

    // Get team codes/tricodes - prioritize flat fields
    const homeTricode = game.home_team_code || 
                       (game.home_team && typeof game.home_team === 'object' ? (game.home_team.code || game.home_team.abbrev || game.home_team.abbreviation) : null) ||
                       null;
    const awayTricode = game.visiting_team_code ||
                       (game.visiting_team && typeof game.visiting_team === 'object' ? (game.visiting_team.code || game.visiting_team.abbrev || game.visiting_team.abbreviation) : null) ||
                       null;

    // Get location/arena - prioritize venue_name (WHL format)
    let location = game.venue_name || 
                  game.venueName || 
                  game.venue || 
                  game.arena || 
                  game.arena_name || 
                  game.arenaName || 
                  'TBD';
    
    // If location is just a number (venue ID), try to get venue name from nested structures
    if ((typeof location === 'number' || (typeof location === 'string' && /^\d+$/.test(location))) && location !== 'TBD') {
      // Try to find venue name in nested structures
      if (game.venue_info && game.venue_info.name) {
        location = game.venue_info.name;
      } else if (data.SiteKit && data.SiteKit.Venue) {
        const venues = Array.isArray(data.SiteKit.Venue) ? data.SiteKit.Venue : [data.SiteKit.Venue];
        const venue = venues.find(v => v.id == location || v.venue_id == location);
        if (venue) {
          location = venue.name || venue.venue_name || location;
        }
      }
      // If still a number, keep it as is (better than TBD)
    }
    
    // Clean up venue name if it includes location info (e.g., "Scotiabank Saddledome - Calgary, AB")
    if (typeof location === 'string' && location.includes(' - ')) {
      location = location.split(' - ')[0];
    }

    const gameId = game.game_id || game.id || null;
    
    // Construct linkToSummary URL using gameId based on league
    let linkToSummary = null;
    if (gameId) {
      if (league === 'WHL') {
        linkToSummary = `https://chl.ca/whl/gamecentre/${gameId}/`;
      } else if (league === 'AHL') {
        linkToSummary = `https://theahl.com/stats/game-center/${gameId}`;
      }
    }

    return {
      gameId: gameId,
      date,
      time,
      location,
      homeTeam: homeTeamName,
      awayTeam: awayTeamName,
      homeTeamId: homeTeamId,
      awayTeamId: awayTeamId,
      homeTricode: homeTricode,
      awayTricode: awayTricode,
      homeLogo,
      awayLogo,
      league,
      ticketLink: game.tickets_url || game.ticket_link || game.tickets || game.ticket_url || null,
      homeScore,
      awayScore,
      linkToSummary,
      overtime,
      shootout
    };
  }).filter(game => game !== null); // Remove any null entries
}

module.exports = {
  transformHockeyTechData
};

