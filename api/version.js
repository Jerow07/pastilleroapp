export default function handler(req, res) {
  res.status(200).json({ version: "v1.7.0" });
}
