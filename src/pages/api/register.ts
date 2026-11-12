import type { APIContext } from "astro";
import { lucia } from "../../auth.js";
import db from "../../db/index.js";
import { hash } from "bcryptjs";

function generateId() {
	return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export async function POST(context: APIContext): Promise<Response> {
	const body = await context.request.text();
	const params = new URLSearchParams(body);
	
    const display_name = params.get("display_name")?.trim() ?? "";
    const username = params.get("username")?.trim() ?? "";
	const password = params.get("password") ?? "";

    if (!display_name) {
        return new Response("El nombre es obligatorio", { status: 400 });
    }

	if (
		typeof username !== "string" ||
		username.length < 3 ||
		username.length > 31 ||
		!/^[a-z0-9_-]+$/.test(username)
	) {
		return new Response("Usuario inválido (solo minúsculas y números, 3-31 caracteres)", { status: 400 });
	}
	
	if (typeof password !== "string" || password.length < 4 || password.length > 255) {
		return new Response("Contraseña inválida", { status: 400 });
	}

	const existingUserRes = await db.execute({
		sql: "SELECT * FROM user WHERE username = ?",
		args: [username]
	});

	if (existingUserRes.rows.length > 0) {
		return new Response("Ese nombre de usuario ya está en uso", { status: 400 });
	}

    const userId = generateId();
    const passwordHash = await hash(password, 10);
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;

    await db.execute({
        // trailer_visto = 0: la primera vez que entra le aparece el pop-up con el trailer
        sql: "INSERT INTO user (id, username, display_name, password_hash, avatar_url, trailer_visto) VALUES (?, ?, ?, ?, ?, 0)",
        args: [userId, username, display_name, passwordHash, avatarUrl]
    });

    const session = await lucia.createSession(userId, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    context.cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

    return context.redirect("/");
}
