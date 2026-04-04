export function okJson(obj: unknown, headers?: HeadersInit) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

export function bad(msg: string, status = 400) {
  return new Response(msg, { status });
}
