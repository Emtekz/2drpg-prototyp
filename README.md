# Eichenhain – 2D-Fantasy-RPG-Prototyp

Ein spielbarer Browser-Prototyp als Vorlage für die spätere Umsetzung in **Godot**.
Er läuft am Laptop (Tastatur) und auf Handy/Tablet (Touch-Steuerung).

## Starten

```bash
node server.js
```

Dann im Browser `http://localhost:8080` öffnen.
Vom Handy im selben WLAN: `http://<IP-des-Laptops>:8080` (die IP findest du mit `ipconfig`).

## Inhalt

| Feature | Umsetzung im Prototyp |
|---|---|
| Zonen wie bei Pokémon | 4 Zonen: Dorf Eichenhain → Blumenwiese (Ost), Flüsterwald (Nord) → Kristallhöhle |
| Freie Bewegung | Rasterbewegung mit flüssigem Übergang, Kamera folgt dem Spieler |
| Zufallskämpfe | Im hohen Gras bzw. auf dunklem Höhlenboden |
| Rundenkampf | Angriff, Magie (4 Fähigkeiten, nach Level freigeschaltet), Items, Verteidigen, Flucht; Gift, Ausweichen, Krits, Lebensraub, Boss mit Aufladeangriff |
| Sammeln | Kräuter, Bäume (Axt), Erz und Kristalle (Spitzhacke), wachsen nach 45 s nach; Gegner lassen Material fallen |
| Handwerk | 15 Rezepte an der Werkbank (Dorf) oder am Lagerfeuer (Wald) |
| Kaufen/Verkaufen | Händlerin im Dorf |
| Fortschritt | EP und Level, 3 Ausrüstungsplätze, Truhen, Endboss, Speicherstand im Browser |

## Steuerung

- **Laptop:** Pfeiltasten/WASD · Leertaste/E/Enter = interagieren · M/Esc = Menü · im Kampf Tasten 1–5
- **Touch:** Steuerkreuz links, A-Knopf rechts, ☰ oben rechts

## Dateien → spätere Godot-Struktur

| Prototyp | Godot-Entsprechung |
|---|---|
| `js/data.js` – Items, Rezepte, Gegner, Zonen | `Resource`-Klassen (`ItemData.tres`, `EnemyData.tres`, `Recipe.tres`) oder JSON |
| Zonen-Karten (Text-Raster) | Eine Szene pro Zone mit `TileMapLayer`; Objekte als eigene Nodes |
| `js/state.js` – Spielstand, Werte, Inventar | Autoload-Singleton `GameState.gd`, Speichern über `FileAccess` + JSON |
| `js/world.js` – Bewegung, Interaktion | `Player.tscn` (`CharacterBody2D` + `Tween` von Kachel zu Kachel), `RayCast2D` zum Interagieren, `Area2D` für Ausgänge und hohes Gras |
| `js/battle.js` – Kampfablauf | `Battle.tscn`, Ablauf mit `await` / Signals als State-Machine |
| `js/ui.js` – HUD, Dialog, Menüs, Shop | `CanvasLayer` mit `Control`-Nodes (`TabContainer`, `ItemList`, `RichTextLabel`) |
| Touch-Steuerung | `TouchScreenButton` oder virtueller Joystick, Input-Map-Aktionen `move_*`, `interact`, `menu` |

Tipp: In Godot das Projekt auf *Web* exportieren und mit „Stretch Mode: canvas_items“ arbeiten, dann läuft es ebenfalls im Browser auf Laptop und Handy.
