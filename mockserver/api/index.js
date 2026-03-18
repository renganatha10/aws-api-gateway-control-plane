const express = require("express")

const app = express()
app.use(express.json())

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------
let pets = [
  { id: 1, name: "Buddy",   species: "dog", age: 3, status: "available" },
  { id: 2, name: "Whiskers", species: "cat", age: 5, status: "adopted"   },
  { id: 3, name: "Tweety",  species: "bird", age: 1, status: "available" },
]
let nextId = 4

// ---------------------------------------------------------------------------
// OpenAPI spec
// ---------------------------------------------------------------------------
const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Pets Mock API",
    version: "1.0.0",
    description: "A simple mocked CRUD API for pets",
  },
  servers: [{ url: "/", description: "Current server" }],
  paths: {
    "/pets": {
      get: {
        summary: "List all pets",
        operationId: "listPets",
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["available", "adopted", "pending"] },
            description: "Filter by status",
          },
        ],
        responses: {
          200: {
            description: "A list of pets",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Pet" } } } },
          },
        },
      },
      post: {
        summary: "Create a pet",
        operationId: "createPet",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/PetInput" } } },
        },
        responses: {
          201: {
            description: "Pet created",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Pet" } } },
          },
          400: { description: "Validation error" },
        },
      },
    },
    "/pets/{id}": {
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "integer" } },
      ],
      get: {
        summary: "Get a pet by ID",
        operationId: "getPet",
        responses: {
          200: {
            description: "A pet",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Pet" } } },
          },
          404: { description: "Not found" },
        },
      },
      put: {
        summary: "Update a pet",
        operationId: "updatePet",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/PetInput" } } },
        },
        responses: {
          200: {
            description: "Updated pet",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Pet" } } },
          },
          404: { description: "Not found" },
        },
      },
      delete: {
        summary: "Delete a pet",
        operationId: "deletePet",
        responses: {
          204: { description: "Deleted" },
          404: { description: "Not found" },
        },
      },
    },
  },
  components: {
    schemas: {
      Pet: {
        type: "object",
        properties: {
          id:      { type: "integer" },
          name:    { type: "string"  },
          species: { type: "string"  },
          age:     { type: "integer" },
          status:  { type: "string", enum: ["available", "adopted", "pending"] },
        },
        required: ["id", "name", "species"],
      },
      PetInput: {
        type: "object",
        properties: {
          name:    { type: "string"  },
          species: { type: "string"  },
          age:     { type: "integer" },
          status:  { type: "string", enum: ["available", "adopted", "pending"] },
        },
        required: ["name", "species"],
      },
    },
  },
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET /openapi.json  and  GET /spec
app.get(["/openapi.json", "/spec"], (req, res) => {
  res.json(openApiSpec)
})

// GET /pets
app.get("/pets", (req, res) => {
  const { status } = req.query
  const result = status ? pets.filter((p) => p.status === status) : pets
  res.json(result)
})

// GET /pets/:id
app.get("/pets/:id", (req, res) => {
  const pet = pets.find((p) => p.id === Number(req.params.id))
  if (!pet) return res.status(404).json({ error: "Pet not found" })
  res.json(pet)
})

// POST /pets
app.post("/pets", (req, res) => {
  const { name, species, age, status = "available" } = req.body
  if (!name || !species) {
    return res.status(400).json({ error: "name and species are required" })
  }
  const pet = { id: nextId++, name, species, age: age ?? null, status }
  pets.push(pet)
  res.status(201).json(pet)
})

// PUT /pets/:id
app.put("/pets/:id", (req, res) => {
  const idx = pets.findIndex((p) => p.id === Number(req.params.id))
  if (idx === -1) return res.status(404).json({ error: "Pet not found" })
  const { name, species, age, status } = req.body
  pets[idx] = { ...pets[idx], ...(name && { name }), ...(species && { species }), ...(age !== undefined && { age }), ...(status && { status }) }
  res.json(pets[idx])
})

// DELETE /pets/:id
app.delete("/pets/:id", (req, res) => {
  const idx = pets.findIndex((p) => p.id === Number(req.params.id))
  if (idx === -1) return res.status(404).json({ error: "Pet not found" })
  pets.splice(idx, 1)
  res.status(204).send()
})

// ---------------------------------------------------------------------------
// Local dev
// ---------------------------------------------------------------------------
if (require.main === module) {
  const PORT = process.env.PORT ?? 4000
  app.listen(PORT, () => console.log(`Pets mock server running at http://localhost:${PORT}`))
}

module.exports = app
