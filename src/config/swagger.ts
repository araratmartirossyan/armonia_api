import swaggerJsdoc from 'swagger-jsdoc';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Beauty License Manager API',
    version: '1.0.0',
    description: 'API documentation for the Beauty License Manager - A RAG backend with license management',
    contact: {
      name: 'API Support',
    },
  },
  // NOTE: Don't hardcode localhost here; we set `servers` dynamically in `/api-docs.json`
  // so Swagger works correctly behind reverse proxies and in production.
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      User: {
        type: 'object',
        description: 'User object (password field is excluded from responses)',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'User ID',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address',
          },
          role: {
            type: 'string',
            enum: ['ADMIN', 'CUSTOMER'],
            description: 'User role',
          },
          legalName: {
            type: 'string',
            nullable: true,
            description: 'Legal name of the customer/company',
          },
          centerName: {
            type: 'string',
            nullable: true,
            description: 'Center name',
          },
          customerStatus: {
            type: 'string',
            enum: [
              'Activation Request',
              'In Progress',
              'In Test',
              'Active',
              'Unpaid',
              'Terminated',
              'Terminated - Blacklist',
              'Demo',
            ],
            description: 'Customer status',
          },
          contactPerson: {
            type: 'string',
            nullable: true,
            description: 'Primary contact person',
          },
          contactNumber: {
            type: 'string',
            nullable: true,
            description: 'Primary contact number',
          },
          address: {
            type: 'string',
            nullable: true,
            description: 'Customer address',
          },
          assignedAgentFullName: {
            type: 'string',
            nullable: true,
            description: 'Assigned agent full name',
          },
          license: {
            $ref: '#/components/schemas/License',
            nullable: true,
            description: 'User license (one-to-one relationship, when relations are loaded)',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      License: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'License ID',
          },
          key: {
            type: 'string',
            description: 'License key (UUID)',
          },
          isActive: {
            type: 'boolean',
            description: 'Whether the license is active',
          },
          expiresAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'License expiration date (null for no expiration)',
          },
          user: {
            $ref: '#/components/schemas/User',
          },
          knowledgeBases: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/KnowledgeBase',
            },
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      KnowledgeBase: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Knowledge Base ID',
          },
          name: {
            type: 'string',
            description: 'Knowledge Base name',
          },
          description: {
            type: 'string',
            nullable: true,
            description: 'Knowledge Base description',
          },
          documents: {
            type: 'object',
            nullable: true,
            description: 'Deprecated: Metadata about uploaded documents (use pdfDocuments instead)',
            deprecated: true,
          },
          pdfDocuments: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Document',
            },
            description: 'List of uploaded PDF documents',
          },
          licenses: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/License',
            },
            description: 'Licenses that have access to this knowledge base',
          },
          promptInstructions: {
            type: 'string',
            nullable: true,
            description: 'Custom prompt instructions for this knowledge base (per customer)',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      Document: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Document ID',
          },
          fileName: {
            type: 'string',
            description: 'Original filename of the uploaded PDF',
          },
          filePath: {
            type: 'string',
            description: 'Path to the stored PDF file',
          },
          metadata: {
            type: 'object',
            nullable: true,
            description: 'Document metadata (file size, page count, etc.)',
            properties: {
              fileSize: {
                type: 'number',
                description: 'File size in bytes',
              },
              pageCount: {
                type: 'number',
                description: 'Number of pages in the PDF',
              },
              uploadedAt: {
                type: 'string',
                format: 'date-time',
                description: 'Upload timestamp',
              },
            },
          },
          knowledgeBaseId: {
            type: 'string',
            format: 'uuid',
            description: 'Knowledge Base ID this document belongs to',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address',
          },
          password: {
            type: 'string',
            minLength: 6,
            description: 'User password',
          },
          role: {
            type: 'string',
            enum: ['ADMIN', 'CUSTOMER'],
            default: 'CUSTOMER',
            description: 'User role (defaults to CUSTOMER)',
          },
          legalName: {
            type: 'string',
            nullable: true,
          },
          centerName: {
            type: 'string',
            nullable: true,
          },
          customerStatus: {
            type: 'string',
            enum: [
              'Activation Request',
              'In Progress',
              'In Test',
              'Active',
              'Unpaid',
              'Terminated',
              'Terminated - Blacklist',
              'Demo',
            ],
            nullable: true,
          },
          contactPerson: {
            type: 'string',
            nullable: true,
          },
          contactNumber: {
            type: 'string',
            nullable: true,
          },
          address: {
            type: 'string',
            nullable: true,
          },
          assignedAgentFullName: {
            type: 'string',
            nullable: true,
          },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
          },
          password: {
            type: 'string',
          },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          token: {
            type: 'string',
            description: 'JWT authentication token',
          },
          user: {
            $ref: '#/components/schemas/User',
          },
          license: {
            type: 'string',
            nullable: true,
            description: 'License key for the user (if the user has a license)',
            example: 'c5e0f8b0-1234-4cde-9abc-9876543210ff',
          },
        },
      },
      CreateLicenseRequest: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: {
            type: 'string',
            format: 'uuid',
            description: 'User ID to associate the license with',
          },
          validityPeriodDays: {
            type: 'number',
            minimum: 1,
            description: 'Number of days until license expires (optional, if not provided license never expires)',
          },
        },
      },
      UpdateLicenseRequest: {
        type: 'object',
        description:
          'Update license validity period. Provide a positive number to set expiry to now + days, or null to clear expiry (never expires).',
        properties: {
          validityPeriodDays: {
            type: 'number',
            nullable: true,
            minimum: 1,
          },
        },
        required: ['validityPeriodDays'],
      },
      CreateKnowledgeBaseRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            description: 'Knowledge Base name',
          },
          description: {
            type: 'string',
            nullable: true,
            description: 'Knowledge Base description',
          },
          documents: {
            type: 'object',
            nullable: true,
            description: 'Metadata about documents',
          },
          promptInstructions: {
            type: 'string',
            nullable: true,
            description: 'Custom prompt instructions for this knowledge base (per customer)',
          },
        },
      },
      AIConfiguration: {
        type: 'object',
        description: 'Global AI Configuration',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Configuration ID',
          },
          key: {
            type: 'string',
            description: 'Configuration key (default: "default")',
            example: 'default',
          },
          llmProvider: {
            type: 'string',
            enum: ['OPENAI', 'GEMINI', 'ANTHROPIC'],
            description: 'LLM provider',
          },
          model: {
            type: 'string',
            nullable: true,
            description: 'Model name (e.g., "gpt-4", "gemini-pro", "claude-3-sonnet-20240229")',
          },
          temperature: {
            type: 'number',
            nullable: true,
            description: 'Temperature (0.0 to 2.0 for Gemini, 0.0 to 1.0 for OpenAI/Anthropic)',
            minimum: 0,
            maximum: 2,
          },
          maxTokens: {
            type: 'integer',
            nullable: true,
            description: 'Maximum tokens to generate',
          },
          topP: {
            type: 'number',
            nullable: true,
            description: 'Nucleus sampling parameter (0.0 to 1.0)',
            minimum: 0,
            maximum: 1,
          },
          topK: {
            type: 'integer',
            nullable: true,
            description: 'Top-k sampling (Gemini/Anthropic)',
          },
          frequencyPenalty: {
            type: 'number',
            nullable: true,
            description: 'Frequency penalty (OpenAI only: -2.0 to 2.0)',
            minimum: -2,
            maximum: 2,
          },
          presencePenalty: {
            type: 'number',
            nullable: true,
            description: 'Presence penalty (OpenAI only: -2.0 to 2.0)',
            minimum: -2,
            maximum: 2,
          },
          stopSequences: {
            type: 'array',
            items: {
              type: 'string',
            },
            nullable: true,
            description: 'Stop sequences (Gemini/Anthropic)',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      UpdateAIConfigRequest: {
        type: 'object',
        description: 'Request body for updating AI configuration',
        properties: {
          llmProvider: {
            type: 'string',
            enum: ['OPENAI', 'GEMINI', 'ANTHROPIC'],
            description: 'LLM provider',
          },
          model: {
            type: 'string',
            nullable: true,
            description: 'Model name',
          },
          temperature: {
            type: 'number',
            nullable: true,
            description: 'Temperature',
          },
          maxTokens: {
            type: 'integer',
            nullable: true,
            description: 'Maximum tokens',
          },
          topP: {
            type: 'number',
            nullable: true,
            description: 'Top-p parameter',
          },
          topK: {
            type: 'integer',
            nullable: true,
            description: 'Top-k parameter',
          },
          frequencyPenalty: {
            type: 'number',
            nullable: true,
            description: 'Frequency penalty (OpenAI only)',
          },
          presencePenalty: {
            type: 'number',
            nullable: true,
            description: 'Presence penalty (OpenAI only)',
          },
          stopSequences: {
            type: 'array',
            items: {
              type: 'string',
            },
            nullable: true,
            description: 'Stop sequences',
          },
        },
      },
      AttachKnowledgeBaseRequest: {
        type: 'object',
        required: ['kbId', 'licenseId'],
        properties: {
          kbId: {
            type: 'string',
            format: 'uuid',
            description: 'Knowledge Base ID',
          },
          licenseId: {
            type: 'string',
            format: 'uuid',
            description: 'License ID',
          },
        },
      },
      ChatRequest: {
        type: 'object',
        required: ['question', 'licenseKey'],
        properties: {
          question: {
            type: 'string',
            description: 'Question to ask the RAG system',
          },
          licenseKey: {
            type: 'string',
            description: 'License key to use for the query',
          },
          kbId: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'Knowledge Base ID to use (optional, uses first KB if not specified)',
          },
        },
      },
      ChatResponse: {
        type: 'object',
        properties: {
          answer: {
            type: 'string',
            description: 'Answer from the RAG system',
          },
        },
      },
      UploadDocumentRequest: {
        type: 'object',
        required: ['text', 'licenseKey', 'kbId'],
        properties: {
          text: {
            type: 'string',
            description: 'Document text content',
          },
          metadata: {
            type: 'object',
            nullable: true,
            description: 'Document metadata',
          },
          licenseKey: {
            type: 'string',
            description: 'License key to associate the document with',
          },
          kbId: {
            type: 'string',
            format: 'uuid',
            description: 'Knowledge Base ID to ingest document into',
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Error message',
          },
        },
      },
    },
  },
};

const options = {
  definition: swaggerDefinition,
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
