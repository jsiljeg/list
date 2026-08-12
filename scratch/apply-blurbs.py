# -*- coding: utf-8 -*-
"""The five reorderings the owner accepted (2026-08-12), in all eight
languages, plus Korak's hectares corrected from 5 to 6 (owner's number).

Facts are unchanged; what moves is which of them the guest meets first."""
import json, sys
sys.stdout.reconfigure(encoding="utf-8")

NEW = {}

NEW["Baraka"] = {
 "hr": "Plavina, babić i lasina drugdje su ispale iz mode; ovdje nisu ukras nego glavni posao. Mala šibenska kuća: 4 hektara, 11.500 trsova, suhozidi stari stoljeće i serije koje se daju izbrojati.",
 "en": "Plavina, Babić and Lasina fell out of fashion elsewhere; here they are not decoration but the main business. A small house near Šibenik: 4 hectares, 11,500 vines, drystone walls a century old, and batches you could count.",
 "it": "Plavina, Babić e Lasina sono passate di moda altrove; qui non sono un ornamento ma il lavoro principale. Una piccola casa del Sebenicano: 4 ettari, 11.500 ceppi, muretti a secco vecchi un secolo e partite che si possono contare.",
 "fr": "La plavina, le babić et la lasina sont passés de mode ailleurs ; ici, ils ne sont pas un ornement mais le travail principal. Une petite maison du pays de Šibenik : 4 hectares, 11 500 ceps, des murets de pierre sèche centenaires et des lots qu'on peut compter.",
 "de": "Plavina, Babić und Lasina fielen anderswo aus der Mode; hier sind sie keine Zierde, sondern die Hauptarbeit. Ein kleines Haus bei Šibenik: 4 Hektar, 11.500 Stöcke, 100 Jahre alte Trockenmauern und zählbare Partien.",
 "sl": "Plavina, babić in lasina so drugod izpadle iz mode; tu niso okras, ampak glavno delo. Majhna šibeniška hiša: 4 hektari, 11.500 trt, suhozidi, stari stoletje, in serije, ki se dajo prešteti.",
 "es": "La plavina, el babić y la lasina pasaron de moda en otros sitios; aquí no son adorno sino el trabajo principal. Una casa pequeña de la comarca de Šibenik: 4 hectáreas, 11.500 cepas, muros de piedra seca centenarios y partidas que se pueden contar.",
 "zh": "普拉维纳、巴比奇、拉西纳在别处早已过时；在这里，它们不是点缀，而是正业。希贝尼克一带的一间小酒庄：四公顷、一万一千五百株葡萄藤、有百年历史的干砌石墙，产量少到可以一批批数清。"
}

NEW["Šember"] = {
 "hr": "Plavec žuti gotovo nitko više ne sadi, a za pjenušac je idealan: Šemberima drži kiselinu u vinima koja su više od dvije trećine svega što rade, sve klasična metoda. Pavel je i selo i crkva — žive u Donjim Pavlovčanima, a nad vinogradima stoji crkvica svetog Pavla. U kući je peta generacija.",
 "en": "Almost nobody plants Plavec žuti any more, and for sparkling it is ideal: it holds the acidity in the classic-method wines that are more than two thirds of everything the Šembers make. Pavel is both a village and a church — they live in Donji Pavlovčani, and a chapel of St Paul stands above the vineyards. The fifth generation is in the house.",
 "it": "Il Plavec žuti non lo pianta quasi più nessuno, e per le bollicine è ideale: tiene l'acidità negli spumanti metodo classico, che sono più di due terzi di tutto ciò che gli Šember fanno. Pavel è insieme un paese e una chiesa — vivono a Donji Pavlovčani, e sopra le vigne sta una cappella di San Paolo. In casa c'è la quinta generazione.",
 "fr": "Presque plus personne ne plante le plavec žuti, et pour la bulle il est idéal : c'est lui qui tient l'acidité des effervescents de méthode classique, plus des deux tiers de tout ce que font les Šember. Pavel est à la fois un village et une église — ils vivent à Donji Pavlovčani, et une chapelle Saint-Paul se dresse au-dessus des vignes. La cinquième génération est à la maison.",
 "de": "Plavec žuti pflanzt fast niemand mehr, und für Schaumwein ist er ideal: Er hält die Säure in den Flaschengärungen, die mehr als zwei Drittel von allem sind, was die Šembers machen. Pavel ist zugleich ein Dorf und eine Kirche — sie leben in Donji Pavlovčani, und über den Weinbergen steht eine Paulskapelle. Im Haus ist die fünfte Generation.",
 "sl": "Plavec žuti skoraj nihče več ne sadi, za penino pa je idealen: Šembrom drži kislino v vinih, ki so več kot dve tretjini vsega, kar delajo, vse po klasični metodi. Pavel je hkrati vas in cerkev — živijo v Donjih Pavlovčanih, nad vinogradi pa stoji cerkvica svetega Pavla. V hiši je peti rod.",
 "es": "El Plavec žuti ya casi nadie lo planta, y para la burbuja es ideal: sostiene la acidez de los espumosos de método clásico, más de dos tercios de todo lo que hacen los Šember. Pavel es a la vez un pueblo y una iglesia — viven en Donji Pavlovčani, y sobre las viñas se alza una capilla de San Pablo. En la casa está la quinta generación.",
 "zh": "黄普拉韦茨如今几乎无人再种，可它正适合起泡酒：舍姆贝尔家三分之二以上的酒都是传统法起泡酒，撑住酸度的正是它。Pavel 既是村名也是教堂名——他们住在下帕夫洛夫恰尼，葡萄园之上立着一座圣保罗小教堂。家里已是第五代。"
}

