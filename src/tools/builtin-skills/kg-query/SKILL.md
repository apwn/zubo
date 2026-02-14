# kg_query

Query the knowledge graph to find entities, their relationships, and structured information. Use this to recall known people, projects, concepts, and how they relate to each other.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["search", "get", "relations", "graph"],
      "description": "Action: 'search' to find entities by name, 'get' to get full entity details, 'relations' to list connections, 'graph' to export subgraph"
    },
    "name": {
      "type": "string",
      "description": "Entity name to look up (for get, relations)"
    },
    "type": {
      "type": "string",
      "description": "Entity type filter (person, project, concept, place, org, etc.)"
    },
    "query": {
      "type": "string",
      "description": "Search query (for search action)"
    },
    "relation": {
      "type": "string",
      "description": "Filter by relation type (for relations action)"
    },
    "direction": {
      "type": "string",
      "enum": ["outgoing", "incoming", "both"],
      "description": "Relation direction filter (default: both)"
    }
  },
  "required": ["action"]
}
```

## Usage Hints

- Use "search" with a query to find entities by name.
- Use "get" with a name to see full entity details and all relations.
- Use "relations" to explore how an entity connects to others.
- Use "graph" to export the full graph or a type-filtered subgraph.
