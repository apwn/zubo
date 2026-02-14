import { getDb } from "../../../db/connection";

export default async function (input: Record<string, unknown>): Promise<string> {
  const action = input.action as string;
  const db = getDb();

  switch (action) {
    case "create": {
      const name = input.name as string;
      if (!name) throw new Error("'name' is required for create.");
      if (!/^[a-z0-9_-]+$/i.test(name)) {
        throw new Error("Webhook name must be alphanumeric with hyphens/underscores.");
      }

      const description = (input.description as string) || "";
      const secret = (input.secret as string) || null;
      const id = crypto.randomUUID();

      try {
        db.prepare(
          "INSERT INTO webhooks (id, name, description, secret) VALUES (?, ?, ?, ?)"
        ).run(id, name, description, secret);
      } catch (err: any) {
        if (err.message?.includes("UNIQUE")) {
          throw new Error(`Webhook "${name}" already exists.`);
        }
        throw err;
      }

      return JSON.stringify({
        action: "create",
        webhook: { id, name, description, active: true },
        url: `/api/webhook/${id}`,
        note: "Share this URL with external services. Events sent here will be processed by the agent.",
      });
    }

    case "list": {
      const rows = db.query(
        "SELECT id, name, description, active, created_at FROM webhooks ORDER BY created_at DESC"
      ).all() as any[];

      // Get event counts
      const webhooks = rows.map(w => {
        const eventCount = (db.query(
          "SELECT COUNT(*) as c FROM webhook_events WHERE webhook_id = ?"
        ).get(w.id) as any)?.c ?? 0;
        return { ...w, active: w.active === 1, eventCount };
      });

      return JSON.stringify({ action: "list", webhooks });
    }

    case "delete": {
      const name = input.name as string;
      if (!name) throw new Error("'name' is required for delete.");
      const webhook = db.query("SELECT id FROM webhooks WHERE name = ?").get(name) as { id: string } | null;
      if (!webhook) throw new Error(`Webhook "${name}" not found.`);

      db.prepare("DELETE FROM webhook_events WHERE webhook_id = ?").run(webhook.id);
      db.prepare("DELETE FROM webhooks WHERE id = ?").run(webhook.id);
      return JSON.stringify({ action: "delete", name, deleted: true });
    }

    case "toggle": {
      const name = input.name as string;
      if (!name) throw new Error("'name' is required for toggle.");
      const webhook = db.query("SELECT id, active FROM webhooks WHERE name = ?").get(name) as { id: string; active: number } | null;
      if (!webhook) throw new Error(`Webhook "${name}" not found.`);

      const newActive = webhook.active === 1 ? 0 : 1;
      db.prepare("UPDATE webhooks SET active = ? WHERE id = ?").run(newActive, webhook.id);
      return JSON.stringify({ action: "toggle", name, active: newActive === 1 });
    }

    default:
      throw new Error(`Unknown action: "${action}". Use create, list, delete, or toggle.`);
  }
}
