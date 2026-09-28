exports.handler = async () => ({
  statusCode: 501,
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ detail: "Run backend/scripts/deploy.sh to publish Lambda code" }),
});
