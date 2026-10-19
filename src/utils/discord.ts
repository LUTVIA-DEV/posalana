import { colorLutviaEntero } from "./tokens.js";

// Dirección pública del sitio, para los enlaces y el avatar del bot en Discord
const SITE_URL = (process.env.SITE_URL || "https://posalana.lutvia.com").replace(/\/$/, "");
const BOT_AVATAR_URL = `${SITE_URL}/bot-avatar.png`;

export async function sendDiscordRoll(
    displayName: string,
    dice: number[],
    lomitoActivated: boolean,
    lomitoPlayers: string[]
) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
        console.warn("DISCORD_WEBHOOK_URL is not configured.");
        return;
    }

    const diceStr = dice.join(" - ");
    let content = "";
    let embeds: any[] = [];

    if (lomitoActivated && lomitoPlayers.length > 0) {
        // Lomito Alert!
        content = "🥪🔥 @here **¡CLÁUSULA LOMITO ACTIVADA!** 🔥🥪";
        embeds = [{
            title: "🥪 ¡Se rompió la matrix de la suerte! 🥪",
            description: `¡La profecía se ha cumplido! **${lomitoPlayers.join(" y ")}** han sacado exactamente la misma tirada:\n👉 **${diceStr}**\n\n¡Hoy se festeja almorzando unos **LOMITOS CON PAPAS** patrocinados por **LUTVIA**! 🍟🤤🥪`,
            color: colorLutviaEntero("violeta"),
            footer: {
                text: "POSALANA • Cláusula Lomito 🥪"
            },
            timestamp: new Date().toISOString()
        }];
    } else {
        // Dynamic commentary based on the first die (d1), which defines sorting in POSALANA
        const d1 = dice[0];
        const d2 = dice[1];
        const d3 = dice[2];
        const d4 = dice[3];

        let commentary = "";
        if (d1 === 1 && d2 === 1 && d3 === 1 && d4 === 1) {
            commentary = "💀 *¡EL PEOR TIRO ABSOLUTO! Cuatro unos. Vayan buscando la esponja...*";
        } else if (d1 === 6 && d2 === 6 && d3 === 6 && d4 === 6) {
            commentary = "👑 *¡EL TIRO PERFECTO! Cuatro seis. Esto es un milagro absoluto.*";
        } else if (d1 <= 2) {
            commentary = `😰 *¡Zona de peligro! Ese primer dado (${d1}) da mucho frío...*`;
        } else if (d1 >= 5) {
            commentary = `😎 *¡Qué tranquilidad! Arrancar con un ${d1} es casi zafar seguro.*`;
        } else {
            commentary = `⚖️ *Tirada decente (primer dado: ${d1}). A cruzar los dedos para que otros saquen menos.*`;
        }

        // Standard notification
        embeds = [{
            title: "🎲 ¡El destino en juego! Nueva tirada",
            description: `**${displayName}** arrojó los dados de la suerte y obtuvo:\n👉 **${diceStr}**\n\n${commentary}\n\n🔗 ¿Y vos? ¿Zafás o lavás? Medí tu suerte en la [App de POSALANA](${SITE_URL}/)`,
            color: colorLutviaEntero("cyan"),
            footer: {
                text: "POSALANA • Suerte del Día 🎲"
            },
            timestamp: new Date().toISOString()
        }];
    }

    try {
        const res = await fetch(webhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ content, embeds, avatar_url: BOT_AVATAR_URL })
        });
        if (!res.ok) {
            console.error("Failed to send Discord notification:", await res.text());
        }
    } catch (err) {
        console.error("Error sending Discord notification:", err);
    }
}

export async function sendDiscordVerdict(
    dateStr: string,
    choresAssigned: {
        lava: string[];
        saca: string[];
        pone: string[];
        zafaron: string[];
        exentos: string[];
    },
    playersCount: number,
    automatic = false
): Promise<"ok" | "no-webhook" | "error"> {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
        console.warn("DISCORD_WEBHOOK_URL is not configured.");
        return "no-webhook";
    }

    const poneStr = choresAssigned.pone.length > 0 ? choresAssigned.pone.join(", ") : "Nadie";
    const sacaStr = choresAssigned.saca.length > 0 ? choresAssigned.saca.join(", ") : "Nadie";
    const lavaStr = choresAssigned.lava.length > 0 ? choresAssigned.lava.join(", ") : "Nadie";
    const zafaronStr = choresAssigned.zafaron.length > 0 ? choresAssigned.zafaron.join(", ") : "Ninguno";
    const exentosStr = choresAssigned.exentos.length > 0 ? choresAssigned.exentos.join(", ") : "Ninguno";

    const embed = {
        title: `📜 EL DECRETO DIARIO - ${dateStr}${automatic ? " · ⏰ MESA CERRADA" : ""}`,
        description: `🚨 **¡ATENCIÓN JUGADORES!** El destino ha hablado y las sentencias de hoy son definitivas e inapelables.\n\n## 🎲 ${playersCount} ${playersCount === 1 ? "jugador tiró" : "jugadores tiraron"} hoy\n\nAquí tienen la distribución oficial de tareas de la mesa para hoy:\n\n🍽️ **PO:** **${poneStr}**\n🗑️ **SA:** **${sacaStr}**\n🧽 **LA:** **${lavaStr}**\n🎉 **NA:** **${zafaronStr !== "Ninguno" ? zafaronStr : "Ninguno"}**\n🛡️ **EXENTOS HOY:** **${exentosStr !== "Ninguno" ? exentosStr : "Ninguno"}**\n\n👉 *¿Querés apelar con tus estadísticas?* Entrá a la [App de POSALANA](${SITE_URL}/)`,
        color: colorLutviaEntero("rosa"),
        footer: {
            text: automatic
                ? "POSALANA • Veredicto automático al cierre de la tirada ⏰"
                : "POSALANA • El veredicto del destino 📜"
        },
        timestamp: new Date().toISOString()
    };

    try {
        const res = await fetch(webhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ embeds: [embed], avatar_url: BOT_AVATAR_URL })
        });
        if (!res.ok) {
            console.error("Failed to send Discord verdict:", await res.text());
            return "error";
        }
        return "ok";
    } catch (err) {
        console.error("Error sending Discord verdict:", err);
        return "error";
    }
}
