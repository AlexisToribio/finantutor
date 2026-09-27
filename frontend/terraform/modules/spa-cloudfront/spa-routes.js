function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.indexOf(".") !== -1) {
    return request;
  }
  request.uri = "/index.html";
  return request;
}
