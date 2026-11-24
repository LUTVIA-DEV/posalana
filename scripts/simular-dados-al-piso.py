"""
Simulación de «se cayó un dado al piso» 🚫 (ver src/utils/drop.ts).

Chance fija por tirada: en la primera tirada del día de cada jugador hay una chance p
de que se caiga un dado al piso, la misma para todos, con tope de 2 caídas por día
(y una por jugador). Por defecto p = 1 − (1 − 0,9)^(1/n), con n el piso de
asistencia (7 jugadores), así hasta en un día flojo hay ~90 % de chance de al menos una
caída. Asistencia real del equipo: entre 7 y 11 jugadores por día, que llegan en
cualquier orden.

Uso: python scripts/simular-dados-al-piso.py
"""
import random
from math import comb

random.seed(11)
TARGET = 0.9
FLOOR = 7
P = 1 - (1 - TARGET) ** (1 / FLOOR)
CAP = 2


def distribution(n, p):
    """Probabilidad exacta de 0, 1 y 2 caídas con n tiradas y tope de 2 (binomial cortada)."""
    exact = [comb(n, k) * p**k * (1 - p) ** (n - k) for k in range(CAP)]
    return exact + [1 - sum(exact)]


def simulate(days=40000):
    drops = 0
    perday = [0, 0, 0, 0]
    bypos, cntpos = {}, {}
    for _ in range(days):
        n = random.randint(7, 11)
        fallen = 0
        for k in range(1, n + 1):
            cntpos[k] = cntpos.get(k, 0) + 1
            if fallen < CAP and random.random() < P:
                fallen += 1
                bypos[k] = bypos.get(k, 0) + 1
        drops += fallen > 0
        perday[fallen] += 1
    print(f"Simulación: {days} días con 7 a 11 jugadores, p = {P * 100:.1f} %")
    print(f"  días con al menos una caída: {drops / days * 100:.1f} %")
    print("  caídas por día: " + " ".join(f"{c}: {perday[c] / days * 100:.1f} %" for c in range(CAP + 1)))
    print("  chance por posición de llegada: " + " ".join(f"{k}.º {bypos.get(k, 0) / cntpos[k] * 100:.1f} %" for k in sorted(cntpos)))


print(f"p = 1 − 0,1^(1/{FLOOR}) = {P * 100:.1f} %\n")
print("| n | al menos una | 0 | 1 | 2 |")
print("|---|---|---|---|---|")
for n in (7, 9, 11):
    d = distribution(n, P)
    print(f"| {n} | {(1 - d[0]) * 100:.1f} % | " + " | ".join(f"{x * 100:.1f} %" for x in d) + " |")
print()
simulate()
