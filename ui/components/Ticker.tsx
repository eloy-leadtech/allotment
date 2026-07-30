interface TickerProps {
  lines: string[];
}

/** Retro teletipo: renders the pre-narrated match lines from the game layer. */
export function Ticker({ lines }: TickerProps) {
  return (
    <ul className="ticker">
      {lines.map((line, index) => (
        <li key={index} className="ticker__line">
          {line}
        </li>
      ))}
    </ul>
  );
}
