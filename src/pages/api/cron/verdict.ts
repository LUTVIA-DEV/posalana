import type { APIContext } from "astro";
import db from "../../../db/index.js";
import { maybeSendAutoVerdict } from "../../../utils/schedule.js";

// Red de seguridad para el veredicto automático: lo llama la tarea programada
// de Coolify a las 16:00 UTC. Si alguien ya visitó la app después del cierre, el
// veredicto ya salió y esto no hace nada.
export async function GET(context: APIContext): Promise<Response> {
    const secret = process.env.CRON_SECRET;
    if (secret && context.request.headers.get("authorization") !== `Bearer ${secret}`) {
        return new Response("No autorizado", { status: 401 });
    }

    try {
        const result = await maybeSendAutoVerdict(db);
        return new Response(JSON.stringify({ result }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message || "Error interno del servidor" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
