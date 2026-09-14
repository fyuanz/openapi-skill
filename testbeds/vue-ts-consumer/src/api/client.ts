/**
 * Types mirrored from the live OpenAPI 3.1.0 documents served by
 * 127.0.0.1:18080. Group `account` contributes UserView/Address/ApiError;
 * group `business` contributes CreateOrder/UploadReceipt plus the shared
 * Address/ApiError definitions.
 */

/** `Address` — shared by UserView and CreateOrder. Both fields are required. */
export interface Address {
  city: string
  street: string
}

/** `ApiError` — unified error body returned by 404 and 400 responses. */
export interface ApiError {
  code: string
  message: string
}

/** `UserView` — `children` allows recursive nesting. */
export interface UserView {
  id: number
  name: string
  address: Address
  children: UserView[]
}

/** `CreateOrder` — request body for POST /orders. */
export interface CreateOrder {
  userId: number
  /** Minimum 1. */
  quantity: number
  shippingAddress: Address
}

/** `UploadReceipt` — response body of POST /files. */
export interface UploadReceipt {
  size: number
}

/** Every call throws this so the UI can render the documented error shape. */
export class ApiRequestError extends Error {
  readonly status: number
  readonly body: ApiError | null

  constructor(status: number, body: ApiError | null, message: string) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.body = body
  }
}

async function toApiError(response: Response): Promise<ApiError | null> {
  try {
    const parsed = (await response.json()) as Partial<ApiError>
    if (typeof parsed?.code === 'string' && typeof parsed?.message === 'string') {
      return { code: parsed.code, message: parsed.message }
    }
    return null
  } catch {
    return null
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!response.ok) {
    const body = await toApiError(response)
    throw new ApiRequestError(
      response.status,
      body,
      body ? `${body.code}: ${body.message}` : `HTTP ${response.status}`,
    )
  }
  return (await response.json()) as T
}

/** GET /users — `keyword` is optional and filters by display name. */
export function listUsers(keyword?: string): Promise<UserView[]> {
  const query = keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''
  return requestJson<UserView[]>(`/users${query}`)
}

/**
 * GET /users/{id} — returns 404 with ApiError when the id is unknown.
 * `X-Request-Id` is an optional documented request header.
 */
export function getUser(id: number, requestId?: string): Promise<UserView> {
  return requestJson<UserView>(`/users/${id}`, {
    headers: requestId ? { 'X-Request-Id': requestId } : undefined,
  })
}

/**
 * POST /orders — responds 201 with the echoed request, 400 with ApiError when
 * validation fails. The document declares bearerAuth; the sample service does
 * not enforce it, so no Authorization header is sent here.
 */
export function createOrder(payload: CreateOrder): Promise<CreateOrder> {
  return requestJson<CreateOrder>('/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

/** POST /files — multipart upload; the response only reports the byte size. */
export async function uploadFile(file: File): Promise<UploadReceipt> {
  const form = new FormData()
  form.append('file', file)
  const response = await fetch('/api/files', { method: 'POST', body: form })
  if (!response.ok) {
    const body = await toApiError(response)
    throw new ApiRequestError(
      response.status,
      body,
      body ? `${body.code}: ${body.message}` : `HTTP ${response.status}`,
    )
  }
  return (await response.json()) as UploadReceipt
}
