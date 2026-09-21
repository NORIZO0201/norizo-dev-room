export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const kind = req.body?.kind;
  if (kind !== 'preview' && kind !== 'production') {
    return res.status(400).json({ error: 'Invalid release intent' });
  }

  const event = {
    type: 'DEV_ROOM_RELEASE_INTENT',
    kind,
    project: String(req.body?.project || ''),
    url: String(req.body?.url || ''),
    qa: req.body?.qa || {},
    at: String(req.body?.at || new Date().toISOString())
  };

  console.log(JSON.stringify(event));

  return res.status(200).json({
    ok: true,
    event,
    message: kind === 'production'
      ? 'Production OK を記録しました。Chattyがこの承認を確認してProduction反映します。'
      : 'Preview依頼を記録しました。Chattyがこの依頼を確認してPreviewを作成します。'
  });
}
