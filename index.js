const {
    Client,
    MessageEmbed
} = require('discord.js');
const client = new Client();
const base_config = require('./config.json');
const XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
const {
    stripHtml
} = require('string-strip-html');
try {
    const topgg = require('topgg-autoposter')
    const ap = topgg(base_config.topggtoken, client);
    ap.on('posted', () => { console.log('Posted stats to top.gg'); });
}
catch(e) {
    console.error({topgg_exception: e});
}
const ucFirst = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
};
const setActivity = () => {
    client.user.setActivity(` on ${client.guilds.cache.size} discords | +help`, {
        type: 'PLAYING'
    })
};
const uriWikiEncode = (uri, fragment) => {
    uri = ucFirst(uri);
    uri = uri.replace(/ /g, '_');
    if(fragment) return `${encodeURIComponent(uri)}#${encodeURIComponent(fragment)}`;
    return encodeURIComponent(uri);
};
const THUMBNAIL_SIZE = 800;
const DESCRIPTION_SIZE = 349;
const getPageEmbed = async (title, fragment, is_redirect = false) => {
    let matches;
    if (matches = title.match(/\/?([^#]+)#(.+)$/)) {
        fragment = matches[2];
        title = matches[1];
    }
    else if (matches = title.match(/\/([^\/]+)$/))
        title = matches[1];
    title = decodeURIComponent(decodeURIComponent(title));
    if (fragment) {
        fragment = decodeURIComponent(decodeURIComponent(fragment));
        title = `${title}#${fragment}`;
    }
    const fragmentparams = fragment ? 'exsectionformat=wiki' : 'exintro=1';
    const uri = `https://ashesofcreation.wiki/api.php?action=query&format=json&prop=pageimages%7Cextracts%7Cpageprops&list=&titles=${uriWikiEncode(title)}&redirects=1&pithumbsize=${THUMBNAIL_SIZE}&formatversion=2&${fragmentparams}&redirects=1&converttitles=1`;
    const xhr = new XMLHttpRequest();
    await xhr.open('GET', uri, false);
    await xhr.send(null);
    if (xhr.readyState != 4 || xhr.status != 200)
        throw 'Page not found. Please try again later.';
    const response = xhr.responseText;
    const json = JSON.parse(response);
    if (!json || !json.query || !json.query.pages || !json.query.pages.length)
        throw 'Missing response. Try again later.';
    if (!is_redirect && json.query.redirects && json.query.redirects.length && json.query.redirects[0].to)
        return await getPageEmbed(json.query.redirects[0].to, json.query.redirects[0].tofragment, true);
    const page = json.query.pages[0];
    let page_url = `https://ashesofcreation.wiki/${uriWikiEncode(page.title)}`;
    if (fragment)
        page_url += `#${uriWikiEncode(fragment)}`;
    if (page.missing && !is_redirect && page.title) {
        const xhr = new XMLHttpRequest();
        await xhr.open('GET', page_url, false);
        xhr.setRequestHeader('Content-Type', 'text/plain;charset=iso-8859-1');
        await xhr.send(null);
        if (xhr.readyState == 4 && xhr.responseText) {
            const location = xhr.getResponseHeader('location');
            if (location)
                return await getPageEmbed(location, null, true);
	    throw 'Not found';
        }
    }
    let description = page.extract;
    let page_title = page.title;
    if (fragment) {
        const regex = new RegExp(`<span id="${fragment}">${fragment}</span>(.+?)<span id=`, 's');
        if (matches = `${description}<span id="">`.match(regex)) {
            page_title = fragment;
            description = matches[1];
        }
    }
    if (!description && page.pageprops && page.pageprops.description) description = page.pageprops.description;
    const embed = new MessageEmbed()
        .setAuthor('Ashes of Creation Wiki')
        .setTitle(page_title)
        .setColor('#e69710')
        .setURL(page_url)
        .addField(`Learn more here`, `${page_url}`);
    if (description) {
        description = stripHtml(description).result;
        if (description.length > DESCRIPTION_SIZE) description = description.substring(0, DESCRIPTION_SIZE).trim() + '...';
        embed.setDescription(description);
    }
    if (page.thumbnail && page.thumbnail.source) embed.setImage(page.thumbnail.source);
    return embed;
};
const embedPage = async (title, fragment, is_redirect = false) => {
    try {
	return await getPageEmbed(title, fragment, is_redirect);
    }
    catch(e) {
	return e;
    }
};
global.timestamp = {};
const dispatcher = async (message) => {
    if (message.author.bot) return;
    const config = message.member.guild.id in base_config ? base_config[message.member.guild.id] : base_config;
    if(config.prefix) {
        const regex = new RegExp(`^[${config.prefix}]`, 's');
        message.content = message.content.replace(regex, '+');
    }
    if (!message.content.match(/^[+]/)) return;
    if (config.bans && config.bans.includes(message.member.id)) return console.log('%s is banned', message.member.id);
    const args = message.content.split(/ +/g);
    const command = args.shift().toLowerCase();
    const cooldown = async () => {
        if (config.immune && config.immune.includes(message.member.id)) return false;
        const cd = Math.floor((config.command_cooldown - (message.createdTimestamp - global.timestamp[message.channel.id])) / 1000);
        if (config.command_cooldown && cd > 0) {
            const m = await message.channel.send(`Command cooldown is in effect. ${cd} seconds remaining`)
            return true;
        }
        global.timestamp[message.channel.id] = message.createdTimestamp;
        return false;
    };
    const ping = async () => {
        if (await cooldown()) return;
        const m = await message.channel.send('test');
        m.edit(`Ping latency: ${m.createdTimestamp - message.createdTimestamp}ms. API Latency: ${Math.round(client.ws.ping)}ms`);
    };
    const wiki = async () => {
        if (await cooldown()) return;
        const search = args.join(' ').replace(/_/g, ' ');
        if (search == '') {
            message.channel.send('https://ashesofcreation.wiki');
            return;
        }
	try {
            return message.channel.send(await getPageEmbed(search));
	}
	catch(e) {
	    console.log('no exact match found for %s: %s', search, e);
	}
        //const query = `https://ashesofcreation.wiki/Special:Search?cirrusDumpResult=&search=${uriWikiEncode(search)}`;
	const query = `https://ashesofcreation.wiki/api.php?action=query&format=json&prop=&list=search&srsearch=${uriWikiEncode(search)}&formatversion=2&&srprop=size%7Cwordcount%7Ctimestamp%7Csnippet%7Csectiontitle%7Csectionsnippet&srenablerewrites=1`;
	const xhr = new XMLHttpRequest();
        await xhr.open('GET', query, false);
        xhr.setRequestHeader('Content-Type', 'text/plain;charset=iso-8859-1');
        await xhr.send(null);
        if (xhr.readyState != 4)
            return message.channel.send('Page not found. Please try again later.');
        const response = xhr.responseText;
        if (!response)
            return message.channel.send(await embedPage(search)).catch(err => {
                console.error(err);
            });
        let location = xhr.getResponseHeader('location');
        if (location)
            return message.channel.send(await embedPage(location));
        const json = JSON.parse(response);
        if (!json || !json.query || !json.query.search)
            return message.channel.send('Missing response. Try again later.');
        const result = json.query.search;
        if (!result)
            return message.channel.send('Invalid response format. Try again later.');
        if (!result.length)
            return message.channel.send('No matching results. Try something else.');
	// console.log(JSON.stringify(result, null, 4));
        if (result.length == 1) {
            return message.channel.send(await embedPage(result[0].title, result[0].sectiontitle)).catch(err => {
                console.error(err);
            });
	}
        result.length = 3;
        const embed = new MessageEmbed().setTitle(`Ashes of Creation Wiki search results`).setColor('#e69710');
        let count = 1;
        for (const hit of result) {
            if (!hit || !hit.title) continue;
            let m = hit.snippet.toString();
            m = m.replace(/<span[^>]+>([^<]+)<\/span>/g, '***$1***');
            m = m.replace(/\uE000([^\uE001]+)\uE001/g, '***$1***');
            m = m.replace(/<[^>]+>/g, '');
	    m = m.replace(/&quot;/g, '"');
            m = m.replace(/&amp;/g, '&');
            embed.addField(`${count}: <https://ashesofcreation.wiki/${uriWikiEncode(hit.title, hit.sectiontitle)}>`, `...${m}...`);
            count++;
        };
        message.channel.send(count == 1 ? 'Something went wrong. Try again later.' : embed).catch(err => {
            console.error(err);
        });
    };
    const random = async () => {
        if (await cooldown()) return;
        const xhr = new XMLHttpRequest();
        const category = ucFirst(args.join('_').replace(/ /g, '_'));
        if (category)
            await xhr.open('GET', `https://ashesofcreation.wiki/Special:RandomArticleInCategory/${category}`, false);
        else
            await xhr.open('GET', 'https://ashesofcreation.wiki/Special:Random', false);
        await xhr.setRequestHeader('Content-Type', 'text/plain;charset=iso-8859-1');
        await xhr.send(null);
        let location = xhr.getResponseHeader('location');
        if (!location && !category.match(/s$/i)) {
            await xhr.open('GET', `https://ashesofcreation.wiki/Special:RandomArticleInCategory/${category}s`, false);
            await xhr.send(null);
            location = xhr.getResponseHeader('location');
        }
        message.channel.send(location ? await embedPage(location) : 'Random page not available. Try again later.');
    };
    const quiz = async () => {
        if (await cooldown()) return;
        message.channel.send('https://quiz.ashesofcreation.wiki/quiz_list_guest/');
    };
    const help = async () => {
        if (await cooldown()) return;
	const prefix = config.prefix ? config.prefix : '+';
        const embed = new MessageEmbed()
            .setTitle(`** ashesofcreation.wiki Discord bot **`)
            .setColor('#e69710')
            .setDescription('Concise and accurate information on Ashes of Creation from https://ashesofcreation.wiki delivered directly to your Discord!')
            .addField(`\`\`${prefix}wiki TEXT\`\``, `Search ashesofcreation.wiki for TEXT (top 3 results)`)
            .addField(`\`\`${prefix}random\`\``, `Random article from ashesofcreation.wiki`)
            .addField(`\`\`${prefix}random CATEGORY\`\``, `Random article in CATEGORY`)
            .addField(`\`\`${prefix}quiz\`\``, `Take the Ashes of Creation Trivianator quiz`)
            .addField('Join our discord!', 'https://discord.gg/HEKx527')
            .addField('Invite me to your discord!', 'https://goo.gl/DMB3Sr')
	    .addField('Vote for me at top.gg!', 'https://top.gg/bot/506608731463876628');
        if (config.command_cooldown) embed.setFooter(`Command cooldown is set to ${config.command_cooldown / 1000} seconds`);
        message.channel.send(embed).catch(err => {
            console.error(err);
        });
    };
    switch (command) {
        case "+ping":
            return await ping();
        case "+wiki":
            return await wiki();
        case "+random":
            return await random();
        case "+quiz":
            return await quiz();
        case "+help":
            return await help();
        default:
            return;
    }
};
client.on('ready', () => {
    console.log(`Bot starting in ${client.guilds.cache.size} servers with ${client.users.cache.size} users`);
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
    await dispatcher(message).catch((e) => {
        console.error({
            dispatcher: e
        });
    });
});
client.login(base_config.token);

