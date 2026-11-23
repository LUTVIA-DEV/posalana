"""
Simulación de «se cayeron los dados al piso» 🫣 (ver src/utils/drop.ts).

Sorteo previo: cada día se elige un jugador entre los habituales, con peso igual a su
asistencia en los últimos 20 días de juego, y se le caen los dados en su primera
tirada (si ese día no tira, no hay caída). Equipo realista: 10 jugadores con
asistencia del 50 al 95 % y horarios de costumbre. Compara con el sorteo uniforme.

Uso: python scripts/simular-dados-al-piso.py
"""
import random

random.seed(11)
ATT = [0.95, 0.92, 0.9, 0.88, 0.85, 0.8, 0.75, 0.7, 0.6, 0.5]
HAB = [620, 640, 650, 660, 670, 680, 690, 700, 705, 712]  # hora típica (madrugador → tardío)
WINDOW = 20


def run(weighted, habits=True, days=40000):
    history = []  # jugadores de cada día de juego
    drops = 0
    bypos, cntpos = {}, {}
    byp, plp = [0] * len(ATT), [0] * len(ATT)
    for _ in range(days):
        recent = history[-WINDOW:]
        att = [sum(i in day for day in recent) for i in range(len(ATT))]
        if weighted and sum(att) > 0:
            chosen = random.choices(range(len(ATT)), weights=att)[0]
        else:
            chosen = random.randrange(len(ATT))
        players = [i for i, a in enumerate(ATT) if random.random() < a]
        order = [i for _, i in sorted(((random.gauss(HAB[i], 25) if habits else random.random()), i) for i in players)]
        for k, i in enumerate(order, 1):
            cntpos[k] = cntpos.get(k, 0) + 1
            plp[i] += 1
            if i == chosen:
                bypos[k] = bypos.get(k, 0) + 1
                byp[i] += 1
        drops += chosen in players
        if players:
            history.append(set(players))
    pos = " ".join(f"{k}:{bypos.get(k, 0) / cntpos[k] * 100:.1f}%" for k in sorted(cntpos) if cntpos[k] > days * 0.02)
    pl = " ".join(f"{byp[i] / plp[i] * 100:.1f}%" for i in range(len(ATT)))
    name = ("ponderado por asistencia" if weighted else "uniforme") + ("" if habits else ", llegada al azar")
    print(f"{name}: días con caída {drops / days * 100:.1f}%\n  chance por tirada según llegada: {pos}\n  chance por tirada según jugador (asiste 95 % → 50 %): {pl}")


# Con costumbres, los que más asisten también suelen llegar temprano: eso inclina el
# reparto por llegada aunque el sorteo no mire el orden. Con llegada al azar queda plano.
run(True)
run(True, habits=False)
run(False)
