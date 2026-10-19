import { lucia } from "./auth.js";
import { defineMiddleware } from "astro:middleware";
import db from "./db/index.js";
import { maybeSendAutoVerdict, startAutoVerdictTimer } from "./utils/schedule.js";

// El veredicto automático se revisa solo cada minuto desde que el servidor atiende
// la primera request (el health check de Docker la hace a los pocos segundos de arrancar).
startAutoVerdictTimer(db);

export const onRequest = defineMiddleware(async (context, next) => {
	const sessionId = context.cookies.get(lucia.sessionCookieName)?.value ?? null;
	if (!sessionId) {
		context.locals.user = null;
		context.locals.session = null;
	} else {
		const { session, user } = await lucia.validateSession(sessionId);
		if (session && session.fresh) {
			const sessionCookie = lucia.createSessionCookie(session.id);
			context.cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
		}
		if (!session) {
			const sessionCookie = lucia.createBlankSessionCookie();
			context.cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
		}
		context.locals.session = session;
		context.locals.user = user;
	}

	// Veredicto automático: la primera visita después del cierre de la tirada
	// (incluido el polling del inicio) lo publica. Nunca debe romper la página.
	try {
		await maybeSendAutoVerdict(db);
	} catch (e) {
		console.error("No se pudo publicar el veredicto automático:", e);
	}

	const response = await next();
	
	// Disable caching for HTML pages so that state mutations are immediately visible
	if (response.headers.get("content-type")?.includes("text/html")) {
		response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
		response.headers.set("Pragma", "no-cache");
		response.headers.set("Expires", "0");
	}
	
	return response;
});
