// Region maps — schematic, gold-on-charcoal. viewBox 0 0 320 240.
const REGION_MAPS = {
champagne: `<svg viewBox="0 0 320 240" class="rmap">
  <path d="M95 40 C120 30 175 34 200 55 C215 68 210 92 185 100 C150 110 110 100 98 78 C90 62 84 46 95 40 Z" class="zone"/>
  <path d="M60 148 C100 138 150 140 185 150" class="river"/>
  <path d="M132 150 C126 175 128 200 135 215 L150 215 C156 198 154 172 150 150 Z" class="zone"/>
  <circle cx="150" cy="40" r="3.2" class="town"/><text x="158" y="43" class="t-town">Reims</text>
  <circle cx="140" cy="140" r="3.2" class="town"/><text x="148" y="143" class="t-town">Épernay</text>
  <circle cx="185" cy="96" r="2.4" class="dot"/><text x="191" y="99" class="t-dot">Ambonnay</text>
  <circle cx="128" cy="120" r="2.4" class="dot"/><text x="96" y="123" class="t-dot">Aÿ</text>
  <circle cx="141" cy="182" r="2.4" class="dot"/><text x="148" y="185" class="t-dot">Avize</text>
  <circle cx="143" cy="205" r="2.4" class="dot"/><text x="150" y="208" class="t-dot">Le Mesnil</text>
  <text x="150" y="72" class="t-zone">Montagne de Reims</text>
  <text x="60" y="134" class="t-zone">Vallée de la Marne</text>
  <text x="196" y="185" class="t-zone">Côte des<tspan x="196" dy="13">Blancs</tspan></text>
</svg>`,
burgundy: `<svg viewBox="0 0 320 240" class="rmap">
  <path d="M120 18 C150 30 165 55 168 80 C172 110 160 140 150 165 C140 190 128 210 118 224 C112 214 118 190 122 165 C128 135 132 108 128 82 C124 55 108 34 120 18 Z" class="zone"/>
  <path d="M138 20 C150 55 152 100 146 150 C142 185 132 208 124 224" class="road"/>
  <circle cx="150" cy="46" r="2.6" class="dot"/><text x="158" y="49" class="t-dot">Gevrey-Chambertin</text>
  <circle cx="150" cy="86" r="2.6" class="dot"/><text x="158" y="89" class="t-dot">Vosne-Romanée</text>
  <circle cx="147" cy="112" r="2.6" class="dot"/><text x="155" y="115" class="t-dot">Nuits-St-Georges</text>
  <circle cx="142" cy="146" r="2.6" class="dot"/><text x="150" y="149" class="t-dot">Beaune</text>
  <circle cx="136" cy="176" r="2.6" class="dot"/><text x="144" y="179" class="t-dot">Meursault</text>
  <circle cx="130" cy="198" r="2.6" class="dot"/><text x="138" y="201" class="t-dot">Puligny · Chassagne</text>
  <text x="70" y="30" class="t-zone">Côte de Nuits</text>
  <text x="66" y="196" class="t-zone">Côte de Beaune</text>
</svg>`,
bordeaux: `<svg viewBox="0 0 320 240" class="rmap">
  <path d="M70 30 C90 60 120 95 135 120 C150 145 150 175 145 205" class="river"/>
  <path d="M235 120 C210 130 175 128 150 140" class="river"/>
  <path d="M150 140 C140 165 135 190 138 210" class="river"/>
  <path d="M95 60 C108 66 112 90 104 120 C98 145 92 168 96 190 C86 168 82 140 86 112 C88 88 86 66 95 60 Z" class="zone"/>
  <path d="M186 132 C200 128 214 138 210 152 C205 165 188 166 180 156 C176 146 178 134 186 132 Z" class="zone"/>
  <circle cx="98" cy="70" r="2.4" class="dot"/><text x="40" y="73" class="t-dot">St-Estèphe</text>
  <circle cx="100" cy="92" r="2.4" class="dot"/><text x="52" y="95" class="t-dot">Pauillac</text>
  <circle cx="98" cy="118" r="2.4" class="dot"/><text x="44" y="121" class="t-dot">St-Julien</text>
  <circle cx="94" cy="150" r="2.4" class="dot"/><text x="50" y="153" class="t-dot">Margaux</text>
  <circle cx="196" cy="150" r="2.4" class="dot"/><text x="204" y="153" class="t-dot">St-Émilion</text>
  <circle cx="188" cy="140" r="2.4" class="dot"/><text x="196" y="132" class="t-dot">Pomerol</text>
  <circle cx="120" cy="185" r="3" class="town"/><text x="128" y="188" class="t-town">Bordeaux</text>
  <circle cx="132" cy="222" r="2.4" class="dot"/><text x="140" y="225" class="t-dot">Sauternes</text>
  <text x="45" y="45" class="t-zone">Médoc</text>
</svg>`,
piedmont: `<svg viewBox="0 0 320 240" class="rmap">
  <path d="M60 150 C110 130 160 138 210 120 C250 106 275 110 285 100" class="river"/>
  <path d="M110 165 C126 158 142 168 138 186 C132 202 112 202 104 188 C100 176 102 168 110 165 Z" class="zone"/>
  <path d="M205 118 C222 110 240 120 236 138 C230 154 210 154 202 140 C198 128 197 122 205 118 Z" class="zone"/>
  <circle cx="168" cy="150" r="3" class="town"/><text x="176" y="153" class="t-town">Alba</text>
  <text x="86" y="200" class="t-zone">Barolo</text>
  <text x="216" y="106" class="t-zone">Barbaresco</text>
  <text x="60" y="140" class="t-dot">Tanaro</text>
  <text x="60" y="40" class="t-zone">Langhe · Piemonte</text>
</svg>`,
tuscany: `<svg viewBox="0 0 320 240" class="rmap">
  <path d="M70 20 C60 60 66 110 80 150 C92 185 96 210 90 228" class="coast"/>
  <path d="M100 90 C112 86 122 96 118 110 C112 122 98 122 92 110 C90 100 92 92 100 90 Z" class="zone"/>
  <path d="M168 96 C182 92 194 102 190 118 C184 132 166 132 160 118 C158 106 160 100 168 96 Z" class="zone"/>
  <path d="M172 150 C186 146 198 156 194 172 C188 186 170 186 164 172 C162 160 164 154 172 150 Z" class="zone"/>
  <circle cx="106" cy="100" r="2.6" class="dot"/><text x="60" y="86" class="t-dot">Bolgheri</text>
  <text x="196" y="112" class="t-zone">Chianti</text>
  <text x="198" y="168" class="t-zone">Montalcino</text>
  <text x="34" y="150" class="t-zone">Tirreno</text>
  <text x="120" y="40" class="t-zone">Toscana</text>
</svg>`,
dalmatia: `<svg viewBox="0 0 320 240" class="rmap">
  <path d="M40 60 C90 84 140 108 190 128 C220 140 250 150 285 158" class="coast"/>
  <path d="M150 118 C175 126 205 132 232 140 C246 144 250 152 240 156 C214 152 184 146 158 138 C144 133 140 122 150 118 Z" class="zone"/>
  <path d="M120 165 C138 162 152 170 148 182 C142 192 124 192 118 180 C116 172 114 167 120 165 Z" class="zone"/>
  <circle cx="228" cy="150" r="2.6" class="dot"/><text x="212" y="168" class="t-dot">Dingač · Postup</text>
  <text x="150" y="112" class="t-zone">Pelješac</text>
  <text x="112" y="205" class="t-zone">Korčula</text>
  <text x="40" y="130" class="t-zone">Jadran</text>
  <text x="40" y="46" class="t-zone">Dalmacija</text>
</svg>`
};