NEW["Jakopić"] = {
 "hr": "Pušipel — tako Međimurje zove furmint, i sámo ga je vratilo iz zaborava. Jakopići ga rade na Železnoj gori, uz graševinu i sauvignon, na 15 hektara oko kurije Zichy-Terbócz; kuriju su obnovili u baštinski hotel i vino po njoj nosi ime. U obitelji se vino radi od 1908., a Branimir i Nada danas ga predaju sinovima Filipu, Martinu i Vinku.",
 "en": "Pušipel is what Međimurje calls Furmint — a name the region pulled back out of oblivion itself. The Jakopićs grow it on Železna gora alongside Graševina and Sauvignon, 15 hectares around the Zichy-Terbócz manor, which they restored into a heritage hotel and after which the wine is named. Wine has been made in the family since 1908; Branimir and Nada are handing it on to their sons Filip, Martin and Vinko.",
 "it": "Pušipel è il nome con cui il Međimurje chiama il Furmint — un nome che la regione ha ripescato da sola dall'oblio. I Jakopić lo coltivano sulla Železna gora, accanto a Graševina e Sauvignon, su 15 ettari attorno alla curia Zichy-Terbócz, che hanno restaurato in albergo storico e da cui il vino prende il nome. In famiglia si fa vino dal 1908; Branimir e Nada lo stanno passando ai figli Filip, Martin e Vinko.",
 "fr": "Le pušipel, c'est le nom que le Međimurje donne au furmint — un nom que la région a elle-même tiré de l'oubli. Les Jakopić le cultivent sur la Železna gora, à côté de la graševina et du sauvignon, sur 15 hectares autour du manoir Zichy-Terbócz, qu'ils ont restauré en hôtel de caractère et dont le vin porte le nom. On fait du vin dans la famille depuis 1908 ; Branimir et Nada le transmettent à leurs fils Filip, Martin et Vinko.",
 "de": "Pušipel ist der Name, mit dem das Međimurje den Furmint ruft — einer, den die Region selbst dem Vergessen entrissen hat. Die Jakopićs bauen ihn auf der Železna gora an, neben Graševina und Sauvignon, auf 15 Hektar rund um den Herrensitz Zichy-Terbócz, den sie zum Heritage-Hotel restauriert haben und nach dem der Wein heißt. In der Familie wird seit 1908 Wein gemacht; Branimir und Nada geben ihn an die Söhne Filip, Martin und Vinko weiter.",
 "sl": "Pušipel je ime, s katerim Medžimurje kliče furmint — ime, ki ga je pokrajina sama potegnila iz pozabe. Jakopići ga delajo na Železni gori, ob graševini in sauvignonu, na 15 hektarih okoli kurije Zichy-Terbócz, ki so jo obnovili v hotel dediščine in po kateri se vino imenuje. V družini delajo vino od leta 1908; Branimir in Nada ga danes predajata sinovom Filipu, Martinu in Vinku.",
 "es": "Pušipel es el nombre con que Međimurje llama al Furmint — un nombre que la propia comarca rescató del olvido. Los Jakopić lo cultivan en Železna gora, junto a Graševina y Sauvignon, en 15 hectáreas alrededor de la casona Zichy-Terbócz, que restauraron como hotel patrimonial y de la que el vino toma su nombre. En la familia se hace vino desde 1908; Branimir y Nada se lo van pasando a sus hijos Filip, Martin y Vinko.",
 "zh": "普希佩尔，是梅吉穆列对富尔民特的称呼——这个名字是这个地区自己从遗忘中找回来的。雅科皮奇家族在热莱兹纳山上种它，旁边还有格拉舍维纳和长相思，约 15 公顷，环绕着齐希-泰尔博茨庄园；庄园被他们修复成古迹酒店，酒名也由此而来。家族自 1908 年起酿酒，如今布拉尼米尔与娜达正把它交给儿子菲利普、马丁与温科。"
}

