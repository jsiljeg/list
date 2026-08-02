# -*- coding: utf-8 -*-
"""Second pass on the five new maps, after looking at them rendered.

What the first draft got wrong, and what a schematic map has to get right:
  - a river must not run through a zone it runs *past* (the Adige sliced the
    Valpolicella Classica in half; the Isonzo crossed the Carso)
  - every zone label needs a zone under it (Nahe and Friuli Isonzo were
    floating captions)
  - every zone must sit inside the coastline that contains it (Istria's west
    strip spilled into the sea)
  - a label must not land on top of another zone (Sava sat inside Plešivica)
"""
import re

NEW = {
"istria": '''istria: `<svg viewBox="0 0 320 240" class="rmap">
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
</svg>`''',

# The Mosel runs east into the Rhine at Koblenz; the Saar joins it at Trier.
# The Rhine then runs south — through the Rheingau's east–west stretch, past
# the Nahe's mouth at Bingen, down the Rheinhessen and Pfalz flank.
"germany": '''germany: `<svg viewBox="0 0 320 240" class="rmap">
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
</svg>`''',

# The Adige passes *between* the two halves of the Valpolicella, not through
# the Classica — that is the whole point of the split.
"veneto": '''veneto: `<svg viewBox="0 0 320 240" class="rmap">
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
</svg>`''',

# The Isonzo reaches the sea *west* of the Carso plateau, so it runs down the
# left of the Kras zone rather than across it. Its own plain gets a zone.
"friuli": '''friuli: `<svg viewBox="0 0 320 240" class="rmap">
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
</svg>`''',

# Only the two labels that landed on top of other things moved.
"north-croatia": '''"north-croatia": `<svg viewBox="0 0 320 240" class="rmap">
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
</svg>`''',
}

p = 'js/maps.js'
s = open(p, 'rb').read().decode('utf-8')
nl = '\r\n' if '\r\n' in s else '\n'
for key, block in NEW.items():
    name = '"north-croatia"' if key == 'north-croatia' else key
    pat = re.compile(re.escape(name) + r': `<svg.*?</svg>`', re.S)
    assert pat.search(s), key
    s = pat.sub(lambda m: block.replace('\n', nl), s, count=1)
open(p, 'wb').write(s.encode('utf-8'))
print("revised:", ", ".join(NEW))
