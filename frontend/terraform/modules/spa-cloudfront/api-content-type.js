function handler(event) {
  var request = event.request;
  var response = event.response;
  var isChat = request.method === "POST" && /^\/api\/v1\/courses\/[^/]+\/conversations\/[^/]+\/messages$/.test(request.uri);
  response.headers["content-type"] = {value: isChat ? "text/event-stream; charset=utf-8" : "application/json"};
  response.headers["cache-control"] = {value: "no-store"};
  return response;
}
