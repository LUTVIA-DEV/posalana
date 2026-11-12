import type { APIContext } from "astro";
import db from "../../../db/index.js";

// Marca que el usuario ya cerró el pop-up del trailer, para que no le vuelva a salir.
export async function POST(context: APIContext): Promise<Response> {
	if (!context.locals.session || !context.locals.user) {
		return new Response("No autorizado", { status: 401 });
	}

	try {
		await db.execute({
			sql: "UPDATE user SET trailer_visto = 1 WHERE id = ?",
			args: [context.locals.user.id]
		});
		return new Response(null, { status: 204 });
	} catch (e) {
		console.error("No se pudo marcar el trailer como visto:", e);
		return new Response("Error al guardar", { status: 500 });
	}
}
