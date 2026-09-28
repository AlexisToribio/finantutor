function handler(event) {
  var request = event.request;
  var response = event.response;
  var uri = request.uri || "";
  var messages = "/messages";
  var isChat =
    request.method === "POST" &&
    uri.indexOf("/api/v1/conversations/") === 0 &&
    uri.lastIndexOf(messages) === uri.length - messages.length;
  response.headers["content-type"] = {
    value: isChat ? "text/event-stream; charset=utf-8" : "application/json",
  };
  response.headers["cache-control"] = { value: "no-store" };
  return response;
}
