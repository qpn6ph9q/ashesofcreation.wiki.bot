Instructions for hosting the ashesofcreation.wiki bot on your own server.

> The ashesofcreation.wiki bot uses the [discord.js](https://discord.js.org) [node.js](https://nodejs.org/) module.

# Create a bot user on Discord

- Visit Discord's [bot portal](https://discordapp.com/developers/applications/).
- Create a new application and record the **CLIENTID** number for later use.
- Create a bot for that application and record the **TOKEN** for later use.

# Install the ashesofcreation.wiki bot on your server
- Clone this repo to a folder on your server. Change directory to that folder.
```
git clone https://github.com/qpn6ph9q/ashesofcreation.wiki.bot.git
```
- Copy `config.default.json` to `config.json` then edit `config.json` to specify your **TOKEN**. Example:
```json
{ 
  "token"  : "GBDQ*********************************hxyB",
  "prefix" : "+"
}
```
- Install [node.js and discord.js](https://discordjs.guide/#/preparations/) and other dependencies on your server. Example:
```
npm init -y
npm install discord.js
npm install xmlhttprequest
npm install string-strip-html

```

# Starting the ashesofcreation.wiki bot on your server
- Run the following command in the the ashesofcreation.wiki bot folder.
```
node index.js
```

# Adding your ashesofcreation.wiki bot to a Discord server
- Specify your **CLIENTID** in the following URL to add the ashesofcreation.wiki bot to a Discord server you manage.
```
https://discordapp.com/oauth2/authorize?&client_id=CLIENTID&scope=bot&permissions=0
```
