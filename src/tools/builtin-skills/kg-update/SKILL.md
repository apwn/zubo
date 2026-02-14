# kg_update

Update the knowledge graph by adding or removing entities and relationships. Use this to build structured memory about people, projects, concepts, and their connections.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["add_entity", "add_relation", "remove_entity", "remove_relation"],
      "description": "Action to perform"
    },
    "name": {
      "type": "string",
      "description": "Entity name"
    },
    "type": {
      "type": "string",
      "description": "Entity type (person, project, concept, place, org, tool, etc.)"
    },
    "properties": {
      "type": "object",
      "description": "Key-value properties for the entity or relation"
    },
    "source_name": {
      "type": "string",
      "description": "Source entity name (for add_relation, remove_relation)"
    },
    "source_type": {
      "type": "string",
      "description": "Source entity type (for add_relation)"
    },
    "target_name": {
      "type": "string",
      "description": "Target entity name (for add_relation, remove_relation)"
    },
    "target_type": {
      "type": "string",
      "description": "Target entity type (for add_relation)"
    },
    "relation": {
      "type": "string",
      "description": "Relation type (works_at, knows, manages, part_of, uses, created, etc.)"
    }
  },
  "required": ["action"]
}
```

## Usage Hints

- Use "add_entity" to create or update an entity (upserts by name+type).
- Use "add_relation" to connect two entities (creates them if needed).
- Use "remove_entity" to delete an entity and all its relations.
- Use "remove_relation" to delete a specific relationship.
- Common types: person, project, concept, place, org, tool, topic.
- Common relations: works_at, knows, manages, part_of, uses, created, interested_in.
