// Region maps — schematic, gold-on-charcoal. viewBox 0 0 320 240.
//
// Every `.t-town` / `.t-dot` / `.t-zone` label is run through `localizeMap()`
// in js/app.js before it reaches the screen, so a Chinese guest reads 巴罗洛
// rather than Barolo and a German reads Toskana rather than Toscana. Two rules
// follow from that: **write place names in full** — "Saint-Émilion", not
// "St-Émilion", because the abbreviation is in no dictionary — and separate two
// names sharing one label with " · ", which the localiser splits on.
// Names that are water or landform rather than wine region live in
// MAP_FEATURES below; ZH_REGION is for places wine comes from.
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
  <circle cx="143" cy="205" r="2.4" class="dot"/><text x="150" y="208" class="t-dot">Le Mesnil-sur-Oger</text>
  <text x="150" y="72" class="t-zone">Montagne de Reims</text>
  <text x="60" y="134" class="t-zone">Vallée de la Marne</text>
  <text x="180" y="192" class="t-zone">Côte des Blancs</text>
</svg>`,
burgundy: `<svg viewBox="0 0 320 240" class="rmap">
  <path d="M120 18 C150 30 165 55 168 80 C172 110 160 140 150 165 C140 190 128 210 118 224 C112 214 118 190 122 165 C128 135 132 108 128 82 C124 55 108 34 120 18 Z" class="zone"/>
  <path d="M138 20 C150 55 152 100 146 150 C142 185 132 208 124 224" class="road"/>
  <circle cx="150" cy="46" r="2.6" class="dot"/><text x="158" y="49" class="t-dot">Gevrey-Chambertin</text>
  <circle cx="150" cy="86" r="2.6" class="dot"/><text x="158" y="89" class="t-dot">Vosne-Romanée</text>
  <circle cx="147" cy="112" r="2.6" class="dot"/><text x="155" y="115" class="t-dot">Nuits-Saint-Georges</text>
  <circle cx="142" cy="146" r="2.6" class="dot"/><text x="150" y="149" class="t-dot">Beaune</text>
  <circle cx="136" cy="176" r="2.6" class="dot"/><text x="144" y="179" class="t-dot">Meursault</text>
  <circle cx="130" cy="198" r="2.6" class="dot"/><text x="138" y="201" class="t-dot">Puligny-Montrachet · Chassagne-Montrachet</text>
  <text x="70" y="30" class="t-zone">Côte de Nuits</text>
  <text x="66" y="196" class="t-zone">Côte de Beaune</text>
</svg>`,
bordeaux: `<svg viewBox="0 0 320 240" class="rmap">
  <path d="M70 30 C90 60 120 95 135 120 C150 145 150 175 145 205" class="river"/>
  <path d="M235 120 C210 130 175 128 150 140" class="river"/>
  <path d="M150 140 C140 165 135 190 138 210" class="river"/>
  <path d="M95 60 C108 66 112 90 104 120 C98 145 92 168 96 190 C86 168 82 140 86 112 C88 88 86 66 95 60 Z" class="zone"/>
  <path d="M186 132 C200 128 214 138 210 152 C205 165 188 166 180 156 C176 146 178 134 186 132 Z" class="zone"/>
  <circle cx="98" cy="70" r="2.4" class="dot"/><text x="40" y="73" class="t-dot">Saint-Estèphe</text>
  <circle cx="100" cy="92" r="2.4" class="dot"/><text x="52" y="95" class="t-dot">Pauillac</text>
  <circle cx="98" cy="118" r="2.4" class="dot"/><text x="44" y="121" class="t-dot">Saint-Julien</text>
  <circle cx="94" cy="150" r="2.4" class="dot"/><text x="50" y="153" class="t-dot">Margaux</text>
  <circle cx="196" cy="150" r="2.4" class="dot"/><text x="204" y="153" class="t-dot">Saint-Émilion</text>
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
</svg>`,

istria: `<svg viewBox="0 0 320 240" class="rmap">
  <path d="M78 38 C112 30 200 30 232 44 C238 74 226 112 206 146 C186 180 166 202 152 214 C136 200 116 174 100 142 C82 106 72 68 78 38 Z" class="coast"/>
  <path d="M100 58 C118 52 132 64 130 84 C128 106 122 126 114 142 C104 124 92 102 88 82 C86 68 92 60 100 58 Z" class="zone"/>
  <path d="M154 62 C182 56 202 68 202 90 C202 116 190 144 176 168 C162 148 150 120 146 96 C144 76 148 66 154 62 Z" class="zone"/>
  <circle cx="106" cy="70" r="2.6" class="dot"/><text x="60" y="73" class="t-dot">Buje</text>
  <circle cx="102" cy="100" r="2.6" class="dot"/><text x="54" y="103" class="t-dot">Poreč</text>
  <circle cx="168" cy="84" r="2.6" class="dot"/><text x="176" y="87" class="t-dot">Motovun</text>
  <circle cx="174" cy="122" r="2.6" class="dot"/><text x="182" y="125" class="t-dot">Pazin</text>
  <circle cx="112" cy="134" r="3" class="town"/><text x="66" y="137" class="t-town">Bale</text>
  <text x="8" y="176" class="t-zone">Zapadna Istra</text>
  <text x="206" y="192" class="t-zone">Centralna Istra</text>
  <text x="126" y="22" class="t-zone">Istra</text>
