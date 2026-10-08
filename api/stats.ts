import { handleApiRequest } from '../mock/handler.js'

export function GET(request: Request) {
  return handleApiRequest(request)
}
