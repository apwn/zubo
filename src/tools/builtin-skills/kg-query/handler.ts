import { getDb } from "../../../db/connection";
import { searchEntities, queryEntity, queryRelations, getGraph } from "../../../memory/knowledge-graph";

export default async function (input: Record<string, unknown>): Promise<string> {
  const action = input.action as string;
  const db = getDb();

  switch (action) {
    case "search": {
      const query = input.query as string;
      if (!query) throw new Error("'query' is required for search action.");
      const type = input.type as string | undefined;
      const results = searchEntities(db, query, type);
      return JSON.stringify({ action: "search", query, results });
    }

    case "get": {
      const name = input.name as string;
      if (!name) throw new Error("'name' is required for get action.");
      const type = input.type as string | undefined;
      const result = queryEntity(db, name, type);
      if (!result) return JSON.stringify({ action: "get", name, found: false });
      return JSON.stringify({ action: "get", ...result });
    }

    case "relations": {
      const name = input.name as string;
      if (!name) throw new Error("'name' is required for relations action.");
      const relation = input.relation as string | undefined;
      const direction = input.direction as "outgoing" | "incoming" | "both" | undefined;
      const results = queryRelations(db, name, relation, direction);
      return JSON.stringify({ action: "relations", name, results });
    }

    case "graph": {
      const type = input.type as string | undefined;
      const result = getGraph(db, type);
      return JSON.stringify({ action: "graph", ...result });
    }

    default:
      throw new Error(`Unknown action: "${action}". Use search, get, relations, or graph.`);
  }
}
