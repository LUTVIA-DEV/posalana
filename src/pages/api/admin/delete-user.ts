import type { APIRoute } from "astro";
import db from "../../../db/index.js";

export const POST: APIRoute = async ({ request, locals }) => {
	const user = locals.user;
	
	if (!user || user.role !== "admin") {
		return new Response("Unauthorized", { status: 403 });
	}

	let formData;
	try {
		if (request.headers.get("Content-Type")?.includes("multipart/form-data")) {
			formData = await request.formData();
		} else {
			formData = new URLSearchParams(await request.text());
		}
	} catch (e) {
		return new Response("Invalid form data", { status: 400 });
	}

	const idToDelete = formData.get("userId")?.toString();

	if (!idToDelete) {
		return new Response("Missing userId", { status: 400 });
	}
    
    if (idToDelete === user.id) {
        return new Response("No te podes borrar a vos mismo", { status: 400 });
    }

	try {
        // Delete user's rolls first
        await db.execute({
            sql: "DELETE FROM roll WHERE user_id = ?",
            args: [idToDelete]
        });
        await db.execute({
            sql: "DELETE FROM dropped_roll WHERE user_id = ?",
            args: [idToDelete]
        });
        
        // Delete user's sessions
        await db.execute({
            sql: "DELETE FROM session WHERE user_id = ?",
            args: [idToDelete]
        });

        // Delete user
		await db.execute({
			sql: "DELETE FROM user WHERE id = ?",
			args: [idToDelete]
		});
		
		return new Response(null, {
			status: 302,
			headers: { Location: "/admin" }
		});
	} catch (e) {
		console.error("Error deleting user:", e);
		return new Response("Internal Server Error", { status: 500 });
	}
};
