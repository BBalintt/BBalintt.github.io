# 2D Dungeon Generator & Portfolio

Ez a projekt a személyes portfólióoldalam és egy interaktív, böngészőben futtatható 2D dungeon (kazamata) generátor és szerkesztő, amely kifejezetten asztali szerepjátékokhoz (pl. D&D, VTT rendszerek) készült.

## 🌐 Elérhetőség

Az alkalmazás semmilyen külön telepítést nem igényel, közvetlenül a böngésződből futtatható a következő linken:
👉 **[https://bbalintt.github.io/](https://bbalintt.github.io/)**

A weboldal főoldalán a szakmai önéletrajzom és portfólióm érhető el, míg a kazamakészítő modul a projektek közül vagy a dedikált aloldalról indítható.

## 🚀 Főbb Jellemzők

- **Böngészőalapú futtatás:** Nincs szükség szerverre vagy letöltésre, tisztán kliensoldali JavaScript/TypeScript technológiára épül.
- **Dungeon Generálás & Szerkesztés:** Csempealapú (tile-based) renderelőmotor szabványos 32px-es rácsmérettel.
- **Kézi és Automatikus Portálkezelés (Ajtók):** 
  - Egyedi ajtók elhelyezése és törlése a szerkesztőfelületen.
  - Automatikus rácshoz illeszkedés és intelligens átfedés-szűrés.
- **Tökéletes Fájlkezelés & Export:** 
  - Teljes körű **Universal VTT (`.dd2vtt`)** import és export támogatás.
  - A kézzel elhelyezett ajtók alól a kód automatikusan eltávolítja a falakat (`line_of_sight`), így azok teljesen járhatóvá válnak a VTT szoftverekben (pl. Owlbear Rodeo, Foundry).
  - Tiszta képmentés (a szerkesztői segédvonalak nélkül).
- **Vizuális Stílusok:** Választható rögös/sziklás (`rocky`) vagy simított (`smooth`) fali textúrák, egyedi csempe- és háttérkép-kezeléssel.

## 🛠️ Technológiai Halmaz

- **Nyelv:** JavaScript / TypeScript
- **Grafika:** HTML5 Canvas API
- **Formátum:** Universal VTT (`.dd2vtt`) JSON szabvány
- **Környezet:** GitHub Pages (statikus tárhely)

## 💻 Használat

1. Nyisd meg a [weboldalt](https://bbalintt.github.io/).
2. Navigálj a dungeon generator felületre.
3. Hozz létre vagy tölts be egy térképet, szerkeszd a falakat és helyezz el ajtókat a szerkesztőben.
4. Exportáld ki a `.dd2vtt` fájlt, amelyet azonnal betölthetsz a kedvenc virtuális asztali szerepjáték (VTT) programodba!
