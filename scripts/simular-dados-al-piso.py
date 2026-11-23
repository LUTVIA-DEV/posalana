"""
Simulación de «se cayeron los dados al piso» 🫣 (ver src/utils/drop.ts).

Equipo realista: 10 jugadores con asistencia del 50 al 95 %, cada uno con su hora de
costumbre, y un 12 % de tiradas en la última media hora. Ventana 10:00–12:30 y red de
seguridad 30 minutos antes del cierre. Compara percentiles de asistencia para N.

Uso: python scripts/simular-dados-al-piso.py
"""
import random

random.seed(11)
ATT = [0.95, 0.92, 0.9, 0.88, 0.85, 0.8, 0.75, 0.7, 0.6, 0.5]
HAB = [620, 640, 650, 660, 670, 680, 690, 700, 705, 712]  # hora típica en minutos (madrugador → tardío)
START, END = 600, 750
CUT = END - 30  # red de seguridad


def arrival(i):
    if random.random() < 0.12:
        return random.uniform(CUT, END)
    return min(CUT - 1, max(START, random.gauss(HAB[i], 20)))


def percentile(xs, p):
    xs = sorted(xs)
    return xs[max(0, min(len(xs) - 1, round(p * (len(xs) - 1))))]


def run(p, days=40000, window=20):
    hist, drops = [], 0
    bypos, cntpos = {}, {}
    byp, plp = [0] * len(ATT), [0] * len(ATT)
    for _ in range(days):
        players = [i for i, a in enumerate(ATT) if random.random() < a]
        times = sorted((arrival(i), i) for i in players)
        n = percentile(hist[-window:], p) if len(hist) >= 5 else len(ATT)
        dropped = False
        for k, (t, i) in enumerate(times, 1):
            cntpos[k] = cntpos.get(k, 0) + 1
            plp[i] += 1
            if dropped:
                continue
            chance = 1 if t >= CUT else 1 / (max(n, k) - k + 1)
            if random.random() < chance:
                dropped = True
                bypos[k] = bypos.get(k, 0) + 1
                byp[i] += 1
        drops += dropped
        if players:
            hist.append(len(players))
    pos = " ".join(f"{k}:{bypos.get(k, 0) / cntpos[k] * 100:.0f}%" for k in sorted(cntpos) if cntpos[k] > days * 0.02)
    pl = " ".join(f"{byp[i] / plp[i] * 100:.0f}%" for i in range(len(ATT)))
    print(f"p{int(p * 100)}: días con caída {drops / days * 100:.2f}% | por llegada {pos} | por jugador {pl}")


for p in (0.5, 0.2, 0.1):
    run(p)