NEW["Erdoro"] = {
 "hr": "Sauvignon koji je ovdje napravio Milan Budinski hrvatska je kritika nazvala jednim od najboljih u desetljeću — a vlastito vino od Budinskog, OMO, također je na ovoj karti. Vinograde vodi Francuz Eric Moro, isti čovjek koji savjetuje Saints Hills. Ime je spoj dvaju: Erdödy, plemićka obitelj koja je vino na Plešivici počela prodavati 1736., i oro — zlato. Danas je Erdoro najveći vinogradarski projekt Plešivice.",
 "en": "The Sauvignon Milan Budinski made here was called one of the best of the decade by the Croatian critics — and Budinski's own wine, OMO, is on this list too. The vineyards are in the hands of the Frenchman Eric Moro, the same man who advises Saints Hills. The name is two things joined: Erdödy, the noble family that began selling wine on Plešivica in 1736, and oro — gold. Erdoro is now the largest viticultural project on Plešivica.",
 "it": "Il Sauvignon che Milan Budinski ha fatto qui la critica croata l'ha definito uno dei migliori del decennio — e il vino personale di Budinski, OMO, è anch'esso su questa carta. Le vigne sono affidate al francese Eric Moro, lo stesso che consiglia Saints Hills. Il nome unisce due cose: Erdödy, la famiglia nobile che cominciò a vendere vino sulla Plešivica nel 1736, e oro. Oggi Erdoro è il più grande progetto viticolo della Plešivica.",
 "fr": "Le Sauvignon que Milan Budinski a fait ici a été qualifié par la critique croate de l'un des meilleurs de la décennie — et le vin personnel de Budinski, OMO, figure aussi sur cette carte. Les vignes sont confiées au Français Eric Moro, celui-là même qui conseille Saints Hills. Le nom joint deux choses : Erdödy, la famille noble qui commença à vendre du vin sur la Plešivica en 1736, et oro — l'or. Erdoro est aujourd'hui le plus grand projet viticole de la Plešivica.",
 "de": "Den Sauvignon, den Milan Budinski hier gemacht hat, nannte die kroatische Kritik einen der besten des Jahrzehnts — und Budinskis eigener Wein, OMO, steht ebenfalls auf dieser Karte. Die Weinberge liegen in den Händen des Franzosen Eric Moro, desselben Mannes, der Saints Hills berät. Der Name fügt zwei Dinge zusammen: Erdödy, die Adelsfamilie, die 1736 auf der Plešivica begann, Wein zu verkaufen, und oro — Gold. Erdoro ist heute das größte Weinbauprojekt der Plešivica.",
 "sl": "Sauvignon, ki ga je tu naredil Milan Budinski, je hrvaška kritika označila za enega najboljših v desetletju — lastno vino Budinskega, OMO, pa je prav tako na tej karti. Vinograde vodi Francoz Eric Moro, isti človek, ki svetuje Saints Hillsu. Ime združuje dvoje: Erdödy, plemiško družino, ki je na Plešivici začela prodajati vino leta 1736, in oro — zlato. Erdoro je danes največji vinogradniški projekt Plešivice.",
 "es": "El Sauvignon que Milan Budinski hizo aquí fue calificado por la crítica croata como uno de los mejores de la década — y el propio vino de Budinski, OMO, está también en esta carta. De los viñedos se encarga el francés Eric Moro, el mismo que asesora a Saints Hills. El nombre une dos cosas: Erdödy, la familia noble que empezó a vender vino en Plešivica en 1736, y oro. Erdoro es hoy el mayor proyecto vitícola de Plešivica.",
 "zh": "米兰·布丁斯基在此酿出的长相思，被克罗地亚酒评界称为十年来最好的之一——而布丁斯基自己的酒 OMO，也在这份酒单上。葡萄园交给法国人埃里克·莫罗打理，正是为 Saints Hills 做顾问的那一位。这个名字由两部分拼成：埃尔德迪（Erdödy）——1736 年就在普莱希维察开始卖酒的贵族家族——以及 oro，黄金。如今 Erdoro 是普莱希维察最大的葡萄种植项目。"
}

