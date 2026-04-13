/**
 * Runtime Validation — Chapter 10: TypeBox Pattern
 *
 * Lightweight runtime validation without external dependencies.
 * Validates API inputs at the edge before handlers process them.
 *
 * Pattern: validate(data, schema) → { ok, errors }
 */

// ─── Validators ─────────────────────────────────────────────────

type Validator = (value: any) => string | null;

function isString(v: any): string | null {
  return typeof v === "string" ? null : "expected string";
}

function isNumber(v: any): string | null {
  return typeof v === "number" && !isNaN(v) ? null : "expected number";
}

function isBoolean(v: any): string | null {
  return typeof v === "boolean" ? null : "expected boolean";
}

function isStringArray(v: any): string | null {
  if (!Array.isArray(v)) return "expected array";
  for (let i = 0; i < v.length; i++) {
    if (typeof v[i] !== "string") return `expected string at index ${i}`;
  }
  return null;
}

function isOptional(validator: Validator): Validator {
  return (v) => (v === undefined || v === null ? null : validator(v));
}

function minLength(min: number): Validator {
  return (v) => (typeof v === "string" && v.length >= min ? null : `minimum length ${min}`);
}

function maxLength(max: number): Validator {
  return (v) => (typeof v === "string" && v.length <= max ? null : `maximum length ${max}`);
}

function oneOf(...values: string[]): Validator {
  return (v) => (values.includes(v) ? null : `must be one of: ${values.join(", ")}`);
}

function matches(pattern: RegExp, msg?: string): Validator {
  return (v) => (typeof v === "string" && pattern.test(v) ? null : msg || `must match ${pattern}`);
}

// ─── Schema Definition ──────────────────────────────────────────

interface FieldSchema {
  required?: boolean;
  validators: Validator[];
}

type Schema = Record<string, FieldSchema>;

// ─── Validation Result ──────────────────────────────────────────

interface ValidationError {
  field: string;
  message: string;
}

interface ValidationResult {
  ok: boolean;
  errors: ValidationError[];
}

// ─── Core Validator ─────────────────────────────────────────────

export function validate(data: any, schema: Schema): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { ok: false, errors: [{ field: "(root)", message: "expected object" }] };
  }

  for (const [field, fieldSchema] of Object.entries(schema)) {
    const value = data[field];

    if (fieldSchema.required && (value === undefined || value === null)) {
      errors.push({ field, message: "is required" });
      continue;
    }

    if (value === undefined || value === null) continue;

    for (const validator of fieldSchema.validators) {
      const err = validator(value);
      if (err) {
        errors.push({ field, message: err });
        break; // first error per field
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

// ─── Pre-built Schemas ──────────────────────────────────────────

export const schemas = {
  createTask: {
    subject: { required: true, validators: [isString, minLength(1), maxLength(500)] },
    description: { required: false, validators: [isOptional(isString), isOptional(maxLength(5000))] },
    owner: { required: false, validators: [isOptional(isString), isOptional(maxLength(100))] },
    team: { required: false, validators: [isOptional(isString), isOptional(maxLength(100))] },
    blockedBy: { required: false, validators: [isOptional(isStringArray)] },
    branch: { required: false, validators: [isOptional(isString), isOptional(maxLength(200))] },
  } as Schema,

  updateTask: {
    subject: { required: false, validators: [isOptional(isString), isOptional(minLength(1)), isOptional(maxLength(500))] },
    description: { required: false, validators: [isOptional(isString), isOptional(maxLength(5000))] },
    owner: { required: false, validators: [isOptional(isString), isOptional(maxLength(100))] },
    status: { required: false, validators: [isOptional(oneOf("pending", "in_progress", "completed", "deleted"))] },
    blockedBy: { required: false, validators: [isOptional(isStringArray)] },
    branch: { required: false, validators: [isOptional(isString), isOptional(maxLength(200))] },
  } as Schema,

  createProject: {
    name: { required: true, validators: [isString, minLength(1), maxLength(200)] },
    description: { required: false, validators: [isOptional(isString), isOptional(maxLength(2000))] },
  } as Schema,

  thinkProposal: {
    oracle: { required: true, validators: [isString, minLength(1), maxLength(100)] },
    title: { required: true, validators: [isString, minLength(1), maxLength(500)] },
    type: { required: false, validators: [isOptional(oneOf("improvement", "bug", "feature", "refactor"))] },
    description: { required: false, validators: [isOptional(isString), isOptional(maxLength(5000))] },
    priority: { required: false, validators: [isOptional(oneOf("low", "medium", "high"))] },
  } as Schema,

  meetingCreate: {
    topic: { required: true, validators: [isString, minLength(1), maxLength(500)] },
    participants: { required: false, validators: [isOptional(isStringArray)] },
  } as Schema,

  meetingNote: {
    note: { required: true, validators: [isString, minLength(1), maxLength(5000)] },
    author: { required: false, validators: [isOptional(isString), isOptional(maxLength(100))] },
  } as Schema,

  inboxMessage: {
    from: { required: true, validators: [isString, minLength(1), maxLength(100)] },
    to: { required: true, validators: [isString, minLength(1), maxLength(100)] },
    subject: { required: false, validators: [isOptional(isString), isOptional(maxLength(500))] },
    body: { required: true, validators: [isString, minLength(1), maxLength(10000)] },
    tags: { required: false, validators: [isOptional(isStringArray)] },
  } as Schema,

  cronJob: {
    name: { required: false, validators: [isOptional(isString), isOptional(maxLength(200))] },
    schedule: { required: true, validators: [isString, minLength(1)] },
    prompt: { required: true, validators: [isString, minLength(1), maxLength(10000)] },
  } as Schema,

  tokenRecord: {
    agent: { required: true, validators: [isString, minLength(1)] },
    inputTokens: { required: true, validators: [isNumber] },
    outputTokens: { required: true, validators: [isNumber] },
    cost: { required: false, validators: [isOptional(isNumber)] },
  } as Schema,

  chatSend: {
    content: { required: true, validators: [isString, minLength(1), maxLength(50000)] },
    role: { required: false, validators: [isOptional(oneOf("human", "oracle", "system"))] },
  } as Schema,

  feedEvent: {
    event: { required: true, validators: [isString, minLength(1)] },
    oracle: { required: true, validators: [isString, minLength(1)] },
    host: { required: true, validators: [isString, minLength(1)] },
    message: { required: true, validators: [isString, minLength(1), maxLength(5000)] },
  } as Schema,
};

// ─── Helper: parse body + validate ──────────────────────────────

/**
 * Validate request body against schema.
 * Returns { data } on success, or { error } string on failure.
 * Usage in Hono handler:
 *   const body = await c.req.json();
 *   const check = validateBody(body, schemas.createTask);
 *   if (check.error) return c.json({ error: check.error }, 400);
 */
export function validateBody(data: any, schema: Schema): { data?: any; error?: string } {
  const result = validate(data, schema);
  if (!result.ok) {
    return { error: result.errors.map(e => `${e.field}: ${e.message}`).join("; ") };
  }
  return { data };
}

// ─── Exports ────────────────────────────────────────────────────

export {
  isString, isNumber, isBoolean, isStringArray,
  isOptional, minLength, maxLength, oneOf, matches,
};
export type { Schema, ValidationError, ValidationResult };
