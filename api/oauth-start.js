export default function handler(req, res) {
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.ROOT_URL + '/api/oauth-callback')}&response_type=code&scope=identify`;
  res.redirect(302, discordAuthUrl);
}