NEW["Niko Bura"] = {
 "hr": "Ruža Dalmatinska je prošek od rukatca — vino kojim se na Pelješcu oduvijek dočekivao gost kojeg se htjelo počastiti, i ono najslađe što kuća radi. Bure ovdje rade vino od 1410., a prvu bocu s vlastitom etiketom napravili su 1995. — 585 godina i 4.000 boca poslije. Šesnaesti je naraštaj u kući.",
 "en": "Ruža Dalmatinska is a prošek from Rukatac — the wine Pelješac has always opened for a guest worth honouring, and the sweetest thing the house makes. The Buras have made wine here since 1410, and their first bottle under their own label came in 1995 — 585 years and 4,000 bottles later. The sixteenth generation is in the house.",
 "it": "Ruža Dalmatinska è un prošek di Rukatac — il vino che sul Pelješac si è sempre aperto per l'ospite che si voleva onorare, e la cosa più dolce che la casa produca. I Bura fanno vino qui dal 1410, e la prima bottiglia con l'etichetta di famiglia è del 1995 — 585 anni e 4.000 bottiglie dopo. In casa c'è la sedicesima generazione.",
 "fr": "Ruža Dalmatinska est un prošek de rukatac — le vin qu'on a toujours ouvert sur le Pelješac pour l'hôte qu'on voulait honorer, et la chose la plus douce que fasse la maison. Les Bura font du vin ici depuis 1410, et leur première bouteille sous leur propre étiquette date de 1995 — 585 ans et 4 000 bouteilles plus tard. La seizième génération est à la maison.",
 "de": "Ruža Dalmatinska ist ein Prošek aus Rukatac — der Wein, den man auf der Pelješac immer für den Gast geöffnet hat, den man ehren wollte, und das Süßeste, was das Haus macht. Die Buras machen hier seit 1410 Wein, und ihre erste Flasche unter eigenem Etikett kam 1995 — 585 Jahre und 4.000 Flaschen später. Im Haus ist die sechzehnte Generation.",
 "sl": "Ruža Dalmatinska je prošek iz rukatca — vino, ki so ga na Pelješcu od nekdaj odprli za gosta, ki so ga hoteli počastiti, in najslajše, kar hiša dela. Bure tu delajo vino od leta 1410, prvo steklenico z lastno etiketo pa so naredili leta 1995 — 585 let in 4.000 steklenic pozneje. V hiši je šestnajsti rod.",
 "es": "Ruža Dalmatinska es un prošek de Rukatac — el vino que en Pelješac siempre se ha abierto para el huésped al que se quería honrar, y lo más dulce que hace la casa. Los Bura hacen vino aquí desde 1410, y su primera botella con etiqueta propia llegó en 1995 — 585 años y 4.000 botellas después. En la casa está la decimosexta generación.",
 "zh": "Ruža Dalmatinska 是用鲁卡塔茨酿的 prošek 甜酒——在佩列沙茨半岛，它历来是为值得款待的客人开的那一瓶，也是这个家族做出的最甜的东西。布拉家族自 1410 年起在此酿酒，而第一瓶挂着自家酒标的酒，要等到 1995 年——585 年、四千瓶之后。家里已是第十六代。"
}

p = "data/producers.json"
raw = open(p, "r", encoding="utf-8", newline="").read()
data = json.loads(raw)
prods = data["producers"]

for key, langs in NEW.items():
    for lg, text in langs.items():
        assert lg in prods[key]["blurb"], (key, lg)
        prods[key]["blurb"][lg] = text
    print("%s: %d languages, hr %d chars" % (key, len(langs), len(langs["hr"])))

# Korak: 6 hectares, not 5 (owner). Only the number moves.
fixes = {"hr": ("5 hektara", "6 hektara"), "en": ("5 hectares", "6 hectares"),
         "it": ("5 ettari", "6 ettari"), "fr": ("5 hectares", "6 hectares"),
         "de": ("5 Hektar", "6 Hektar"), "sl": ("5 hektarov", "6 hektarov"),
         "es": ("5 hectáreas", "6 hectáreas"), "zh": ("5 公顷", "6 公顷")}
for lg, (a, b) in fixes.items():
    t = prods["Korak"]["blurb"][lg]
    assert a in t, (lg, a)
    prods["Korak"]["blurb"][lg] = t.replace(a, b)
print("Korak: hectares 5 -> 6 in all 8 languages")

out = json.dumps(data, ensure_ascii=False, indent=1) + "\n"
open(p, "w", encoding="utf-8", newline="").write(out.replace("\n", "\r\n"))
print("written")
