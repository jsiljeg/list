# -*- coding: utf-8 -*-
"""The twelfth region card, and a sane order for all of them. One-shot."""
import json

CARD = {
 "id": "california", "country": "US",
 "name": {"hr":"Kalifornija i Oregon","en":"California and Oregon","it":"California e Oregon",
          "fr":"Californie et Oregon","de":"Kalifornien und Oregon","sl":"Kalifornija in Oregon",
          "es":"California y Oregón","zh":"加利福尼亚与俄勒冈"},
 "sub": {"hr":"Magla s Pacifika","en":"Fog off the Pacific","it":"Nebbia dal Pacifico",
         "fr":"Le brouillard du Pacifique","de":"Nebel vom Pazifik","sl":"Megla s Pacifika",
         "es":"Niebla del Pacífico","zh":"来自太平洋的雾"},
 "appellations": ["Napa Valley","Spring Mountain District","Mount Veeder","Sonoma County",
                  "Alexander Valley","Sonoma Coast","Santa Cruz Mountains","Sta. Rita Hills",
                  "Willamette Valley"],
 "blurb": {
  "hr":"Ono što ovu obalu drži u ravnoteži nije sunce nego hladno more: magla koja svaku večer ulazi kroz zaljev i vraća kiselinu koju bi dan bio pojeo. Napa i njezine planinske pozicije daju stroge, dugovječne Caberneta, Santa Cruz Mountains vino koje je 1976. u Parizu promijenilo mišljenje svijeta, a Willamette na sjeveru Pinot Noir bliži Burgundiji nego Kaliforniji.",
  "en":"What keeps this coast in balance is not the sun but the cold sea: the fog that comes through the gate every evening and gives back the acidity the day had eaten. Napa and its mountain sites give strict, long-lived Cabernet, the Santa Cruz Mountains the wine that changed the world's mind in Paris in 1976, and the Willamette to the north a Pinot Noir closer to Burgundy than to California.",
  "it":"Ciò che tiene in equilibrio questa costa non è il sole ma il mare freddo: la nebbia che ogni sera entra dalla baia e restituisce l'acidità che il giorno aveva mangiato. Napa e i suoi vigneti di montagna danno Cabernet severi e longevi, i Santa Cruz Mountains il vino che nel 1976 a Parigi cambiò l'idea del mondo, e la Willamette a nord un Pinot Nero più vicino alla Borgogna che alla California.",
  "fr":"Ce qui tient cette côte en équilibre, ce n'est pas le soleil mais la mer froide : le brouillard qui entre chaque soir par la baie et rend l'acidité que le jour avait mangée. Napa et ses coteaux de montagne donnent des cabernets stricts et de longue garde, les Santa Cruz Mountains le vin qui a changé l'avis du monde à Paris en 1976, et la Willamette au nord un pinot noir plus proche de la Bourgogne que de la Californie.",
  "de":"Was diese Küste im Gleichgewicht hält, ist nicht die Sonne, sondern das kalte Meer: der Nebel, der jeden Abend durch die Bucht kommt und die Säure zurückgibt, die der Tag gefressen hatte. Napa und seine Berglagen geben strenge, langlebige Cabernets, die Santa Cruz Mountains den Wein, der 1976 in Paris die Meinung der Welt änderte, und das Willamette im Norden einen Pinot Noir, der Burgund näher ist als Kalifornien.",
  "sl":"Kar to obalo drži v ravnovesju, ni sonce, ampak hladno morje: megla, ki vsak večer pride skozi zaliv in vrne kislino, ki jo je dan pojedel. Napa in njene gorske lege dajejo stroge, dolgožive cabernete, Santa Cruz Mountains vino, ki je leta 1976 v Parizu spremenilo mnenje sveta, Willamette na severu pa pinot noir, bližji Burgundiji kot Kaliforniji.",
  "es":"Lo que mantiene esta costa en equilibrio no es el sol sino el mar frío: la niebla que entra cada tarde por la bahía y devuelve la acidez que el día se había comido. Napa y sus laderas de montaña dan cabernets severos y longevos, las Santa Cruz Mountains el vino que en 1976 cambió la opinión del mundo en París, y el Willamette al norte un pinot noir más cercano a Borgoña que a California.",
  "zh":"让这条海岸保持平衡的不是阳光，而是冰冷的海：每晚穿过海湾而来的雾，把白日吃掉的酸度还了回来。纳帕与它的山地园出产严谨而长寿的赤霞珠；圣克鲁兹山献出了 1976 年在巴黎改变世界看法的那款酒；北面的威拉米特谷，则给出更近勃艮第而非加州的黑皮诺。"}
}

