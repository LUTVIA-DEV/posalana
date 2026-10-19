import type { APIRoute } from "astro";
import db from "../../../db/index.js";
import { isValidDate, isValidTime, timeToMinutes } from "../../../utils/schedule.js";

async function setSetting(key: string, value: string) {
	await db.execute({
		sql: "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
		args: [key, value]
	});
}

export const POST: APIRoute = async ({ request, locals }) => {
	const user = locals.user;

	if (!user || user.role !== "admin") {
		return new Response("Unauthorized", { status: 403 });
	}

	let formData;
	try {
		formData = new URLSearchParams(await request.text());
	} catch (e) {
		return new Response("Invalid form data", { status: 400 });
	}

	const last_lomito_date = formData.get("last_lomito_date")?.toString() || "";
	const roll_window_start = formData.get("roll_window_start")?.toString() || "";
	const roll_window_end = formData.get("roll_window_end")?.toString() || "";
	const auto_verdict_enabled = formData.get("auto_verdict_enabled") === "1";
	const special_roll_date = formData.get("special_roll_date")?.toString() || "";

	if (!isValidTime(roll_window_start) || !isValidTime(roll_window_end)) {
		return new Response("El horario de tirada debe tener formato HH:MM", { status: 400 });
	}
	if (timeToMinutes(roll_window_start) >= timeToMinutes(roll_window_end)) {
		return new Response("La hora de apertura tiene que ser anterior a la de cierre", { status: 400 });
	}
	if (special_roll_date && !isValidDate(special_roll_date)) {
		return new Response("La fecha de la tirada especial no es válida", { status: 400 });
	}

	try {
        if (last_lomito_date) {
            await setSetting("last_lomito_date", last_lomito_date);
        } else {
            await db.execute("DELETE FROM settings WHERE key = 'last_lomito_date'");
        }

		await setSetting("roll_window_start", roll_window_start);
		await setSetting("roll_window_end", roll_window_end);
		await setSetting("auto_verdict_enabled", auto_verdict_enabled ? "1" : "0");

		// Tirada especial: habilita la tirada en una fecha que no es día de juego
		if (special_roll_date) {
			await setSetting("special_roll_date", special_roll_date);
		} else {
			await db.execute("DELETE FROM settings WHERE key = 'special_roll_date'");
		}

		return new Response(null, {
			status: 302,
			headers: { Location: "/admin" }
		});
	} catch (e) {
		console.error("Error saving settings:", e);
		return new Response("Internal Server Error", { status: 500 });
	}
};
