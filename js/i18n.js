/* Theatrium by Filho — i18n dictionary (hr, en, it, fr, de)
   Edit translations here. Keys must match data/wines.json descriptor keys. */
"use strict";

const LANGS = [
  { code: "hr", name: "Hrvatski" },
  { code: "en", name: "English" },
  { code: "it", name: "Italiano" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" }
];

const I18N = {
hr: {
  ui: {
    subtitle: "Vinska karta i pića",
    chooseLanguage: "Odaberite jezik",
    back: "Natrag",
    search: "Pretraži vina…",
    noResults: "Nema rezultata",
    priceNote: "Cijene ovog dijela ponude zatražite od osoblja.",
    grape: "Sorta", region: "Regija", country: "Zemlja", style: "Stil",
    body: "Tijelo", aromas: "Arome i okusi", pairings: "Uz jela",
    temp: "Temperatura posluživanja",
    legal: "Cijene su izražene u eurima, PDV i porezi uračunati su u cijenu. Zabranjeno je usluživanje alkoholnih pića maloljetnim osobama. Za informacije o alergenima obratite se našem osoblju.",
    company: "Restoran Theatrium · Apelacija d.o.o. · Teslina 7, Zagreb",
    recommended: "Filho preporučuje",
    storyNav: "Priča",
    enter: "Otvori kartu",
    ratings: "Ocjene kritičara",
    picks: "Filhov izbor",
    newBadge: "Novo"
  },
  helper: {
    title: "Pomozi mi odabrati",
    qFood: "Što jedete?",
    qStyle: "Kakav stil volite?",
    qBudget: "Budžet za bocu?",
    food: { seafood: "Riba i plodovi mora", meat: "Odrezak i crveno meso", pasta: "Tjestenina, rižoto, pizza", white: "Perad i bijelo meso", cheese: "Sir i naresci", dessert: "Desert", none: "Samo piće / aperitiv" },
    style: { fresh: "Svježe i lagano", rich: "Bogato i snažno", bold: "Nešto posebno i drugačije" },
    budget: { b1: "do 60 €", b2: "60–120 €", b3: "iznad 120 €", any: "Bez ograničenja" },
    results: "Naše preporuke",
    again: "Ispočetka"
  },
  story: {
    title: "Theatrium Wine Program — Filho Edition",
    paras: [
      "Vinska karta koju držite pred sobom nije katalog, nije popis, nije inventar. To je odraz jedne filozofije, jednog puta i jednog pogleda na vino. Filho ju je gradio godinama — kroz putovanja, razgovore i osobna iskustva u vinogradima, kroz stotine degustacija i nebrojene susrete s vinarima koji stvaraju vina koja nisu samo pića, nego priče, krajolici i emocije.",
      "Ova karta je rezultat izbora, a ne ponude. Svako je vino ovdje zato što je nešto pokazalo: karakter, preciznost, čistoću, stil ili osobnost vinara. Svaka berba je odabrana zato što poštuje terroir, godinu, klimatsku sliku i rukopis podruma.",
      "Srce karte čini burgundijska filozofija terroira. Champagne je tu kao elegancija, a ne pozlata. A hrvatska vina dobivaju ozbiljan prostor koji zaslužuju: vinari koji rade čiste, fokusirane, karakterne stilove i mogu stajati uz bok najboljima iz Francuske, Italije i Njemačke.",
      "Nema vina iz navike. Postoje samo vina s karakterom, vinari s vizijom i berbe koje nose priču. Ova karta nije zatvorena — ona se razvija, raste, uči i mijenja, baš kao i ljudi koji je stvaraju. Filho vjeruje da je vino živi organizam; zato i vinska karta mora biti živa."
    ]
  },
  sections: {
    "glass": "Vina na čašu", "bottle-sparkling": "Pjenušci i šampanjci",
    "bottle-white": "Bijela vina", "bottle-rose": "Rosé vina",
    "bottle-red": "Crna vina", "bottle-dessert": "Desertna vina",
    "spirits": "Žestoka pića", "rakija-beer": "Rakije, grappe, likeri i pivo",
    "other": "Vode i ostala pića"
  },
  categories: {
    sparkling: "Pjenušava vina", champagne: "Šampanjac", white: "Bijela vina",
    orange: "Macerirana bijela vina", red: "Crna vina", rose: "Rosé vina",
    dessert: "Desertna vina", vodka: "Vodka", gin: "Gin", vermouth: "Vermut",
    "tequila-mezcal": "Tequila i mezcal", whisky: "Viski", rum: "Rum",
    cognac: "Cognac", shochu: "Shochu", rakija: "Rakija", grappa: "Grappa",
    liqueur: "Likeri", beer: "Pivo", water: "Mineralna voda", tonic: "Tonik",
    juice: "Sokovi i bezalkoholna pića", coffee: "Kava"
  },
  countries: { HR: "Hrvatska", DE: "Njemačka", AT: "Austrija", FR: "Francuska", IT: "Italija", ES: "Španjolska", SI: "Slovenija", US: "SAD", CN: "Kina" },
  styles: {
    sparkling: "Pjenušavo · svježe i suho", sparkling_rose: "Pjenušavi rosé",
    champagne: "Champagne · klasični brut", champagne_bdb: "Champagne · Blanc de Blancs",
    champagne_rose: "Champagne rosé", champagne_prestige: "Prestižni champagne · kompleksan i zreo",
    white_fresh: "Bijelo · svježe i voćno", white_aromatic: "Bijelo · aromatično",
    white_mineral: "Bijelo · mineralno i precizno", white_rich: "Bijelo · bogato i kremasto",
    orange: "Macerirano bijelo · odležano na kožici", rose: "Rosé · svježe i lagano",
    red_light: "Crno · lagano i elegantno", red_medium: "Crno · srednje puno",
    red_full: "Crno · puno i snažno", red_mature: "Crno · zrelo, razvijene tercijarne arome",
    sweet: "Slatko · desertno vino"
  },
  bodies: { light: "lagano", medium: "srednje puno", full: "puno" },
  aromas: {
    almond: "badem", apricot: "marelica", balsamic: "balzamične note", blackberry: "kupina",
    blackcurrant: "crni ribiz", brioche: "brioche", butter: "maslac", candied_fruit: "kandirano voće",
    caramel: "karamela", cedar: "cedrovina", cherry: "trešnja", chocolate: "čokolada",
    citrus: "citrusi", coffee: "kava", dried_fruit: "suho voće", earth: "zemljane note",
    elderflower: "cvijet bazge", fig: "smokva", flint: "kremen", forest_floor: "šumsko tlo",
    grapefruit: "grejp", grass: "pokošena trava", green_apple: "zelena jabuka", hazelnut: "lješnjak",
    herbs: "mediteransko bilje", honey: "med", leather: "koža", licorice: "sladić",
    lime: "limeta", mineral: "mineralnost", mint: "metvica", orange_peel: "narančina kora",
    peach: "breskva", pear: "kruška", pepper: "papar", petrol: "petrolej",
    plum: "šljiva", quince: "dunja", raisin: "grožđice", raspberry: "malina",
    red_apple: "crvena jabuka", red_currant: "crveni ribiz", rose: "ruža", saline: "slanost",
    smoke: "dim", sour_cherry: "višnja", spice: "začini", strawberry: "jagoda",
    toast: "tost", tobacco: "duhan", tropical: "tropsko voće", truffle: "tartuf",
    vanilla: "vanilija", violet: "ljubičica", walnut: "orah", wet_stone: "mokri kamen",
    white_flowers: "bijelo cvijeće", yeast: "kvasac"
  },
  pairings: {
    aperitif: "aperitiv", asian: "azijska kuhinja", asparagus: "šparoge", bbq: "jela s roštilja",
    beef: "govedina", caviar: "kavijar", charcuterie: "suhomesnati naresci", cheese_blue: "plavi sirevi",
    cheese_fresh: "svježi sirevi", cheese_hard: "tvrdi, zreli sirevi", chocolate: "čokolada",
    desserts: "deserti", foie_gras: "foie gras", fruit_desserts: "voćni deserti", game: "divljač",
    grilled_fish: "riba s gradela", lamb: "janjetina", light_starters: "lagana predjela",
    mushrooms: "gljive", nuts: "orašasti plodovi", oysters: "kamenice", pasta: "tjestenina",
    pizza: "pizza", pork: "svinjetina", poultry: "perad", prosciutto: "pršut",
    risotto: "rižoto", salads: "salate", seafood: "plodovi mora", shellfish: "školjke i rakovi",
    solo: "samostalno, za posebne trenutke", spicy: "začinjena jela", steak: "odrezak",
    stews: "gulaši i složena jela", sushi: "sushi", truffles: "jela s tartufima",
    veal: "teletina", vegetables: "povrće", white_fish: "bijela riba", white_meat: "bijelo meso"
  }
},
en: {
  ui: {
    subtitle: "Wine & drinks list",
    chooseLanguage: "Choose your language",
    back: "Back",
    search: "Search wines…",
    noResults: "No results",
    priceNote: "Please ask our staff for prices in this section.",
    grape: "Grape variety", region: "Region", country: "Country", style: "Style",
    body: "Body", aromas: "Tasting notes", pairings: "Food pairing",
    temp: "Serving temperature",
    legal: "Prices are in euros, VAT and taxes included. Serving alcoholic beverages to minors is prohibited. For allergen information, please ask our staff.",
    company: "Restaurant Theatrium · Apelacija d.o.o. · Teslina 7, Zagreb",
    recommended: "Filho recommends",
    storyNav: "The story",
    enter: "View the list",
    ratings: "Critic scores",
    picks: "Filho's picks",
    newBadge: "New"
  },
  helper: {
    title: "Help me choose",
    qFood: "What are you eating?",
    qStyle: "Which style do you prefer?",
    qBudget: "Bottle budget?",
    food: { seafood: "Fish & seafood", meat: "Steak & red meat", pasta: "Pasta, risotto, pizza", white: "Poultry & white meat", cheese: "Cheese & charcuterie", dessert: "Dessert", none: "Just drinks / aperitif" },
    style: { fresh: "Fresh & light", rich: "Rich & powerful", bold: "Something special & different" },
    budget: { b1: "under 60 €", b2: "60–120 €", b3: "over 120 €", any: "No limit" },
    results: "Our suggestions",
    again: "Start over"
  },
  story: {
    title: "Theatrium Wine Program — Filho Edition",
    paras: [
      "The wine list in front of you is not a catalogue, not an inventory. It is the reflection of a philosophy, of a journey and of one view of wine. Filho has built it over the years — through travels, conversations and personal experience in the vineyards, through hundreds of tastings and countless encounters with winemakers whose wines are not merely drinks, but stories, landscapes and emotions.",
      "This list is the result of selection, not supply. Every wine is here because it has shown something: character, precision, purity, style, or the personality of its maker. Every vintage was chosen because it respects the terroir, the year, the climate and the signature of the cellar.",
      "At the heart of the list lies the Burgundian philosophy of terroir. Champagne is here as elegance, not gilding. And Croatian wines are given the serious space they deserve: winemakers crafting pure, focused, characterful styles that stand shoulder to shoulder with the best of France, Italy and Germany.",
      "There are no wines out of habit. There are only wines with character, winemakers with vision and vintages that carry a story. This list is not closed — it develops, grows, learns and changes, just like the people who create it. Filho believes wine is a living organism; that is why a wine list must be alive as well."
    ]
  },
  sections: {
    "glass": "Wines by the glass", "bottle-sparkling": "Sparkling & Champagne",
    "bottle-white": "White wines", "bottle-rose": "Rosé wines",
    "bottle-red": "Red wines", "bottle-dessert": "Dessert wines",
    "spirits": "Spirits", "rakija-beer": "Rakija, grappa, liqueurs & beer",
    "other": "Water & other beverages"
  },
  categories: {
    sparkling: "Sparkling wines", champagne: "Champagne", white: "White wines",
    orange: "Orange wines", red: "Red wines", rose: "Rosé wines",
    dessert: "Dessert wines", vodka: "Vodka", gin: "Gin", vermouth: "Vermouth",
    "tequila-mezcal": "Tequila & mezcal", whisky: "Whisky", rum: "Rum",
    cognac: "Cognac", shochu: "Shochu", rakija: "Rakija", grappa: "Grappa",
    liqueur: "Liqueurs", beer: "Beer", water: "Mineral water", tonic: "Tonic water",
    juice: "Juices & soft drinks", coffee: "Coffee"
  },
  countries: { HR: "Croatia", DE: "Germany", AT: "Austria", FR: "France", IT: "Italy", ES: "Spain", SI: "Slovenia", US: "USA", CN: "China" },
  styles: {
    sparkling: "Sparkling · fresh and dry", sparkling_rose: "Sparkling rosé",
    champagne: "Champagne · classic brut", champagne_bdb: "Champagne · Blanc de Blancs",
    champagne_rose: "Champagne rosé", champagne_prestige: "Prestige champagne · complex and mature",
    white_fresh: "White · fresh and fruity", white_aromatic: "White · aromatic",
    white_mineral: "White · mineral and precise", white_rich: "White · rich and creamy",
    orange: "Orange · skin-macerated", rose: "Rosé · fresh and light",
    red_light: "Red · light and elegant", red_medium: "Red · medium-bodied",
    red_full: "Red · full-bodied and powerful", red_mature: "Red · mature, developed tertiary notes",
    sweet: "Sweet · dessert wine"
  },
  bodies: { light: "light", medium: "medium", full: "full" },
  aromas: {
    almond: "almond", apricot: "apricot", balsamic: "balsamic notes", blackberry: "blackberry",
    blackcurrant: "blackcurrant", brioche: "brioche", butter: "butter", candied_fruit: "candied fruit",
    caramel: "caramel", cedar: "cedar", cherry: "cherry", chocolate: "chocolate",
    citrus: "citrus", coffee: "coffee", dried_fruit: "dried fruit", earth: "earthy notes",
    elderflower: "elderflower", fig: "fig", flint: "flint", forest_floor: "forest floor",
    grapefruit: "grapefruit", grass: "cut grass", green_apple: "green apple", hazelnut: "hazelnut",
    herbs: "Mediterranean herbs", honey: "honey", leather: "leather", licorice: "licorice",
    lime: "lime", mineral: "minerality", mint: "mint", orange_peel: "orange peel",
    peach: "peach", pear: "pear", pepper: "pepper", petrol: "petrol",
    plum: "plum", quince: "quince", raisin: "raisins", raspberry: "raspberry",
    red_apple: "red apple", red_currant: "redcurrant", rose: "rose", saline: "salinity",
    smoke: "smoke", sour_cherry: "sour cherry", spice: "spice", strawberry: "strawberry",
    toast: "toast", tobacco: "tobacco", tropical: "tropical fruit", truffle: "truffle",
    vanilla: "vanilla", violet: "violet", walnut: "walnut", wet_stone: "wet stone",
    white_flowers: "white flowers", yeast: "yeast"
  },
  pairings: {
    aperitif: "aperitif", asian: "Asian cuisine", asparagus: "asparagus", bbq: "barbecue",
    beef: "beef", caviar: "caviar", charcuterie: "charcuterie", cheese_blue: "blue cheese",
    cheese_fresh: "fresh cheese", cheese_hard: "aged cheese", chocolate: "chocolate",
    desserts: "desserts", foie_gras: "foie gras", fruit_desserts: "fruit desserts", game: "game",
    grilled_fish: "grilled fish", lamb: "lamb", light_starters: "light starters",
    mushrooms: "mushrooms", nuts: "nuts", oysters: "oysters", pasta: "pasta",
    pizza: "pizza", pork: "pork", poultry: "poultry", prosciutto: "prosciutto",
    risotto: "risotto", salads: "salads", seafood: "seafood", shellfish: "shellfish",
    solo: "on its own, for special moments", spicy: "spicy dishes", steak: "steak",
    stews: "stews", sushi: "sushi", truffles: "truffle dishes",
    veal: "veal", vegetables: "vegetables", white_fish: "white fish", white_meat: "white meat"
  }
},
it: {
  ui: {
    subtitle: "Carta dei vini e delle bevande",
    chooseLanguage: "Scegli la lingua",
    back: "Indietro",
    search: "Cerca vini…",
    noResults: "Nessun risultato",
    priceNote: "Per i prezzi di questa sezione rivolgetevi al nostro personale.",
    grape: "Vitigno", region: "Regione", country: "Paese", style: "Stile",
    body: "Corpo", aromas: "Note di degustazione", pairings: "Abbinamenti",
    temp: "Temperatura di servizio",
    legal: "I prezzi sono espressi in euro, IVA e tasse incluse. È vietato servire bevande alcoliche ai minori. Per informazioni sugli allergeni rivolgetevi al nostro personale.",
    company: "Ristorante Theatrium · Apelacija d.o.o. · Teslina 7, Zagabria",
    recommended: "Filho consiglia",
    storyNav: "La storia",
    enter: "Apri la carta",
    ratings: "Punteggi della critica",
    picks: "La selezione di Filho",
    newBadge: "Novità"
  },
  helper: {
    title: "Aiutami a scegliere",
    qFood: "Cosa mangiate?",
    qStyle: "Che stile preferite?",
    qBudget: "Budget per la bottiglia?",
    food: { seafood: "Pesce e frutti di mare", meat: "Bistecca e carni rosse", pasta: "Pasta, risotto, pizza", white: "Pollame e carni bianche", cheese: "Formaggi e salumi", dessert: "Dessert", none: "Solo da bere / aperitivo" },
    style: { fresh: "Fresco e leggero", rich: "Ricco e potente", bold: "Qualcosa di speciale e diverso" },
    budget: { b1: "fino a 60 €", b2: "60–120 €", b3: "oltre 120 €", any: "Senza limite" },
    results: "I nostri consigli",
    again: "Ricomincia"
  },
  story: {
    title: "Theatrium Wine Program — Filho Edition",
    paras: [
      "La carta dei vini che avete davanti non è un catalogo, non è un inventario. È il riflesso di una filosofia, di un percorso e di uno sguardo sul vino. Filho l'ha costruita negli anni — attraverso viaggi, conversazioni ed esperienze personali nei vigneti, centinaia di degustazioni e innumerevoli incontri con vignaioli i cui vini non sono semplici bevande, ma storie, paesaggi ed emozioni.",
      "Questa carta è il risultato di una selezione, non di un'offerta. Ogni vino è qui perché ha dimostrato qualcosa: carattere, precisione, purezza, stile o la personalità del produttore. Ogni annata è stata scelta perché rispetta il terroir, l'anno, il clima e la firma della cantina.",
      "Il cuore della carta è la filosofia borgognona del terroir. Lo Champagne è qui come eleganza, non come doratura. E i vini croati ricevono lo spazio serio che meritano: vignaioli che creano stili puri, precisi e di carattere, alla pari con i migliori di Francia, Italia e Germania.",
      "Non ci sono vini per abitudine. Ci sono solo vini con carattere, vignaioli con visione e annate che raccontano una storia. Questa carta non è chiusa — si sviluppa, cresce, impara e cambia, proprio come le persone che la creano. Filho crede che il vino sia un organismo vivo; per questo anche la carta dei vini deve essere viva."
    ]
  },
  sections: {
    "glass": "Vini al calice", "bottle-sparkling": "Spumanti e Champagne",
    "bottle-white": "Vini bianchi", "bottle-rose": "Vini rosati",
    "bottle-red": "Vini rossi", "bottle-dessert": "Vini da dessert",
    "spirits": "Distillati", "rakija-beer": "Rakija, grappe, liquori e birra",
    "other": "Acque e altre bevande"
  },
  categories: {
    sparkling: "Spumanti", champagne: "Champagne", white: "Vini bianchi",
    orange: "Vini orange", red: "Vini rossi", rose: "Vini rosati",
    dessert: "Vini da dessert", vodka: "Vodka", gin: "Gin", vermouth: "Vermut",
    "tequila-mezcal": "Tequila e mezcal", whisky: "Whisky", rum: "Rum",
    cognac: "Cognac", shochu: "Shochu", rakija: "Rakija (acquavite)", grappa: "Grappa",
    liqueur: "Liquori", beer: "Birra", water: "Acqua minerale", tonic: "Acqua tonica",
    juice: "Succhi e bibite", coffee: "Caffè"
  },
  countries: { HR: "Croazia", DE: "Germania", AT: "Austria", FR: "Francia", IT: "Italia", ES: "Spagna", SI: "Slovenia", US: "Stati Uniti", CN: "Cina" },
  styles: {
    sparkling: "Spumante · fresco e secco", sparkling_rose: "Spumante rosato",
    champagne: "Champagne · brut classico", champagne_bdb: "Champagne · Blanc de Blancs",
    champagne_rose: "Champagne rosé", champagne_prestige: "Champagne di prestigio · complesso e maturo",
    white_fresh: "Bianco · fresco e fruttato", white_aromatic: "Bianco · aromatico",
    white_mineral: "Bianco · minerale e preciso", white_rich: "Bianco · ricco e cremoso",
    orange: "Orange · macerato sulle bucce", rose: "Rosato · fresco e leggero",
    red_light: "Rosso · leggero ed elegante", red_medium: "Rosso · di medio corpo",
    red_full: "Rosso · corposo e potente", red_mature: "Rosso · maturo, note terziarie evolute",
    sweet: "Dolce · vino da dessert"
  },
  bodies: { light: "leggero", medium: "medio", full: "corposo" },
  aromas: {
    almond: "mandorla", apricot: "albicocca", balsamic: "note balsamiche", blackberry: "mora",
    blackcurrant: "ribes nero", brioche: "brioche", butter: "burro", candied_fruit: "frutta candita",
    caramel: "caramello", cedar: "cedro", cherry: "ciliegia", chocolate: "cioccolato",
    citrus: "agrumi", coffee: "caffè", dried_fruit: "frutta secca", earth: "note terrose",
    elderflower: "fiori di sambuco", fig: "fico", flint: "pietra focaia", forest_floor: "sottobosco",
    grapefruit: "pompelmo", grass: "erba tagliata", green_apple: "mela verde", hazelnut: "nocciola",
    herbs: "erbe mediterranee", honey: "miele", leather: "cuoio", licorice: "liquirizia",
    lime: "lime", mineral: "mineralità", mint: "menta", orange_peel: "scorza d'arancia",
    peach: "pesca", pear: "pera", pepper: "pepe", petrol: "idrocarburi",
    plum: "prugna", quince: "mela cotogna", raisin: "uva passa", raspberry: "lampone",
    red_apple: "mela rossa", red_currant: "ribes rosso", rose: "rosa", saline: "salinità",
    smoke: "fumo", sour_cherry: "amarena", spice: "spezie", strawberry: "fragola",
    toast: "pane tostato", tobacco: "tabacco", tropical: "frutta tropicale", truffle: "tartufo",
    vanilla: "vaniglia", violet: "violetta", walnut: "noce", wet_stone: "pietra bagnata",
    white_flowers: "fiori bianchi", yeast: "lievito"
  },
  pairings: {
    aperitif: "aperitivo", asian: "cucina asiatica", asparagus: "asparagi", bbq: "grigliate",
    beef: "manzo", caviar: "caviale", charcuterie: "salumi", cheese_blue: "formaggi erborinati",
    cheese_fresh: "formaggi freschi", cheese_hard: "formaggi stagionati", chocolate: "cioccolato",
    desserts: "dolci", foie_gras: "foie gras", fruit_desserts: "dolci alla frutta", game: "selvaggina",
    grilled_fish: "pesce alla griglia", lamb: "agnello", light_starters: "antipasti leggeri",
    mushrooms: "funghi", nuts: "frutta a guscio", oysters: "ostriche", pasta: "pasta",
    pizza: "pizza", pork: "maiale", poultry: "pollame", prosciutto: "prosciutto crudo",
    risotto: "risotto", salads: "insalate", seafood: "frutti di mare", shellfish: "crostacei",
    solo: "da meditazione", spicy: "piatti speziati", steak: "bistecca",
    stews: "stufati", sushi: "sushi", truffles: "piatti al tartufo",
    veal: "vitello", vegetables: "verdure", white_fish: "pesce bianco", white_meat: "carni bianche"
  }
},
fr: {
  ui: {
    subtitle: "Carte des vins et boissons",
    chooseLanguage: "Choisissez votre langue",
    back: "Retour",
    search: "Rechercher un vin…",
    noResults: "Aucun résultat",
    priceNote: "Pour les prix de cette section, adressez-vous à notre personnel.",
    grape: "Cépage", region: "Région", country: "Pays", style: "Style",
    body: "Corps", aromas: "Notes de dégustation", pairings: "Accords mets-vins",
    temp: "Température de service",
    legal: "Les prix sont exprimés en euros, TVA et taxes comprises. Il est interdit de servir des boissons alcoolisées aux mineurs. Pour toute information sur les allergènes, adressez-vous à notre personnel.",
    company: "Restaurant Theatrium · Apelacija d.o.o. · Teslina 7, Zagreb",
    recommended: "Filho recommande",
    storyNav: "L'histoire",
    enter: "Voir la carte",
    ratings: "Notes des critiques",
    picks: "La sélection de Filho",
    newBadge: "Nouveau"
  },
  helper: {
    title: "Aidez-moi à choisir",
    qFood: "Que mangez-vous ?",
    qStyle: "Quel style préférez-vous ?",
    qBudget: "Budget pour la bouteille ?",
    food: { seafood: "Poisson et fruits de mer", meat: "Steak et viandes rouges", pasta: "Pâtes, risotto, pizza", white: "Volaille et viandes blanches", cheese: "Fromages et charcuterie", dessert: "Dessert", none: "Juste un verre / apéritif" },
    style: { fresh: "Frais et léger", rich: "Riche et puissant", bold: "Quelque chose de spécial" },
    budget: { b1: "moins de 60 €", b2: "60–120 €", b3: "plus de 120 €", any: "Sans limite" },
    results: "Nos suggestions",
    again: "Recommencer"
  },
  story: {
    title: "Theatrium Wine Program — Filho Edition",
    paras: [
      "La carte des vins que vous avez sous les yeux n'est ni un catalogue ni un inventaire. Elle est le reflet d'une philosophie, d'un parcours et d'un regard sur le vin. Filho l'a construite au fil des années — à travers des voyages, des conversations et des expériences personnelles dans les vignobles, des centaines de dégustations et d'innombrables rencontres avec des vignerons dont les vins ne sont pas de simples boissons, mais des histoires, des paysages et des émotions.",
      "Cette carte est le fruit d'une sélection, non d'une offre. Chaque vin est ici parce qu'il a montré quelque chose : du caractère, de la précision, de la pureté, du style ou la personnalité de son vigneron. Chaque millésime a été choisi parce qu'il respecte le terroir, l'année, le climat et la signature de la cave.",
      "Au cœur de la carte se trouve la philosophie bourguignonne du terroir. Le Champagne y est présent comme élégance, non comme dorure. Et les vins croates reçoivent la place sérieuse qu'ils méritent : des vignerons aux styles purs, précis et de caractère, à la hauteur des meilleurs de France, d'Italie et d'Allemagne.",
      "Il n'y a pas de vins par habitude. Il n'y a que des vins de caractère, des vignerons visionnaires et des millésimes porteurs d'histoire. Cette carte n'est pas figée — elle évolue, grandit, apprend et change, tout comme ceux qui la créent. Filho croit que le vin est un organisme vivant ; c'est pourquoi la carte des vins doit l'être aussi."
    ]
  },
  sections: {
    "glass": "Vins au verre", "bottle-sparkling": "Effervescents et Champagne",
    "bottle-white": "Vins blancs", "bottle-rose": "Vins rosés",
    "bottle-red": "Vins rouges", "bottle-dessert": "Vins de dessert",
    "spirits": "Spiritueux", "rakija-beer": "Rakija, grappa, liqueurs et bière",
    "other": "Eaux et autres boissons"
  },
  categories: {
    sparkling: "Vins effervescents", champagne: "Champagne", white: "Vins blancs",
    orange: "Vins orange", red: "Vins rouges", rose: "Vins rosés",
    dessert: "Vins de dessert", vodka: "Vodka", gin: "Gin", vermouth: "Vermouth",
    "tequila-mezcal": "Tequila et mezcal", whisky: "Whisky", rum: "Rhum",
    cognac: "Cognac", shochu: "Shochu", rakija: "Rakija (eau-de-vie)", grappa: "Grappa",
    liqueur: "Liqueurs", beer: "Bière", water: "Eau minérale", tonic: "Tonic",
    juice: "Jus et boissons sans alcool", coffee: "Café"
  },
  countries: { HR: "Croatie", DE: "Allemagne", AT: "Autriche", FR: "France", IT: "Italie", ES: "Espagne", SI: "Slovénie", US: "États-Unis", CN: "Chine" },
  styles: {
    sparkling: "Effervescent · frais et sec", sparkling_rose: "Effervescent rosé",
    champagne: "Champagne · brut classique", champagne_bdb: "Champagne · Blanc de Blancs",
    champagne_rose: "Champagne rosé", champagne_prestige: "Champagne de prestige · complexe et mûr",
    white_fresh: "Blanc · frais et fruité", white_aromatic: "Blanc · aromatique",
    white_mineral: "Blanc · minéral et précis", white_rich: "Blanc · riche et crémeux",
    orange: "Orange · macéré sur peaux", rose: "Rosé · frais et léger",
    red_light: "Rouge · léger et élégant", red_medium: "Rouge · de corps moyen",
    red_full: "Rouge · corsé et puissant", red_mature: "Rouge · mature, notes tertiaires évoluées",
    sweet: "Doux · vin de dessert"
  },
  bodies: { light: "léger", medium: "moyen", full: "corsé" },
  aromas: {
    almond: "amande", apricot: "abricot", balsamic: "notes balsamiques", blackberry: "mûre",
    blackcurrant: "cassis", brioche: "brioche", butter: "beurre", candied_fruit: "fruits confits",
    caramel: "caramel", cedar: "cèdre", cherry: "cerise", chocolate: "chocolat",
    citrus: "agrumes", coffee: "café", dried_fruit: "fruits secs", earth: "notes terreuses",
    elderflower: "fleur de sureau", fig: "figue", flint: "pierre à fusil", forest_floor: "sous-bois",
    grapefruit: "pamplemousse", grass: "herbe coupée", green_apple: "pomme verte", hazelnut: "noisette",
    herbs: "herbes méditerranéennes", honey: "miel", leather: "cuir", licorice: "réglisse",
    lime: "citron vert", mineral: "minéralité", mint: "menthe", orange_peel: "écorce d'orange",
    peach: "pêche", pear: "poire", pepper: "poivre", petrol: "notes pétrolées",
    plum: "prune", quince: "coing", raisin: "raisins secs", raspberry: "framboise",
    red_apple: "pomme rouge", red_currant: "groseille", rose: "rose", saline: "salinité",
    smoke: "fumé", sour_cherry: "griotte", spice: "épices", strawberry: "fraise",
    toast: "toast", tobacco: "tabac", tropical: "fruits tropicaux", truffle: "truffe",
    vanilla: "vanille", violet: "violette", walnut: "noix", wet_stone: "pierre mouillée",
    white_flowers: "fleurs blanches", yeast: "levure"
  },
  pairings: {
    aperitif: "apéritif", asian: "cuisine asiatique", asparagus: "asperges", bbq: "grillades",
    beef: "bœuf", caviar: "caviar", charcuterie: "charcuterie", cheese_blue: "fromages bleus",
    cheese_fresh: "fromages frais", cheese_hard: "fromages affinés", chocolate: "chocolat",
    desserts: "desserts", foie_gras: "foie gras", fruit_desserts: "desserts aux fruits", game: "gibier",
    grilled_fish: "poisson grillé", lamb: "agneau", light_starters: "entrées légères",
    mushrooms: "champignons", nuts: "fruits à coque", oysters: "huîtres", pasta: "pâtes",
    pizza: "pizza", pork: "porc", poultry: "volaille", prosciutto: "jambon cru",
    risotto: "risotto", salads: "salades", seafood: "fruits de mer", shellfish: "coquillages et crustacés",
    solo: "à déguster seul, pour les grands moments", spicy: "plats épicés", steak: "steak",
    stews: "plats mijotés", sushi: "sushi", truffles: "plats à la truffe",
    veal: "veau", vegetables: "légumes", white_fish: "poisson blanc", white_meat: "viandes blanches"
  }
},
de: {
  ui: {
    subtitle: "Wein- & Getränkekarte",
    chooseLanguage: "Sprache wählen",
    back: "Zurück",
    search: "Weine suchen…",
    noResults: "Keine Ergebnisse",
    priceNote: "Die Preise dieser Rubrik erfragen Sie bitte bei unserem Personal.",
    grape: "Rebsorte", region: "Region", country: "Land", style: "Stil",
    body: "Körper", aromas: "Aromen", pairings: "Speiseempfehlung",
    temp: "Serviertemperatur",
    legal: "Die Preise sind in Euro angegeben, inklusive Mehrwertsteuer und Abgaben. Der Ausschank alkoholischer Getränke an Minderjährige ist verboten. Informationen zu Allergenen erhalten Sie bei unserem Personal.",
    company: "Restaurant Theatrium · Apelacija d.o.o. · Teslina 7, Zagreb",
    recommended: "Filho empfiehlt",
    storyNav: "Die Geschichte",
    enter: "Zur Karte",
    ratings: "Kritiker-Bewertungen",
    picks: "Filhos Auswahl",
    newBadge: "Neu"
  },
  helper: {
    title: "Hilfe bei der Auswahl",
    qFood: "Was essen Sie?",
    qStyle: "Welchen Stil bevorzugen Sie?",
    qBudget: "Budget für die Flasche?",
    food: { seafood: "Fisch & Meeresfrüchte", meat: "Steak & rotes Fleisch", pasta: "Pasta, Risotto, Pizza", white: "Geflügel & helles Fleisch", cheese: "Käse & Aufschnitt", dessert: "Dessert", none: "Nur Getränke / Aperitif" },
    style: { fresh: "Frisch & leicht", rich: "Reich & kraftvoll", bold: "Etwas Besonderes" },
    budget: { b1: "bis 60 €", b2: "60–120 €", b3: "über 120 €", any: "Ohne Limit" },
    results: "Unsere Empfehlungen",
    again: "Neu beginnen"
  },
  story: {
    title: "Theatrium Wine Program — Filho Edition",
    paras: [
      "Die Weinkarte, die Sie vor sich haben, ist kein Katalog und kein Inventar. Sie ist der Ausdruck einer Philosophie, eines Weges und eines Blicks auf den Wein. Filho hat sie über Jahre aufgebaut — durch Reisen, Gespräche und persönliche Erfahrungen in den Weinbergen, durch Hunderte von Verkostungen und unzählige Begegnungen mit Winzern, deren Weine nicht bloß Getränke sind, sondern Geschichten, Landschaften und Emotionen.",
      "Diese Karte ist das Ergebnis einer Auswahl, nicht eines Angebots. Jeder Wein ist hier, weil er etwas gezeigt hat: Charakter, Präzision, Reinheit, Stil oder die Persönlichkeit seines Winzers. Jeder Jahrgang wurde gewählt, weil er Terroir, Jahr, Klima und die Handschrift des Kellers respektiert.",
      "Das Herz der Karte bildet die burgundische Terroir-Philosophie. Champagner steht hier für Eleganz, nicht für Vergoldung. Und kroatische Weine erhalten den ernsthaften Platz, den sie verdienen: Winzer mit reinen, fokussierten, charaktervollen Stilen, die den Besten aus Frankreich, Italien und Deutschland ebenbürtig sind.",
      "Es gibt keine Weine aus Gewohnheit. Es gibt nur Weine mit Charakter, Winzer mit Vision und Jahrgänge, die eine Geschichte tragen. Diese Karte ist nicht abgeschlossen — sie entwickelt sich, wächst, lernt und verändert sich, genau wie die Menschen, die sie gestalten. Filho glaubt, dass Wein ein lebendiger Organismus ist; deshalb muss auch eine Weinkarte lebendig sein."
    ]
  },
  sections: {
    "glass": "Offene Weine", "bottle-sparkling": "Schaumwein & Champagner",
    "bottle-white": "Weißweine", "bottle-rose": "Roséweine",
    "bottle-red": "Rotweine", "bottle-dessert": "Dessertweine",
    "spirits": "Spirituosen", "rakija-beer": "Rakija, Grappa, Liköre & Bier",
    "other": "Wasser & weitere Getränke"
  },
  categories: {
    sparkling: "Schaumweine", champagne: "Champagner", white: "Weißweine",
    orange: "Orange Weine", red: "Rotweine", rose: "Roséweine",
    dessert: "Dessertweine", vodka: "Wodka", gin: "Gin", vermouth: "Wermut",
    "tequila-mezcal": "Tequila & Mezcal", whisky: "Whisky", rum: "Rum",
    cognac: "Cognac", shochu: "Shochu", rakija: "Rakija (Obstbrand)", grappa: "Grappa",
    liqueur: "Liköre", beer: "Bier", water: "Mineralwasser", tonic: "Tonic Water",
    juice: "Säfte & Softdrinks", coffee: "Kaffee"
  },
  countries: { HR: "Kroatien", DE: "Deutschland", AT: "Österreich", FR: "Frankreich", IT: "Italien", ES: "Spanien", SI: "Slowenien", US: "USA", CN: "China" },
  styles: {
    sparkling: "Schaumwein · frisch und trocken", sparkling_rose: "Rosé-Schaumwein",
    champagne: "Champagner · klassischer Brut", champagne_bdb: "Champagner · Blanc de Blancs",
    champagne_rose: "Rosé-Champagner", champagne_prestige: "Prestige-Champagner · komplex und reif",
    white_fresh: "Weiß · frisch und fruchtig", white_aromatic: "Weiß · aromatisch",
    white_mineral: "Weiß · mineralisch und präzise", white_rich: "Weiß · reich und cremig",
    orange: "Orange · maischevergoren", rose: "Rosé · frisch und leicht",
    red_light: "Rot · leicht und elegant", red_medium: "Rot · mittelkräftig",
    red_full: "Rot · vollmundig und kraftvoll", red_mature: "Rot · gereift, entwickelte Tertiäraromen",
    sweet: "Süß · Dessertwein"
  },
  bodies: { light: "leicht", medium: "mittel", full: "vollmundig" },
  aromas: {
    almond: "Mandel", apricot: "Aprikose", balsamic: "balsamische Noten", blackberry: "Brombeere",
    blackcurrant: "schwarze Johannisbeere", brioche: "Brioche", butter: "Butter", candied_fruit: "kandierte Früchte",
    caramel: "Karamell", cedar: "Zeder", cherry: "Kirsche", chocolate: "Schokolade",
    citrus: "Zitrus", coffee: "Kaffee", dried_fruit: "Trockenfrüchte", earth: "erdige Noten",
    elderflower: "Holunderblüte", fig: "Feige", flint: "Feuerstein", forest_floor: "Waldboden",
    grapefruit: "Grapefruit", grass: "frisches Gras", green_apple: "grüner Apfel", hazelnut: "Haselnuss",
    herbs: "mediterrane Kräuter", honey: "Honig", leather: "Leder", licorice: "Lakritz",
    lime: "Limette", mineral: "Mineralität", mint: "Minze", orange_peel: "Orangenschale",
    peach: "Pfirsich", pear: "Birne", pepper: "Pfeffer", petrol: "Petrolnote",
    plum: "Pflaume", quince: "Quitte", raisin: "Rosinen", raspberry: "Himbeere",
    red_apple: "roter Apfel", red_currant: "rote Johannisbeere", rose: "Rose", saline: "Salzigkeit",
    smoke: "Rauch", sour_cherry: "Sauerkirsche", spice: "Gewürze", strawberry: "Erdbeere",
    toast: "Röstbrot", tobacco: "Tabak", tropical: "tropische Früchte", truffle: "Trüffel",
    vanilla: "Vanille", violet: "Veilchen", walnut: "Walnuss", wet_stone: "nasser Stein",
    white_flowers: "weiße Blüten", yeast: "Hefe"
  },
  pairings: {
    aperitif: "Aperitif", asian: "asiatische Küche", asparagus: "Spargel", bbq: "Gegrilltes",
    beef: "Rind", caviar: "Kaviar", charcuterie: "Wurstwaren", cheese_blue: "Blauschimmelkäse",
    cheese_fresh: "Frischkäse", cheese_hard: "gereifter Käse", chocolate: "Schokolade",
    desserts: "Desserts", foie_gras: "Foie gras", fruit_desserts: "Fruchtdesserts", game: "Wild",
    grilled_fish: "gegrillter Fisch", lamb: "Lamm", light_starters: "leichte Vorspeisen",
    mushrooms: "Pilze", nuts: "Nüsse", oysters: "Austern", pasta: "Pasta",
    pizza: "Pizza", pork: "Schwein", poultry: "Geflügel", prosciutto: "Rohschinken",
    risotto: "Risotto", salads: "Salate", seafood: "Meeresfrüchte", shellfish: "Schalentiere",
    solo: "pur genießen, für besondere Momente", spicy: "scharfe Gerichte", steak: "Steak",
    stews: "Schmorgerichte", sushi: "Sushi", truffles: "Trüffelgerichte",
    veal: "Kalb", vegetables: "Gemüse", white_fish: "weißer Fisch", white_meat: "helles Fleisch"
  }
}
};
