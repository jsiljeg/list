# -*- coding: utf-8 -*-
"""Two corrections the owner caught (2026-08-12).

Violić: the blurb claimed that naming a wine after its vineyard rather than its
appellation is a rarity here. It is not — on Pelješac the appellations *are*
positions (Dingač, Postup), which is the owner's point and the reason the
proposed reordering was withdrawn. The false clause goes; the position stays.

Erdoro: the house makes a Sauvignon and a Pinot Noir and we pour both, but the
blurb spoke only of the Sauvignon — the flagship standing in for the estate,
which is the exact failure the per-estate rule exists to prevent.
"""
import json, sys
sys.stdout.reconfigure(encoding="utf-8")

VIOLIC = {
 "hr": "Sagul je latinsko ime položaja koji svi zovu Zaguine, na kunovskoj strani Pelješca — jedno od najosunčanijih mjesta na poluotoku, i po njemu se vino zove. Plavac je srce kuće i penje se u tri stupnja, od ovoga do Dingača; uz njega idu rukatac i pošip, u bijelom i narančastom.",
 "en": "Sagul is the Latin name of the site everyone calls Zaguine, on the Kuna side of Pelješac — one of the sunniest places on the peninsula, and the wine is named after it. Plavac is the heart of the house and climbs in three steps, from this one up to Dingač; beside it come Rukatac and Pošip, white and orange.",
 "it": "Sagul è il nome latino della posizione che tutti chiamano Zaguine, sul versante di Kuna del Pelješac — uno dei luoghi più assolati della penisola, e da lì il vino prende il nome. Il Plavac è il cuore della casa e sale per tre gradini, da questo fino al Dingač; accanto vanno Rukatac e Pošip, in bianco e in macerato.",
 "fr": "Sagul est le nom latin du lieu-dit que tout le monde appelle Zaguine, sur le versant de Kuna du Pelješac — l'un des endroits les plus ensoleillés de la péninsule, et le vin en porte le nom. Le plavac est le cœur de la maison et monte en trois marches, de celui-ci jusqu'au Dingač ; à côté viennent le rukatac et le pošip, en blanc et en orange.",
 "de": "Sagul ist der lateinische Name der Lage, die alle Zaguine nennen, auf der Kuna-Seite der Pelješac — einer der sonnigsten Orte der Halbinsel, und nach ihr heißt der Wein. Plavac ist das Herz des Hauses und steigt in drei Stufen, von diesem bis zum Dingač; daneben stehen Rukatac und Pošip, weiß und orange.",
 "sl": "Sagul je latinsko ime lege, ki ji vsi pravijo Zaguine, na kunski strani Pelješca — eno najbolj osončenih mest na polotoku, in vino se imenuje po njej. Plavac je srce hiše in se vzpenja v treh stopnjah, od tega do Dingača; ob njem gresta rukatac in pošip, v belem in oranžnem.",
 "es": "Sagul es el nombre latino del pago que todos llaman Zaguine, en la vertiente de Kuna de Pelješac — uno de los lugares más soleados de la península, y de él toma el vino su nombre. El Plavac es el corazón de la casa y sube en tres escalones, desde este hasta el Dingač; a su lado van el Rukatac y el Pošip, en blanco y en naranja.",
 "zh": "Sagul 是那片园地的拉丁名，人人都叫它 Zaguine，位于佩列沙茨半岛的库纳一侧——半岛上日照最足的地方之一，酒名就取自这里。普拉瓦茨是这个家族的核心，分三个等级层层上行，从这一款一直到丁加奇；此外还有鲁卡塔茨与波希普，白的与橘的。"
}