</svg>`,

germany: `<svg viewBox="0 0 320 240" class="rmap">
  <path d="M36 152 C62 146 74 128 96 122 C118 116 128 100 148 92 C166 84 178 74 190 62" class="river"/>
  <path d="M52 212 C58 190 50 172 40 152" class="river"/>
  <path d="M190 62 C186 84 178 100 166 112 C180 122 190 132 192 148 C194 176 194 200 192 222" class="river"/>
  <path d="M104 168 C126 152 146 132 166 118" class="river"/>
  <path d="M56 138 C78 130 92 114 112 108 C130 102 142 88 158 80 C164 88 162 98 150 106 C132 118 122 130 104 138 C88 144 76 154 62 152 C56 148 54 142 56 138 Z" class="zone"/>
  <path d="M160 78 C172 70 182 62 190 56 C196 62 196 72 188 82 C180 92 172 98 164 102 C158 96 156 86 160 78 Z" class="zone"/>
  <path d="M44 198 C50 180 44 166 36 152 C30 156 28 166 34 180 C38 190 40 198 42 206 Z" class="zone"/>
  <path d="M172 108 C192 100 214 104 218 116 C220 128 204 136 186 132 C172 128 166 116 172 108 Z" class="zone"/>
  <path d="M166 148 C188 140 210 148 210 164 C210 182 188 188 174 180 C162 172 160 154 166 148 Z" class="zone"/>
  <path d="M164 194 C186 186 208 194 208 210 C208 226 186 232 172 224 C160 216 158 200 164 194 Z" class="zone"/>
  <path d="M96 158 C116 148 134 140 148 132 C154 138 152 148 140 156 C126 164 112 170 100 172 C94 168 92 162 96 158 Z" class="zone"/>
  <circle cx="190" cy="62" r="3" class="town"/><text x="198" y="58" class="t-town">Koblenz</text>
  <circle cx="42" cy="150" r="3" class="town"/><text x="10" y="142" class="t-town">Trier</text>
  <circle cx="110" cy="120" r="2.4" class="dot"/><text x="86" y="112" class="t-dot">Bernkastel</text>
  <circle cx="192" cy="146" r="3" class="town"/><text x="200" y="142" class="t-town">Mainz</text>
  <text x="60" y="104" class="t-zone">Mittelmosel</text>
  <text x="150" y="70" class="t-zone">Terrassenmosel</text>
  <text x="6" y="222" class="t-zone">Saar</text>
  <text x="222" y="112" class="t-zone">Rheingau</text>
  <text x="216" y="166" class="t-zone">Rheinhessen</text>
  <text x="214" y="212" class="t-zone">Pfalz</text>
  <text x="70" y="180" class="t-zone">Nahe</text>
</svg>`,

veneto: `<svg viewBox="0 0 320 240" class="rmap">
  <path d="M36 46 C30 74 34 104 44 124 C50 138 52 150 48 162" class="coast"/>
  <path d="M148 24 C144 58 138 98 134 138 C132 154 134 166 140 178 C152 194 176 204 206 210" class="river"/>
  <path d="M70 74 C94 66 116 76 122 94 C128 112 118 132 98 136 C78 140 62 126 60 106 C58 90 62 78 70 74 Z" class="zone"/>
  <path d="M162 78 C186 70 212 80 216 98 C220 116 206 134 186 136 C166 138 152 124 152 106 C152 90 156 82 162 78 Z" class="zone"/>
  <circle cx="84" cy="94" r="2.6" class="dot"/><text x="26" y="97" class="t-dot">Negrar</text>
  <circle cx="80" cy="116" r="2.6" class="dot"/><text x="16" y="119" class="t-dot">Marano</text>
  <circle cx="196" cy="106" r="2.6" class="dot"/><text x="226" y="109" class="t-dot">Illasi</text>
  <circle cx="134" cy="160" r="3.2" class="town"/><text x="142" y="172" class="t-town">Verona</text>
  <text x="24" y="60" class="t-zone">Valpolicella Classica</text>
  <text x="220" y="72" class="t-zone">Valpolicella</text>
  <text x="6" y="40" class="t-zone">Garda</text>
  <text x="180" y="196" class="t-dot">Adige</text>
