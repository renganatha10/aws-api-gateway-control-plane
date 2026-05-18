import * as React from "react"
import * as yaml from "js-yaml"
import { Form, redirect, useActionData, useNavigate } from "react-router"

import { getActiveGatewayId, requireAuth } from "~/lib/session.server"
import { getUserProfile } from "~/lib/keycloak.server"
import { createApi, findApiByGatewayAndBasePath } from "~/repositories/api.repository.server"
import { buildAwsSpec, extractBasePath } from "~/aws/build-aws-spec.server"
import { importApiSpec } from "~/aws/import-api.server"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import type { Route } from "./+types/api-create"

export function meta({}: Route.MetaArgs) {
  return [{ title: "Create API" }]
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request)
  return null
}

export async function action({ request }: Route.ActionArgs) {
  const { accessToken } = await requireAuth(request)
  const createdBy = getUserProfile(accessToken).email

  const gatewayId = await getActiveGatewayId(request)

  const formData    = await request.formData()
  const displayName = (formData.get("name") as string)?.trim()
  const specType    = formData.get("type") as string
  const yamlStr     = (formData.get("yaml") as string)?.trim()
  const scope       = (formData.get("scope") as string)?.trim() || null

  if (!displayName) return { error: "API name is required." }
  const name = gatewayId ? `${displayName}-${gatewayId}` : displayName
  if (!specType) return { error: "Please select an API type." }
  if (!yamlStr) return { error: "YAML definition is required." }

  let spec: unknown
  try {
    spec = yaml.load(yamlStr)
  } catch {
    return { error: "Invalid YAML — could not parse the definition." }
  }

  if (!spec || typeof spec !== "object") return { error: "YAML must define an object." }

  const basePath = extractBasePath(spec as Record<string, unknown>)

  if (gatewayId) {
    const conflict = await findApiByGatewayAndBasePath(gatewayId, basePath)
    if (conflict) return { error: `Base path "${basePath}" is already in use by another API in this gateway.` }
  }

  let awsApiId: string
  try {
    const specObj  = spec as Record<string, unknown>
    const specForAws = { ...specObj, info: { ...(specObj.info as object ?? {}), title: name } }
    awsApiId = await importApiSpec(buildAwsSpec(specForAws))
  } catch (err) {
    return { error: `AWS import failed: ${err instanceof Error ? err.message : "Unknown error"}` }
  }

  const now = new Date()
  await createApi({ name, displayName, scope, specType, spec, basePath, gatewayId, createdBy, updatedBy: createdBy, awsApiId, updatedAt: now })

  throw redirect("/apis")
}

const API_TYPES = [
  { value: "swagger2", label: "Swagger 2.0" },
  { value: "openapi3", label: "OpenAPI 3.0" },
]

