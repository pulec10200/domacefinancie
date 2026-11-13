# Prvé spustenie Domácich financií

Overené balíky verzie **1.0.0-rc.1**: [Windows](https://github.com/pulec10200/domacefinancie/actions/runs/43479699912/artifacts/14064667713) · [Linux](https://github.com/pulec10200/domacefinancie/actions/runs/43479699912/artifacts/14064204557). Stiahni a rozbaľ ZIP. [Výsledky overenia](https://github.com/pulec10200/domacefinancie/actions/runs/43479699912) sú úspešné na oboch systémoch.

1. Na stránke [zostavení](https://github.com/pulec10200/domacefinancie/actions) otvor najnovšie úspešné zostavenie. Dole v časti **Artifacts** stiahni **desktop-Windows** alebo **desktop-Linux** a rozbaľ ZIP.
2. **Windows:** spusti inštalátor `.exe` a postupuj podľa sprievodcu. **Ubuntu/Debian:** otvor `.deb` cez správcu softvéru. **AppImage:** povoľ spúšťanie súboru vo vlastnostiach a otvor ho. Balíky zatiaľ nemajú vydavateľský digitálny podpis.
3. Po otvorení je aplikácia prázdna. V **Účty** pridaj svoj účet a počiatočný zostatok. V **Transakcie** zapisuj príjmy, výdavky a prevody. Aplikácia nekomunikuje s bankou.
4. V **Kategórie** môžeš vytvoriť strom kategórií; v **Rozpočty** nastav mesačné limity. Súčet nadradenej kategórie zahŕňa aj podradené kategórie.
5. V **Majetok** pridaj napríklad byt alebo auto. V **Zmluvy a poistky** eviduj zmluvu a jej skutočné termíny. V **Povinnosti** vytvor opakovanie, prípadne očakávaný príjem. Úhrada je samostatná operácia a môže byť čiastočná.
6. V **Dokumenty** importuj PDF/fotografiu alebo vyber **Sledovať priečinok**. Môže ísť aj o priečinok synchronizovaný cez Drive/OneDrive. Originály sa nemenia. Po spracovaní otvor **Náhľad vedľa údajov**, skontroluj sumu, dátum a typ. Chýbajúce údaje doplň podľa originálu. Faktúru môžeš priradiť k existujúcej očakávanej platbe; bloček potrebuje účet. Zmluva môže vytvoriť aj pravidelnú povinnosť. Finančný zápis vzniká až potvrdením.
7. **eKasa:** automatické overenie nie je zapnuté. Otvor oficiálne **Over doklad**, porovnaj výsledok a v aplikácii ulož výsledok ručnej kontroly. QR kód ani OCR samy nepotvrdzujú pravosť.
8. **AI modely** sú voliteľné. Základ funguje bez nich. Ak ich chceš použiť, zadaj vlastný model/kľúč alebo lokálnu Ollamu, limity a priradenie úloh. Pred odoslaním dokumentu uvidíš poskytovateľov a musíš ho povoliť. Podrobnosti sú v AI_PROVIDERS.md.
9. V **Nastavenia** uprav upozornenia. Voliteľne zapni režim na pozadí a štart po prihlásení. Pri úplne vypnutej aplikácii sa upozornenia nedoručujú; nezaplatené povinnosti zostanú viditeľné pri ďalšom štarte.
10. Vytvor **kompletnú zálohu na inom disku/priečinku**. JSON export nezahŕňa originály ani API kľúče. Obnovu vyberáš v Nastaveniach; pred reštartom sa kontroluje integrita a pôvodný dátový profil zostáva zachovaný. Záloha obsahuje citlivé dokumenty, preto ju chráň.

Na bežné používanie netreba Git, Node.js, Python, Google účet ani predplatné AI. Projekt na GitHube je zdrojový kód a inštalátory; svoje osobné financie doň nenahrávaj.
