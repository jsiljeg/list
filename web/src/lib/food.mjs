/* The words a pairing tag is printed as.
 *
 * Shared so the generator can check it: a key with no word here used to
 * fall through to the raw tag with underscores swapped for spaces, which
 * is how `steak` reached a Croatian page as "steak". build-pairings.mjs
 * now fails on a missing key rather than printing one. */
export const FOOD = {
  salads: "salate", cheese_fresh: "svježi sirevi", cheese_aged: "zreli sirevi",
  vegetables: "povrće", mushrooms: "gljive", truffles: "tartufi",
  white_fish: "bijela riba", grilled_fish: "riba s roštilja", oysters: "kamenice",
  shellfish: "školjke", seafood: "plodovi mora", sushi: "sushi",
  smoked_fish: "dimljena riba", caviar: "kavijar",
  white_meat: "bijelo meso", poultry: "perad", pork: "svinjetina",
  veal: "teletina", beef: "govedina", lamb: "janjetina", game: "divljač",
  charcuterie: "suhomesnato", prosciutto: "pršut", duck: "patka",
  pasta: "tjestenina", risotto: "rižoto", truffle_pasta: "jela s tartufima",
  light_starters: "lagana predjela", aperitif: "aperitiv", asian: "azijska jela",
  spicy: "začinjeno", desserts: "deserti", fruit_desserts: "voćni deserti",
  dark_chocolate: "tamna čokolada", foie_gras: "foie gras",
  pasticada: "pašticada", grilled_meat: "meso s roštilja",
  cheese_hard: "tvrdi sirevi",
  nuts: "orašasti plodovi",
  steak: "biftek",
  stews: "variva",
};

export const food = (k) => FOOD[k] || k.replace(/_/g, " ");
