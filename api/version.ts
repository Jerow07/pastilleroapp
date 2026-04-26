export default function handler(req, res) {
  // Simple version endpoint for deployment verification
  res.status(200).json({ version: "v1.6.2 (16:10)" });
}
