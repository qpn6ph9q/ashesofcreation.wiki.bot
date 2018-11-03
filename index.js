const Discord = require("discord.js");
const client = new Discord.Client();
const config = require("./config.json");

function ucFirst(str) {
 return str.charAt(0).toUpperCase() + str.slice(1);
}

function setActivity() {
 client.user.setActivity(`on ${client.guilds.size} servers | +help`);
}

function uriWikiEncode(uri) {
 uri = ucFirst(uri);
 uri = uri.replace(/ /g, '_');
 uri = uri.replace(/&/g, '%26');
 uri = uri.replace(/\//g, '%2F');
 uri = uri.replace(/=/g, '%3D');
 uri = uri.replace(/\?/g, '%3F');
 return uri;
}

client.on('ready', () => {
 console.log(`Bot starting in ${client.guilds.size} servers with ${client.users.size} users`);
 setActivity();
});

client.on('guildCreate', guild => {
 console.log(`Bot joining ${guild.name} with ${guild.memberCount} members`);
 setActivity();
});

client.on('guildDelete', guild => {
 console.log(`Bot leaving ${guild.name}`);
 setActivity();
});

client.on('message', async message => {
 if (message.author.bot)
  return;

 if (message.content.indexOf(config.prefix) !== 0)
  return;

 const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
 const command = args.shift().toLowerCase();

 if (command === 'ping') {
  const m = await message.channel.send('test');
  m.edit(`Ping latency: ${m.createdTimestamp - message.createdTimestamp}ms. API Latency: ${Math.round(client.ping)}ms`);
 }
 if (command === 'search' || command === 'wiki') {
  var search = args.join(' ');
  if (search == '') {
   message.channel.send('https://ashesofcreation.wiki');
   return;
  }
  var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
  var xhr = new XMLHttpRequest();
  xhr.addEventListener('load', function() {
   var response = xhr.responseText;
   if (!response) {
    message.channel.send('https://ashesofcreation.wiki/' + uriWikiEncode(search))
     .catch(err => {
      console.log(err);
     });
    return;
   }
   var json = JSON.parse(response);
   if (!json) {
    message.channel.send('Missing response. Try again later.');
    return;
   }
   if (!json.result) {
    message.channel.send('Invalid response format. Try again later.');
    return;
   }
   if (!json.result.hits) {
    message.channel.send('No matching results. Try something else.');
    return;
   }
   if (!json.result.hits.total) {
    message.channel.send('"' + args.join(' ') + '" not found. Try something else.');
    return;
   }
   if (json.result.hits.total == 1) {
    message.channel.send('https://ashesofcreation.wiki/' + uriWikiEncode(json.result.hits.hits[0]._source.title))
     .catch(err => {
      console.log(err);
     });
    return;
   }
   var count = 1;
   json.result.hits.hits.length = command === 'search' ? 10 : 3;
   json.result.hits.hits.forEach(function(hit) {
    var m = hit.highlight.text.toString();
    m = m.replace(/<span[^>]+>([^<]+)<\/span>/g, '***$1***');
    m = m.replace(/<[^>]+>/g, '');
    m = count + ': <https://ashesofcreation.wiki/' + uriWikiEncode(hit._source.title) + ">\n..." + m + '...';
    message.channel.send(m)
     .catch(err => {
      console.log(err);
     });
    count++;
   });
  });

  search = uriWikiEncode(search);
  var query = 'https://ashesofcreation.wiki/Special:Search?cirrusDumpResult=&search=' + search;
  xhr.open("GET", query, false);
  xhr.send();
 }
 if (command === 'help') {
  message.channel.send('** ashesofcreation.wiki Discord bot **')
  message.channel.send('Concise and accurate information on Ashes of Creation from https://ashesofcreation.wiki delivered directly to your Discord!')
  message.channel.send('Commands:')
   .catch(err => {
    console.log(err);
   });
  message.channel.send('```    +wiki TEXT        - Search ashesofcreation.wiki for TEXT (top 3 results)```')
   .catch(err => {
    console.log(err);
   });
  message.channel.send('```    +search TEXT      - Search ashesofcreation.wiki for TEXT (top 10 results)```')
   .catch(err => {
    console.log(err);
   });
  message.channel.send('Join our discord! https://discord.gg/HEKx527')
   .catch(err => {
    console.log(err);
   });
  message.channel.send('Invite me to your discord! <https://goo.gl/DMB3Sr>')
   .catch(err => {
    console.log(err);
   });
 }
});
client.login(config.token);
