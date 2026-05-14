// Cute SVG illustrations for spots
// All icons are designed in a soft, illustrated style

const ICONS = {
  // Default fallback
  default: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="55" r="28" fill="#fff"/>
    <circle cx="42" cy="50" r="3" fill="#4A3F5F"/>
    <circle cx="58" cy="50" r="3" fill="#4A3F5F"/>
    <path d="M42 62 Q50 68 58 62" stroke="#4A3F5F" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  </svg>`,

  clock: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="28" y="34" width="44" height="50" rx="4" fill="#fff" stroke="#4A3F5F" stroke-width="2.5"/>
    <polygon points="20,34 80,34 50,16" fill="#FF9FBA" stroke="#4A3F5F" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="50" cy="56" r="12" fill="#FFFAF5" stroke="#4A3F5F" stroke-width="2"/>
    <line x1="50" y1="56" x2="50" y2="48" stroke="#4A3F5F" stroke-width="2" stroke-linecap="round"/>
    <line x1="50" y1="56" x2="56" y2="56" stroke="#4A3F5F" stroke-width="2" stroke-linecap="round"/>
    <circle cx="50" cy="56" r="1.5" fill="#4A3F5F"/>
    <rect x="44" y="72" width="12" height="14" fill="#FFE5B4" stroke="#4A3F5F" stroke-width="2"/>
  </svg>`,

  tower: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <polygon points="50,12 56,30 44,30" fill="#FF9FBA" stroke="#4A3F5F" stroke-width="2"/>
    <polygon points="40,30 60,30 64,50 36,50" fill="#FFE5B4" stroke="#4A3F5F" stroke-width="2.5"/>
    <rect x="42" y="35" width="16" height="10" rx="2" fill="#fff" stroke="#4A3F5F" stroke-width="2"/>
    <polygon points="36,50 64,50 68,86 32,86" fill="#FFD6E0" stroke="#4A3F5F" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="42" y1="60" x2="58" y2="60" stroke="#4A3F5F" stroke-width="2"/>
    <line x1="40" y1="74" x2="60" y2="74" stroke="#4A3F5F" stroke-width="2"/>
    <circle cx="50" cy="8" r="2.5" fill="#4A3F5F"/>
  </svg>`,

  park: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="84" rx="40" ry="6" fill="#7FCFA4"/>
    <circle cx="32" cy="58" r="18" fill="#B5E2C5" stroke="#4A3F5F" stroke-width="2"/>
    <circle cx="68" cy="58" r="18" fill="#7FCFA4" stroke="#4A3F5F" stroke-width="2"/>
    <rect x="29" y="68" width="6" height="16" fill="#A68870" stroke="#4A3F5F" stroke-width="2"/>
    <rect x="65" y="68" width="6" height="16" fill="#A68870" stroke="#4A3F5F" stroke-width="2"/>
    <circle cx="50" cy="40" r="6" fill="#FFE5B4" stroke="#4A3F5F" stroke-width="2"/>
    <line x1="50" y1="40" x2="56" y2="34" stroke="#4A3F5F" stroke-width="1.5"/>
    <line x1="50" y1="40" x2="44" y2="34" stroke="#4A3F5F" stroke-width="1.5"/>
    <line x1="50" y1="40" x2="56" y2="46" stroke="#4A3F5F" stroke-width="1.5"/>
    <line x1="50" y1="40" x2="44" y2="46" stroke="#4A3F5F" stroke-width="1.5"/>
  </svg>`,

  torii: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="86" rx="36" ry="5" fill="#B5E2C5"/>
    <rect x="20" y="34" width="60" height="8" fill="#FF9FBA" stroke="#4A3F5F" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M16 30 Q50 22 84 30 L80 38 Q50 32 20 38 Z" fill="#FF9FBA" stroke="#4A3F5F" stroke-width="2.5" stroke-linejoin="round"/>
    <rect x="26" y="42" width="6" height="42" fill="#FF9FBA" stroke="#4A3F5F" stroke-width="2.5"/>
    <rect x="68" y="42" width="6" height="42" fill="#FF9FBA" stroke="#4A3F5F" stroke-width="2.5"/>
    <rect x="44" y="48" width="12" height="3" fill="#fff" stroke="#4A3F5F" stroke-width="1"/>
    <rect x="42" y="51" width="16" height="20" fill="none"/>
  </svg>`,

  pyramid: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="86" rx="38" ry="5" fill="#B5E2C5"/>
    <polygon points="50,18 86,82 14,82" fill="#B8E0F5" stroke="#4A3F5F" stroke-width="2.5" stroke-linejoin="round"/>
    <polygon points="50,18 50,82 86,82" fill="#7FC3E8" stroke="#4A3F5F" stroke-width="2.5" stroke-linejoin="round" opacity="0.7"/>
    <circle cx="50" cy="50" r="3" fill="#FFE5B4"/>
  </svg>`,

  cookie: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="52" r="32" fill="#FFE5B4" stroke="#4A3F5F" stroke-width="2.5"/>
    <circle cx="38" cy="42" r="4" fill="#A68870"/>
    <circle cx="58" cy="38" r="3.5" fill="#A68870"/>
    <circle cx="64" cy="58" r="4" fill="#A68870"/>
    <circle cx="40" cy="62" r="3.5" fill="#A68870"/>
    <circle cx="50" cy="52" r="3" fill="#A68870"/>
    <circle cx="42" cy="48" r="1" fill="#fff"/>
    <circle cx="56" cy="60" r="1" fill="#fff"/>
  </svg>`,

  bear: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="10" fill="#A68870" stroke="#4A3F5F" stroke-width="2"/>
    <circle cx="68" cy="32" r="10" fill="#A68870" stroke="#4A3F5F" stroke-width="2"/>
    <circle cx="32" cy="32" r="4" fill="#FFD6E0"/>
    <circle cx="68" cy="32" r="4" fill="#FFD6E0"/>
    <circle cx="50" cy="54" r="28" fill="#A68870" stroke="#4A3F5F" stroke-width="2.5"/>
    <ellipse cx="50" cy="64" rx="14" ry="10" fill="#FFE5B4"/>
    <circle cx="42" cy="50" r="3" fill="#4A3F5F"/>
    <circle cx="58" cy="50" r="3" fill="#4A3F5F"/>
    <circle cx="43" cy="49" r="1" fill="#fff"/>
    <circle cx="59" cy="49" r="1" fill="#fff"/>
    <ellipse cx="50" cy="62" rx="3" ry="2" fill="#4A3F5F"/>
    <path d="M50 64 Q47 68 44 67" stroke="#4A3F5F" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M50 64 Q53 68 56 67" stroke="#4A3F5F" stroke-width="2" fill="none" stroke-linecap="round"/>
  </svg>`,

  canal: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="60" width="84" height="28" fill="#B8E0F5" stroke="#4A3F5F" stroke-width="2"/>
    <path d="M8 64 Q20 62 32 64 T56 64 T80 64 T92 64" stroke="#fff" stroke-width="1.5" fill="none"/>
    <path d="M8 72 Q20 70 32 72 T56 72 T80 72 T92 72" stroke="#fff" stroke-width="1.5" fill="none"/>
    <rect x="12" y="32" width="22" height="28" fill="#FFE5B4" stroke="#4A3F5F" stroke-width="2"/>
    <polygon points="10,32 36,32 23,20" fill="#FF9FBA" stroke="#4A3F5F" stroke-width="2" stroke-linejoin="round"/>
    <rect x="18" y="42" width="4" height="6" fill="#4A3F5F"/>
    <rect x="26" y="42" width="4" height="6" fill="#4A3F5F"/>
    <rect x="40" y="20" width="22" height="40" fill="#FFD6E0" stroke="#4A3F5F" stroke-width="2"/>
    <rect x="46" y="28" width="4" height="6" fill="#4A3F5F"/>
    <rect x="54" y="28" width="4" height="6" fill="#4A3F5F"/>
    <rect x="46" y="40" width="4" height="6" fill="#4A3F5F"/>
    <rect x="54" y="40" width="4" height="6" fill="#4A3F5F"/>
    <rect x="68" y="34" width="22" height="26" fill="#D5C5E8" stroke="#4A3F5F" stroke-width="2"/>
    <polygon points="66,34 92,34 79,22" fill="#A688D0" stroke="#4A3F5F" stroke-width="2" stroke-linejoin="round"/>
  </svg>`,

  music: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="20" y="40" width="60" height="42" rx="4" fill="#A688D0" stroke="#4A3F5F" stroke-width="2.5"/>
    <rect x="24" y="44" width="52" height="20" fill="#FFE5B4" stroke="#4A3F5F" stroke-width="1.5"/>
    <line x1="32" y1="44" x2="32" y2="64" stroke="#4A3F5F" stroke-width="1"/>
    <line x1="44" y1="44" x2="44" y2="64" stroke="#4A3F5F" stroke-width="1"/>
    <line x1="56" y1="44" x2="56" y2="64" stroke="#4A3F5F" stroke-width="1"/>
    <line x1="68" y1="44" x2="68" y2="64" stroke="#4A3F5F" stroke-width="1"/>
    <circle cx="38" cy="34" r="6" fill="#FF9FBA" stroke="#4A3F5F" stroke-width="2"/>
    <line x1="44" y1="34" x2="44" y2="14" stroke="#4A3F5F" stroke-width="2"/>
    <path d="M44 14 Q58 16 56 28" stroke="#4A3F5F" stroke-width="2" fill="none"/>
    <circle cx="40" cy="74" r="3" fill="#FF9FBA"/>
    <circle cx="60" cy="74" r="3" fill="#FF9FBA"/>
  </svg>`,

  bottle: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="44" y="14" width="12" height="14" fill="#A68870" stroke="#4A3F5F" stroke-width="2"/>
    <path d="M42 28 L42 36 Q34 38 34 50 L34 82 Q34 88 40 88 L60 88 Q66 88 66 82 L66 50 Q66 38 58 36 L58 28 Z"
          fill="#FFE5B4" stroke="#4A3F5F" stroke-width="2.5" stroke-linejoin="round"/>
    <rect x="38" y="50" width="24" height="20" fill="#fff" stroke="#4A3F5F" stroke-width="1.5"/>
    <line x1="42" y1="58" x2="58" y2="58" stroke="#A68870" stroke-width="1.2"/>
    <line x1="42" y1="62" x2="58" y2="62" stroke="#A68870" stroke-width="1.2"/>
  </svg>`,

  mountain: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="86" rx="44" ry="5" fill="#B5E2C5"/>
    <polygon points="50,20 86,80 14,80" fill="#B8E0F5" stroke="#4A3F5F" stroke-width="2.5" stroke-linejoin="round"/>
    <polygon points="50,20 60,38 40,38 50,28" fill="#fff" stroke="#4A3F5F" stroke-width="1.5" stroke-linejoin="round"/>
    <polygon points="30,80 60,80 45,52" fill="#7FC3E8" stroke="#4A3F5F" stroke-width="2" stroke-linejoin="round"/>
    <polygon points="45,52 51,62 39,62 45,56" fill="#fff" stroke="#4A3F5F" stroke-width="1.2"/>
    <circle cx="70" cy="30" r="6" fill="#FFE5B4"/>
    <circle cx="74" cy="34" r="6" fill="#fff" opacity="0.7"/>
  </svg>`,

  lake: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="62" rx="42" ry="22" fill="#B8E0F5" stroke="#4A3F5F" stroke-width="2.5"/>
    <path d="M18 58 Q30 56 42 58 T68 58 T82 58" stroke="#fff" stroke-width="1.5" fill="none"/>
    <path d="M22 66 Q34 64 46 66 T72 66 T84 66" stroke="#fff" stroke-width="1.5" fill="none"/>
    <polygon points="35,30 50,12 65,30" fill="#7FC3E8" stroke="#4A3F5F" stroke-width="2" stroke-linejoin="round"/>
    <polygon points="48,18 52,22 50,14" fill="#fff"/>
    <circle cx="72" cy="22" r="6" fill="#FFE5B4"/>
    <circle cx="22" cy="76" r="2" fill="#fff"/>
    <circle cx="78" cy="68" r="2" fill="#fff"/>
  </svg>`,

  volcano: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="86" rx="42" ry="5" fill="#B5E2C5"/>
    <path d="M20 80 L36 40 L44 36 L56 36 L64 40 L80 80 Z" fill="#A68870" stroke="#4A3F5F" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="50" cy="38" rx="10" ry="3" fill="#4A3F5F"/>
    <path d="M44 36 Q40 26 46 22 Q44 14 52 16 Q56 8 60 18 Q66 16 64 24 Q68 30 60 32" fill="#FF9FBA" stroke="#4A3F5F" stroke-width="2" stroke-linejoin="round"/>
    <path d="M30 70 L36 60 L42 70 Z" fill="#FFE5B4" opacity="0.6"/>
  </svg>`,

  onsen: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M30 26 Q26 22 30 18 Q34 22 30 26 M30 32 Q26 28 30 24" stroke="#7C708F" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.7"/>
    <path d="M50 22 Q46 18 50 14 Q54 18 50 22 M50 28 Q46 24 50 20" stroke="#7C708F" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.7"/>
    <path d="M70 26 Q66 22 70 18 Q74 22 70 26 M70 32 Q66 28 70 24" stroke="#7C708F" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.7"/>
    <ellipse cx="50" cy="62" rx="38" ry="22" fill="#FFD6E0" stroke="#4A3F5F" stroke-width="2.5"/>
    <ellipse cx="50" cy="58" rx="34" ry="16" fill="#FF9FBA"/>
    <path d="M16 60 Q28 56 40 60 T64 60 T84 60" stroke="#fff" stroke-width="2" fill="none" opacity="0.8"/>
    <path d="M20 68 Q32 66 44 68 T68 68 T84 68" stroke="#fff" stroke-width="2" fill="none" opacity="0.6"/>
  </svg>`,

  steam: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M22 30 Q18 24 22 18 Q28 24 22 30" stroke="#fff" stroke-width="3" fill="rgba(255,255,255,.6)" stroke-linecap="round"/>
    <path d="M40 20 Q34 12 40 6 Q48 14 40 20" stroke="#fff" stroke-width="3" fill="rgba(255,255,255,.6)"/>
    <path d="M60 18 Q56 10 60 4 Q66 12 60 18" stroke="#fff" stroke-width="3" fill="rgba(255,255,255,.6)"/>
    <path d="M78 28 Q72 22 78 16 Q84 22 78 28" stroke="#fff" stroke-width="3" fill="rgba(255,255,255,.6)"/>
    <path d="M10 80 Q22 50 50 50 Q78 50 90 80 Z" fill="#A68870" stroke="#4A3F5F" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="30" cy="68" rx="6" ry="3" fill="#FFE5B4"/>
    <ellipse cx="60" cy="62" rx="8" ry="3" fill="#FFE5B4"/>
    <ellipse cx="72" cy="72" rx="5" ry="2" fill="#FFE5B4"/>
  </svg>`,

  flower: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <line x1="50" y1="50" x2="50" y2="84" stroke="#7FCFA4" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="42" cy="70" rx="6" ry="3" fill="#7FCFA4" transform="rotate(-30 42 70)"/>
    <ellipse cx="58" cy="76" rx="6" ry="3" fill="#7FCFA4" transform="rotate(30 58 76)"/>
    <circle cx="50" cy="30" r="9" fill="#D5C5E8" stroke="#4A3F5F" stroke-width="1.5"/>
    <circle cx="34" cy="40" r="9" fill="#D5C5E8" stroke="#4A3F5F" stroke-width="1.5"/>
    <circle cx="66" cy="40" r="9" fill="#D5C5E8" stroke="#4A3F5F" stroke-width="1.5"/>
    <circle cx="40" cy="54" r="9" fill="#D5C5E8" stroke="#4A3F5F" stroke-width="1.5"/>
    <circle cx="60" cy="54" r="9" fill="#D5C5E8" stroke="#4A3F5F" stroke-width="1.5"/>
    <circle cx="50" cy="44" r="7" fill="#FFE5B4" stroke="#4A3F5F" stroke-width="1.5"/>
  </svg>`,

  pond: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="62" rx="40" ry="22" fill="#7FC3E8" stroke="#4A3F5F" stroke-width="2.5"/>
    <ellipse cx="50" cy="58" rx="36" ry="14" fill="#B8E0F5"/>
    <line x1="20" y1="44" x2="24" y2="48" stroke="#A68870" stroke-width="2" stroke-linecap="round"/>
    <line x1="28" y1="40" x2="32" y2="44" stroke="#A68870" stroke-width="2" stroke-linecap="round"/>
    <line x1="68" y1="38" x2="72" y2="42" stroke="#A68870" stroke-width="2" stroke-linecap="round"/>
    <line x1="76" y1="44" x2="80" y2="48" stroke="#A68870" stroke-width="2" stroke-linecap="round"/>
    <ellipse cx="40" cy="60" rx="4" ry="1.5" fill="#fff"/>
    <ellipse cx="60" cy="64" rx="4" ry="1.5" fill="#fff"/>
    <circle cx="32" cy="32" r="3" fill="#FFE5B4"/>
    <circle cx="72" cy="26" r="2" fill="#FFE5B4"/>
  </svg>`,

  hill: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="86" rx="44" ry="5" fill="#7FCFA4"/>
    <path d="M0 70 Q20 50 40 64 Q60 78 80 60 Q90 52 100 64 L100 84 L0 84 Z" fill="#FFE5B4" stroke="#4A3F5F" stroke-width="2"/>
    <path d="M0 78 Q25 64 50 76 Q75 86 100 76 L100 84 L0 84 Z" fill="#B5E2C5" stroke="#4A3F5F" stroke-width="2"/>
    <circle cx="68" cy="38" r="8" fill="#FFE5B4"/>
    <path d="M58 38 Q68 32 78 38" stroke="#fff" stroke-width="2" fill="none" opacity="0.6"/>
    <ellipse cx="18" cy="32" rx="10" ry="5" fill="#fff" opacity="0.8"/>
    <ellipse cx="40" cy="22" rx="8" ry="4" fill="#fff" opacity="0.8"/>
  </svg>`,

  waterfall: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 16 L80 16 L72 80 L28 80 Z" fill="#A68870" stroke="#4A3F5F" stroke-width="2.5" stroke-linejoin="round"/>
    <rect x="32" y="22" width="36" height="60" fill="#B8E0F5" stroke="#4A3F5F" stroke-width="2"/>
    <line x1="38" y1="26" x2="38" y2="76" stroke="#fff" stroke-width="1.5"/>
    <line x1="46" y1="26" x2="46" y2="76" stroke="#fff" stroke-width="1.5"/>
    <line x1="54" y1="26" x2="54" y2="76" stroke="#fff" stroke-width="1.5"/>
    <line x1="62" y1="26" x2="62" y2="76" stroke="#fff" stroke-width="1.5"/>
    <ellipse cx="50" cy="84" rx="18" ry="3" fill="#fff" opacity="0.7"/>
    <ellipse cx="50" cy="86" rx="22" ry="4" fill="#B8E0F5"/>
  </svg>`,

  snowflake: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <g stroke="#7FC3E8" stroke-width="3" stroke-linecap="round" fill="none" transform="translate(50 50)">
      <line x1="0" y1="-32" x2="0" y2="32"/>
      <line x1="-28" y1="-16" x2="28" y2="16"/>
      <line x1="-28" y1="16" x2="28" y2="-16"/>
      <line x1="0" y1="-32" x2="-6" y2="-26"/>
      <line x1="0" y1="-32" x2="6" y2="-26"/>
      <line x1="0" y1="32" x2="-6" y2="26"/>
      <line x1="0" y1="32" x2="6" y2="26"/>
      <line x1="-28" y1="-16" x2="-26" y2="-22"/>
      <line x1="-28" y1="-16" x2="-22" y2="-18"/>
      <line x1="28" y1="16" x2="26" y2="22"/>
      <line x1="28" y1="16" x2="22" y2="18"/>
      <line x1="-28" y1="16" x2="-26" y2="22"/>
      <line x1="-28" y1="16" x2="-22" y2="18"/>
      <line x1="28" y1="-16" x2="26" y2="-22"/>
      <line x1="28" y1="-16" x2="22" y2="-18"/>
    </g>
    <circle cx="50" cy="50" r="4" fill="#B8E0F5" stroke="#7FC3E8" stroke-width="2"/>
  </svg>`,

  nightview: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="100" height="100" fill="#D5C5E8" opacity="0.2"/>
    <circle cx="72" cy="22" r="10" fill="#FFE5B4"/>
    <circle cx="68" cy="20" r="7" fill="#D5C5E8" opacity="0.5"/>
    <circle cx="18" cy="14" r="1.5" fill="#fff"/>
    <circle cx="38" cy="22" r="1" fill="#fff"/>
    <circle cx="90" cy="36" r="1" fill="#fff"/>
    <path d="M0 60 Q10 56 20 60 L20 84 L0 84 Z" fill="#A688D0" stroke="#4A3F5F" stroke-width="2"/>
    <path d="M20 56 Q35 50 50 56 L50 84 L20 84 Z" fill="#7C708F" stroke="#4A3F5F" stroke-width="2"/>
    <path d="M50 50 Q70 44 90 50 L90 84 L50 84 Z" fill="#A688D0" stroke="#4A3F5F" stroke-width="2"/>
    <rect x="6" y="68" width="2" height="3" fill="#FFE5B4"/>
    <rect x="12" y="64" width="2" height="3" fill="#FFE5B4"/>
    <rect x="26" y="60" width="2" height="3" fill="#FFE5B4"/>
    <rect x="32" y="68" width="2" height="3" fill="#FFE5B4"/>
    <rect x="38" y="62" width="2" height="3" fill="#FFE5B4"/>
    <rect x="56" y="56" width="2" height="3" fill="#FFE5B4"/>
    <rect x="62" y="64" width="2" height="3" fill="#FFE5B4"/>
    <rect x="68" y="58" width="2" height="3" fill="#FFE5B4"/>
    <rect x="76" y="64" width="2" height="3" fill="#FFE5B4"/>
    <rect x="82" y="60" width="2" height="3" fill="#FFE5B4"/>
  </svg>`,

  star: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <polygon points="50,16 60,40 86,40 66,56 74,80 50,66 26,80 34,56 14,40 40,40" fill="#FFD6E0" stroke="#4A3F5F" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="50" cy="50" r="10" fill="#B5E2C5" stroke="#4A3F5F" stroke-width="2"/>
    <circle cx="46" cy="46" r="2" fill="#fff"/>
  </svg>`,

  crab: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="60" rx="28" ry="20" fill="#FF9FBA" stroke="#4A3F5F" stroke-width="2.5"/>
    <path d="M22 60 Q12 50 8 58 Q4 64 14 68" stroke="#4A3F5F" stroke-width="2" fill="#FF9FBA"/>
    <path d="M78 60 Q88 50 92 58 Q96 64 86 68" stroke="#4A3F5F" stroke-width="2" fill="#FF9FBA"/>
    <path d="M28 76 L20 84" stroke="#4A3F5F" stroke-width="3" stroke-linecap="round"/>
    <path d="M40 80 L36 90" stroke="#4A3F5F" stroke-width="3" stroke-linecap="round"/>
    <path d="M60 80 L64 90" stroke="#4A3F5F" stroke-width="3" stroke-linecap="round"/>
    <path d="M72 76 L80 84" stroke="#4A3F5F" stroke-width="3" stroke-linecap="round"/>
    <line x1="42" y1="48" x2="38" y2="38" stroke="#4A3F5F" stroke-width="2" stroke-linecap="round"/>
    <line x1="58" y1="48" x2="62" y2="38" stroke="#4A3F5F" stroke-width="2" stroke-linecap="round"/>
    <circle cx="38" cy="36" r="3" fill="#4A3F5F"/>
    <circle cx="62" cy="36" r="3" fill="#4A3F5F"/>
    <circle cx="39" cy="35" r="1" fill="#fff"/>
    <circle cx="63" cy="35" r="1" fill="#fff"/>
    <path d="M44 64 Q50 66 56 64" stroke="#4A3F5F" stroke-width="2" fill="none" stroke-linecap="round"/>
  </svg>`,

  church: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="44" y="14" width="3" height="10" fill="#4A3F5F"/>
    <rect x="40" y="18" width="11" height="3" fill="#4A3F5F"/>
    <polygon points="32,30 56,30 44,12" fill="#FF9FBA" stroke="#4A3F5F" stroke-width="2" stroke-linejoin="round"/>
    <rect x="32" y="30" width="24" height="50" fill="#FFE5B4" stroke="#4A3F5F" stroke-width="2.5"/>
    <rect x="38" y="38" width="12" height="16" rx="6 6 0 0" fill="#B8E0F5" stroke="#4A3F5F" stroke-width="1.5"/>
    <line x1="44" y1="38" x2="44" y2="54" stroke="#4A3F5F" stroke-width="1"/>
    <line x1="38" y1="46" x2="50" y2="46" stroke="#4A3F5F" stroke-width="1"/>
    <rect x="56" y="44" width="24" height="36" fill="#FFFAF5" stroke="#4A3F5F" stroke-width="2"/>
    <rect x="62" y="50" width="6" height="8" fill="#B8E0F5" stroke="#4A3F5F" stroke-width="1"/>
    <rect x="70" y="50" width="6" height="8" fill="#B8E0F5" stroke="#4A3F5F" stroke-width="1"/>
    <ellipse cx="56" cy="86" rx="38" ry="3" fill="#B5E2C5"/>
  </svg>`,

  warehouse: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="86" rx="42" ry="4" fill="#B5E2C5"/>
    <rect x="14" y="40" width="72" height="44" fill="#FF9FBA" stroke="#4A3F5F" stroke-width="2.5"/>
    <polygon points="10,40 90,40 50,20" fill="#A68870" stroke="#4A3F5F" stroke-width="2.5" stroke-linejoin="round"/>
    <rect x="22" y="50" width="10" height="14" fill="#FFE5B4" stroke="#4A3F5F" stroke-width="1.5"/>
    <rect x="44" y="50" width="12" height="34" fill="#A68870" stroke="#4A3F5F" stroke-width="1.5"/>
    <rect x="68" y="50" width="10" height="14" fill="#FFE5B4" stroke="#4A3F5F" stroke-width="1.5"/>
    <line x1="14" y1="68" x2="86" y2="68" stroke="#4A3F5F" stroke-width="1.5" stroke-dasharray="2 2"/>
  </svg>`,

  castle: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="86" rx="44" ry="4" fill="#B5E2C5"/>
    <rect x="22" y="64" width="56" height="20" fill="#FFFAF5" stroke="#4A3F5F" stroke-width="2.5"/>
    <polygon points="18,64 82,64 50,52" fill="#FF9FBA" stroke="#4A3F5F" stroke-width="2.5" stroke-linejoin="round"/>
    <rect x="32" y="44" width="36" height="20" fill="#FFFAF5" stroke="#4A3F5F" stroke-width="2.5"/>
    <polygon points="28,44 72,44 50,32" fill="#FF9FBA" stroke="#4A3F5F" stroke-width="2.5" stroke-linejoin="round"/>
    <rect x="40" y="28" width="20" height="16" fill="#FFFAF5" stroke="#4A3F5F" stroke-width="2"/>
    <polygon points="38,28 62,28 50,18" fill="#FF9FBA" stroke="#4A3F5F" stroke-width="2" stroke-linejoin="round"/>
    <rect x="46" y="14" width="2" height="4" fill="#4A3F5F"/>
    <path d="M48 12 L56 14 L48 16 Z" fill="#FF9FBA" stroke="#4A3F5F" stroke-width="1"/>
    <rect x="46" y="72" width="8" height="12" fill="#A68870" stroke="#4A3F5F" stroke-width="1.5"/>
    <rect x="46" y="50" width="3" height="4" fill="#4A3F5F"/>
    <rect x="52" y="50" width="3" height="4" fill="#4A3F5F"/>
  </svg>`,

  ship: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <line x1="50" y1="14" x2="50" y2="56" stroke="#A68870" stroke-width="3"/>
    <path d="M50 18 L70 38 L50 38 Z" fill="#FFD6E0" stroke="#4A3F5F" stroke-width="2"/>
    <path d="M50 42 L74 56 L50 56 Z" fill="#FFFAF5" stroke="#4A3F5F" stroke-width="2"/>
    <path d="M14 56 L86 56 L78 76 L22 76 Z" fill="#FF9FBA" stroke="#4A3F5F" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="32" cy="66" r="3" fill="#B8E0F5" stroke="#4A3F5F" stroke-width="1"/>
    <circle cx="44" cy="66" r="3" fill="#B8E0F5" stroke="#4A3F5F" stroke-width="1"/>
    <circle cx="56" cy="66" r="3" fill="#B8E0F5" stroke="#4A3F5F" stroke-width="1"/>
    <circle cx="68" cy="66" r="3" fill="#B8E0F5" stroke="#4A3F5F" stroke-width="1"/>
    <path d="M8 82 Q22 78 36 82 T64 82 T92 82" stroke="#7FC3E8" stroke-width="2.5" fill="none"/>
    <path d="M14 88 Q28 84 42 88 T70 88 T96 88" stroke="#B8E0F5" stroke-width="2" fill="none"/>
  </svg>`,

  crane: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="86" rx="38" ry="4" fill="#B5E2C5"/>
    <line x1="34" y1="84" x2="34" y2="60" stroke="#A68870" stroke-width="2"/>
    <line x1="38" y1="84" x2="38" y2="60" stroke="#A68870" stroke-width="2"/>
    <ellipse cx="50" cy="60" rx="22" ry="10" fill="#FFFAF5" stroke="#4A3F5F" stroke-width="2"/>
    <path d="M28 56 Q20 50 14 58 Q22 60 28 60 Z" fill="#FFFAF5" stroke="#4A3F5F" stroke-width="2"/>
    <ellipse cx="60" cy="44" rx="6" ry="8" fill="#FFFAF5" stroke="#4A3F5F" stroke-width="2"/>
    <path d="M64 38 Q72 32 76 40 L66 44" fill="#FFFAF5" stroke="#4A3F5F" stroke-width="2"/>
    <polygon points="60,32 64,32 62,28" fill="#FF9FBA"/>
    <path d="M76 40 L82 42 L76 44" stroke="#FFE5B4" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="62" cy="42" r="1.5" fill="#4A3F5F"/>
    <path d="M50 60 L62 56 L72 60" stroke="#4A3F5F" stroke-width="1.5" fill="none"/>
  </svg>`,

  forest: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="86" rx="42" ry="4" fill="#7FCFA4"/>
    <polygon points="20,68 30,38 40,68" fill="#7FCFA4" stroke="#4A3F5F" stroke-width="2" stroke-linejoin="round"/>
    <rect x="28" y="68" width="4" height="14" fill="#A68870" stroke="#4A3F5F" stroke-width="1.5"/>
    <polygon points="36,72 50,30 64,72" fill="#B5E2C5" stroke="#4A3F5F" stroke-width="2" stroke-linejoin="round"/>
    <rect x="48" y="72" width="4" height="12" fill="#A68870" stroke="#4A3F5F" stroke-width="1.5"/>
    <polygon points="60,70 70,42 80,70" fill="#7FCFA4" stroke="#4A3F5F" stroke-width="2" stroke-linejoin="round"/>
    <rect x="68" y="70" width="4" height="12" fill="#A68870" stroke="#4A3F5F" stroke-width="1.5"/>
    <circle cx="44" cy="48" r="3" fill="#FFE5B4"/>
    <circle cx="56" cy="44" r="2" fill="#FFE5B4"/>
  </svg>`,

  iceberg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="56" width="100" height="32" fill="#7FC3E8"/>
    <path d="M0 56 Q20 50 40 56 T80 56 T100 56" stroke="#fff" stroke-width="2" fill="none"/>
    <polygon points="20,56 28,40 36,56" fill="#fff" stroke="#4A3F5F" stroke-width="2"/>
    <polygon points="44,56 60,28 76,56" fill="#fff" stroke="#4A3F5F" stroke-width="2.5" stroke-linejoin="round"/>
    <polygon points="60,28 70,46 50,46" fill="#B8E0F5"/>
    <polygon points="72,56 82,46 90,56" fill="#fff" stroke="#4A3F5F" stroke-width="2"/>
    <polygon points="44,56 56,68 32,68" fill="#B8E0F5" stroke="#4A3F5F" stroke-width="2" stroke-linejoin="round" opacity="0.7"/>
    <circle cx="20" cy="20" r="3" fill="#fff"/>
    <circle cx="80" cy="20" r="2" fill="#fff"/>
  </svg>`,

  building: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="86" rx="42" ry="4" fill="#B5E2C5"/>
    <rect x="18" y="30" width="64" height="54" fill="#FFE5B4" stroke="#4A3F5F" stroke-width="2.5"/>
    <polygon points="14,30 86,30 50,16" fill="#A68870" stroke="#4A3F5F" stroke-width="2.5" stroke-linejoin="round"/>
    <rect x="26" y="40" width="10" height="14" fill="#fff" stroke="#4A3F5F" stroke-width="1.5"/>
    <line x1="31" y1="40" x2="31" y2="54" stroke="#4A3F5F" stroke-width="1"/>
    <rect x="44" y="40" width="12" height="14" fill="#fff" stroke="#4A3F5F" stroke-width="1.5"/>
    <line x1="50" y1="40" x2="50" y2="54" stroke="#4A3F5F" stroke-width="1"/>
    <rect x="64" y="40" width="10" height="14" fill="#fff" stroke="#4A3F5F" stroke-width="1.5"/>
    <line x1="69" y1="40" x2="69" y2="54" stroke="#4A3F5F" stroke-width="1"/>
    <rect x="44" y="64" width="12" height="20" fill="#A68870" stroke="#4A3F5F" stroke-width="2"/>
    <circle cx="53" cy="74" r="1.5" fill="#FFE5B4"/>
  </svg>`,

  farm: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="86" rx="44" ry="4" fill="#7FCFA4"/>
    <path d="M0 76 Q25 70 50 76 Q75 82 100 76 L100 84 L0 84 Z" fill="#B5E2C5"/>
    <rect x="46" y="58" width="20" height="22" fill="#FF9FBA" stroke="#4A3F5F" stroke-width="2"/>
    <polygon points="44,58 68,58 56,46" fill="#A68870" stroke="#4A3F5F" stroke-width="2" stroke-linejoin="round"/>
    <rect x="52" y="68" width="8" height="12" fill="#A68870" stroke="#4A3F5F" stroke-width="1.5"/>
    <circle cx="22" cy="68" r="7" fill="#fff" stroke="#4A3F5F" stroke-width="2"/>
    <circle cx="34" cy="64" r="9" fill="#fff" stroke="#4A3F5F" stroke-width="2"/>
    <ellipse cx="32" cy="74" rx="2" ry="3" fill="#FFE5B4"/>
    <ellipse cx="38" cy="74" rx="2" ry="3" fill="#FFE5B4"/>
    <circle cx="30" cy="60" r="1.5" fill="#4A3F5F"/>
    <circle cx="38" cy="60" r="1.5" fill="#4A3F5F"/>
    <ellipse cx="34" cy="68" rx="3" ry="2" fill="#FFD6E0"/>
    <ellipse cx="78" cy="26" rx="10" ry="5" fill="#fff" opacity="0.8"/>
  </svg>`,

  lighthouse: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="86" rx="40" ry="4" fill="#B5E2C5"/>
    <polygon points="36,82 44,30 56,30 64,82" fill="#fff" stroke="#4A3F5F" stroke-width="2.5" stroke-linejoin="round"/>
    <rect x="42" y="40" width="16" height="6" fill="#FF9FBA"/>
    <rect x="42" y="56" width="16" height="6" fill="#FF9FBA"/>
    <rect x="42" y="72" width="16" height="6" fill="#FF9FBA"/>
    <rect x="40" y="22" width="20" height="8" fill="#A68870" stroke="#4A3F5F" stroke-width="2"/>
    <rect x="44" y="14" width="12" height="8" fill="#FFE5B4" stroke="#4A3F5F" stroke-width="2"/>
    <polygon points="44,14 56,14 50,8" fill="#A68870" stroke="#4A3F5F" stroke-width="2"/>
    <circle cx="50" cy="18" r="3" fill="#FFE5B4" opacity="0.8"/>
    <path d="M64 16 L80 14" stroke="#FFE5B4" stroke-width="3" opacity="0.6" stroke-linecap="round"/>
    <path d="M64 22 L82 24" stroke="#FFE5B4" stroke-width="3" opacity="0.4" stroke-linecap="round"/>
  </svg>`,

  cliff: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="86" rx="44" ry="4" fill="#B5E2C5"/>
    <path d="M8 84 L8 50 L24 30 L36 44 L48 26 L62 42 L76 24 L92 40 L92 84 Z" fill="#A68870" stroke="#4A3F5F" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M8 84 L8 60 L20 50 L34 60 L46 50 L60 64 L74 50 L88 60 L92 60 L92 84 Z" fill="#7FCFA4" stroke="#4A3F5F" stroke-width="2"/>
    <circle cx="74" cy="20" r="6" fill="#FFE5B4"/>
    <ellipse cx="30" cy="20" rx="10" ry="4" fill="#fff" opacity="0.7"/>
  </svg>`,

  penguin: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="86" rx="32" ry="4" fill="#B5E2C5"/>
    <ellipse cx="50" cy="54" rx="24" ry="30" fill="#4A3F5F"/>
    <ellipse cx="50" cy="58" rx="16" ry="22" fill="#fff"/>
    <circle cx="42" cy="40" r="3" fill="#fff"/>
    <circle cx="58" cy="40" r="3" fill="#fff"/>
    <circle cx="43" cy="40" r="2" fill="#4A3F5F"/>
    <circle cx="57" cy="40" r="2" fill="#4A3F5F"/>
    <polygon points="46,46 54,46 50,52" fill="#FFC97A" stroke="#4A3F5F" stroke-width="1.5"/>
    <ellipse cx="44" cy="80" rx="6" ry="3" fill="#FFC97A" stroke="#4A3F5F" stroke-width="1.5"/>
    <ellipse cx="56" cy="80" rx="6" ry="3" fill="#FFC97A" stroke="#4A3F5F" stroke-width="1.5"/>
    <ellipse cx="28" cy="58" rx="4" ry="12" fill="#4A3F5F" transform="rotate(-15 28 58)"/>
    <ellipse cx="72" cy="58" rx="4" ry="12" fill="#4A3F5F" transform="rotate(15 72 58)"/>
    <circle cx="38" cy="50" r="3" fill="#FFD6E0" opacity="0.6"/>
    <circle cx="62" cy="50" r="3" fill="#FFD6E0" opacity="0.6"/>
  </svg>`,

  ramen: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M22 26 Q18 18 24 14 Q30 20 24 26" stroke="#7C708F" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.7"/>
    <path d="M40 22 Q34 12 42 8 Q50 14 42 22" stroke="#7C708F" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.7"/>
    <path d="M60 22 Q56 12 64 8 Q70 14 62 22" stroke="#7C708F" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.7"/>
    <path d="M14 50 Q14 80 50 80 Q86 80 86 50 Z" fill="#fff" stroke="#4A3F5F" stroke-width="2.5"/>
    <ellipse cx="50" cy="50" rx="36" ry="6" fill="#FFE5B4"/>
    <ellipse cx="50" cy="50" rx="32" ry="4" fill="#FFC97A"/>
    <circle cx="36" cy="48" r="4" fill="#fff" stroke="#FF9FBA" stroke-width="1.5"/>
    <circle cx="36" cy="48" r="2" fill="#FFE5B4"/>
    <ellipse cx="56" cy="46" rx="8" ry="3" fill="#A68870"/>
    <path d="M44 50 Q50 48 56 50" stroke="#fff" stroke-width="1.5" fill="none"/>
    <rect x="62" y="38" width="2" height="36" fill="#A68870" transform="rotate(20 63 56)"/>
    <rect x="34" y="38" width="2" height="36" fill="#A68870" transform="rotate(-20 35 56)"/>
  </svg>`,

  sea: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="50" width="100" height="38" fill="#7FC3E8"/>
    <path d="M0 50 Q15 44 30 50 T60 50 T90 50 T100 50 L100 56 L0 56 Z" fill="#B8E0F5"/>
    <path d="M0 62 Q15 58 30 62 T60 62 T90 62 L100 62 L100 68 L0 68 Z" fill="#fff" opacity="0.6"/>
    <path d="M0 74 Q20 70 40 74 T80 74 T100 74 L100 78 L0 78 Z" fill="#fff" opacity="0.4"/>
    <polygon points="6,50 14,30 22,50" fill="#7FCFA4" stroke="#4A3F5F" stroke-width="2" stroke-linejoin="round"/>
    <polygon points="78,50 90,28 102,50" fill="#7FCFA4" stroke="#4A3F5F" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="50" cy="22" r="8" fill="#FFE5B4"/>
    <circle cx="46" cy="20" r="6" fill="#fff" opacity="0.5"/>
  </svg>`,

  cloud: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="86" rx="38" ry="4" fill="#B5E2C5"/>
    <path d="M14 72 Q4 70 8 60 Q4 50 16 48 Q14 36 28 36 Q34 26 46 30 Q54 22 64 30 Q78 28 80 40 Q92 42 90 56 Q96 66 86 72 Z" fill="#fff" stroke="#4A3F5F" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="36" cy="52" r="2" fill="#4A3F5F"/>
    <circle cx="60" cy="52" r="2" fill="#4A3F5F"/>
    <path d="M44 60 Q48 64 52 60" stroke="#4A3F5F" stroke-width="2" fill="none" stroke-linecap="round"/>
    <ellipse cx="32" cy="58" rx="4" ry="2" fill="#FFD6E0" opacity="0.6"/>
    <ellipse cx="64" cy="58" rx="4" ry="2" fill="#FFD6E0" opacity="0.6"/>
  </svg>`,

  melon: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="86" rx="34" ry="4" fill="#7FCFA4"/>
    <circle cx="50" cy="56" r="30" fill="#B5E2C5" stroke="#4A3F5F" stroke-width="2.5"/>
    <path d="M22 50 Q35 45 50 50 T78 50" stroke="#fff" stroke-width="1.5" fill="none"/>
    <path d="M22 60 Q35 55 50 60 T78 60" stroke="#fff" stroke-width="1.5" fill="none"/>
    <path d="M22 70 Q35 65 50 70 T78 70" stroke="#fff" stroke-width="1.5" fill="none"/>
    <path d="M30 30 Q50 26 70 30" stroke="#fff" stroke-width="1.5" fill="none"/>
    <rect x="46" y="20" width="3" height="10" fill="#7FCFA4" stroke="#4A3F5F" stroke-width="1.5"/>
    <path d="M48 22 Q56 14 60 22" fill="#7FCFA4" stroke="#4A3F5F" stroke-width="1.5"/>
  </svg>`
};

function getIcon(iconName) {
  return ICONS[iconName] || ICONS.default;
}
