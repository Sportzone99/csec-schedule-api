# CSEC Schedule API

A unified API that aggregates schedule data from three Calgary hockey teams:
- Calgary Flames (NHL)
- Calgary Wranglers (AHL)
- Calgary Hitmen (WHL)

## Features

- Fetches schedule data from NHL, AHL, and WHL APIs
- Normalizes data into a unified format
- Converts all times to Mountain Time (MT)
- Handles team logos with league-specific URL formats
- Includes game scores, overtime, and shootout information
- Provides ticket links and game summary links when available

## Installation

1. Install dependencies:
```bash
npm install
```

## Usage

### Development

Start the development server:
```bash
npm start
```

The API will be available at `http://localhost:3000`

### Endpoints

#### GET `/api/schedule`
Returns the unified schedule for all three teams.

**Response Format:**
```json
{
  "success": true,
  "count": 150,
  "data": [
    {
      "date": "2025-10-15",
      "time": "19:00",
      "location": "Scotiabank Saddledome",
      "homeTeam": "Calgary Flames",
      "awayTeam": "Edmonton Oilers",
      "homeTeamId": 20,
      "awayTeamId": 22,
      "homeTricode": "CGY",
      "awayTricode": "EDM",
      "homeLogo": "https://...",
      "awayLogo": "https://...",
      "league": "NHL",
      "ticketLink": "https://...",
      "homeScore": null,
      "awayScore": null,
      "linkToSummary": "https://...",
      "overtime": false,
      "shootout": false
    }
  ]
}
```

#### GET `/health`
Health check endpoint.

## Data Sources

- **NHL Flames**: `https://api-web.nhle.com/v1/club-schedule-season/CGY/20252026`
- **WHL Hitmen**: `https://lscluster.hockeytech.com/feed/?feed=modulekit&view=schedule&client_code=whl&key=41b145a848f4bd67&fmt=json&season_id=289&team_id=202`
- **AHL Wranglers**: `https://lscluster.hockeytech.com/feed/?feed=modulekit&view=schedule&client_code=ahl&key=ccb91f29d6744675&fmt=json&season_id=90&team_id=444`

## Logo URLs

- **NHL**: Logos are provided directly in the API response
- **WHL**: `https://assets.leaguestat.com/whl/logos/{team_id}.png`
- **AHL**: `https://assets.leaguestat.com/ahl/logos/{team_id}.png`

## Production Deployment

For production, this API will be deployed to AWS S3 with a Lambda function that updates the data hourly:
1. Lambda function fetches data from all three APIs
2. Processes and normalizes the data
3. Saves to S3 bucket as JSON
4. API Gateway serves the JSON file

## Environment Variables

- `PORT`: Server port (default: 3000)

