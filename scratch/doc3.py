# -*- coding: utf-8 -*-
"""CLAUDE.md for the third 2026-08-02 round. One-shot."""

OLD_HELPER_START = '**The second question is "a glass or a bottle?"**'
OLD_HELPER_END = 'which is both true and the name that shelf already has.'

NEW_HELPER = '''**One list at a time, and the glass offered quietly.** This took three goes and
the first two are worth remembering as things not to do again.

  1. It searched `bottle-*` only, so it could answer nothing but a whole
     bottle - useless to the guest most likely to ask (one person, one dish),
     and it ignored the shelf the owner curates hardest: 28% of the
     by-the-glass pours are picks against 9% of the bottles.
  2. So it showed two glasses *and* three bottles under two headings. The owner
     called it "super confusing": the step said "boca" three times, then the
     answer showed bottles and then a glass, and the glass was the same wine
     under every price band - because a bottle budget says nothing about a
     glass. It read as an error.

What stuck: **the budget question is the four bands it always was, and the
answer is three bottles and nothing else.** The glass appears two ways, neither
of them a second list:

  - **on the row**, when the suggested bottle is also poured by the glass -
    `🍷 i na cašu 8 €` under the producer. 24 of the 32 pours are sold both
    ways, and at least one of the three suggestions carries the line in 57% of
    dish x band combinations. It upsells the wine the guest is already reading,
    which is the only upsell that does not feel like one.
  - **one link underneath** - "Radije na cašu?" - which flips the whole answer
    to four pours, and back. `helperState.mode`, reset to bottle whenever the
    helper opens.

`GLASS_PRICE` memoises producer|name -> glass price and **must be cleared
whenever DATA is rebuilt** (both the initial load and every poll), because a
wine can be 86'd off one shelf and not the other - and an advertised glass that
is not being poured is worse than no offer.

"Bez ogranicenja" stays, wording and behaviour both: it means spare no expense
and shows the 500 EUR+ Ikone. It was renamed to "Ikone (500 EUR+)" for exactly
one round on the grounds that the label did not describe the filter; the owner
had asked for both explicitly and asked for them back. Do not rename it again.

'''

OLD_SEARCH = '''**The flavour half is labelled on screen.** The owner asked whether aromas
belong in search at all, and the honest answer is that they do - but a guest
who typed "orange" and got 45 rows had no way to know the first twelve were the
answer and the rest merely smell of it. A divider (`ui.byFlavour`) between the
two halves is the whole fix, and it only appears when both halves have content,
so the common single-sense query stays clean.'''

NEW_SEARCH = '''**Both halves are labelled, and both carry a count.** The owner asked whether
aromas belong in search at all; they do, but a guest who typed "orange" and got
45 rows had no way to know the first twelve were the answer and the rest merely
smell of it. Labelling only the second half fixed that and created the next
question - what is the *first* group, then? So now:

    REZULTATI                  12
    PO AROMI I SLJUBLJIVANJU   33

A count explains a group better than a noun does, and it dodges Slavic plural
agreement completely: "Rezultati · 12" needs no concord, while "12 vina / 1
vino / 21 vino" needs three rules and gets one of them wrong. Headings are
always on, so the layout is something a guest learns once.'''

RIGHTS = '''## Copyright, and what is actually protectable (2026-08-02)

The repo is **public** - GitHub Pages on the free plan requires it - and every
data file is one request away: wines.json 458 kB, producers.json 258 kB,
i18n.js 118 kB. A complete copy takes about a second. There is no technical fix
for that; anything a browser renders, a scraper takes.

So the answer is a notice, in every place a notice is read:

  - `LICENSE` - all rights reserved, and specific about *what*. The clause that
    does the real work is the **sui generis database right** (Directive
    96/9/EC): it protects the substantial investment in obtaining, verifying
    and presenting the contents, independently of copyright in the texts, and
    it forbids repeated extraction of insubstantial parts as well as one big
    grab. Croatia is in the EU, so this is the strongest instrument available.
  - **Text and data mining reserved** under Art. 4(3) of Directive (EU)
    2019/790, which only works if the reservation is *machine-readable*. Hence
    all three of `robots.txt`, `/.well-known/tdmrep.json` and the
    `tdm-reservation` meta element - and the crawler list in robots.txt names
    GPTBot, ClaudeBot, CCBot, Google-Extended and the rest by name while
    leaving ordinary search engines allowed, because guests still need to find
    the restaurant.
  - `ui.copyright` - one line under the footer, in all eight languages.

None of it stops a copy. All of it turns "found it online" into a documented
one, which is the difference between having a case and not.

Worth being clear about what the asset is. The wine list copies badly - a
competitor gets wines they do not stock at prices they do not charge against a
menu they do not cook. What is genuinely reusable is the *engine*: 226 aroma
keys and 65 pairing keys in eight languages, the region ladders, the glass
research, the structure. That is what the database right is for.

Do not "improve" this with obfuscation or a bundler. It buys minutes against a
copier and costs the no-build design that makes a price edit live in a minute.

'''

p = 'CLAUDE.md'
s = open(p, 'rb').read().decode('utf-8')
nl = '\r\n' if '\r\n' in s else '\n'

i = s.index(OLD_HELPER_START.replace('\n', nl))
j = s.index(OLD_HELPER_END) + len(OLD_HELPER_END)
s = s[:i] + NEW_HELPER.replace('\n', nl).rstrip() + s[j:]

assert OLD_SEARCH.replace('\n', nl) in s, "search block not found"
s = s.replace(OLD_SEARCH.replace('\n', nl), NEW_SEARCH.replace('\n', nl), 1)

# Replace the older, thinner rights section wholesale.
a = s.index("## Copyright, and what is actually protectable (2026-08-02)")
b = s.index("## Windows environment notes")
s = s[:a] + RIGHTS.replace('\n', nl) + s[b:]

open(p, 'wb').write(s.encode('utf-8'))
print("ok")
