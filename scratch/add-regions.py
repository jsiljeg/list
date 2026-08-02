# -*- coding: utf-8 -*-
"""Add the five region cards the list was missing. One-shot; kept for the record."""
import json

p = 'data/regions.json'
d = json.loads(open(p, 'rb').read().decode('utf-8'))

NEW = [
{
 "id": "istria", "country": "HR",
 "name": {"hr":"Istra","en":"Istria","it":"Istria","fr":"Istrie","de":"Istrien","sl":"Istra","es":"Istria","zh":"伊斯特拉"},
 "sub": {"hr":"Crvena zemlja, bijelo vino","en":"Red earth, white wine","it":"Terra rossa, vino bianco","fr":"Terre rouge, vin blanc","de":"Rote Erde, weißer Wein","sl":"Rdeča zemlja, belo vino","es":"Tierra roja, vino blanco","zh":"红土，白葡萄酒"},
 "appellations": ["Zapadna Istra","Centralna Istra","Malvazija istarska","Teran"],
 "blurb": {
  "hr":"Poluotok koji je od Malvazije istarske napravio ozbiljno vino: zapadna, primorska Istra na crvenoj zemlji daje široka i slana vina, središnja na bijeloj i sivoj ilovači napetija i mineralnija. Teran ostaje istarski tvrdoglavac — visoka kiselina, željezo i divlja višnja.",
  "en":"The peninsula that turned Malvasia Istriana into a serious wine: coastal western Istria, on red earth, gives broad and saline whites; the central hills, on white and grey marl, something tighter and more mineral. Teran remains Istria's stubborn one — high acid, iron and sour cherry.",
  "it":"La penisola che ha reso la Malvasia Istriana un vino serio: l'Istria occidentale costiera, sulla terra rossa, dà bianchi ampi e salini; le colline centrali, su marne bianche e grigie, qualcosa di più teso e minerale. Il Terrano resta il testardo dell'Istria — acidità alta, ferro e amarena.",
  "fr":"La péninsule qui a fait de la Malvasia Istriana un vin sérieux : l'Istrie occidentale, côtière, sur terre rouge, donne des blancs amples et salins ; les collines centrales, sur marnes blanches et grises, quelque chose de plus tendu et minéral. Le teran reste l'entêté de l'Istrie — acidité haute, fer et griotte.",
  "de":"Die Halbinsel, die aus der Malvasia Istriana einen ernsten Wein gemacht hat: das küstennahe Westistrien auf roter Erde gibt breite, salzige Weiße; die zentralen Hügel auf weißem und grauem Mergel etwas Straffere, Mineralischere. Teran bleibt der Sturkopf Istriens — hohe Säure, Eisen und Sauerkirsche.",
  "sl":"Polotok, ki je iz istrske malvazije naredil resno vino: obalna zahodna Istra na rdeči zemlji daje široka in slana vina, osrednja na beli in sivi ilovici bolj napeta in mineralna. Teran ostaja istrski trmoglavec — visoka kislina, železo in višnja.",
  "es":"La península que convirtió la Malvasía istriana en un vino serio: la Istria occidental costera, sobre tierra roja, da blancos amplios y salinos; las colinas centrales, sobre margas blancas y grises, algo más tenso y mineral. El teran sigue siendo el testarudo de Istria — acidez alta, hierro y guinda.",
  "zh":"这座半岛让伊斯特拉马尔瓦齐娅成为一款严肃的酒：西部沿海的红土产出宽厚而带咸感的白葡萄酒，中部丘陵的白灰泥灰岩则更紧致、更矿物。特兰依旧是伊斯特拉的倔强者——高酸、铁质与酸樱桃。"}
},
{
 "id": "germany", "country": "DE",
 "name": {"hr":"Njemačka — Riesling","en":"Germany — Riesling","it":"Germania — Riesling","fr":"Allemagne — riesling","de":"Deutschland — Riesling","sl":"Nemčija — rizling","es":"Alemania — riesling","zh":"德国 — 雷司令"},
 "sub": {"hr":"Škriljevac, rijeka i nagib","en":"Slate, river and slope","it":"Ardesia, fiume e pendio","fr":"Ardoise, rivière et pente","de":"Schiefer, Fluss und Steillage","sl":"Skrilavec, reka in strmina","es":"Pizarra, río y pendiente","zh":"板岩、河流与坡地"},
 "appellations": ["Mosel","Saar","Terrassenmosel","Mittelmosel","Rheinhessen","Pfalz","Nahe","Rheingau"],
 "blurb": {
  "hr":"Riesling ovdje raste na granici mogućeg: na škriljevcu tako strmom da se bere užetom, iznad rijeke koja vraća svjetlo. Mosel i Saar daju najlaganija i najdugovječnija vina Europe, Rheinhessen i Pfalz toplija i punija — a slatkoća, gdje je ima, nije šećer nego zategnuta kiselina.",
  "en":"Riesling here grows at the edge of the possible: on slate too steep to pick without a rope, above a river that throws the light back up. The Mosel and the Saar give Europe's lightest and longest-lived wines, Rheinhessen and the Pfalz something warmer and fuller — and the sweetness, where there is any, is not sugar but acidity held taut.",
  "it":"Qui il Riesling cresce al limite del possibile: su ardesia così ripida da vendemmiare con la corda, sopra un fiume che rimanda la luce. Mosella e Saar danno i vini più leggeri e più longevi d'Europa, Rheinhessen e Palatinato qualcosa di più caldo e pieno — e la dolcezza, dove c'è, non è zucchero ma acidità tesa.",
  "fr":"Le riesling pousse ici à la limite du possible : sur une ardoise si raide qu'on vendange à la corde, au-dessus d'une rivière qui renvoie la lumière. La Moselle et la Sarre donnent les vins les plus légers et les plus durables d'Europe, la Hesse rhénane et le Palatinat quelque chose de plus chaud et de plus ample — et la douceur, quand il y en a, n'est pas du sucre mais de l'acidité tendue.",
  "de":"Riesling wächst hier am Rand des Möglichen: auf Schiefer, so steil, dass am Seil gelesen wird, über einem Fluss, der das Licht zurückwirft. Mosel und Saar geben Europas leichteste und langlebigste Weine, Rheinhessen und Pfalz etwas Wärmeres und Volleres — und die Süße, wo es sie gibt, ist kein Zucker, sondern gespannte Säure.",
  "sl":"Rizling tu raste na robu mogočega: na skrilavcu, tako strmem, da se trga z vrvjo, nad reko, ki vrača svetlobo. Mozela in Saar dajeta najlažja in najdolgoživejša vina Evrope, Rheinhessen in Pfalška nekaj toplejšega in polnejšega — sladkoba, kjer je, pa ni sladkor, ampak napeta kislina.",
  "es":"Aquí el riesling crece al límite de lo posible: sobre pizarra tan empinada que se vendimia con cuerda, encima de un río que devuelve la luz. El Mosela y el Sarre dan los vinos más ligeros y longevos de Europa, Hesse renana y el Palatinado algo más cálido y pleno — y el dulzor, donde lo hay, no es azúcar sino acidez tensa.",
  "zh":"雷司令在这里生长于可能的边缘：陡到需系绳采收的板岩坡上，脚下的河把阳光再送回来。摩泽尔与萨尔孕育出欧洲最轻盈也最长寿的酒，莱茵黑森与法尔兹则更温暖丰满——而那份甜，若有，也不是糖，而是绷紧的酸。"}
},
{
 "id": "veneto", "country": "IT",
 "name": {"hr":"Veneto — Valpolicella","en":"Veneto — Valpolicella","it":"Veneto — Valpolicella","fr":"Vénétie — Valpolicella","de":"Venetien — Valpolicella","sl":"Benečija — Valpolicella","es":"Véneto — Valpolicella","zh":"威尼托 — 瓦坡里切拉"},
 "sub": {"hr":"Grožđe koje čeka","en":"Grapes that wait","it":"Uve che aspettano","fr":"Des raisins qui attendent","de":"Trauben, die warten","sl":"Grozdje, ki čaka","es":"Uvas que esperan","zh":"等待的葡萄"},
 "appellations": ["Valpolicella Classica","Valpolicella","Negrar","Marano di Valpolicella","Illasi","Amarone","Recioto"],
 "blurb": {
  "hr":"Sjeverno od Verone, Corvina i njezine sestre ne idu ravno u bačvu — suše se mjesecima na letvama dok ne izgube pola vode. Iz toga nastaje Amarone, suh i golem, i Recioto, sladak i taman; Valpolicella Classica, srce regije, radi to na najstrmijim terasama.",
  "en":"North of Verona, Corvina and her sisters do not go straight into the vat — they dry on racks for months until half the water is gone. Out of that comes Amarone, dry and enormous, and Recioto, sweet and dark; Valpolicella Classica, the region's heart, does it on the steepest terraces.",
  "it":"A nord di Verona, la Corvina e le sue sorelle non vanno dritte in tino — appassiscono sui graticci per mesi finché metà dell'acqua se n'è andata. Ne nascono l'Amarone, secco ed enorme, e il Recioto, dolce e scuro; la Valpolicella Classica, cuore della zona, lo fa sulle terrazze più ripide.",
  "fr":"Au nord de Vérone, la corvina et ses sœurs ne vont pas droit en cuve — elles sèchent sur claies des mois durant, jusqu'à perdre la moitié de leur eau. Il en naît l'amarone, sec et énorme, et le recioto, doux et sombre ; la Valpolicella Classica, cœur de la zone, le fait sur les terrasses les plus raides.",
  "de":"Nördlich von Verona gehen Corvina und ihre Schwestern nicht direkt in den Bottich — sie trocknen monatelang auf Lattenrosten, bis das halbe Wasser weg ist. Daraus entsteht Amarone, trocken und gewaltig, und Recioto, süß und dunkel; die Valpolicella Classica, das Herz der Zone, macht es auf den steilsten Terrassen.",
  "sl":"Severno od Verone corvina in njene sestre ne gredo naravnost v kad — mesece se sušijo na letvah, dokler ne izgubijo polovice vode. Iz tega nastane amarone, suh in ogromen, in recioto, sladek in temen; Valpolicella Classica, srce območja, to počne na najstrmejših terasah.",
  "es":"Al norte de Verona, la corvina y sus hermanas no van directas a la cuba — se secan en cañizos durante meses hasta perder la mitad del agua. De ahí salen el Amarone, seco y enorme, y el Recioto, dulce y oscuro; la Valpolicella Classica, corazón de la zona, lo hace en las terrazas más empinadas.",
  "zh":"在维罗纳以北，科维纳与她的姐妹们不会直接入槽——她们在架上风干数月，直到失去一半水分。由此诞生了干型而宏大的阿玛罗尼，以及甜美深沉的雷乔托；产区核心经典瓦坡里切拉，把这件事做在最陡的梯田上。"}
},
{
 "id": "friuli", "country": "IT",
 "name": {"hr":"Friuli — Collio i Kras","en":"Friuli — Collio and Carso","it":"Friuli — Collio e Carso","fr":"Frioul — Collio et Carso","de":"Friaul — Collio und Karst","sl":"Furlanija — Brda in Kras","es":"Friuli — Collio y Carso","zh":"弗留利 — 科利奥与喀斯特"},
 "sub": {"hr":"Ondje gdje su bijela vina postala narančasta","en":"Where white wine turned orange","it":"Dove il vino bianco è diventato arancione","fr":"Là où le vin blanc est devenu orange","de":"Wo Weißwein orange wurde","sl":"Kjer je belo vino postalo oranžno","es":"Donde el vino blanco se volvió naranja","zh":"白葡萄酒变成橙色的地方"},
 "appellations": ["Collio","Oslavia","Friuli Isonzo","Kras","Gorizia","Ribolla Gialla","Vitovska"],
 "blurb": {
  "hr":"Uski pojas uz slovensku granicu gdje je krajem devedesetih šačica vinara vratila bijelo grožđe na kožicu — tjednima, ponekad mjesecima, u drvu ili amfori. Oslavia i Collio dali su Ribollu kakvu nitko nije očekivao, a Kras iznad Trsta Vitovsku s vjetrom i vapnencem u sebi.",
  "en":"A narrow belt along the Slovenian border where, in the late nineties, a handful of growers put white grapes back on their skins — for weeks, sometimes months, in wood or in amphora. Oslavia and the Collio gave a Ribolla nobody expected; the Carso above Trieste gives Vitovska with wind and limestone in it.",
  "it":"Una fascia stretta lungo il confine sloveno dove, a fine anni Novanta, una manciata di vignaioli rimise le uve bianche sulle bucce — per settimane, a volte mesi, in legno o in anfora. Oslavia e il Collio hanno dato una Ribolla che nessuno si aspettava; il Carso sopra Trieste dà una Vitovska con dentro il vento e il calcare.",
  "fr":"Une bande étroite le long de la frontière slovène où, à la fin des années 1990, une poignée de vignerons a remis les raisins blancs sur leurs peaux — des semaines, parfois des mois, en bois ou en amphore. Oslavia et le Collio ont donné une ribolla que personne n'attendait ; le Carso au-dessus de Trieste donne une vitovska qui a le vent et le calcaire dedans.",
  "de":"Ein schmaler Streifen entlang der slowenischen Grenze, wo Ende der Neunziger eine Handvoll Winzer weiße Trauben zurück auf die Schalen legte — wochenlang, manchmal monatelang, in Holz oder Amphore. Oslavia und das Collio gaben eine Ribolla, die niemand erwartet hatte; der Karst über Triest gibt Vitovska mit Wind und Kalk darin.",
  "sl":"Ozek pas ob slovenski meji, kjer je konec devetdesetih peščica vinarjev belo grozdje vrnila na kožico — za tedne, včasih mesece, v les ali amforo. Oslavje in Brda so dala rebulo, kakršne ni pričakoval nihče; Kras nad Trstom pa vitovsko z vetrom in apnencem v sebi.",
  "es":"Una franja estrecha junto a la frontera eslovena donde, a finales de los noventa, un puñado de viticultores devolvió la uva blanca a sus pieles — semanas, a veces meses, en madera o en ánfora. Oslavia y el Collio dieron una ribolla que nadie esperaba; el Carso sobre Trieste da una vitovska con viento y caliza dentro.",
  "zh":"沿斯洛文尼亚边境的一条窄带。九十年代末，几位酒农把白葡萄重新放回果皮上浸渍——数周，有时数月，在木桶或陶罐里。奥斯拉维亚与科利奥酿出了无人预料的丽波拉；的里雅斯特之上的喀斯特，则给出带着风与石灰岩的维托夫斯卡。"}
},
{
 "id": "north-croatia", "country": "HR",
 "name": {"hr":"Sjeverna Hrvatska","en":"Northern Croatia","it":"Croazia settentrionale","fr":"Croatie du Nord","de":"Nordkroatien","sl":"Severna Hrvaška","es":"Croacia septentrional","zh":"克罗地亚北部"},
 "sub": {"hr":"Brežuljci, hladne noći, mjehurići","en":"Hills, cold nights, bubbles","it":"Colline, notti fredde, bollicine","fr":"Collines, nuits froides, bulles","de":"Hügel, kalte Nächte, Perlen","sl":"Griči, hladne noči, mehurčki","es":"Colinas, noches frías, burbujas","zh":"丘陵、寒夜与气泡"},
 "appellations": ["Plešivica – Okić","Zagorje-Međimurje","Zabok","Međimurje","Moslavina","Voloder – Ivanić-Grad"],
 "blurb": {
  "hr":"Kontinentalni sjever radi ono što jug ne može: hladne noći drže kiselinu, a kiselina drži pjenušac. Plešivica je postala hrvatska adresa za klasičnu metodu i pét-nat, Zagorje i Međimurje daju precizne rizlinge i Sauvignone, a Moslavina čuva Škrlet — sortu koja raste gotovo nigdje drugdje.",
  "en":"The continental north does what the south cannot: cold nights hold the acidity, and acidity holds the bubble. Plešivica has become Croatia's address for méthode traditionnelle and pét-nat, Zagorje and Međimurje give precise Rieslings and Sauvignons, and Moslavina keeps Škrlet — a variety that grows almost nowhere else.",
  "it":"Il nord continentale fa ciò che il sud non può: le notti fredde tengono l'acidità, e l'acidità tiene la bolla. Plešivica è diventata l'indirizzo croato per il metodo classico e il pét-nat, lo Zagorje e il Međimurje danno Riesling e Sauvignon precisi, e la Moslavina custodisce lo Škrlet — una varietà che cresce quasi in nessun altro luogo.",
  "fr":"Le nord continental fait ce que le sud ne peut pas : les nuits froides tiennent l'acidité, et l'acidité tient la bulle. Plešivica est devenue l'adresse croate de la méthode traditionnelle et du pét-nat, le Zagorje et le Međimurje donnent des rieslings et des sauvignons précis, et la Moslavina garde le škrlet — un cépage qui ne pousse presque nulle part ailleurs.",
  "de":"Der kontinentale Norden kann, was der Süden nicht kann: kalte Nächte halten die Säure, und die Säure hält die Perle. Plešivica ist Kroatiens Adresse für die klassische Flaschengärung und Pét-Nat geworden, Zagorje und Međimurje geben präzise Rieslinge und Sauvignons, und die Moslavina bewahrt den Škrlet — eine Sorte, die fast nirgendwo sonst wächst.",
  "sl":"Celinski sever zmore, česar jug ne: hladne noči držijo kislino, kislina pa mehurček. Plešivica je postala hrvaški naslov za klasično metodo in pet-nat, Zagorje in Medžimurje dajeta natančne rizlinge in sauvignone, Moslavina pa hrani škrlet — sorto, ki raste tako rekoč nikjer drugje.",
  "es":"El norte continental hace lo que el sur no puede: las noches frías sostienen la acidez, y la acidez sostiene la burbuja. Plešivica se ha convertido en la dirección croata del método tradicional y el pét-nat, Zagorje y Međimurje dan rieslings y sauvignons precisos, y Moslavina guarda el škrlet — una variedad que no crece casi en ningún otro sitio.",
  "zh":"大陆性的北部能做南部做不到的事：寒夜守住酸度，酸度守住气泡。普莱希维察已成为克罗地亚传统法起泡与 pét-nat 的地址，扎戈列与梅吉穆列出产精准的雷司令与长相思，而莫斯拉维纳守护着什克尔莱特——一个几乎别无他处生长的品种。"}
},
]

have = {r['id'] for r in d['regions']}
for r in NEW:
    assert r['id'] not in have, r['id']
d['regions'].extend(NEW)
open(p, 'wb').write((json.dumps(d, ensure_ascii=False, indent=1) + '\n').replace('\n', '\r\n').encode('utf-8'))
print("regions now:", [r['id'] for r in d['regions']])