ERDORO = {
 "hr": "Sauvignon koji je ovdje napravio Milan Budinski hrvatska je kritika nazvala jednim od najboljih u desetljeću — a vlastito vino od Budinskog, OMO, također je na ovoj karti. Uz sauvignon kuća radi i pinot crni, na istim plešivičkim položajima i s istom rukom. Vinograde vodi Francuz Eric Moro, isti čovjek koji savjetuje Saints Hills. Ime je spoj dvaju: Erdödy, plemićka obitelj koja je vino na Plešivici počela prodavati 1736., i oro — zlato.",
 "en": "The Sauvignon Milan Budinski made here was called one of the best of the decade by the Croatian critics — and Budinski's own wine, OMO, is on this list too. Beside the Sauvignon the house makes a Pinot Noir, from the same Plešivica slopes and by the same hand. The vineyards are in the hands of the Frenchman Eric Moro, the same man who advises Saints Hills. The name is two things joined: Erdödy, the noble family that began selling wine on Plešivica in 1736, and oro — gold.",
 "it": "Il Sauvignon che Milan Budinski ha fatto qui la critica croata l'ha definito uno dei migliori del decennio — e il vino personale di Budinski, OMO, è anch'esso su questa carta. Accanto al Sauvignon la casa fa un Pinot nero, dalle stesse pendici della Plešivica e con la stessa mano. Le vigne sono affidate al francese Eric Moro, lo stesso che consiglia Saints Hills. Il nome unisce due cose: Erdödy, la famiglia nobile che cominciò a vendere vino sulla Plešivica nel 1736, e oro.",
 "fr": "Le Sauvignon que Milan Budinski a fait ici a été qualifié par la critique croate de l'un des meilleurs de la décennie — et le vin personnel de Budinski, OMO, figure aussi sur cette carte. À côté du sauvignon, la maison fait un pinot noir, des mêmes coteaux de la Plešivica et de la même main. Les vignes sont confiées au Français Eric Moro, celui-là même qui conseille Saints Hills. Le nom joint deux choses : Erdödy, la famille noble qui commença à vendre du vin sur la Plešivica en 1736, et oro — l'or.",
 "de": "Den Sauvignon, den Milan Budinski hier gemacht hat, nannte die kroatische Kritik einen der besten des Jahrzehnts — und Budinskis eigener Wein, OMO, steht ebenfalls auf dieser Karte. Neben dem Sauvignon macht das Haus einen Pinot Noir, aus denselben Lagen der Plešivica und von derselben Hand. Die Weinberge liegen in den Händen des Franzosen Eric Moro, desselben Mannes, der Saints Hills berät. Der Name fügt zwei Dinge zusammen: Erdödy, die Adelsfamilie, die 1736 auf der Plešivica begann, Wein zu verkaufen, und oro — Gold.",
 "sl": "Sauvignon, ki ga je tu naredil Milan Budinski, je hrvaška kritika označila za enega najboljših v desetletju — lastno vino Budinskega, OMO, pa je prav tako na tej karti. Ob sauvignonu hiša dela še modri pinot, z istih plešiviških leg in z isto roko. Vinograde vodi Francoz Eric Moro, isti človek, ki svetuje Saints Hillsu. Ime združuje dvoje: Erdödy, plemiško družino, ki je na Plešivici začela prodajati vino leta 1736, in oro — zlato.",
 "es": "El Sauvignon que Milan Budinski hizo aquí fue calificado por la crítica croata como uno de los mejores de la década — y el propio vino de Budinski, OMO, está también en esta carta. Junto al Sauvignon la casa hace un Pinot Noir, de las mismas laderas de Plešivica y de la misma mano. De los viñedos se encarga el francés Eric Moro, el mismo que asesora a Saints Hills. El nombre une dos cosas: Erdödy, la familia noble que empezó a vender vino en Plešivica en 1736, y oro.",
 "zh": "米兰·布丁斯基在此酿出的长相思，被克罗地亚酒评界称为十年来最好的之一——而布丁斯基自己的酒 OMO，也在这份酒单上。除长相思外，酒庄还做黑皮诺，来自普莱希维察同样的坡地，出自同一双手。葡萄园交给法国人埃里克·莫罗打理，正是为 Saints Hills 做顾问的那一位。这个名字由两部分拼成：埃尔德迪（Erdödy）——1736 年就在普莱希维察开始卖酒的贵族家族——以及 oro，黄金。"
}

p = "data/producers.json"
raw = open(p, "r", encoding="utf-8", newline="").read()
data = json.loads(raw)
prods = data["producers"]

for key, langs in (("Violić", VIOLIC), ("Erdoro", ERDORO)):
    for lg, text in langs.items():
        assert lg in prods[key]["blurb"], (key, lg)
        prods[key]["blurb"][lg] = text
    print("%s: %d languages, hr %d chars" % (key, len(langs), len(langs["hr"])))

out = json.dumps(data, ensure_ascii=False, indent=1) + "\n"
open(p, "w", encoding="utf-8", newline="").write(out.replace("\n", "\r\n"))
print("written")
