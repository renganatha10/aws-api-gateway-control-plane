export const PET_SWAGGER_YAML = `swagger: "2.0"
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
        enum: [available, pending, sold]`;

export const OPENAPI3_PLACEHOLDER = `openapi: "3.0.0"
info:
  title: My API
  version: "1.0.0"
paths:
  /example:
    get:
      summary: Example endpoint
      responses:
        "200":
          description: OK`;