# Pacific coast down the left, Oregon at the top, then Napa/Sonoma, the bay,
# the Santa Cruz Mountains and Sta. Rita far south.
MAP = '''california: `<svg viewBox="0 0 320 240" class="rmap">
  <path d="M62 10 C74 42 84 74 96 104 C108 132 118 154 126 172 C136 194 148 214 160 232" class="coast"/>
  <path d="M96 26 C122 18 146 28 148 44 C150 62 128 72 108 66 C90 60 86 34 96 26 Z" class="zone"/>
  <path d="M112 88 C136 80 158 90 158 106 C158 124 136 132 118 124 C102 116 102 94 112 88 Z" class="zone"/>
  <path d="M150 74 C172 66 196 76 198 94 C200 112 178 122 158 114 C142 106 140 80 150 74 Z" class="zone"/>
  <path d="M138 150 C158 142 178 152 178 166 C178 182 158 190 142 182 C128 174 128 156 138 150 Z" class="zone"/>
  <path d="M166 204 C186 196 206 206 206 220 C206 234 186 240 172 232 C160 224 158 210 166 204 Z" class="zone"/>
  <circle cx="122" cy="46" r="2.6" class="dot"/><text x="152" y="40" class="t-dot">Willamette Valley</text>
  <circle cx="132" cy="106" r="2.6" class="dot"/><text x="88" y="140" class="t-dot">Sonoma</text>
  <circle cx="172" cy="94" r="2.6" class="dot"/><text x="204" y="92" class="t-dot">Napa Valley</text>
  <circle cx="126" cy="150" r="3" class="town"/><text x="60" y="158" class="t-town">San Francisco</text>
  <circle cx="156" cy="166" r="2.6" class="dot"/><text x="186" y="170" class="t-dot">Santa Cruz Mountains</text>
  <circle cx="184" cy="220" r="2.6" class="dot"/><text x="212" y="224" class="t-dot">Sta. Rita Hills</text>
  <text x="14" y="30" class="t-zone">Oregon</text>
  <text x="12" y="100" class="t-zone">Kalifornija</text>
  <text x="6" y="196" class="t-dot">Pacifik</text>
</svg>`'''

# Croatia first — the wine list itself groups Croatia first inside every
# category, so the Regions screen should not invent a different convention.
# After that, by how many wines we actually pour, country by country.
ORDER = ["dalmatia", "north-croatia", "istria",
         "burgundy", "champagne", "bordeaux",
         "tuscany", "piedmont", "friuli", "veneto",
         "germany", "california"]

p = 'data/regions.json'
d = json.loads(open(p, 'rb').read().decode('utf-8'))
assert not any(r['id'] == 'california' for r in d['regions'])
d['regions'].append(CARD)
by = {r['id']: r for r in d['regions']}
assert set(by) == set(ORDER), (set(by) ^ set(ORDER))
d['regions'] = [by[i] for i in ORDER]
open(p, 'wb').write((json.dumps(d, ensure_ascii=False, indent=1) + '\n').replace('\n', '\r\n').encode('utf-8'))
print("order:", ORDER)

p = 'js/maps.js'
s = open(p, 'rb').read().decode('utf-8')
nl = '\r\n' if '\r\n' in s else '\n'
i = s.index('};')                      # end of REGION_MAPS
s = s[:i].rstrip() + ',' + nl + nl + MAP.replace('\n', nl) + nl + s[i:]
open(p, 'wb').write(s.encode('utf-8'))
print("map added")