export default function ApiCreate() {
  const actionData = useActionData<typeof action>()
  const navigate   = useNavigate()
  const [type, setType] = React.useState("swagger2")

  return (
    <div className="flex flex-col h-full bg-white">
      <Form method="post" className="flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200 shrink-0">
          <h1 className="text-2xl font-normal text-gray-900">Create API</h1>
          <div className="flex gap-2">
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6">
              Save API
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </div>
        </div>

        <div className="flex flex-col flex-1 min-h-0 px-6 py-6 gap-6">
          {actionData?.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive shrink-0">
              {actionData.error}
            </p>
          )}

          {/* Name */}
          <div className="space-y-2 shrink-0">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="e.g. payments-api" required className="max-w-sm" />
          </div>

          {/* Type + Scope */}
          <div className="flex gap-6 items-end shrink-0">
            <div className="space-y-2">
              <Label>Type</Label>
              <input type="hidden" name="type" value={type} />
              <div className="flex gap-2">
                {API_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    className={[
                      "rounded-md border px-4 py-2 text-sm font-medium transition-colors",
                      type === t.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-64 space-y-2">
              <Label htmlFor="scope">Scope</Label>
              <Input id="scope" name="scope" placeholder="e.g. read:orders" defaultValue="pets" />
            </div>
          </div>

          {/* YAML definition — grows to fill remaining space */}
          <div className="flex flex-col flex-1 min-h-0 space-y-2">
            <Label htmlFor="yaml">Definition (YAML)</Label>
            <textarea
              id="yaml"
              name="yaml"
              defaultValue={type === "swagger2" ? PET_SWAGGER_YAML : OPENAPI3_PLACEHOLDER}
              className="flex-1 w-full rounded-md border border-input bg-gray-950 px-4 py-3 font-mono text-sm text-white placeholder:text-gray-600 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              required
            />
          </div>
        </div>
      </Form>
    </div>
  )
}

const PET_SWAGGER_YAML = `swagger: "2.0"
info:
  title: Petstore - Pet API
  description: Pet operations proxied through API Gateway.
  version: "1.0.0"
  contact:
    email: "apiteam@swagger.io"
  license:
    name: "Apache 2.0"
    url: "http://www.apache.org/licenses/LICENSE-2.0.html"
host: "petstore.swagger.io"
hosts:
  dev: dev.petstore.swagger.io/v2
  prod: petstore.swagger.io/v2
basePath: "/v2"
schemes:
  - https
tags:
  - name: pet
    description: Everything about your Pets
paths:
  /pet:
    post:
      tags: [pet]
      summary: Add a new pet to the store
      operationId: addPet
      consumes: [application/json]
      produces: [application/json]
      parameters:
        - in: body
          name: body
          description: Pet object that needs to be added to the store
          required: true
          schema:
            $ref: "#/definitions/Pet"
      responses:
        "405":
          description: Invalid input
    put:
      tags: [pet]
      summary: Update an existing pet
      operationId: updatePet
      consumes: [application/json]
      produces: [application/json]
      parameters:
        - in: body
          name: body
          description: Pet object that needs to be updated
          required: true
          schema:
            $ref: "#/definitions/Pet"
      responses:
        "400":
          description: Invalid ID supplied
        "404":
          description: Pet not found
        "405":
          description: Validation exception
  /pet/findByStatus:
    get:
      tags: [pet]
      summary: Finds Pets by status
      operationId: findPetsByStatus
      produces: [application/json]
      parameters:
        - name: status
          in: query
          required: true
          type: array
          items:
            type: string
            enum: [available, pending, sold]
            default: available
          collectionFormat: multi
      responses:
        "200":
          description: Successful operation
          schema:
            type: array
            items:
              $ref: "#/definitions/Pet"
        "400":
          description: Invalid status value
  /pet/findByTags:
    get:
      tags: [pet]
      summary: Finds Pets by tags
      operationId: findPetsByTags
      produces: [application/json]
      parameters:
        - name: tags
          in: query
          required: true
          type: array
          items:
            type: string
          collectionFormat: multi
      responses:
        "200":
          description: Successful operation
          schema:
            type: array
            items:
              $ref: "#/definitions/Pet"
        "400":
          description: Invalid tag value
      deprecated: true
  /pet/{petId}:
    get:
      tags: [pet]
      summary: Find pet by ID
      operationId: getPetById
      produces: [application/json]
      parameters:
        - name: petId
          in: path
          description: ID of pet to return
          required: true
          type: integer
          format: int64
      responses:
        "200":
          description: Successful operation
          schema:
            $ref: "#/definitions/Pet"
        "400":
          description: Invalid ID supplied
        "404":
          description: Pet not found
    post:
      tags: [pet]
      summary: Updates a pet in the store with form data
      operationId: updatePetWithForm
      consumes: [application/json]
      produces: [application/json]
      parameters:
        - name: petId
          in: path
          description: ID of pet that needs to be updated
          required: true
          type: integer
          format: int64
      responses:
        "405":
          description: Invalid input
    delete:
      tags: [pet]
      summary: Deletes a pet
      operationId: deletePet
      produces: [application/json]
      parameters:
        - name: petId
          in: path
          description: Pet id to delete
          required: true
          type: integer
          format: int64
      responses:
        "400":
          description: Invalid ID supplied
        "404":
          description: Pet not found
  /pet/{petId}/uploadImage:
    post:
      tags: [pet]
      summary: Uploads an image
      operationId: uploadFile
      consumes: [application/octet-stream]
      produces: [application/json]
      parameters:
        - name: petId
          in: path
          description: ID of pet to update
          required: true
          type: integer
          format: int64
      responses:
        "200":
          description: Successful operation
          schema:
            $ref: "#/definitions/ApiResponse"
definitions:
  ApiResponse:
    type: object
    properties:
      code:
        type: integer
        format: int32
      type:
        type: string
      message:
        type: string
  Category:
    type: object
    properties:
      id:
        type: integer
        format: int64
      name:
        type: string
  Tag:
    type: object
    properties:
      id:
        type: integer
        format: int64
      name:
        type: string
  Pet:
    type: object
    required: [name, photoUrls]
    properties:
      id:
        type: integer
        format: int64
      category:
        $ref: "#/definitions/Category"
      name:
        type: string
      photoUrls:
        type: array
        items:
          type: string
      tags:
        type: array
        items:
          $ref: "#/definitions/Tag"
      status:
        type: string
        description: pet status in the store
        enum: [available, pending, sold]`

const OPENAPI3_PLACEHOLDER = `openapi: "3.0.0"
info:
  title: My API
  version: "1.0.0"
paths:
  /example:
    get:
      summary: Example endpoint
      responses:
        "200":
          description: OK`
