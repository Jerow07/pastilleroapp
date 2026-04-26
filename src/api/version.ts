export default function handler(req: any, res: any) {
  // Simple version endpoint for deployment verification
  const version = "v1.6.1 (16:03)";
  res.status(200).json({ version });
}
