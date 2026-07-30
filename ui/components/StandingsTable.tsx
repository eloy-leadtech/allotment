import type { StandingRow } from '@engine';

interface StandingsTableProps {
  rows: StandingRow[];
  teamName: (id: string) => string;
  highlightTeamId?: string;
}

export function StandingsTable({ rows, teamName, highlightTeamId }: StandingsTableProps) {
  return (
    <div className="standings-scroll">
      <table className="standings">
        <thead>
          <tr>
            <th>#</th>
            <th className="standings__team">Equipo</th>
            <th>PJ</th>
            <th>G</th>
            <th>E</th>
            <th>P</th>
            <th>GF</th>
            <th>GC</th>
            <th>DG</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.teamId} className={row.teamId === highlightTeamId ? 'standings__row--me' : ''}>
              <td>{index + 1}</td>
              <td className="standings__team">{teamName(row.teamId)}</td>
              <td>{row.played}</td>
              <td>{row.won}</td>
              <td>{row.drawn}</td>
              <td>{row.lost}</td>
              <td>{row.goalsFor}</td>
              <td>{row.goalsAgainst}</td>
              <td>{row.goalDiff}</td>
              <td className="standings__pts">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
