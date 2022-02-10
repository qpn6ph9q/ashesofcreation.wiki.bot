import {
    MessageEmbed
} from 'discord.js';
import { stripHtml } from 'string-strip-html';

const THUMBNAIL_SIZE = 800;
const DESCRIPTION_SIZE = 349;

export function setActivity() {
    global.client.user.setActivity(` on ${global.client.guilds.cache.size} discords | +help`, {
        type: 'PLAYING'
    })
}

export function ucFirst (str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export function uriWikiEncode (uri, fragment) {
    uri = ucFirst(uri);
    uri = uri.replace(/ /g, '_');
    if (fragment) return `${encodeURIComponent(uri)}#${encodeURIComponent(fragment)}`;
    return encodeURIComponent(uri);
}

export async function getPageEmbed (title, fragment, is_redirect = false) {
    let matches;
    if (matches = title.match(/\/?([^#]+)#(.+)$/)) {
        fragment = matches[2];
        title = matches[1];
    } else if (matches = title.match(/\/([^\/]+)$/)) title = matches[1];
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
    if (xhr.readyState != 4 || xhr.status != 200) throw 'Page not found. Please try again later.';
    const response = xhr.responseText;
    const json = JSON.parse(response);
    if (!json || !json.query || !json.query.pages || !json.query.pages.length) throw 'Missing response. Try again later.';
    if (!is_redirect && json.query.redirects && json.query.redirects.length && json.query.redirects[0].to) return await getPageEmbed(json.query.redirects[0].to, json.query.redirects[0].tofragment, true);
    const page = json.query.pages[0];
    let page_url = `https://ashesofcreation.wiki/${uriWikiEncode(page.title)}`;
    if (fragment) page_url += `#${uriWikiEncode(fragment)}`;
    if (page.missing && !is_redirect && page.title) {
        const xhr = new XMLHttpRequest();
        await xhr.open('GET', page_url, false);
        xhr.setRequestHeader('Content-Type', 'text/plain;charset=iso-8859-1');
        await xhr.send(null);
        if (xhr.readyState == 4 && xhr.responseText) {
            const location = xhr.getResponseHeader('location');
            if (location) return await getPageEmbed(location, null, true);
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
    const embed = new MessageEmbed().setAuthor('Ashes of Creation Wiki').setTitle(page_title).setColor('#e69710').setURL(page_url).addField(`Learn more here`, `${page_url}`);
    if (description) {
        description = stripHtml(description).result;
        if (description.length > DESCRIPTION_SIZE) description = description.substring(0, DESCRIPTION_SIZE).trim() + '...';
        embed.setDescription(description);
    }
    if (page.thumbnail && page.thumbnail.source) embed.setImage(page.thumbnail.source);
    return embed;
}

export async function embedPage (title, fragment, is_redirect = false) {
    try {
        return await getPageEmbed(title, fragment, is_redirect);
    } catch (e) {
        return e;
    }
}

export function prepareMessageContent (content, text) {
    if (content && typeof content === 'object') {
        switch (content?.constructor?.name) {
            case 'MessageEmbed':
                return text ? { content: text, embeds: [content] } : { embeds: [content] };
            case 'Number':
            case 'String':
            case 'undefined':
                break;
            default:
                content = content.toString();
        }
    }
    if (!content)
        return text ? { content: text } : '';
    return text ? { content: [content, text] } : { content: content };
};

export function prepareLegacyMessageContent(content) {
    content = prepareMessageContent(content);
    if (content?.constructor?.name != 'MessageEmbed')
        return content;
    content.setFooter('Wiki commands starting with + or ! will no longer work from April 2022 due to new Discord rules. Please use / commands instead.');
}

export default () => { };