</svg>`,

friuli: `<svg viewBox="0 0 320 240" class="rmap">
  <path d="M132 20 C142 52 152 88 158 122 C162 148 164 170 162 186" class="river"/>
  <path d="M30 200 C86 206 152 208 212 200 C254 194 286 186 306 178" class="coast"/>
  <path d="M92 44 C126 34 162 42 168 62 C172 82 152 100 120 102 C92 104 76 88 78 68 C80 54 84 48 92 44 Z" class="zone"/>
  <path d="M112 126 C142 118 172 126 174 142 C176 160 152 170 126 166 C104 162 100 142 106 132 C108 128 110 126 112 126 Z" class="zone"/>
  <path d="M204 132 C238 124 274 136 276 156 C278 176 250 188 220 182 C196 176 190 154 196 140 C198 136 200 134 204 132 Z" class="zone"/>
  <circle cx="128" cy="76" r="2.6" class="dot"/><text x="86" y="66" class="t-dot">Oslavia</text>
  <circle cx="150" cy="96" r="3" class="town"/><text x="158" y="99" class="t-town">Gorizia</text>
  <circle cx="140" cy="146" r="2.4" class="dot"/><text x="30" y="149" class="t-dot">Mariano del Friuli</text>
  <circle cx="234" cy="158" r="2.6" class="dot"/><text x="242" y="161" class="t-dot">Sgonico</text>
  <circle cx="238" cy="188" r="3" class="town"/><text x="246" y="198" class="t-town">Trieste</text>
  <text x="38" y="36" class="t-zone">Collio</text>
  <text x="238" y="126" class="t-zone">Kras</text>
  <text x="96" y="118" class="t-zone">Friuli Isonzo</text>
</svg>`,

"north-croatia": `<svg viewBox="0 0 320 240" class="rmap">
  <path d="M56 150 C102 158 150 166 200 172 C240 176 274 180 300 186" class="river"/>
  <path d="M212 40 C238 34 262 42 264 58 C264 74 244 82 224 76 C208 70 204 52 212 40 Z" class="zone"/>
  <path d="M96 56 C136 46 178 56 182 76 C186 98 158 112 124 108 C94 104 80 86 84 68 C86 60 90 58 96 56 Z" class="zone"/>
  <path d="M52 128 C80 120 106 128 108 144 C110 162 88 174 64 168 C44 162 40 140 48 132 C50 130 50 128 52 128 Z" class="zone"/>
  <path d="M212 146 C242 138 270 148 270 166 C270 184 244 192 220 184 C202 178 200 154 208 148 Z" class="zone"/>
  <circle cx="140" cy="134" r="3.2" class="town"/><text x="148" y="137" class="t-town">Zagreb</text>
  <circle cx="72" cy="146" r="2.6" class="dot"/><text x="18" y="149" class="t-dot">Okić</text>
  <circle cx="126" cy="80" r="2.6" class="dot"/><text x="94" y="70" class="t-dot">Zabok</text>
  <circle cx="238" cy="166" r="2.6" class="dot"/><text x="246" y="169" class="t-dot">Voloder</text>
  <text x="26" y="194" class="t-zone">Plešivica</text>
  <text x="24" y="52" class="t-zone">Zagorje</text>
  <text x="212" y="28" class="t-zone">Međimurje</text>
  <text x="206" y="212" class="t-zone">Moslavina</text>
  <text x="130" y="184" class="t-dot">Sava</text>
</svg>`
};

/* Map furniture: the river, the two seas. Not appellations, so they are not in
   ZH_REGION — but they are still text on a map a guest is reading. */
const MAP_FEATURES = {
  "Garda":   { hr: "Garda", en: "Lake Garda", it: "Lago di Garda", fr: "Lac de Garde", de: "Gardasee", sl: "Gardsko jezero", es: "Lago de Garda", zh: "加尔达湖" },
  "Adige":   { hr: "Adige", en: "Adige", it: "Adige", fr: "Adige", de: "Etsch", sl: "Adiža", es: "Adigio", zh: "阿迪杰河" },
  "Sava":    { hr: "Sava", en: "Sava", it: "Sava", fr: "Save", de: "Save", sl: "Sava", es: "Sava", zh: "萨瓦河" },  "Tanaro":  { zh: "塔纳罗河" },
  "Tirreno": { hr: "Tirensko more", en: "Tyrrhenian Sea", it: "Tirreno", fr: "Mer Tyrrhénienne", de: "Tyrrhenisches Meer", sl: "Tirensko morje", es: "Mar Tirreno", zh: "第勒尼安海" },
  "Jadran":  { hr: "Jadran", en: "Adriatic", it: "Adriatico", fr: "Adriatique", de: "Adria", sl: "Jadran", es: "Adriático", zh: "亚得里亚海" }
};
