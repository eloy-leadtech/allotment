/**
 * Trofeo central del "despacho" (referencia PCF7 §5): copa metálica dorada
 * presidiendo el menú, sobre el destello azul del fondo. SVG propio, sin assets.
 */
export function Trophy({ size = 150 }: { size?: number }) {
  return (
    <svg
      className="trophy"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label="Trofeo"
    >
      <defs>
        <linearGradient id="trophyGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3c4" />
          <stop offset="0.35" stopColor="#f2c94c" />
          <stop offset="0.7" stopColor="#c8971e" />
          <stop offset="1" stopColor="#8a5a0f" />
        </linearGradient>
        <linearGradient id="trophyShine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fffbe6" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="trophyBase" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5c7eae" />
          <stop offset="1" stopColor="#1e3462" />
        </linearGradient>
      </defs>

      {/* asas */}
      <path
        d="M28 34 C10 34 10 60 34 62 L34 54 C22 52 22 42 34 42 Z"
        fill="url(#trophyGold)"
        stroke="#7a4e0c"
        strokeWidth="1"
      />
      <path
        d="M92 34 C110 34 110 60 86 62 L86 54 C98 52 98 42 86 42 Z"
        fill="url(#trophyGold)"
        stroke="#7a4e0c"
        strokeWidth="1"
      />

      {/* copa */}
      <path
        d="M32 26 L88 26 C88 54 78 70 60 72 C42 70 32 54 32 26 Z"
        fill="url(#trophyGold)"
        stroke="#7a4e0c"
        strokeWidth="1.5"
      />
      {/* borde superior */}
      <rect x="30" y="22" width="60" height="7" rx="3" fill="url(#trophyGold)" stroke="#7a4e0c" strokeWidth="1" />
      {/* brillo diagonal */}
      <path d="M40 30 L52 30 C50 48 46 58 42 62 C38 52 38 40 40 30 Z" fill="url(#trophyShine)" opacity="0.6" />

      {/* pie */}
      <rect x="55" y="72" width="10" height="12" fill="url(#trophyGold)" stroke="#7a4e0c" strokeWidth="1" />
      <path d="M44 84 L76 84 L72 92 L48 92 Z" fill="url(#trophyGold)" stroke="#7a4e0c" strokeWidth="1" />

      {/* peana de acero azul */}
      <rect x="40" y="92" width="40" height="9" rx="2.5" fill="url(#trophyBase)" stroke="#0a0a28" strokeWidth="1" />
      <rect x="46" y="101" width="28" height="6" rx="2" fill="url(#trophyBase)" stroke="#0a0a28" strokeWidth="1" />
    </svg>
  );
}
