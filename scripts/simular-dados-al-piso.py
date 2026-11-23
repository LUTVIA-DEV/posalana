"""
Simulación de «se cayeron los dados al piso» 🫣 (ver src/utils/drop.ts).

Chance fija por tirada: en la primera tirada del día de cada jugador hay una chance p
de que se caigan los dados, la misma para todos, con tope de una caída por día.
p = 1 − (1 − TARGET)^(1/n), con n la mediana de jugadores por día de los últimos 20
días de juego, acotada a [P_MIN, P_MAX]. Equipo realista: 10 jugadores con asistencia
del 50 al 95 % que llegan en orden al azar.

Uso: python scripts/simular-dados-al-piso.py
"""
import random

random.seed(11)
ATT = [0.95, 0.92, 0.9, 0.88, 0.85, 0.8, 0.75, 0.7, 0.6, 0.5]
WINDOW = 20
TARGET = 0.9
P_MIN, P_MAX = 0.05, 0.5


def median(xs):
    xs = sorted(xs)
    return xs[len(xs) // 2] if len(xs) % 2 else (xs[len(xs) // 2 - 1] + xs[len(xs) // 2]) / 2


def run(days=40000):
    history, drops = [], 0
    bypos, cntpos = {}, {}
    for _ in range(days):
        n = median(history[-WINDOW:]) if history else len(ATT)
        p = min(P_MAX, max(P_MIN, 1 - (1 - TARGET) ** (1 / n)))
        players = [i for i, a in enumerate(ATT) if random.random() < a]
        random.shuffle(players)
        dropped = False
        for k, _ in enumerate(players, 1):
            cntpos[k] = cntpos.get(k, 0) + 1
            if not dropped and random.random() < p:
                dropped = True
                bypos[k] = bypos.get(k, 0) + 1
        drops += dropped
        if players:
            history.append(len(players))
    pos = " ".join(f"{k}:{bypos.get(k, 0) / cntpos[k] * 100:.1f}%" for k in sorted(cntpos) if cntpos[k] > days * 0.02)
    print(f"p ≈ {p * 100:.1f}% por tirada (n = {n}) | días con caída {drops / days * 100:.1f}%\n  chance por posición de llegada: {pos}")


run()
