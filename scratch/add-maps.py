# -*- coding: utf-8 -*-
"""Draw the five new region maps into js/maps.js. One-shot; kept for the record."""

MAPS = {
# Istria: the peninsula, pointing south. West coast strip and the central hills.
"istria": '''istria: `<svg viewBox="0 0 320 240" class="rmap">
  <path d="M78 34 C120 26 186 28 226 40 C238 60 232 96 216 128 C198 164 176 196 158 216 C142 196 122 166 106 134 C88 98 74 62 78 34 Z" class="coast"/>
  <path d="M92 46 C112 42 132 44 140 56 C146 74 140 108 132 138 C124 166 116 188 110 202 C100 178 90 144 84 112 C79 82 82 56 92 46 Z" class="zone"/>
  <path d="M148 54 C172 50 196 56 202 70 C206 92 196 118 182 142 C170 162 160 176 152 186 C146 162 144 126 144 96 C144 74 144 60 148 54 Z" class="zone"/>
  <circle cx="104" cy="58" r="2.6" class="dot"/><text x="56" y="61" class="t-dot">Buje</text>
  <circle cx="100" cy="92" r="2.6" class="dot"/><text x="48" y="95" class="t-dot">Poreč</text>
  <circle cx="160" cy="78" r="2.6" class="dot"/><text x="168" y="81" class="t-dot">Motovun</text>
  <circle cx="170" cy="120" r="2.6" class="dot"/><text x="178" y="123" class="t-dot">Pazin</text>
  <circle cx="112" cy="150" r="3" class="town"/><text x="58" y="153" class="t-town">Bale</text>
  <text x="20" y="120" class="t-zone">Zapadna Istra</text>
  <text x="196" y="176" class="t-zone">Centralna Istra</text>
  <text x="120" y="24" class="t-zone">Istra</text>
</svg>`''',

# Germany: the Mosel coming down to the Rhine at Koblenz, the Saar joining at
# Konz, then the Rhine south past the Nahe, the Rheingau, Rheinhessen and Pfalz.
"germany": '''germany: `<svg viewBox="0 0 320 240" class="rmap">
  <path d="M40 108 C64 96 78 116 96 106 C114 96 122 118 142 110 C162 102 176 78 196 66" class="river"/>
  <path d="M56 148 C62 132 52 122 40 108" class="river"/>
  <path d="M196 66 C206 92 200 122 206 150 C210 176 214 200 212 220" class="river"/>
  <path d="M150 128 C170 122 186 128 190 140" class="river"/>
  <path d="M44 96 C70 84 86 106 104 96 C120 88 128 108 146 100 C150 108 148 116 138 120 C120 128 110 110 96 118 C80 126 66 108 46 116 C40 110 40 100 44 96 Z" class="zone"/>
  <path d="M50 152 C58 134 48 122 36 110 C30 114 30 122 38 134 C44 144 44 152 46 158 Z" class="zone"/>
  <path d="M160 74 C176 68 190 70 194 78 C186 88 172 92 160 88 C155 84 155 78 160 74 Z" class="zone"/>
  <path d="M198 92 C216 88 232 96 230 112 C226 128 206 130 198 118 C194 108 194 96 198 92 Z" class="zone"/>
  <path d="M200 150 C218 146 234 154 232 172 C228 190 208 192 200 178 C196 168 196 154 200 150 Z" class="zone"/>
  <circle cx="196" cy="66" r="3" class="town"/><text x="204" y="62" class="t-town">Koblenz</text>
  <circle cx="52" cy="120" r="3" class="town"/><text x="20" y="132" class="t-town">Trier</text>
  <circle cx="118" cy="102" r="2.4" class="dot"/><text x="102" y="92" class="t-dot">Bernkastel</text>
  <circle cx="204" cy="106" r="3" class="town"/><text x="238" y="109" class="t-town">Mainz</text>
  <text x="66" y="86" class="t-zone">Mittelmosel</text>
  <text x="146" y="146" class="t-zone">Terrassenmosel</text>
  <text x="16" y="170" class="t-zone">Saar</text>
  <text x="150" y="66" class="t-zone">Rheingau</text>
  <text x="240" y="124" class="t-zone">Rheinhessen</text>
  <text x="240" y="172" class="t-zone">Pfalz</text>
  <text x="152" y="176" class="t-dot">Nahe</text>
</svg>`''',

# Veneto: Verona, the Adige, Lake Garda west, and the Valpolicella valleys that
# fan north of the city — Classica to the west, the rest east toward Illasi.
"veneto": '''veneto: `<svg viewBox="0 0 320 240" class="rmap">
  <path d="M36 46 C30 74 34 104 44 124 C50 138 52 150 48 162" class="coast"/>
  <path d="M96 40 C114 74 130 108 146 134 C162 160 180 180 200 194" class="river"/>
  <path d="M74 70 C96 62 118 70 126 88 C132 106 124 126 106 132 C86 138 68 124 66 104 C64 88 66 74 74 70 Z" class="zone"/>
  <path d="M150 74 C172 66 196 76 202 94 C206 112 194 130 174 134 C154 138 138 124 138 106 C138 90 142 78 150 74 Z" class="zone"/>
  <circle cx="88" cy="90" r="2.6" class="dot"/><text x="30" y="93" class="t-dot">Negrar</text>
  <circle cx="84" cy="112" r="2.6" class="dot"/><text x="4" y="115" class="t-dot">Marano</text>
  <circle cx="182" cy="104" r="2.6" class="dot"/><text x="212" y="107" class="t-dot">Illasi</text>
  <circle cx="132" cy="158" r="3.2" class="town"/><text x="140" y="161" class="t-town">Verona</text>
  <text x="52" y="56" class="t-zone">Valpolicella Classica</text>
  <text x="200" y="66" class="t-zone">Valpolicella</text>
  <text x="6" y="40" class="t-zone">Garda</text>
  <text x="164" y="196" class="t-dot">Adige</text>
</svg>`''',

# Friuli: the border strip. Collio and Oslavia above Gorizia, the Isonzo running
# down to the sea, and the Carso plateau on the limestone behind Trieste.
"friuli": '''friuli: `<svg viewBox="0 0 320 240" class="rmap">
  <path d="M150 20 C160 54 172 92 186 124 C196 148 204 168 210 182" class="river"/>
  <path d="M40 196 C90 200 150 202 210 194 C250 188 280 180 300 172" class="coast"/>
  <path d="M96 44 C130 34 166 42 172 62 C176 82 156 100 124 102 C96 104 80 88 82 68 C84 54 88 48 96 44 Z" class="zone"/>
  <path d="M182 130 C214 122 250 132 254 152 C256 172 232 184 202 180 C178 176 170 158 174 142 C176 134 178 132 182 130 Z" class="zone"/>
  <circle cx="132" cy="76" r="2.6" class="dot"/><text x="90" y="66" class="t-dot">Oslavia</text>
  <circle cx="152" cy="94" r="3" class="town"/><text x="160" y="97" class="t-town">Gorizia</text>
  <circle cx="176" cy="122" r="2.4" class="dot"/><text x="184" y="125" class="t-dot">Mariano del Friuli</text>
  <circle cx="206" cy="164" r="2.6" class="dot"/><text x="214" y="167" class="t-dot">Sgonico</text>
  <circle cx="232" cy="182" r="3" class="town"/><text x="240" y="192" class="t-town">Trieste</text>
  <text x="42" y="40" class="t-zone">Collio</text>
  <text x="248" y="136" class="t-zone">Kras</text>
  <text x="118" y="150" class="t-zone">Friuli Isonzo</text>
</svg>`''',

# Northern Croatia: Zagreb in the middle, Plešivica south-west of it, Zagorje
# north, Međimurje in the far north-east corner, Moslavina east down the Sava.
"north-croatia": '''"north-croatia": `<svg viewBox="0 0 320 240" class="rmap">
  <path d="M56 150 C102 158 150 166 200 172 C240 176 274 180 300 186" class="river"/>
  <path d="M212 40 C238 34 262 42 264 58 C264 74 244 82 224 76 C208 70 204 52 212 40 Z" class="zone"/>
  <path d="M96 56 C136 46 178 56 182 76 C186 98 158 112 124 108 C94 104 80 86 84 68 C86 60 90 58 96 56 Z" class="zone"/>
  <path d="M52 128 C80 120 106 128 108 144 C110 162 88 174 64 168 C44 162 40 140 48 132 C50 130 50 128 52 128 Z" class="zone"/>
  <path d="M212 146 C242 138 270 148 270 166 C270 184 244 192 220 184 C202 178 200 154 208 148 Z" class="zone"/>
  <circle cx="140" cy="134" r="3.2" class="town"/><text x="148" y="137" class="t-town">Zagreb</text>
  <circle cx="72" cy="146" r="2.6" class="dot"/><text x="14" y="149" class="t-dot">Okić</text>
  <circle cx="126" cy="80" r="2.6" class="dot"/><text x="94" y="70" class="t-dot">Zabok</text>
  <circle cx="238" cy="166" r="2.6" class="dot"/><text x="192" y="204" class="t-dot">Voloder</text>
  <text x="30" y="188" class="t-zone">Plešivica</text>
  <text x="24" y="52" class="t-zone">Zagorje</text>
  <text x="214" y="30" class="t-zone">Međimurje</text>
  <text x="250" y="204" class="t-zone">Moslavina</text>
  <text x="60" y="166" class="t-dot">Sava</text>
</svg>`''',
}

p = 'js/maps.js'
s = open(p, 'rb').read().decode('utf-8')
nl = '\r\n' if '\r\n' in s else '\n'
anchor = '</svg>`\r\n};' if nl == '\r\n' else '</svg>`\n};'
assert anchor in s, "closing brace of REGION_MAPS not found"
block = ('</svg>`,' + nl + nl +
         (',' + nl + nl).join(m.replace('\n', nl) for m in MAPS.values()) +
         nl + '};')
s = s.replace(anchor, block, 1)
open(p, 'wb').write(s.encode('utf-8'))
print("added:", ", ".join(MAPS))
