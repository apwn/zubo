import { getDb } from "../../../db/connection";
import { addEntity, addRelation, removeEntity, removeRelation } from "../../../memory/knowledge-graph";

export default async function (input: Record<string, unknown>): Promise<string> {
  const action = input.action as string;
  const db = getDb();

  switch (action) {
    case "add_entity": {
      const name = input.name as string;
      const type = input.type as string;
      if (!name || !type) throw new Error("'name' and 'type' are required for add_entity.");
      const properties = input.properties as Record<string, unknown> | undefined;
      const entity = addEntity(db, name, type, properties);
      return JSON.stringify({ action: "add_entity", entity });
    }

    case "add_relation": {
      const sourceName = input.source_name as string;
      const sourceType = input.source_type as string;
      const targetName = input.target_name as string;
      const targetType = input.target_type as string;
      const relation = input.relation as string;
      if (!sourceName || !sourceType || !targetName || !targetType || !relation) {
        throw new Error("add_relation requires: source_name, source_type, target_name, target_type, relation.");
      }
      const properties = input.properties as Record<string, unknown> | undefined;
      const rel = addRelation(db, sourceName, sourceType, targetName, targetType, relation, properties);
      return JSON.stringify({ action: "add_relation", relation: rel });
    }

    case "remove_entity": {
      const name = input.name as string;
      if (!name) throw new Error("'name' is required for remove_entity.");
      const type = input.type as string | undefined;
      const removed = removeEntity(db, name, type);
      return JSON.stringify({ action: "remove_entity", name, removed });
    }

    case "remove_relation": {
      const sourceName = input.source_name as string;
      const targetName = input.target_name as string;
      const relation = input.relation as string;
      if (!sourceName || !targetName || !relation) {
        throw new Error("remove_relation requires: source_name, target_name, relation.");
      }
      const removed = removeRelation(db, sourceName, targetName, relation);
      return JSON.stringify({ action: "remove_relation", removed });
    }

    default:
      throw new Error(`Unknown action: "${action}". Use add_entity, add_relation, remove_entity, or remove_relation.`);
  }
}
